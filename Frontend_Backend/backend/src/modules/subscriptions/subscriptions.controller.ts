import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CheckoutDto, ConfirmDto } from './dto/subscriptions.dto';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Suscripciones')
@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly stripe: StripeService,
  ) {}

  /** Plan efectivo, vencimiento, precio, topes y uso actual. */
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.service.status(user.id);
  }

  /** Crea la sesión de Stripe Checkout (Bs 49 · 30 días) y devuelve la URL de pago. */
  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.service.createCheckout(user, dto.returnUrl);
  }

  /** Respaldo del webhook: la app lo llama al volver del pago. */
  @Post('confirm')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  confirm(@CurrentUser() user: User, @Body() dto: ConfirmDto) {
    return this.service.confirm(user, dto.sessionId);
  }

  /** Pública a propósito: Stripe redirige aquí el navegador y esta página devuelve a la app. */
  @Get('return')
  @ApiExcludeEndpoint()
  returnToApp(@Query('status') status: string, @Query('session_id') sessionId: string, @Query('app') app: string, @Res() res: Response) {
    const { html } = this.service.returnPage(status, sessionId, app);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // La página lleva un <meta refresh> al deep link de la app; Helmet bloquea los scripts en línea.
    res.status(200).send(html);
  }

  /** Pública a propósito: la autenticidad se comprueba con la firma `Stripe-Signature`. */
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody || !signature) throw new BadRequestException('Falta la firma de Stripe.');
    let event;
    try {
      event = this.stripe.constructEvent(req.rawBody, signature);
    } catch (err: any) {
      if (err?.status) throw err;
      throw new BadRequestException(`Firma de Stripe no válida: ${err?.message ?? 'error'}`);
    }
    return this.service.handleEvent(event);
  }
}

@ApiTags('Suscripciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('api/admin/payments')
export class AdminPaymentsController {
  constructor(private readonly service: SubscriptionsService) {}

  /** Pagos recientes, suscriptores activos e ingresos del mes. */
  @Get()
  overview() {
    return this.service.adminOverview();
  }
}
