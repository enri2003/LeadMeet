import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingLog } from './entities/meeting-log.entity';
import { MeetingGateway } from './gateway/meeting.gateway';
import { MeetingLogService } from './services/meeting-log.service';
import { MeetingLogsController } from './controllers/meeting-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, MeetingParticipant, MeetingLog])],
  providers: [MeetingGateway, MeetingLogService],
  controllers: [MeetingLogsController],
  exports: [MeetingLogService],
})
export class MeetingsModule {}
