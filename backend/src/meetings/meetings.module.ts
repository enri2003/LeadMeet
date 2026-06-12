import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingGateway } from './gateway/meeting.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant])],
  providers: [MeetingGateway],
  exports: [MeetingGateway],
})
export class MeetingsModule {}
