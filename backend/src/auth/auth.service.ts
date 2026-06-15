import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CryptoService } from './crypto.service';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';

export interface SessionUser {
  userId: string;
  name: string;
  fullName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly cryptoSvc: CryptoService,
    private readonly mailSvc: MailService,
  ) {}

  async login(dto: LoginDto): Promise<SessionUser> {
    const user = await this.userRepo.findOne({
      where: [
        { email: dto.email },
        { name: dto.email },
      ],
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Cuenta no verificada. Revisa tu correo para activarla.');
    }

    const valid = await this.cryptoSvc.comparePassword(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas.');

    return {
      userId: user.id,
      name: user.name,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }

  async verifyLoginOtp(dto: VerifyOtpDto): Promise<SessionUser> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const valid = this.cryptoSvc.isOtpValid(dto.code, user.otpCode, user.otpExpiresAt);
    if (!valid) throw new UnauthorizedException('Código incorrecto o expirado. Inténtalo de nuevo.');

    await this.userRepo.update(user.id, { otpCode: null, otpExpiresAt: null });

    return {
      userId: user.id,
      name: user.name,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }

  async register(dto: RegisterDto): Promise<{ message: string; userId: string }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });

    if (existing) {
      throw new ConflictException('Este correo ya está registrado en Lead Meet.');
    }

    const passwordHash = await this.cryptoSvc.hashPassword(dto.password);
    const { code, expiresAt } = this.cryptoSvc.generateOtp();

    const user = this.userRepo.create({
      name: dto.username?.trim() || dto.fullName,
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      role: 'Miembro',
    });

    const saved = await this.userRepo.save(user);

    return {
      message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      userId: saved.id,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.isVerified) {
      throw new BadRequestException('Esta cuenta ya fue verificada.');
    }

    const valid = this.cryptoSvc.isOtpValid(dto.code, user.otpCode, user.otpExpiresAt);

    if (!valid) {
      throw new UnauthorizedException(
        'Código incorrecto o expirado. Solicita un nuevo código.',
      );
    }

    await this.userRepo.update(user.id, {
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
    });

    return { message: '¡Cuenta verificada exitosamente! Ya puedes iniciar sesión.' };
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.isVerified) throw new BadRequestException('Esta cuenta ya fue verificada.');

    const { code, expiresAt } = this.cryptoSvc.generateOtp();

    await this.userRepo.update(user.id, { otpCode: code, otpExpiresAt: expiresAt });

    this.mailSvc.sendOtp(email, user.fullName ?? user.name, code).catch((err: Error) => {
      this.logger.warn(`SMTP error al reenviar OTP a ${email}: ${err.message}`);
    });

    return { message: 'Nuevo código enviado a tu correo.' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    await this.userRepo.update(userId, { otpCode: null, otpExpiresAt: null });
    return { message: 'Todas las sesiones han sido cerradas correctamente.' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('No existe una cuenta con ese correo.');
    const { code, expiresAt } = this.cryptoSvc.generateOtp();
    await this.userRepo.update(user.id, { otpCode: code, otpExpiresAt: expiresAt });
    try {
      await this.mailSvc.sendOtp(email, user.fullName ?? user.name, code);
    } catch (err) {
      this.logger.warn(`SMTP error al enviar código de recuperación a ${email}: ${(err as Error).message}`);
    }
    return { message: 'Código de recuperación enviado a tu correo.' };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const valid = this.cryptoSvc.isOtpValid(code, user.otpCode, user.otpExpiresAt);
    if (!valid) throw new UnauthorizedException('Código incorrecto o expirado.');
    const passwordHash = await this.cryptoSvc.hashPassword(newPassword);
    await this.userRepo.update(user.id, { passwordHash, otpCode: null, otpExpiresAt: null });
    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }
}
