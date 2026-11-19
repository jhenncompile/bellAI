import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('preferences')
export class Preferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.preferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ length: 20, default: 'system' })
  theme: 'light' | 'dark' | 'system';

  @Column({ length: 10, default: 'es' })
  language: string;

  @Column({ name: 'email_notifications', type: 'boolean', default: true })
  emailNotifications: boolean;

  @Column({ name: 'push_notifications', type: 'boolean', default: true })
  pushNotifications: boolean;

  @Column({ name: 'marketing_consent', type: 'boolean', default: false })
  marketingConsent: boolean;

  @Column({ name: 'tracking_consent', type: 'boolean', default: false })
  trackingConsent: boolean;

  @Column({ name: 'auto_backup_enabled', type: 'boolean', default: true })
  autoBackupEnabled: boolean;

  @Column({ name: 'offline_mode_enabled', type: 'boolean', default: true })
  offlineModeEnabled: boolean;

  @Column({ name: 'style_preferences', type: 'jsonb', default: () => "'{}'::jsonb" })
  stylePreferences: {
    goals?: string[];
    preferredStyles?: string[];
    dislikedStyles?: string[];
    occasions?: string[];
    preferredColors?: string[];
    avoidedColors?: string[];
    budgetPerGarment?: number | null;
  };

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
