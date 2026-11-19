import { Body, Controller, Delete, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';

/** Registro del token de notificaciones push del teléfono (app móvil). */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** Body: { token: "ExponentPushToken[…]", platform: "android" | "ios" } */
  @Post('push-token')
  @HttpCode(200)
  register(@CurrentUser() user: User, @Body('token') token: unknown, @Body('platform') platform: unknown) {
    return this.service.register(user.id, token, platform);
  }

  /** Al cerrar sesión o desactivar las notificaciones. Body: { token } */
  @Delete('push-token')
  unregister(@CurrentUser() user: User, @Body('token') token: unknown) {
    return this.service.unregister(user.id, token);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
