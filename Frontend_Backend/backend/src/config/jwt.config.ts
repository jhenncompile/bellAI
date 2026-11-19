import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Configuración JWT compartida por `JwtModule` (firma) y `JwtStrategy` (verificación).
 *
 * Ambos deben leer el secreto desde `ConfigService` (después de cargar `.env`), nunca de
 * `process.env` al importar el módulo: así firma y verificación usan siempre el mismo valor.
 *
 * Ya no existe un secreto de respaldo escrito en el código: con un valor público cualquiera
 * podría firmar tokens válidos (incluso de administradora).
 * - En producción, sin `JWT_SECRET` el servidor no arranca.
 * - En desarrollo se genera un secreto aleatorio temporal y se avisa en el log; las sesiones
 *   se invalidan al reiniciar el servidor.
 */

const MIN_SECRET_LENGTH = 16;
let temporaryDevSecret: string | null = null;

export function resolveJwtSecret(value: string | undefined): string {
  if (value && value.trim().length >= MIN_SECRET_LENGTH) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `JWT_SECRET es obligatorio en producción y debe tener al menos ${MIN_SECRET_LENGTH} caracteres.`,
    );
  }

  if (!temporaryDevSecret) {
    temporaryDevSecret = randomBytes(48).toString('hex');
    new Logger('JwtConfig').warn(
      'JWT_SECRET no está definido (o es muy corto): se usa un secreto aleatorio temporal. ' +
        'Las sesiones se cerrarán al reiniciar el servidor. Defínelo en backend/.env.',
    );
  }
  return temporaryDevSecret;
}

/** Duración de la sesión. Por defecto 7 días, como hasta ahora. */
export function resolveJwtExpiresIn(value: string | undefined): string {
  return value?.trim() || '7d';
}
