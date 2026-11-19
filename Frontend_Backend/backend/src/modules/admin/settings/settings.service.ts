import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from '../entities/platform-setting.entity';
import { AuditLog } from '../../privacy/entities/audit-log.entity';

export type SettingValue = boolean | number | string;

interface SettingDefinition {
  type: 'boolean' | 'number' | 'string';
  default: SettingValue;
  group: 'plataforma' | 'fotografias' | 'ia';
  label: string;
  description: string;
  min?: number;
  max?: number;
  options?: string[];
}

/**
 * HU-030: catálogo de configuraciones administrables. Los umbrales de fotografía se envían
 * al servicio de IA en cada validación (HU-035); el resto controla la cola y el asistente.
 */
export const SETTINGS_SCHEMA = {
  maintenance_mode: { type: 'boolean', default: false, group: 'plataforma', label: 'Modo mantenimiento', description: 'Bloquea temporalmente el acceso de las usuarias a la plataforma.' },
  user_creation_enabled: { type: 'boolean', default: true, group: 'plataforma', label: 'Registro de usuarias', description: 'Permite crear cuentas nuevas desde la app y el panel.' },
  storage_quota_gb: { type: 'number', default: 20, min: 0.0001, max: 10000, group: 'plataforma', label: 'Cuota de almacenamiento (GB)', description: 'Al superar el 90 % se genera una alerta para el administrador.' },
  upload_max_mb: { type: 'number', default: 8, min: 1, max: 20, group: 'plataforma', label: 'Tamaño máximo de foto (MB)', description: 'Límite de tamaño para fotografías subidas por las usuarias.' },
  photo_min_short_side_px: { type: 'number', default: 480, min: 240, max: 2000, group: 'fotografias', label: 'Resolución mínima (px)', description: 'Lado corto mínimo de una foto para analizarla.' },
  photo_min_brightness: { type: 'number', default: 70, min: 0, max: 255, group: 'fotografias', label: 'Brillo mínimo', description: 'Media de luminosidad (0-255) por debajo de la cual la foto se considera oscura.' },
  photo_max_brightness: { type: 'number', default: 210, min: 0, max: 255, group: 'fotografias', label: 'Brillo máximo', description: 'Media de luminosidad por encima de la cual la foto se considera sobreexpuesta.' },
  photo_min_sharpness: { type: 'number', default: 45, min: 1, max: 1000, group: 'fotografias', label: 'Nitidez mínima', description: 'Varianza del laplaciano; valores menores indican foto borrosa.' },
  photo_face_max_yaw: { type: 'number', default: 0.12, min: 0.02, max: 0.5, group: 'fotografias', label: 'Giro máximo del rostro', description: 'Tolerancia de giro lateral del rostro (0 = completamente de frente).' },
  photo_face_max_side_light: { type: 'number', default: 28, min: 5, max: 80, group: 'fotografias', label: 'Diferencia máxima de luz entre mejillas', description: 'Diferencia de luminosidad (L*, 0-100) entre ambas mejillas; por encima se pide luz de frente.' },
  ai_queue_concurrency: { type: 'number', default: 2, min: 1, max: 16, group: 'ia', label: 'Tareas de IA simultáneas', description: 'Número de análisis que se procesan a la vez en la cola.' },
  ai_task_timeout_s: { type: 'number', default: 90, min: 10, max: 600, group: 'ia', label: 'Tiempo máximo por tarea (s)', description: 'Tras este tiempo la tarea se marca como fallida y puede reintentarse.' },
  llm_provider: { type: 'string', default: 'kimi', options: ['kimi', 'ollama'], group: 'ia', label: 'Proveedor del asistente', description: 'kimi: API de Kimi (Moonshot), necesita KIMI_API_KEY en el servidor y envía a Moonshot el resumen de estilo de la usuaria (nunca fotos, nombre ni correo). ollama: modelo local, nada sale del servidor. Sin clave de Kimi se usa Ollama.' },
  kimi_model: { type: 'string', default: 'kimi-k3.1-pro', group: 'ia', label: 'Modelo de Kimi', description: 'Modelo de la API de Kimi (p. ej. kimi-k3.1-pro, kimi-k3.1-pro-highspeed o kimi-k3).' },
  kimi_reasoning_effort: { type: 'string', default: 'low', options: ['low', 'high', 'max'], group: 'ia', label: 'Razonamiento de Kimi', description: 'Cuánto piensa Kimi antes de responder. low: más rápido y barato, suficiente para asesoría de imagen.' },
  llm_model: { type: 'string', default: 'llama3:8b-instruct-q4_K_M', group: 'ia', label: 'Modelo local (Ollama)', description: 'Modelo de Ollama que se usa con el proveedor «ollama» o cuando no hay clave de Kimi.' },
  llm_enabled: { type: 'boolean', default: true, group: 'ia', label: 'Asistente con modelo de lenguaje', description: 'Si se desactiva, el asistente responde con reglas sin modelo de lenguaje.' },
} satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export const VALID_SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

export interface PublicSetting extends Omit<SettingDefinition, 'default'> {
  key: SettingKey;
  value: SettingValue;
  defaultValue: SettingValue;
  updatedAt: string;
}

/** Mapea los ajustes de fotografía a los nombres de umbral del servicio de IA. */
const PHOTO_THRESHOLD_MAP: Partial<Record<SettingKey, string>> = {
  photo_min_short_side_px: 'min_short_side_px',
  photo_min_brightness: 'min_brightness',
  photo_max_brightness: 'max_brightness',
  photo_min_sharpness: 'min_sharpness',
  photo_face_max_yaw: 'face_max_yaw',
  photo_face_max_side_light: 'face_max_side_light_diff',
};

@Injectable()
export class PlatformSettingsService {
  private cache: { at: number; values: Map<string, SettingValue> } | null = null;

  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingRepository: Repository<PlatformSetting>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private definition(key: string): SettingDefinition {
    const def = (SETTINGS_SCHEMA as Record<string, SettingDefinition>)[key];
    if (!def) throw new NotFoundException(`Configuración '${key}' no encontrada`);
    return def;
  }

  private coerce(key: string, raw: unknown): SettingValue {
    const def = this.definition(key);
    if (def.type === 'boolean') return typeof raw === 'boolean' ? raw : Boolean(def.default);
    if (def.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : (def.default as number);
    }
    if (typeof raw !== 'string' || !raw.length) return def.default as string;
    return def.options && !def.options.includes(raw) ? (def.default as string) : raw;
  }

  private async loadAll(): Promise<Map<string, SettingValue>> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.values;
    const records = await this.settingRepository.find();
    const values = new Map<string, SettingValue>();
    for (const r of records) if (r.key in SETTINGS_SCHEMA) values.set(r.key, this.coerce(r.key, r.value));
    this.cache = { at: Date.now(), values };
    return values;
  }

  async getAllSettings(): Promise<PublicSetting[]> {
    const records = await this.settingRepository.find();
    const map = new Map(records.map((r) => [r.key, r]));
    return VALID_SETTING_KEYS.map((key) => {
      const { default: defaultValue, ...def } = this.definition(key);
      const record = map.get(key);
      return {
        key,
        ...def,
        value: record ? this.coerce(key, record.value) : defaultValue,
        defaultValue,
        updatedAt: record?.updatedAt ? record.updatedAt.toISOString() : new Date(0).toISOString(),
      };
    });
  }

  async get<T extends SettingValue = SettingValue>(key: SettingKey): Promise<T> {
    const values = await this.loadAll();
    return (values.has(key) ? values.get(key) : this.definition(key).default) as T;
  }

  async getBoolean(key: SettingKey): Promise<boolean> {
    return Boolean(await this.get(key));
  }

  async getNumber(key: SettingKey): Promise<number> {
    return Number(await this.get(key));
  }

  /** Umbrales para el validador de fotos del servicio de IA (HU-035). */
  async getPhotoThresholds(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [key, aiName] of Object.entries(PHOTO_THRESHOLD_MAP)) {
      out[aiName as string] = await this.getNumber(key as SettingKey);
    }
    return out;
  }

  async updateSetting(
    key: string,
    value: unknown,
    userId: string,
    ipAddress?: string,
  ): Promise<PublicSetting> {
    const def = this.definition(key);
    if (def.type === 'boolean' && typeof value !== 'boolean') {
      throw new BadRequestException('El valor de la configuración debe ser verdadero o falso');
    }
    if (def.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException('El valor de la configuración debe ser numérico');
      }
      if ((def.min !== undefined && value < def.min) || (def.max !== undefined && value > def.max)) {
        throw new BadRequestException(`El valor debe estar entre ${def.min} y ${def.max}`);
      }
    }
    if (def.type === 'string' && (typeof value !== 'string' || !value.trim() || value.length > 120)) {
      throw new BadRequestException('El valor de la configuración debe ser un texto de 1 a 120 caracteres');
    }
    if (def.type === 'string' && def.options && !def.options.includes(value as string)) {
      throw new BadRequestException(`El valor debe ser uno de: ${def.options.join(', ')}`);
    }

    let record = await this.settingRepository.findOne({ where: { key } });
    const previousValue = record ? this.coerce(key, record.value) : def.default;
    if (!record) {
      record = this.settingRepository.create({ key, value: value as any, updatedBy: userId });
    } else {
      record.value = value as any;
      record.updatedBy = userId;
    }
    const saved = await this.settingRepository.save(record);
    this.cache = null;

    try {
      await this.auditLogRepository.save(this.auditLogRepository.create({
        userId,
        action: 'PLATFORM_SETTING_UPDATED',
        entityType: 'platform_setting',
        entityId: key,
        details: { previousValue, newValue: value },
        success: true,
        ipAddress: ipAddress || '127.0.0.1',
      }));
    } catch {
      // No bloquear la respuesta si la auditoría falla
    }

    const { default: defaultValue, ...rest } = def;
    return {
      key: key as SettingKey,
      ...rest,
      value: this.coerce(key, saved.value),
      defaultValue,
      updatedAt: saved.updatedAt ? saved.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
