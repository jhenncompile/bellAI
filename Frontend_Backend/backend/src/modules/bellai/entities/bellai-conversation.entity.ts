import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BellaiMessage } from './bellai-message.entity';

@Entity('bellai_conversations')
export class BellaiConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 160, default: 'Asesora personal BellAI' })
  title: string;

  @Column({ name: 'context_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  contextSnapshot: Record<string, any>;

  @OneToMany(() => BellaiMessage, (message) => message.conversation)
  messages?: BellaiMessage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
