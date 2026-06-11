import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Meeting } from '../../meetings/entities/meeting.entity';
import { MeetingParticipant } from '../../meetings/entities/meeting-participant.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, default: 'Member' })
  role: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ name: 'avatar_url', nullable: true, type: 'text' })
  avatarUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Meeting, (m) => m.createdBy)
  meetings: Meeting[];

  @OneToMany(() => MeetingParticipant, (mp) => mp.user)
  participations: MeetingParticipant[];
}
