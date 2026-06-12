import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MeetingLogService } from '../services/meeting-log.service';

@ApiTags('meeting-logs')
@Controller('meeting-logs')
export class MeetingLogsController {
  constructor(private readonly logSvc: MeetingLogService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtener historial de comparticiones de pantalla de un usuario' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario' })
  getUserSessions(@Param('userId') userId: string) {
    return this.logSvc.getUserSessions(userId);
  }
}
