import { IsNotEmpty, IsBoolean, IsString, IsOptional } from 'class-validator';

export class UpdateConsentDto {
  @IsNotEmpty({ message: 'El tipo de consentimiento es obligatorio' })
  @IsString()
  consentType: string;

  @IsNotEmpty({ message: 'El estado de aceptación es obligatorio' })
  @IsBoolean()
  accepted: boolean;

  @IsOptional()
  @IsString()
  policyVersion?: string;
}
