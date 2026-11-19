import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CheckoutDto {
  /** Deep link de la app al que volver tras pagar (bellai://premium o el de Expo Go). */
  @IsOptional() @IsString() @MaxLength(300)
  returnUrl?: string;
}

export class ConfirmDto {
  @IsString() @Matches(/^cs_[A-Za-z0-9_]+$/, { message: 'session_id no válido' }) @MaxLength(255)
  sessionId: string;
}
