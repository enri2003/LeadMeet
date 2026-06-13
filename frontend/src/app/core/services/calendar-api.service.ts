import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CalendarMonthData, DailyNoteDto } from '../models/calendar.model';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';
  private readonly demoId  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  getEvents(year: number, month: number): Observable<CalendarMonthData> {
    return this.http
      .get<CalendarMonthData>(`${this.baseUrl}/calendar/events`, {
        params: { userId: this.demoId, year: year.toString(), month: month.toString() },
      })
      .pipe(catchError(() => of({} as CalendarMonthData)));
  }

  getNote(date: string): Observable<DailyNoteDto | null> {
    return this.http
      .get<DailyNoteDto | null>(`${this.baseUrl}/calendar/notes`, {
        params: { userId: this.demoId, date },
      })
      .pipe(catchError(() => of(null)));
  }

  upsertNote(date: string, content: string): Observable<DailyNoteDto> {
    return this.http.post<DailyNoteDto>(`${this.baseUrl}/calendar/notes`, {
      userId: this.demoId,
      date,
      content,
    });
  }
}
