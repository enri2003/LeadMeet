import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Meeting } from '../meetings/entities/meeting.entity';
import { MeetingParticipant } from '../meetings/entities/meeting-participant.entity';
import { DashboardStatsDto, UpcomingMeetingDto } from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepo: Repository<MeetingParticipant>,
  ) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const now = new Date();

    try {
      // All participation records for this user (meetings where user was present)
      const participations = await this.participantRepo.find({
        where: { userId },
        relations: { meeting: true },
      });

      const completedParticipations = participations.filter(
        (p) => p.meeting?.status === 'completed',
      );

      // Count distinct completed meetings
      const completedMeetingIds = new Set(completedParticipations.map((p) => p.meetingId));
      const meetingsCompleted = completedMeetingIds.size;

      this.logger.debug(`Found ${meetingsCompleted} completed meetings for user ${userId}`);

      // Total time = sum of (leftAt - joinedAt) per participation record
      const totalMinutes = completedParticipations.reduce((acc, p) => {
        try {
          if (p.joinedAt && p.leftAt) {
            const diff = (p.leftAt.getTime() - p.joinedAt.getTime()) / 60000;
            return acc + Math.max(0, diff);
          }
          return acc;
        } catch {
          return acc;
        }
      }, 0);

      // Today / yesterday counts for the user
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);

      const endOfYesterday = new Date(startOfToday);
      endOfYesterday.setMilliseconds(-1);

      const todayCount = completedParticipations.filter(
        (p) =>
          p.meeting?.endTime &&
          p.meeting.endTime >= startOfToday &&
          p.meeting.endTime <= now,
      ).length;

      const yesterdayCount = completedParticipations.filter(
        (p) =>
          p.meeting?.endTime &&
          p.meeting.endTime >= startOfYesterday &&
          p.meeting.endTime <= endOfYesterday,
      ).length;

      let percentageChange: number | null = null;
      if (yesterdayCount > 0) {
        percentageChange = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
      } else if (todayCount > 0) {
        percentageChange = 100;
      }

      // Upcoming scheduled meetings (created by user)
      const upcoming = await this.meetingRepo.find({
        where: {
          createdById: userId,
          status: 'scheduled',
          startTime: MoreThan(now),
        },
        relations: { participants: { user: true } },
        order: { startTime: 'ASC' },
        take: 3,
      });

      const toDto = (m: Meeting): UpcomingMeetingDto => ({
        id: m.id,
        title: m.title,
        status: m.status,
        type: m.type,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime.toISOString(),
        isConfidential: m.isConfidential,
        meetingCode: m.meetingCode ?? null,
        participants: (m.participants ?? []).map((p) => ({
          id: p.userId,
          name: p.user?.name ?? 'Unknown',
          avatarUrl: p.user?.avatarUrl ?? null,
        })),
        participantCount: m.participants?.length ?? 0,
      });

      const upcomingDtos = upcoming.map(toDto);
      const nextMeeting = upcomingDtos[0] ?? null;

      const minutesUntilNext = nextMeeting
        ? Math.max(
            0,
            Math.round(
              (new Date(nextMeeting.startTime).getTime() - now.getTime()) / 60000,
            ),
          )
        : null;

      const totalHours = (totalMinutes / 60).toFixed(1) + 'h';

      return {
        meetingsCompleted,
        meetingsCompletedToday: todayCount,
        meetingsCompletedYesterday: yesterdayCount,
        percentageChange,
        totalMinutes: Math.round(totalMinutes),
        totalHours,
        upcomingMeetings: upcomingDtos,
        nextMeeting,
        minutesUntilNext,
      };
    } catch (error) {
      this.logger.error(`Error getting dashboard stats for user ${userId}`, error);
      throw error;
    }
  }
}
