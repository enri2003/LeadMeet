import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Meeting } from './meeting.entity';

export type LogEventType = 'share_started' | 'share_stopped';
export type SourceType   = 'monitor' | 'window' | 'browser';

@Entity('meeting_logs')
export class MeetingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting | null;

  @Column({ name: 'meeting_id', nullable: true })
  meetingId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'room_id', length: 100 })
  roomId: string;

  @Column({ name: 'event_type', length: 50 })
  eventType: LogEventType;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'stopped_at', type: 'timestamptz', nullable: true })
  stoppedAt: Date | null;

  @Column({ name: 'source_type', length: 20, nullable: true })
  sourceType: SourceType | null;

  @Column({ name: 'with_audio', default: false })
  withAudio: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
