import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingFilterStatus } from './dto/query-meetings.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';

export type MeetingWithDuration = Meeting & { durationMinutes: number; userDurationMinutes: number };

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
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const meeting = this.meetingRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      startTime,
      endTime,
      isConfidential: dto.isConfidential ?? false,
      meetingCode: code,
      createdById: dto.userId,
      status: 'scheduled',
    });
    try {
      return await this.meetingRepo.save(meeting);
    } catch (err: any) {
      if (err?.code === '23514') {
        throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');
      }
      if (err?.code === '22P02' || err?.code === '23502') {
        throw new BadRequestException('Datos inválidos en la reunión.');
      }
      throw err;
    }
  }

  // ─── Module 2 methods ──────────────────────────────────────────────────────

  async recordJoin(meetingId: string, userId: string, joinedAt: Date): Promise<void> {
    const existing = await this.participantRepo.findOne({ where: { meetingId, userId } });
    if (existing) {
      await this.participantRepo.update({ meetingId, userId }, { joinedAt, leftAt: null });
    } else {
      await this.participantRepo.save(
        this.participantRepo.create({ meetingId, userId, joinedAt, leftAt: null, participantRole: 'Participante' }),
      );
    }
    this.logger.log(`Recorded join: user=${userId} meeting=${meetingId}`);
  }

  async recordLeave(meetingId: string, userId: string, leftAt: Date): Promise<void> {
    await this.participantRepo.update({ meetingId, userId }, { leftAt });
    this.logger.log(`Recorded leave: user=${userId} meeting=${meetingId}`);
  }

  async endMeeting(meetingId: string, actualDurationMinutes?: number): Promise<void> {
    const update: any = { status: 'completed' };
    if (actualDurationMinutes !== undefined) {
      update.actualDurationMinutes = Math.max(0, actualDurationMinutes);
    }
    await this.meetingRepo.update({ id: meetingId }, update);
    this.logger.log(`Meeting ${meetingId} marked as completed (duration: ${actualDurationMinutes ?? 'N/A'} min)`);
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.meetingRepo.findOne({ where: { id } });
  }

  async findByCode(meetingCode: string): Promise<Meeting | null> {
    return this.meetingRepo.findOne({ where: { meetingCode } });
  }

  async findByCodeOrId(codeOrId: string): Promise<Meeting | null> {
    if (codeOrId.length > 10) {
      const byId = await this.meetingRepo.findOne({ where: { id: codeOrId } });
      if (byId) return byId;
    }
    return this.meetingRepo.findOne({ where: { meetingCode: codeOrId } });
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
      .where(
        '(m.createdById = :userId OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = :userId))',
        { userId },
      );

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
        qb.andWhere(
          '(m.status = :completed OR (m.status = :scheduled AND m.endTime < :now))',
          { completed: 'completed', scheduled: 'scheduled', now },
        ).orderBy('m.startTime', 'DESC');
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

    return meetings.map((m) => {
      const userPart = m.participants?.find((p) => p.userId === userId);
      let userDurationMinutes = 0;
      if (userPart?.joinedAt && userPart?.leftAt) {
        userDurationMinutes = Math.max(
          0,
          Math.round((userPart.leftAt.getTime() - userPart.joinedAt.getTime()) / 60_000),
        );
      }
      return Object.assign(m, {
        durationMinutes: Math.round((m.endTime.getTime() - m.startTime.getTime()) / 60_000),
        userDurationMinutes,
      });
    });
  }

  async updateMeeting(
    id: string,
    requesterId: string,
    dto: { title?: string; description?: string; type?: string; startTime?: string; endTime?: string },
  ): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    if (meeting.createdById !== requesterId)
      throw new ForbiddenException('Solo el creador puede editar esta reunión');
    if (meeting.status !== 'scheduled')
      throw new BadRequestException('Solo se pueden editar reuniones programadas');

    if (dto.title) meeting.title = dto.title;
    if (dto.description !== undefined) meeting.description = dto.description ?? null;
    if (dto.type) meeting.type = dto.type as any;
    if (dto.startTime) meeting.startTime = new Date(dto.startTime);
    if (dto.endTime) meeting.endTime = new Date(dto.endTime);

    if (meeting.endTime <= meeting.startTime)
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');

    return this.meetingRepo.save(meeting);
  }

  async archiveMeeting(id: string, requesterId: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    if (meeting.createdById !== requesterId)
      throw new ForbiddenException('Solo el creador puede archivar esta reunión');
    meeting.status = 'archived';
    return this.meetingRepo.save(meeting);
  }

  async unarchiveMeeting(id: string, requesterId: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    if (meeting.createdById !== requesterId)
      throw new ForbiddenException('Solo el creador puede desarchivar esta reunión');
    meeting.status = 'completed';
    return this.meetingRepo.save(meeting);
  }

  async deleteMeeting(id: string, requesterId: string): Promise<void> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    if (meeting.createdById !== requesterId)
      throw new ForbiddenException('Solo el creador puede eliminar esta reunión');
    await this.meetingRepo.delete(id);
  }

}
