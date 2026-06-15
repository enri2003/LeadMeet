import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardModule } from './dashboard/dashboard.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { Meeting } from './meetings/entities/meeting.entity';
import { MeetingLog } from './meetings/entities/meeting-log.entity';
import { User } from './users/entities/user.entity';
import { UserSettings } from './users/entities/user-settings.entity';
import { MeetingParticipant } from './meetings/entities/meeting-participant.entity';
import { CalendarModule } from './calendar/calendar.module';
import { DailyNote } from './calendar/entities/daily-note.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'production' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl: { rejectUnauthorized: false },
            entities: [User, UserSettings, Meeting, MeetingParticipant, MeetingLog, DailyNote],
            synchronize: true,
          };
        }
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port: +(config.get<string>('DB_PORT') ?? '5432'),
          database: config.get<string>('DB_NAME'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          entities: [User, UserSettings, Meeting, MeetingParticipant, MeetingLog, DailyNote],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    DashboardModule,
    MeetingsModule,
    CalendarModule,
  ],
})
export class AppModule {}
