import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingFilterStatus } from './dto/query-meetings.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';

export type MeetingWithDuration = Meeting & { durationMinutes: number };

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepo: Repository<MeetingParticipant>,
  ) {}

  // ─── Create meeting ────────────────────────────────────────────────────────

  async createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const meeting = this.meetingRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      isConfidential: dto.isConfidential ?? false,
      meetingCode: code,
      createdById: dto.userId,
      status: 'scheduled',
    });
    return this.meetingRepo.save(meeting);
  }

  // ─── Module 2 methods ──────────────────────────────────────────────────────

  async recordJoin(meetingId: string, userId: string, joinedAt: Date): Promise<void> {
    await this.participantRepo.upsert(
      { meetingId, userId, joinedAt, leftAt: null },
      { conflictPaths: ['meetingId', 'userId'], skipUpdateIfNoValuesChanged: false },
    );
    this.logger.log(`Recorded join: user=${userId} meeting=${meetingId}`);
  }

  async recordLeave(meetingId: string, userId: string, leftAt: Date): Promise<void> {
    await this.participantRepo.update({ meetingId, userId }, { leftAt });
    this.logger.log(`Recorded leave: user=${userId} meeting=${meetingId}`);
  }

  async endMeeting(meetingId: string): Promise<void> {
    await this.meetingRepo.update({ id: meetingId }, { status: 'completed' });
    this.logger.log(`Meeting ${meetingId} marked as completed`);
  }

  async findByCode(meetingCode: string): Promise<Meeting | null> {
    return this.meetingRepo.findOne({ where: { meetingCode } });
  }

  // ─── Module 6 methods (Task 3.4, 3.5) ─────────────────────────────────────

  async getMeetings(
    userId: string,
    opts: { status?: MeetingFilterStatus; startDate?: string; endDate?: string },
  ): Promise<MeetingWithDuration[]> {
    const now = new Date();

    const qb = this.meetingRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.participants', 'p')
      .where('m.createdById = :userId', { userId });

    switch (opts.status) {
      case 'upcoming':
        qb.andWhere('m.status = :st', { st: 'scheduled' })
          .andWhere('m.startTime > :now', { now })
          .orderBy('m.startTime', 'ASC');
        break;
      case 'live':
        qb.andWhere('m.status = :st', { st: 'scheduled' })
          .andWhere('m.startTime <= :now', { now })
          .andWhere('m.endTime >= :now', { now })
          .orderBy('m.startTime', 'ASC');
        break;
      case 'past':
        qb.andWhere('m.status = :st', { st: 'completed' })
          .orderBy('m.startTime', 'DESC');
        break;
      case 'archived':
        qb.andWhere('m.status = :st', { st: 'archived' })
          .orderBy('m.startTime', 'DESC');
        break;
      default:
        qb.andWhere('m.status IN (:...sts)', { sts: ['scheduled', 'completed', 'archived'] })
          .orderBy('m.startTime', 'DESC');
    }

    if (opts.startDate) {
      qb.andWhere('m.startTime >= :sd', { sd: new Date(opts.startDate) });
    }
    if (opts.endDate) {
      qb.andWhere('m.startTime <= :ed', { ed: new Date(opts.endDate) });
    }

    const meetings = await qb.getMany();

    return meetings.map((m) =>
      Object.assign(m, {
        durationMinutes: Math.round((m.endTime.getTime() - m.startTime.getTime()) / 60_000),
      }),
    );
  }

  async archiveMeeting(id: string, requesterId: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.createdById !== requesterId)
      throw new ForbiddenException('Only the host can archive this meeting');
    meeting.status = 'archived';
    return this.meetingRepo.save(meeting);
  }
}
