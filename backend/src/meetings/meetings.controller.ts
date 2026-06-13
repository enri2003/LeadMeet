import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { MeetingFilterStatus } from './dto/query-meetings.dto';

@ApiTags('meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsSvc: MeetingsService) {}

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
