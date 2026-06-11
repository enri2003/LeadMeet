export interface Participant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface UpcomingMeeting {
  id: string;
  title: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  type: 'strategy' | 'negotiation' | 'interview' | 'general';
  startTime: string;
  endTime: string;
  isConfidential: boolean;
  meetingCode: string | null;
  participants: Participant[];
  participantCount: number;
}

export interface DashboardStats {
  meetingsCompleted: number;
  meetingsCompletedToday: number;
  meetingsCompletedYesterday: number;
  percentageChange: number | null;
  totalMinutes: number;
  totalHours: string;
  upcomingMeetings: UpcomingMeeting[];
  nextMeeting: UpcomingMeeting | null;
  minutesUntilNext: number | null;
}
