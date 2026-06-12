import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.config.get<string>('MAIL_APP_PASSWORD'),
      },
    });
  }

  async sendOtp(to: string, fullName: string, code: string): Promise<void> {
    const subject = 'Tu código de verificación — Lead Meet';
    const html = this.buildOtpEmail(fullName, code);

    try {
      await this.transporter.sendMail({
        from: `"Lead Meet" <${this.config.get<string>('MAIL_USER')}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`OTP enviado a ${to}`);
    } catch (err) {
      this.logger.error(`Error enviando OTP a ${to}: ${(err as Error).message}`);
      throw new Error('No se pudo enviar el correo de verificación. Intenta de nuevo.');
    }
  }

  private buildOtpEmail(fullName: string, code: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"/></head>
      <body style="margin:0;padding:0;background:#101415;font-family:'Inter',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#101415;padding:40px 20px;">
          <tr><td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#181c1e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
              <tr><td align="center" style="padding-bottom:24px;">
                <div style="width:48px;height:48px;background:#1d2022;border:1px solid rgba(255,255,255,0.1);
                            border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto;">
                  <span style="color:white;font-size:20px;">▲</span>
                </div>
              </td></tr>
              <tr><td style="color:#ffffff;font-size:22px;font-weight:700;text-align:center;padding-bottom:8px;">
                Verificación de cuenta
              </td></tr>
              <tr><td style="color:#9ca3af;font-size:14px;text-align:center;padding-bottom:32px;">
                Hola <strong style="color:#e5e7eb;">${fullName}</strong>, usa este código para verificar tu cuenta.
              </td></tr>
              <tr><td align="center" style="padding-bottom:32px;">
                <div style="display:inline-block;background:#1d2022;border:1px solid rgba(0,85,255,0.4);
                            border-radius:12px;padding:20px 40px;">
                  <span style="color:#ffffff;font-size:36px;font-weight:800;letter-spacing:12px;">${code}</span>
                </div>
              </td></tr>
              <tr><td style="color:#6b7280;font-size:12px;text-align:center;padding-bottom:24px;">
                Este código expira en <strong style="color:#9ca3af;">5 minutos</strong>.
                Si no solicitaste esta cuenta, ignora este correo.
              </td></tr>
              <tr><td style="border-top:1px solid rgba(255,255,255,0.05);padding-top:24px;">
                <p style="color:#4b5563;font-size:11px;text-align:center;margin:0;">
                  © 2024 Lead Meet Inc. — Plataforma ejecutiva de videoconferencias
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
  }
}
