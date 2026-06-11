import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly participantRepo: Repository<MeetingParticipant>,
  ) {}

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
}
