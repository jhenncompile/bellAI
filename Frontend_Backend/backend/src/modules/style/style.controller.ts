import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { StyleService } from './style.service';
import { FeedbackDto } from './style.dto';

@ApiTags('Estilo, recomendaciones y aprendizaje')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/style')
export class StyleController {
  constructor(private readonly service: StyleService) {}

  /** HU-007 / HU-008 */
  @Get('dna')
  dna(@CurrentUser() user: User) {
    return this.service.getDna(user);
  }

  /** HU-012 / HU-013 / HU-014 / HU-037 */
  @Get('recommendations')
  recommendations(@CurrentUser() user: User, @Query('occasion') occasion?: string, @Query('type') type?: string) {
    return this.service.recommendations(user, occasion, type);
  }

  /** HU-018 / HU-039 */
  @Post('feedback')
  feedback(@CurrentUser() user: User, @Body() dto: FeedbackDto) {
    return this.service.feedback(user, dto);
  }

  @Get('feedback')
  listFeedback(@CurrentUser() user: User, @Query('targetType') targetType?: string) {
    return this.service.listFeedback(user, targetType);
  }

  /** HU-028 */
  @Get('history')
  history(@CurrentUser() user: User, @Query('kind') kind?: string, @Query('limit') limit?: string) {
    return this.service.history(user, kind, limit ? Number(limit) : 50);
  }
}
