import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MeetingParticipant } from './meeting-participant.entity';

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'archived';
export type MeetingType = 'strategy' | 'negotiation' | 'interview' | 'general';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ['scheduled', 'completed', 'cancelled', 'archived'], default: 'scheduled' })
  status: MeetingStatus;

  @Column({ type: 'enum', enum: ['strategy', 'negotiation', 'interview', 'general'], default: 'general' })
  type: MeetingType;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ name: 'is_confidential', default: false })
  isConfidential: boolean;

  @Column({ name: 'meeting_code', length: 50, nullable: true, unique: true })
  meetingCode: string | null;

  @ManyToOne(() => User, (u) => u.meetings)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => MeetingParticipant, (mp) => mp.meeting, { eager: true })
  participants: MeetingParticipant[];
}
