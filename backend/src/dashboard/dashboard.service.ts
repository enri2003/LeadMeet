import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Meeting } from '../meetings/entities/meeting.entity';
import { DashboardStatsDto, UpcomingMeetingDto } from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
  ) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const now = new Date();


    const completed = await this.meetingRepo.find({
      where: { createdById: userId, status: 'completed' },
      relations: { participants: { user: true } },
    });

    const totalMinutes = completed.reduce((acc, m) => {
      // Use actual duration if recorded, otherwise calculate from start/end times
      if (m.actualDurationMinutes !== null && m.actualDurationMinutes !== undefined) {
        return acc + Math.max(0, m.actualDurationMinutes);
      }
      if (!m.endTime || !m.startTime) return acc;
      const diff = (m.endTime.getTime() - m.startTime.getTime()) / 60000;
      return acc + Math.max(0, diff);
    }, 0);

    // --- % change today vs yesterday ---
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);

    const todayCount = completed.filter(
      (m) => m.endTime >= startOfToday && m.endTime <= now,
    ).length;

    const yesterdayCount = completed.filter(
      (m) => m.endTime >= startOfYesterday && m.endTime <= endOfYesterday,
    ).length;

    let percentageChange: number | null = null;
    if (yesterdayCount > 0) {
      percentageChange = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    } else if (todayCount > 0) {
      percentageChange = 100;
    }

    // --- Next 3 upcoming meetings ---
    const upcoming = await this.meetingRepo.find({
      where: { createdById: userId, status: 'scheduled', startTime: MoreThan(now) },
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
      ? Math.max(0, Math.round((new Date(nextMeeting.startTime).getTime() - now.getTime()) / 60000))
      : null;

    const totalHours = (totalMinutes / 60).toFixed(1) + 'h';

    return {
      meetingsCompleted: completed.length,
      meetingsCompletedToday: todayCount,
      meetingsCompletedYesterday: yesterdayCount,
      percentageChange,
      totalMinutes: Math.round(totalMinutes),
      totalHours,
      upcomingMeetings: upcomingDtos,
      nextMeeting,
      minutesUntilNext,
    };
  }
}
