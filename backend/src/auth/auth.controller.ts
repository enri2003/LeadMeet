import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authSvc: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  login(@Body() dto: LoginDto) {
    return this.authSvc.login(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear cuenta nueva y enviar OTP por correo' })
  register(@Body() dto: RegisterDto) {
    return this.authSvc.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código OTP para activar la cuenta' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authSvc.verifyOtp(dto);
  }

  @Post('verify-login-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP de inicio de sesión (2FA)' })
  verifyLoginOtp(@Body() dto: VerifyOtpDto) {
    return this.authSvc.verifyLoginOtp(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar código OTP al correo del usuario' })
  resendOtp(@Body() body: { email: string }) {
    return this.authSvc.resendOtp(body.email);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos (Task 6.5)' })
  logoutAll(@Query('userId') userId: string) {
    return this.authSvc.logoutAll(userId);
  }
}
