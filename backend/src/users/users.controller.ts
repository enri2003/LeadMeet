import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Cargar preferencias del usuario' })
  @ApiQuery({ name: 'userId', required: true })
  getSettings(@Query('userId') userId: string) {
    return this.usersService.getSettings(userId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar preferencias del usuario' })
  @ApiQuery({ name: 'userId', required: true })
  updateSettings(
    @Query('userId') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar cuenta del usuario y todos sus datos' })
  @ApiQuery({ name: 'userId', required: true })
  deleteAccount(@Query('userId') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
