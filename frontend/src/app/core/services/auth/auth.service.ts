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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<{ message: string; email: string }> {
    return this.http.post<{ message: string; email: string }>(`${this.base}/login`, { email, password });
  }

  verifyLoginOtp(email: string, code: string): Observable<SessionUser> {
    return this.http.post<SessionUser>(`${this.base}/verify-login-otp`, { email, code }).pipe(
      tap(user => localStorage.setItem(SESSION_KEY, JSON.stringify(user))),
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

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  getSession(): SessionUser | null {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getSession();
  }
}
