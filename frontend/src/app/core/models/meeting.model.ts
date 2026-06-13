export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'archived';
export type MeetingType   = 'strategy' | 'negotiation' | 'interview' | 'general';
export type MeetingFilter = 'upcoming' | 'live' | 'past' | 'archived';

export interface MeetingParticipantDto {
  id: string;
  userId: string;
  participantRole: string;
  joinedAt: string | null;
  leftAt: string | null;
}

export interface MeetingDto {
  id: string;
  title: string;
  description: string | null;
  status: MeetingStatus;
  type: MeetingType;
  startTime: string;
  endTime: string;
  isConfidential: boolean;
  meetingCode: string | null;
  createdById: string;
  participants: MeetingParticipantDto[];
  durationMinutes: number;
}

export const TYPE_LABELS: Record<MeetingType, string> = {
  strategy:    'Estrategia',
  negotiation: 'Negociación',
  interview:   'Entrevista',
  general:     'General',
};

export const TYPE_COLORS: Record<MeetingType, string> = {
  strategy:    'bg-blue-500/15 text-blue-400',
  negotiation: 'bg-yellow-500/15 text-yellow-400',
  interview:   'bg-purple-500/15 text-purple-400',
  general:     'bg-white/10 text-white/50',
};
