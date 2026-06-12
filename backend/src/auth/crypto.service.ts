import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export interface OtpPayload {
  code: string;
  expiresAt: Date;
}

@Injectable()
export class CryptoService {
  private readonly SALT_ROUNDS = 12;

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.SALT_ROUNDS);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
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
