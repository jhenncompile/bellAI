import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('bellai_diagnostics')
export class BellaiDiagnostic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'face_shape', type: 'varchar', length: 60 })
  faceShape: string;

  @Column({ name: 'skin_tone', type: 'varchar', length: 80 })
  skinTone: string;

  @Column({ type: 'varchar', length: 40 })
  undertone: string;

  @Column({ name: 'seasonal_palette', type: 'varchar', length: 80 })
  seasonalPalette: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  proportions: Record<string, any>;

  @Column({ name: 'hair_features', type: 'jsonb', default: () => "'{}'::jsonb" })
  hairFeatures: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
