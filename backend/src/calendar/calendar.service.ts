import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from '../meetings/entities/meeting.entity';
import { DailyNote } from './entities/daily-note.entity';

export interface CalendarEventItem {
  id: string;
  title: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  participantCount: number;
  meetingCode: string | null;
  isConfidential: boolean;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(DailyNote)
    private readonly noteRepo: Repository<DailyNote>,
  ) {}

  // ─── Task 3.4 — calendar events grouped by day ─────────────────────────────

  async getEvents(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<number, CalendarEventItem[]>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    const meetings = await this.meetingRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.participants', 'p')
      .where('m.createdById = :userId', { userId })
      .andWhere('m.startTime >= :start', { start: startDate })
      .andWhere('m.startTime < :end',   { end: endDate })
      .andWhere("m.status IN ('scheduled', 'completed')")
      .orderBy('m.startTime', 'ASC')
      .getMany();

    const grouped: Record<number, CalendarEventItem[]> = {};
    for (const m of meetings) {
      const day = new Date(m.startTime).getDate();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({
        id:               m.id,
        title:            m.title,
        type:             m.type,
        status:           m.status,
        startTime:        m.startTime.toISOString(),
        endTime:          m.endTime.toISOString(),
        participantCount: m.participants.length,
        meetingCode:      m.meetingCode,
        isConfidential:   m.isConfidential,
      });
    }
    return grouped;
  }

  // ─── Task 3.5 — daily notes ────────────────────────────────────────────────

  async getNote(userId: string, date: string): Promise<DailyNote | null> {
    return this.noteRepo.findOne({ where: { userId, date } });
  }

  async upsertNote(userId: string, date: string, content: string): Promise<DailyNote> {
    let note = await this.noteRepo.findOne({ where: { userId, date } });
    if (note) {
      note.content = content;
    } else {
      note = this.noteRepo.create({ userId, date, content });
    }
    return this.noteRepo.save(note);
  }
}
