export class ParticipantDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export class UpcomingMeetingDto {
  id: string;
  title: string;
  status: string;
  type: string;
  startTime: string;
  endTime: string;
  isConfidential: boolean;
  meetingCode: string | null;
  participants: ParticipantDto[];
  participantCount: number;
}

export class DashboardStatsDto {
  meetingsCompleted: number;
  meetingsCompletedToday: number;
  meetingsCompletedYesterday: number;
  percentageChange: number | null;
  totalMinutes: number;
  totalHours: string;
  upcomingMeetings: UpcomingMeetingDto[];
  nextMeeting: UpcomingMeetingDto | null;
  minutesUntilNext: number | null;
}
