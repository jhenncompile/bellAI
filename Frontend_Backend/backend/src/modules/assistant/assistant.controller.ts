import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AssistantService } from './assistant.service';

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  content: string;
}

class ConversationDto {
  @IsOptional() @IsString() @MaxLength(160)
  title?: string;
}

class ExplainDto {
  @IsIn(['recomendacion', 'outfit', 'compatibilidad', 'diagnostico', 'compra', 'simulacion'])
  kind: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional() @IsString() @MaxLength(500)
  question?: string;
}

@ApiTags('Asistente conversacional')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Get('conversations')
  list(@CurrentUser() user: User) {
    return this.service.listConversations(user);
  }

  @Post('conversations')
  create(@CurrentUser() user: User, @Body() dto: ConversationDto) {
    return this.service.createConversation(user, dto.title);
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getConversation(user, id);
  }

  @Delete('conversations/:id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteConversation(user, id);
  }

  @Post('conversations/:id/messages')
  send(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.service.sendMessage(user, id, dto.content);
  }

  /** Server-Sent Events: eventos `message`, `token` y `done`. */
  @Post('conversations/:id/messages/stream')
  async stream(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      await this.service.streamMessage(user, id, dto.content, emit, controller.signal);
    } catch (err: any) {
      const body = typeof err?.getResponse === 'function' ? err.getResponse() : null;
      emit('error', {
        message: (body && typeof body === 'object' && (body as any).message) || err?.message || 'No pudimos responder ahora.',
        ...(body && typeof body === 'object' && (body as any).code ? { code: (body as any).code, feature: (body as any).feature, limit: (body as any).limit } : {}),
      });
    } finally {
      res.end();
    }
  }

  /** HU-042 */
  @Post('explain')
  explain(@CurrentUser() user: User, @Body() dto: ExplainDto) {
    return this.service.explain(user, dto.kind, dto.data, dto.question);
  }
}

/** Compatibilidad con la ruta que usa la app móvil actual. */
@ApiTags('Asistente conversacional')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/bellai/conversations')
export class LegacyConversationController {
  constructor(private readonly service: AssistantService) {}

  /** Contrato de la app móvil de main (HU-26): conversación con sus mensajes y `role` user/assistant. */
  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const conv: any = await this.service.getConversation(user, id);
    return {
      ...conv,
      messages: (conv.messages || []).map((m: any) => ({ ...m, role: m.sender === 'usuaria' ? 'user' : 'assistant' })),
    };
  }

  @Post(':id/messages')
  send(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.service.sendMessage(user, id, dto.content);
  }
}
