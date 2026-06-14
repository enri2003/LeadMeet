import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    private readonly dataSource: DataSource,
  ) {}

  async getSettings(userId: string): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });

    if (!settings) {
      // Auto-create default settings for the user
      settings = this.settingsRepo.create({ userId });
      await this.settingsRepo.save(settings);
    }

    return settings;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingsRepo.create({ userId });
    }

    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM meeting_participants WHERE user_id = $1`, [userId]);
      await manager.query(
        `DELETE FROM meeting_logs WHERE meeting_id IN (SELECT id FROM meetings WHERE created_by = $1)`,
        [userId],
      );
      await manager.query(`DELETE FROM meetings WHERE created_by = $1`, [userId]);
      await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    return { message: 'Cuenta eliminada correctamente.' };
  }
}
