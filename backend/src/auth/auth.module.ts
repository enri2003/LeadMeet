import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './ws-jwt.guard';
import { CryptoService } from './crypto.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'leadmeet-dev-secret',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [WsJwtGuard, CryptoService],
  exports: [JwtModule, WsJwtGuard, CryptoService],
})
export class AuthModule {}
