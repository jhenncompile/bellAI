import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.trim() === '') {
    throw new Error('Falta la variable de configuración JWT_SECRET');
  }
  return secret;
}
