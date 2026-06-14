import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CalendarMonthData, DailyNoteDto } from '../models/calendar.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth/auth.service';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly http    = inject(HttpClient);
  private readonly authSvc = inject(AuthService);
  private readonly baseUrl = environment.apiUrl;

  private get userId(): string {
    return this.authSvc.getSession()?.userId ?? '';
  }

  getEvents(year: number, month: number): Observable<CalendarMonthData> {
    return this.http
      .get<CalendarMonthData>(`${this.baseUrl}/calendar/events`, {
        params: { userId: this.userId, year: year.toString(), month: month.toString() },
      })
      .pipe(catchError(() => of({} as CalendarMonthData)));
  }

  getNote(date: string): Observable<DailyNoteDto | null> {
    return this.http
      .get<DailyNoteDto | null>(`${this.baseUrl}/calendar/notes`, {
        params: { userId: this.userId, date },
      })
      .pipe(catchError(() => of(null)));
  }

  upsertNote(date: string, content: string): Observable<DailyNoteDto> {
    return this.http.post<DailyNoteDto>(`${this.baseUrl}/calendar/notes`, {
      userId: this.userId,
      date,
      content,
    });
  }
}
