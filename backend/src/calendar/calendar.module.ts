import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from '../meetings/entities/meeting.entity';
import { DailyNote } from './entities/daily-note.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Meeting, DailyNote])],
  providers: [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
