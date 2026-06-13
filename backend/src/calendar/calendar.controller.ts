import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { UpsertNoteDto } from './dto/upsert-note.dto';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarSvc: CalendarService) {}

  @Get('events')
  @ApiOperation({ summary: 'Reuniones del mes agrupadas por día (Task 3.4)' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'year',   required: true, example: 2026 })
  @ApiQuery({ name: 'month',  required: true, example: 6 })
  getEvents(
    @Query('userId') userId: string,
    @Query('year')   year:   string,
    @Query('month')  month:  string,
  ) {
    return this.calendarSvc.getEvents(userId, +year, +month);
  }

  @Get('notes')
  @ApiOperation({ summary: 'Obtener nota diaria de un usuario (Task 3.5)' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'date',   required: true, example: '2026-06-13' })
  getNote(
    @Query('userId') userId: string,
    @Query('date')   date:   string,
  ) {
    return this.calendarSvc.getNote(userId, date);
  }

  @Post('notes')
  @ApiOperation({ summary: 'Crear o actualizar nota diaria — upsert por (userId, date) (Task 3.5)' })
  @ApiBody({ type: UpsertNoteDto })
  upsertNote(@Body() dto: UpsertNoteDto) {
    return this.calendarSvc.upsertNote(dto.userId, dto.date, dto.content);
  }
}
