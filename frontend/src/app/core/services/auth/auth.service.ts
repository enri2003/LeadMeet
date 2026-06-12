import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, payload);
  }

  verifyOtp(payload: VerifyOtpPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/verify-otp`, payload);
  }

  resendOtp(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/resend-otp`, { email });
  }
}
