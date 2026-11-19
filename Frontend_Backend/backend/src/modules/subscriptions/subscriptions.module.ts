import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminPaymentsController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';

/** Plan Gratis / Premium mensual, pagos con Stripe Checkout (sandbox) y topes de uso. */
@Module({
  imports: [AdminModule],
  controllers: [SubscriptionsController, AdminPaymentsController],
  providers: [SubscriptionsService, StripeService, UsageService],
  exports: [UsageService, SubscriptionsService],
})
export class SubscriptionsModule {}
