import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { MeetingDto, MeetingFilter } from '../models/meeting.model';

@Injectable({ providedIn: 'root' })
export class MeetingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';
  private readonly demoUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  getMeetings(
    filter: MeetingFilter,
    startDate?: string,
    endDate?: string,
  ): Observable<MeetingDto[]> {
    const params: Record<string, string> = { userId: this.demoUserId, status: filter };
    if (startDate) params['startDate'] = startDate;
    if (endDate)   params['endDate']   = endDate;
    return this.http.get<MeetingDto[]>(`${this.baseUrl}/meetings`, { params });
  }

  getLiveMeeting(): Observable<MeetingDto | null> {
    return this.getMeetings('live').pipe(map((list) => list[0] ?? null));
  }

  archiveMeeting(id: string): Observable<MeetingDto> {
    return this.http.patch<MeetingDto>(
      `${this.baseUrl}/meetings/${id}/archive`,
      {},
      { params: { userId: this.demoUserId } },
    );
  }
}
