import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type MediaType = 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture' | 'avatar';
export type SystemFunction =
  | 'catalogo_prendas'
  | 'probador_virtual_3d'
  | 'motor_inferencia_ia'
  | 'perfil_usuario'
  | 'galeria_marketing'
  | 'general';

@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index('idx_media_assets_user_id')
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500, unique: true })
  @Index('idx_media_assets_s3_key')
  s3Key: string;

  @Column({ name: 's3_bucket', type: 'varchar', length: 150 })
  s3Bucket: string;

  @Column({ name: 's3_url', type: 'text' })
  s3Url: string;

  @Column({ name: 'cdn_url', type: 'text' })
  cdnUrl: string;

  @Column({
    name: 'media_type',
    type: 'varchar',
    length: 50,
  })
  @Index('idx_media_assets_media_type')
  mediaType: MediaType;

  @Column({
    name: 'system_function',
    type: 'varchar',
    length: 100,
    default: 'general',
  })
  @Index('idx_media_assets_system_function')
  systemFunction: SystemFunction;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index('idx_media_assets_is_active')
  isActive: boolean;

  @Column({ name: 'used_by_components', type: 'jsonb', default: () => "'[]'" })
  usedByComponents: string[];

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'retired' | 'maintenance';

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'varchar', length: 20 })
  extension: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
