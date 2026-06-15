import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { UserSettings, DEFAULT_SETTINGS } from '../models/settings.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth/auth.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly authSvc = inject(AuthService);
  private readonly baseUrl = environment.apiUrl;

  private readonly _settings = new BehaviorSubject<UserSettings>({ ...DEFAULT_SETTINGS });
  readonly settings$ = this._settings.asObservable();

  private get userId(): string {
    return this.authSvc.getSession()?.userId ?? '';
  }

  load(): Observable<UserSettings> {
    return this.http
      .get<UserSettings>(`${this.baseUrl}/users/settings`, { params: { userId: this.userId } })
      .pipe(tap((s) => this._settings.next(s)));
  }

  save(patch: Partial<UserSettings>): Observable<UserSettings> {
    return this.http
      .patch<UserSettings>(`${this.baseUrl}/users/settings`, patch, { params: { userId: this.userId } })
      .pipe(tap((s) => this._settings.next(s)));
  }

  logoutAll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/auth/logout-all`,
      {},
      { params: { userId: this.userId } },
    );
  }

  get current(): UserSettings {
    return this._settings.value;
  }

  patchLocal(patch: Partial<UserSettings>): void {
    this._settings.next({ ...this._settings.value, ...patch });
  }
}
