import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production' && !rawKey) {
      throw new Error('ENCRYPTION_KEY es obligatoria en producción para el cifrado AES-256-GCM.');
    }
    const resolvedKey = rawKey || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Asegurar 32 bytes de clave para AES-256
    this.key = Buffer.from(resolvedKey.slice(0, 64), 'hex');
    if (this.key.length !== 32) {
      this.key = crypto.createHash('sha256').update(resolvedKey).digest();
    }
  }

  /**
   * Cifra un texto plano utilizando AES-256-GCM con IV dinámico de 16 bytes y Auth Tag.
   * Formato resultante: "ivHex:authTagHex:encryptedHex"
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      throw new Error(`Fallo en el cifrado de datos: ${(error as Error).message}`);
    }
  }

  /**
   * Descifra un payload cifrado en formato "ivHex:authTagHex:encryptedHex"
   */
  decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.includes(':')) return cipherText || '';
    try {
      const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return cipherText;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Si falla o no estaba cifrado, retorna seguro
      return cipherText;
    }
  }

  /**
   * Enmascara un correo electrónico para logs o vistas públicas.
   * Ejemplo: "valeria@bellia.com" -> "va****a@bellia.com"
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    const visibleStart = local.substring(0, 2);
    const visibleEnd = local.substring(local.length - 1);
    const masked = '*'.repeat(Math.max(local.length - 3, 3));
    return `${visibleStart}${masked}${visibleEnd}@${domain}`;
  }

  /**
   * Enmascara un número de teléfono.
   * Ejemplo: "+591 71234567" -> "+591 7***67"
   */
  maskPhone(phone: string): string {
    if (!phone) return '';
    const clean = phone.trim();
    if (clean.length <= 4) return '***' + clean.slice(-1);
    const start = clean.slice(0, Math.min(6, Math.floor(clean.length / 2)));
    const end = clean.slice(-2);
    return `${start}***${end}`;
  }

  /**
   * Genera un hash anónimo SHA-256 (para registrar IPs bajo GDPR sin almacenar la IP real).
   */
  hashAnonymize(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
