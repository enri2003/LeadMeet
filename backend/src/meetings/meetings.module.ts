import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { MeetingLog } from './entities/meeting-log.entity';
import { MeetingGateway } from './gateway/meeting.gateway';
import { WebRtcGateway } from './meeting.gateway';
import { MeetingsService } from './meetings.service';
import { MeetingLogService } from './services/meeting-log.service';
import { MeetingLogsController } from './controllers/meeting-logs.controller';
import { MeetingsController } from './meetings.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingParticipant, MeetingLog]),
    AuthModule,
    UsersModule,
  ],
  providers: [MeetingGateway, WebRtcGateway, MeetingsService, MeetingLogService],
  controllers: [MeetingLogsController, MeetingsController],
  exports: [MeetingsService, MeetingLogService],
})
export class MeetingsModule {}
