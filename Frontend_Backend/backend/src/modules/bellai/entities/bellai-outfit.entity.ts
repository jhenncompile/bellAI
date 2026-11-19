import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface ConsideredFactor {
  category: 'colorimetria' | 'rostro' | 'armario' | 'estilo' | 'ocasion';
  label: string;
  value: string;
}

@Entity('bellai_outfits')
export class BellaiOutfit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  occasion: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  season: string | null;

  @Column({ name: 'garment_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  garmentIds: string[];

  @Column({ name: 'color_harmony', type: 'varchar', length: 120, nullable: true })
  colorHarmony: string | null;

  @Column({ name: 'reason_summary', type: 'text', nullable: true })
  reasonSummary: string | null;

  @Column({ name: 'considered_factors', type: 'jsonb', default: () => "'[]'::jsonb" })
  consideredFactors: ConsideredFactor[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
