import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import type { MeetingFilterStatus } from './dto/query-meetings.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsSvc: MeetingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nueva reunión' })
  createMeeting(@Body() dto: CreateMeetingDto) {
    return this.meetingsSvc.createMeeting(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reuniones filtradas por estado y fecha (Task 3.4)' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: ['upcoming', 'live', 'past', 'archived'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getMeetings(
    @Query('userId') userId: string,
    @Query('status') status?: MeetingFilterStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.meetingsSvc.getMeetings(userId, { status, startDate, endDate });
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archivar una reunión (solo el host) (Task 3.5)' })
  @ApiParam({ name: 'id', description: 'UUID de la reunión' })
  @ApiQuery({ name: 'userId', required: true, description: 'UUID del solicitante (debe ser el host)' })
  archiveMeeting(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.meetingsSvc.archiveMeeting(id, userId);
  }
}
