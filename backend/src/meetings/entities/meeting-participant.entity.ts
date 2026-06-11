import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from '../../users/entities/user.entity';

export type ParticipantRole = 'Anfitrión' | 'Participante' | 'Guest';

@Entity('meeting_participants')
export class MeetingParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meeting, (m) => m.participants)
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => User, (u) => u.participations)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'participant_role', length: 50, default: 'Participante' })
  participantRole: string;

  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joinedAt: Date | null;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt: Date | null;
}
