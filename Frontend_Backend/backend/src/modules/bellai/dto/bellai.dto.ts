import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdatePhotoConsentDto {
  @IsBoolean() authorized: boolean;
  @IsString() @IsNotEmpty() @MaxLength(30) policyVersion: string;
}

export class CreateDiagnosticDto {
  @IsOptional() @IsUUID() facePhotoId?: string;
  @IsOptional() @IsUUID() bodyPhotoId?: string;
  @IsOptional() @IsString() faceShape?: string;
  @IsOptional() @IsString() skinTone?: string;
  @IsOptional() @IsString() undertone?: string;
  @IsOptional() @IsString() seasonalPalette?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsObject() proportions?: Record<string, unknown>;
  @IsOptional() @IsObject() hairFeatures?: Record<string, unknown>;
  @IsObject() details: Record<string, unknown>;
  @IsOptional() @IsArray() colorIds?: number[];
}

export class CreateConversationDto { @IsOptional() @IsString() @MaxLength(160) title?: string; }
export class SendMessageDto { @IsString() @IsNotEmpty() @MaxLength(4000) content: string; }

export class CreateOutfitDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsString() weatherSummary?: string;
  @IsOptional() @IsUUID() occasionId?: string;
  @IsArray() garmentIds: string[];
  @IsOptional() @IsBoolean() saved?: boolean;
  @IsOptional() @IsBoolean() favorite?: boolean;
}

export class CreateRecommendationDto {
  @IsIn(['color', 'corte', 'accesorio', 'maquillaje', 'outfit', 'otro']) type: string;
  @IsString() @IsNotEmpty() content: string;
  @IsString() @IsNotEmpty() explanation: string;
  @IsOptional() @IsUUID() diagnosticId?: string;
}

export class CreateSimulationDto {
  @IsUUID() originalPhotoId: string;
  @IsUUID() resultPhotoId: string;
  @IsIn(['corte_cabello', 'color_cabello', 'maquillaje', 'unas']) type: string;
  @IsOptional() @IsObject() options?: Record<string, unknown>;
}

export class UpsertAvatarDto { @IsString() @IsNotEmpty() modelKey: string; @IsOptional() @IsObject() configuration?: Record<string, unknown>; }

// ── Incorporado desde main (HU-18 motivo de recomendaciones, HU-26 historial unificado) ──

export class ExplainRecommendationDto {
  @IsIn(['outfit', 'garment', 'color', 'hair', 'makeup', 'general'])
  recommendationType: 'outfit' | 'garment' | 'color' | 'hair' | 'makeup' | 'general';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  occasion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  garmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recommendationText?: string;
}

export class SendAdvisorMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @IsIn(['all', 'diagnostic', 'outfit', 'consultation'])
  type?: 'all' | 'diagnostic' | 'outfit' | 'consultation';
}
