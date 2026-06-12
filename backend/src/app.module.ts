import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardModule } from './dashboard/dashboard.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AuthModule } from './auth/auth.module';
import { Meeting } from './meetings/entities/meeting.entity';
import { MeetingLog } from './meetings/entities/meeting-log.entity';
import { User } from './users/entities/user.entity';
import { MeetingParticipant } from './meetings/entities/meeting-participant.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +(config.get<string>('DB_PORT') ?? '5432'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        entities: [User, Meeting, MeetingParticipant, MeetingLog],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    DashboardModule,
    MeetingsModule,
  ],
})
export class AppModule {}
