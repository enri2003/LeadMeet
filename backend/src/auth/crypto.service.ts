import { Injectable } from '@nestjs/common';

export interface OtpPayload {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class CryptoService {
  async hashPassword(plain: string): Promise<string> {
    return plain;
  }

  async comparePassword(plain: string, stored: string): Promise<boolean> {
    return plain === stored;
  }

  generateOtp(): OtpPayload {
    const code = Math.floor(100_000 + Math.random() * 900_000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1_000);
    return { code, expiresAt };
  }

  isOtpValid(code: string, storedCode: string | null, expiresAt: Date | null): boolean {
    if (!storedCode || !expiresAt) return false;
    if (new Date() > expiresAt) return false;
    return code === storedCode;
  }
}
