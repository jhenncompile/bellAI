import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export const WARDROBE_CATEGORIES = [
  'superior',
  'inferior',
  'calzado',
  'abrigo',
  'accesorio',
] as const;
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const DEFAULT_SUBCATEGORY_BY_CATEGORY: Record<
  WardrobeCategory,
  WardrobeSubcategory
> = {
  superior: 'blusas',
  inferior: 'pantalones',
  calzado: 'zapatillas',
  abrigo: 'chaquetas',
  accesorio: 'bolsos',
};

export const WARDROBE_SUBCATEGORIES = [
  'blusas',
  'camisas',
  'camisetas',
  'tops',
  'vestidos',
  'pantalones',
  'jeans',
  'faldas',
  'shorts',
  'chaquetas',
  'abrigos',
  'sueteres',
  'blazers',
  'zapatillas',
  'tacones',
  'botas',
  'sandalias',
  'bolsos',
  'cinturones',
  'joyeria',
  'sombreros',
  'bufandas',
  'lentes',
  'relojes',
  'otros',
] as const;
export type WardrobeSubcategory = (typeof WARDROBE_SUBCATEGORIES)[number];

export const WARDROBE_OCCASIONS = [
  'casual',
  'formal',
  'fiesta',
  'deporte',
  'trabajo',
  'playa',
  'gala',
] as const;
export type WardrobeOccasion = (typeof WARDROBE_OCCASIONS)[number];

export const WARDROBE_SEASONS = [
  'primavera',
  'verano',
  'otono',
  'invierno',
  'todo_el_ano',
] as const;
export type WardrobeSeason = (typeof WARDROBE_SEASONS)[number];

export const WARDROBE_CAPTURE_SOURCES = ['camera', 'gallery'] as const;
export type WardrobeCaptureSource = (typeof WARDROBE_CAPTURE_SOURCES)[number];

export const WARDROBE_STATUSES = ['draft', 'processing', 'confirmed', 'upload_failed'] as const;
export type WardrobeStatus = (typeof WARDROBE_STATUSES)[number];

export const SUBCATEGORY_TO_CATEGORY: Record<WardrobeSubcategory, WardrobeCategory> = {
  blusas: 'superior',
  camisas: 'superior',
  camisetas: 'superior',
  tops: 'superior',
  vestidos: 'superior',
  pantalones: 'inferior',
  jeans: 'inferior',
  faldas: 'inferior',
  shorts: 'inferior',
  chaquetas: 'abrigo',
  abrigos: 'abrigo',
  sueteres: 'abrigo',
  blazers: 'abrigo',
  zapatillas: 'calzado',
  tacones: 'calzado',
  botas: 'calzado',
  sandalias: 'calzado',
  bolsos: 'accesorio',
  cinturones: 'accesorio',
  joyeria: 'accesorio',
  sombreros: 'accesorio',
  bufandas: 'accesorio',
  lentes: 'accesorio',
  relojes: 'accesorio',
  otros: 'superior',
};

export const SUBCATEGORY_LABELS: Record<WardrobeSubcategory, string> = {
  blusas: 'Blusas',
  camisas: 'Camisas',
  camisetas: 'Camisetas',
  tops: 'Tops',
  vestidos: 'Vestidos',
  pantalones: 'Pantalones',
  jeans: 'Jeans',
  faldas: 'Faldas',
  shorts: 'Shorts',
  chaquetas: 'Chaquetas',
  abrigos: 'Abrigos',
  sueteres: 'Suéteres',
  blazers: 'Blazers',
  zapatillas: 'Zapatillas',
  tacones: 'Tacones',
  botas: 'Botas',
  sandalias: 'Sandalias',
  bolsos: 'Bolsos',
  cinturones: 'Cinturones',
  joyeria: 'Joyería',
  sombreros: 'Sombreros',
  bufandas: 'Bufandas',
  lentes: 'Lentes',
  relojes: 'Relojes',
  otros: 'Otros',
};

export const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  calzado: 'Calzado',
  abrigo: 'Abrigo',
  accesorio: 'Accesorio',
};

@Entity('wardrobe_items')
export class WardrobeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 150, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 30 })
  category: WardrobeCategory;

  @Column({ type: 'varchar', length: 50, default: 'otros' })
  subcategory: WardrobeSubcategory;

  @Column({ type: 'varchar', length: 60, nullable: true })
  color: string | null;

  @Column({ name: 'color_hex', type: 'varchar', length: 7, nullable: true })
  colorHex: string | null;

  @Column({ name: 'approximate_size', type: 'varchar', length: 20, nullable: true })
  approximateSize: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  season: WardrobeSeason | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  occasion: WardrobeOccasion | null;

  @Column({ name: 'capture_source', type: 'varchar', length: 20, default: 'camera' })
  captureSource: WardrobeCaptureSource;

  @Column({ name: 'original_image_url', type: 'varchar', length: 500, nullable: true })
  originalImageUrl: string | null;

  @Column({ name: 'enhanced_image_url', type: 'varchar', length: 500, nullable: true })
  enhancedImageUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: 'confirmed' })
  status: WardrobeStatus;

  @Column({ name: 'last_worn_at', type: 'timestamptz', nullable: true })
  lastWornAt: Date | null;

  @Column({ name: 'wear_count', type: 'int', default: 0 })
  wearCount: number;

  @Column({ name: 'ai_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  aiMetadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
