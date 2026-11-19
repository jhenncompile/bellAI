import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CheckoutSessionInput {
  paymentId: string;
  userId: string;
  email?: string;
  amountCents: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionInfo {
  id: string;
  url: string | null;
  paymentStatus: string;
  status: string | null;
}

/**
 * Envoltorio mínimo de Stripe Checkout. Con una clave `sk_test_...` todo corre en el
 * sandbox de Stripe: se paga con tarjetas de prueba y no se mueve dinero real.
 */
@Injectable()
export class StripeService {
  private client: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  isTestMode(): boolean {
    return String(this.config.get<string>('STRIPE_SECRET_KEY') || '').startsWith('sk_test_');
  }

  private stripe(): Stripe {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new ServiceUnavailableException('Los pagos no están configurados. Falta STRIPE_SECRET_KEY en el backend.');
    if (!this.client) this.client = new Stripe(key);
    return this.client;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionInfo> {
    const stripe = this.stripe();
    const session = await this.call(() => stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amountCents,
            product_data: { name: input.productName },
          },
        },
      ],
      customer_email: input.email,
      client_reference_id: input.userId,
      metadata: { paymentId: input.paymentId, userId: input.userId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }));
    return toInfo(session);
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSessionInfo> {
    const stripe = this.stripe();
    return toInfo(await this.call(() => stripe.checkout.sessions.retrieve(sessionId)));
  }

  /**
   * Los errores de Stripe (clave inválida, red, etc.) salen como 502: un 401 de Stripe
   * no debe confundirse con una sesión vencida de la app, que cerraría la sesión.
   */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      this.logger.error(`Stripe: ${err?.type ?? 'error'} ${err?.message ?? ''}`);
      throw new BadGatewayException('No pudimos conectar con la pasarela de pagos. Inténtalo de nuevo en unos minutos.');
    }
  }

  /** Verifica la firma del webhook con STRIPE_WEBHOOK_SECRET. Lanza si no es válida. */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Falta STRIPE_WEBHOOK_SECRET en el backend.');
    return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
  }
}

function toInfo(session: Stripe.Checkout.Session): CheckoutSessionInfo {
  return { id: session.id, url: session.url, paymentStatus: session.payment_status, status: session.status };
}
