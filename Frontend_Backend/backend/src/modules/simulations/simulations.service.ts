import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { signMediaPath } from '../../common/media/signed-url';
import { DataSource } from 'typeorm';
import { UsageService } from '../subscriptions/usage.service';
import { randomUUID, createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { TasksService } from '../tasks/tasks.service';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { BellaiService } from '../bellai/bellai.service';
import { hasPhotoConsent, latestConsent, PHOTO_RETENTION_CONSENT } from '../diagnosis/consent.helper';

export const SIMULATION_TASK = 'simulacion';
export const SIMULATION_KINDS = ['color_cabello', 'maquillaje', 'unas', 'gafas', 'prenda'] as const;

export type TryOnRegion = 'superior' | 'inferior' | 'completo';

/** HU-022: parte del cuerpo donde se coloca una prenda del armario en el probador sobre la foto. */
export function tryOnRegion(category: string, subcategory?: string | null): TryOnRegion | null {
  if (subcategory === 'vestidos') return 'completo';
  if (category === 'superior' || category === 'abrigo') return 'superior';
  if (category === 'inferior') return 'inferior';
  return null; // calzado y accesorios todavía no se pueden probar sobre la foto
}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Catálogo base de tonos para los simuladores (se combina con la paleta de la usuaria). */
const HAIR_PRESETS = [
  { name: 'Negro natural', hex: '#1C1410' }, { name: 'Castaño oscuro', hex: '#3B2A20' }, { name: 'Castaño', hex: '#5A3B26' },
  { name: 'Cobrizo', hex: '#8E4A2B' }, { name: 'Caramelo', hex: '#A0673C' }, { name: 'Rubio miel', hex: '#C8955A' },
  { name: 'Rubio ceniza', hex: '#B8A68A' }, { name: 'Platino', hex: '#E6DCC8' }, { name: 'Borgoña', hex: '#5E1A2B' }, { name: 'Rosa pastel', hex: '#E8A0B4' },
];
const LIP_PRESETS = [
  { name: 'Nude rosado', hex: '#C98B86' }, { name: 'Rojo clásico', hex: '#B3122E' }, { name: 'Coral', hex: '#E8665A' },
  { name: 'Vino', hex: '#6D1A36' }, { name: 'Malva', hex: '#A8687A' }, { name: 'Terracota', hex: '#B5532A' },
];
const NAIL_PRESETS = [
  { name: 'Rojo', hex: '#C62828' }, { name: 'Nude', hex: '#D9B8A7' }, { name: 'Fucsia', hex: '#C2185B' },
  { name: 'Negro', hex: '#111111' }, { name: 'Lila', hex: '#B39DDB' }, { name: 'Blanco', hex: '#F5F5F5' },
];
const GLASSES_STYLES = ['redondas', 'rectangulares', 'cat-eye', 'aviador', 'oversize'];
const GLASSES_BY_FACE: Record<string, string[]> = {
  Redondo: ['rectangulares', 'cat-eye'], Cuadrado: ['redondas', 'aviador'], Ovalado: ['rectangulares', 'cat-eye', 'redondas'],
  Rectangular: ['oversize', 'redondas'], Corazon: ['aviador', 'redondas'], Diamante: ['cat-eye', 'redondas'],
};

interface SimulationInput {
  photoId: string;
  kind: string;
  options: Record<string, unknown>;
  keepPhotos: boolean;
}

/**
 * HU-019 / HU-020 / HU-021: simulaciones de cabello, maquillaje, uñas y gafas como tareas asíncronas (HU-041).
 * Se guardan original y resultado solo si la usuaria aceptó conservar fotos (HU-034).
 */
@Injectable()
export class SimulationsService implements OnModuleInit {
  constructor(
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly ai: AiGatewayService,
    private readonly tasks: TasksService,
    private readonly settings: PlatformSettingsService,
    private readonly audit: AdminAuditService,
    private readonly bellai: BellaiService,
    private readonly usage: UsageService,
  ) {}

  onModuleInit() {
    this.tasks.register(SIMULATION_TASK, (input: SimulationInput, ctx) => this.run(ctx.userId, input, ctx.progress));
  }

  async options(user: User) {
    const [row] = await this.ds.query('SELECT resultado_detallado AS d FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1', [user.id]);
    const d = row?.d || null;
    const accents = (d?.recommendations?.colors?.accents ?? []).map((c: any) => ({ name: c.name, hex: c.hex, fromPalette: true }));
    const recommended = GLASSES_BY_FACE[d?.faceShape] ?? [];
    const items = await this.ds.query(
      `SELECT id, name, category, subcategory, COALESCE(enhanced_image_url, original_image_url) AS image
       FROM wardrobe_items WHERE user_id = $1 AND COALESCE(enhanced_image_url, original_image_url) IS NOT NULL
       ORDER BY created_at DESC LIMIT 60`,
      [user.id],
    );
    const garments = items
      .map((g: any) => ({ id: g.id, name: g.name, category: g.category, region: tryOnRegion(g.category, g.subcategory), imageUrl: signMediaPath(g.image) }))
      .filter((g: any) => g.region);
    return {
      kinds: SIMULATION_KINDS,
      garment: { items: garments, note: 'Vista aproximada en 2D sobre tu foto de cuerpo entero o medio cuerpo.' },
      hair: { colors: HAIR_PRESETS, recommendedShades: d?.recommendations?.hairShades ?? [], styles: ['completo', 'balayage', 'mechas'] },
      makeup: { lips: [...accents.slice(0, 3), ...LIP_PRESETS], recommendedLipsticks: d?.recommendations?.lipsticks ?? [] },
      nails: { colors: [...accents.slice(0, 3), ...NAIL_PRESETS] },
      glasses: {
        styles: GLASSES_STYLES.map((s) => ({ style: s, recommended: recommended.includes(s) })),
        frameColors: [{ name: 'Negro', hex: '#1A1A1A' }, { name: 'Carey', hex: '#6B3E26' }, { name: 'Dorado', hex: '#C9A227' }, { name: 'Plateado', hex: '#B8BCC2' }, ...accents.slice(0, 2)],
        reason: d?.faceShape ? `Recomendadas para un rostro ${String(d.faceShape).toLowerCase()}.` : 'Haz tu análisis facial para ver las monturas que más te favorecen.',
      },
    };
  }

  async start(user: User, file: Express.Multer.File, kind: string, rawOptions?: string) {
    if (!file) throw new BadRequestException('Adjunta una foto en el campo "file".');
    if (!(SIMULATION_KINDS as readonly string[]).includes(kind)) throw new BadRequestException(`Tipo no válido. Usa: ${SIMULATION_KINDS.join(', ')}.`);
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.');
    const maxMb = await this.settings.getNumber('upload_max_mb');
    if (file.size > maxMb * 1024 * 1024) throw new BadRequestException(`La foto supera el máximo de ${maxMb} MB.`);
    if (!(await hasPhotoConsent(this.ds, user.id))) {
      throw new ForbiddenException({ code: 'consentimiento_requerido', message: 'Para simular sobre tu foto necesitamos tu autorización. Actívala en Privacidad.' });
    }
    let options: Record<string, unknown> = {};
    try {
      options = rawOptions ? JSON.parse(rawOptions) : {};
    } catch {
      throw new BadRequestException('Las opciones deben enviarse como JSON.');
    }
    if (kind === 'prenda') options = await this.garmentOptions(user, options);
    await this.usage.consume(user.id, 'simulations_month');
    await this.bellai.ensureUser(user);
    const photoId = await this.storePhoto(user.id, 'simulacion', file.buffer, file.mimetype);
    const keepPhotos = await latestConsent(this.ds, user.id, PHOTO_RETENTION_CONSENT);
    const dedupe = createHash('sha256').update(file.buffer).update(kind).update(JSON.stringify(options)).digest('hex');
    return this.tasks.enqueue(user.id, SIMULATION_TASK, { photoId, kind, options, keepPhotos } as any, dedupe);
  }

  /** HU-022: valida que la prenda sea de la usuaria y fija la región del cuerpo. */
  private async garmentOptions(user: User, options: Record<string, unknown>) {
    const garmentId = String(options.garmentId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(garmentId)) throw new BadRequestException('Elige una prenda de tu armario para probártela.');
    const [item] = await this.ds.query(
      'SELECT name, category, subcategory, enhanced_image_url AS enhanced, original_image_url AS original FROM wardrobe_items WHERE id = $1 AND user_id = $2',
      [garmentId, user.id],
    );
    if (!item) throw new NotFoundException('No encontramos esa prenda en tu armario.');
    if (!item.enhanced && !item.original) throw new BadRequestException('Esa prenda no tiene foto. Agrégale una desde tu armario.');
    const region = tryOnRegion(item.category, item.subcategory);
    if (!region) throw new BadRequestException('Por ahora el probador funciona con prendas superiores, inferiores, abrigos y vestidos.');
    return { ...options, garmentId, garmentName: item.name, region };
  }

  /** Lee la foto de la prenda desde el almacenamiento (`/uploads/wardrobe/...` → clave `wardrobe/...`). */
  private async garmentFile(userId: string, garmentId: string) {
    const [item] = await this.ds.query('SELECT enhanced_image_url AS enhanced, original_image_url AS original FROM wardrobe_items WHERE id = $1 AND user_id = $2', [garmentId, userId]);
    const url = String(item?.enhanced || item?.original || '').split('?')[0];
    const key = url.replace(/^.*?\/uploads\//, '');
    if (!key || key === url) throw new NotFoundException('La foto de la prenda ya no está disponible.');
    const ext = key.split('.').pop()?.toLowerCase() || 'jpg';
    return { buffer: await this.storage.readFile(key), mimetype: MIME_BY_EXT[ext] || 'image/jpeg', originalname: `prenda.${ext}` };
  }

  private async storePhoto(userId: string, type: string, buffer: Buffer, mime: string) {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const key = `private/${userId}/photos/${randomUUID()}.${ext}`;
    await this.storage.uploadFile({ key, buffer, contentType: mime, cacheControl: 'private, no-store' });
    const [row] = await this.ds.query(
      'INSERT INTO fotografia (usuario_id, tipo, clave_archivo, mime, tamano_bytes) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [userId, type, key, mime, buffer.length],
    );
    return row.id as string;
  }

  private async deletePhoto(userId: string, id: string) {
    const [row] = await this.ds.query('SELECT clave_archivo AS key FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
    if (!row) return;
    await this.storage.deleteFile(row.key).catch(() => undefined);
    await this.ds.query('DELETE FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
  }

  private async run(userId: string, input: SimulationInput, progress: (v: number) => Promise<void>) {
    const [photo] = await this.ds.query('SELECT clave_archivo AS key, mime FROM fotografia WHERE id = $1 AND usuario_id = $2', [input.photoId, userId]);
    if (!photo) throw new NotFoundException('La foto ya no está disponible.');
    await progress(20);
    let result: any;
    try {
      const buffer = await this.storage.readFile(photo.key);
      const extra = input.kind === 'prenda' ? { garment: await this.garmentFile(userId, String(input.options.garmentId)) } : {};
      result = await this.ai.postImage(`/api/v1/simulate/${input.kind}`, { buffer, mimetype: photo.mime }, { options: input.options }, 45_000, extra);
    } catch (err) {
      await this.deletePhoto(userId, input.photoId);
      throw err;
    }
    await progress(80);
    let simulationId: string | null = null;
    if (input.keepPhotos) {
      const resultId = await this.storePhoto(userId, 'simulacion', Buffer.from(result.imageBase64, 'base64'), 'image/jpeg');
      const [row] = await this.ds.query(
        'INSERT INTO simulacion (usuario_id, fotografia_original_id, fotografia_resultado_id, tipo, opciones) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id',
        [userId, input.photoId, resultId, input.kind, JSON.stringify({ ...input.options, meta: result.meta, modelVersion: result.modelVersion })],
      );
      simulationId = row.id;
    } else {
      await this.deletePhoto(userId, input.photoId);
    }
    await this.audit.record({ actorUserId: userId, action: 'SIMULATION_COMPLETED', entityType: 'simulacion', entityId: simulationId, changes: { kind: input.kind, saved: input.keepPhotos } });
    return { simulationId, saved: input.keepPhotos, kind: input.kind, options: input.options, meta: result.meta, modelVersion: result.modelVersion, mime: 'image/jpeg', imageBase64: result.imageBase64 };
  }

  list(user: User) {
    return this.ds.query(
      'SELECT id, tipo AS kind, opciones AS options, creada_en AS "createdAt" FROM simulacion WHERE usuario_id = $1 ORDER BY creada_en DESC LIMIT 100',
      [user.id],
    );
  }

  /** Imagen privada (original o resultado) solo para su dueña. */
  async image(user: User, id: string, which: 'original' | 'result') {
    const [row] = await this.ds.query(
      `SELECT f.clave_archivo AS key, f.mime FROM simulacion s
       JOIN fotografia f ON f.id = CASE WHEN $3 = 'original' THEN s.fotografia_original_id ELSE s.fotografia_resultado_id END
       WHERE s.id = $1 AND s.usuario_id = $2`,
      [id, user.id, which],
    );
    if (!row) throw new NotFoundException('No se encontró la simulación.');
    return { buffer: await this.storage.readFile(row.key), mime: row.mime };
  }

  async remove(user: User, id: string) {
    const [row] = await this.ds.query('SELECT fotografia_original_id AS o, fotografia_resultado_id AS r FROM simulacion WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    if (!row) throw new NotFoundException('No se encontró la simulación.');
    await this.ds.query('DELETE FROM simulacion WHERE id = $1', [id]);
    await this.deletePhoto(user.id, row.o);
    await this.deletePhoto(user.id, row.r);
    await this.audit.record({ actorUserId: user.id, action: 'SIMULATION_DELETED', entityType: 'simulacion', entityId: id });
    return { deleted: true };
  }
}
