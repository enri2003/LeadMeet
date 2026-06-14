import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { UserSettings, DEFAULT_SETTINGS } from '../models/settings.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private readonly _settings = new BehaviorSubject<UserSettings>({ ...DEFAULT_SETTINGS });
  readonly settings$ = this._settings.asObservable();

  // Demo userId — in a real app this comes from the auth token
  private readonly demoUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  load(userId = this.demoUserId): Observable<UserSettings> {
    return this.http
      .get<UserSettings>(`${this.baseUrl}/users/settings`, { params: { userId } })
      .pipe(tap((s) => this._settings.next(s)));
  }

  save(patch: Partial<UserSettings>, userId = this.demoUserId): Observable<UserSettings> {
    return this.http
      .patch<UserSettings>(`${this.baseUrl}/users/settings`, patch, { params: { userId } })
      .pipe(tap((s) => this._settings.next(s)));
  }

  logoutAll(userId = this.demoUserId): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/auth/logout-all`,
      {},
      { params: { userId } },
    );
  }

  get current(): UserSettings {
    return this._settings.value;
  }

  patchLocal(patch: Partial<UserSettings>): void {
    this._settings.next({ ...this._settings.value, ...patch });
  }
}
