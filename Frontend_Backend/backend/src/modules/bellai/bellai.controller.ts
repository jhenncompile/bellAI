import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { BellaiService, HistoryItemType } from './bellai.service';
import { CreateDiagnosticDto, CreateOutfitDto, CreateRecommendationDto, CreateSimulationDto, ExplainRecommendationDto, HistoryQueryDto, SendMessageDto, UpdatePhotoConsentDto, UpsertAvatarDto } from './dto/bellai.dto';

const HISTORY_TYPES: HistoryItemType[] = ['diagnostic', 'outfit', 'consultation'];
function historyType(t: string): HistoryItemType {
  if (!HISTORY_TYPES.includes(t as HistoryItemType)) throw new BadRequestException('Tipo de historial no válido.');
  return t as HistoryItemType;
}

@UseGuards(JwtAuthGuard)
@Controller('api/bellai')
export class BellaiController {
  constructor(private readonly service: BellaiService) {}
  @Get('photo-consent') getPhotoConsent(@CurrentUser() user: User) { return this.service.getPhotoConsent(user); }
  @Patch('photo-consent') setPhotoConsent(@CurrentUser() user: User, @Body() dto: UpdatePhotoConsentDto) { return this.service.setPhotoConsent(user, dto.authorized, dto.policyVersion); }
  @Get('photos') listPhotos(@CurrentUser() user: User) { return this.service.listPhotos(user); }
  @Post('photos')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  createPhoto(@CurrentUser() user: User, @Body('type') type: string, @UploadedFile() file: Express.Multer.File) { return this.service.createPhoto(user, type, file); }
  @Get('diagnostics') listDiagnostics(@CurrentUser() user: User) { return this.service.listDiagnostics(user); }
  @Post('diagnostics') createDiagnostic(@CurrentUser() user: User, @Body() dto: CreateDiagnosticDto) { return this.service.createDiagnostic(user, dto); }
  @Get('conversations') listConversations(@CurrentUser() user: User) { return this.service.listConversations(user); }
  @Post('conversations') createConversation(@CurrentUser() user: User, @Body('title') title: string) { return this.service.createConversation(user, title); }
  // POST conversations/:id/messages lo atiende AssistantModule (LLM local, HU-026)
  @Get('outfits') listOutfits(@CurrentUser() user: User) { return this.service.listOutfits(user); }
  @Post('outfits') createOutfit(@CurrentUser() user: User, @Body() dto: CreateOutfitDto) { return this.service.createOutfit(user, dto); }
  @Get('recommendations') listRecommendations(@CurrentUser() user: User) { return this.service.listRecommendations(user); }
  @Post('recommendations') createRecommendation(@CurrentUser() user: User, @Body() dto: CreateRecommendationDto) { return this.service.createRecommendation(user, dto); }
  @Get('challenges/active') getActiveChallenge(@CurrentUser() user: User) { return this.service.getActiveChallenge(user); }
  @Patch('challenges/tasks/:taskId') toggleTask(@CurrentUser() user: User, @Param('taskId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Esa tarea no existe.') })) taskId: string, @Body('completed') completed: boolean) { return this.service.toggleChallengeTask(user, taskId, completed); }
  @Get('simulations') listSimulations(@CurrentUser() user: User) { return this.service.listSimulations(user); }
  @Post('simulations') createSimulation(@CurrentUser() user: User, @Body() dto: CreateSimulationDto) { return this.service.createSimulation(user, dto); }
  @Get('avatar') getAvatar(@CurrentUser() user: User) { return this.service.getAvatar(user); }
  @Post('avatar') upsertAvatar(@CurrentUser() user: User, @Body() dto: UpsertAvatarDto) { return this.service.upsertAvatar(user, dto); }

  // ── Incorporado desde main (contrato de la app móvil de main) ──
  @Post('recommendations/explain') explainRecommendation(@CurrentUser() user: User, @Body() dto: ExplainRecommendationDto) { return this.service.explainRecommendation(user, dto); }
  @Get('history') getHistory(@CurrentUser() user: User, @Query() query: HistoryQueryDto) { return this.service.getHistory(user, query.type || 'all'); }
  @Get('history/:type/:id') getHistoryItem(@CurrentUser() user: User, @Param('type') type: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.getHistoryItem(user, historyType(type), id); }
  @Delete('history/:type/:id') deleteHistoryItem(@CurrentUser() user: User, @Param('type') type: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.deleteHistoryItem(user, historyType(type), id); }
}
