import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingGateway } from './meeting.gateway';
import { MeetingsService } from './meetings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant]), AuthModule],
  providers: [MeetingGateway, MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
