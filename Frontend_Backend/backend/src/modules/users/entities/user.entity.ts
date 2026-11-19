import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Profile } from '../../profile/entities/profile.entity';
import { Preferences } from '../../profile/entities/preferences.entity';
import { GdprConsent } from '../../privacy/entities/gdpr-consent.entity';
import { AuditLog } from '../../privacy/entities/audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 255, select: false })
  password?: string;

  @Column({ length: 50, default: 'user' })
  role: 'admin' | 'manager' | 'user';

  @Column({ length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'suspended';

  /** Plan contratado. Si `planExpiresAt` ya pasó, se trata como 'free' (ver subscriptions/plan-limits.ts). */
  @Column({ length: 20, default: 'free' })
  plan?: 'free' | 'premium';

  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** HU-30: última actividad. No se selecciona por defecto para no cambiar las respuestas de la API. */
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true, select: false })
  lastSeenAt?: Date | null;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile?: Profile;

  @OneToOne(() => Preferences, (prefs) => prefs.user, { cascade: true })
  preferences?: Preferences;

  @OneToMany(() => GdprConsent, (consent) => consent.user)
  consents?: GdprConsent[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs?: AuditLog[];
}
