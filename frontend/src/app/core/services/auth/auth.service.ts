import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}

export interface AuthResponse {
  message: string;
  userId?: string;
}

export interface SessionUser {
  userId: string;
  name: string;
  fullName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
}

const SESSION_KEY = 'lm_session';
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutos

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  login(identifier: string, password: string): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${this.base}/login`, { email: identifier, password }).pipe(
      tap(user => localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, loginAt: Date.now() }))),
    );
  }

  verifyLoginOtp(email: string, code: string): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${this.base}/verify-login-otp`, { email, code }).pipe(
      tap(user => localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, loginAt: Date.now() }))),
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, payload);
  }

  verifyOtp(payload: VerifyOtpPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/verify-otp`, payload);
  }

  resendOtp(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/resend-otp`, { email });
  }

  deleteAccount(): Observable<{ message: string }> {
    const session = this.getSession();
    return this.http.delete<{ message: string }>(
      `${environment.apiUrl}/users/me?userId=${session?.userId ?? ''}`,
    );
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  getSession(): SessionUser | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as SessionUser & { loginAt?: number };
    if (!stored.loginAt || Date.now() - stored.loginAt > SESSION_DURATION) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return stored;
  }

  isAuthenticated(): boolean {
    return !!this.getSession();
  }
}
