import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get consolidated dashboard stats for a user' })
  @ApiQuery({ name: 'userId', required: false, description: 'User UUID (defaults to demo user)' })
  async getStats(
    @Query('userId') userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  ): Promise<DashboardStatsDto> {
    return this.dashboardService.getStats(userId);
  }
}
