import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type PrivacyLevel = 'organization' | 'anyone' | 'verified';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // Audio & Video
  @Column({ name: 'mic_device_id', type: 'text', nullable: true })
  micDeviceId: string | null;

  @Column({ name: 'audio_out_id', type: 'text', nullable: true })
  audioOutId: string | null;

  @Column({ name: 'noise_cancel', default: false })
  noiseCancel: boolean;

  @Column({ name: 'face_link', default: false })
  faceLink: boolean;

  // Privacy
  @Column({ name: 'privacy_level', length: 50, default: 'organization' })
  privacyLevel: string;

  @Column({ name: 'hide_presence', default: false })
  hidePresence: boolean;

  // Interface & Accessibility
  @Column({ name: 'font_size', type: 'smallint', default: 16 })
  fontSize: number;

  @Column({ name: 'theme', length: 50, default: 'dark-lead' })
  theme: string;

  @Column({ name: 'captions', default: false })
  captions: boolean;

  @Column({ name: 'caption_lang', length: 10, default: 'es' })
  captionLang: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
