import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { MeetingDto, MeetingFilter, MeetingType } from '../models/meeting.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth/auth.service';

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  type: MeetingType;
  startTime: string;
  endTime: string;
  isConfidential?: boolean;
  userId: string;
}

@Injectable({ providedIn: 'root' })
export class MeetingsApiService {
  private readonly http    = inject(HttpClient);
  private readonly authSvc = inject(AuthService);
  private readonly baseUrl = environment.apiUrl;

  private get userId(): string {
    return this.authSvc.getSession()?.userId ?? '';
  }

  getMeetings(filter: MeetingFilter, startDate?: string, endDate?: string): Observable<MeetingDto[]> {
    const params: Record<string, string> = { userId: this.userId, status: filter };
    if (startDate) params['startDate'] = startDate;
    if (endDate)   params['endDate']   = endDate;
    return this.http.get<MeetingDto[]>(`${this.baseUrl}/meetings`, { params });
  }

  getLiveMeeting(): Observable<MeetingDto | null> {
    return this.getMeetings('live').pipe(map((list) => list[0] ?? null));
  }

  createMeeting(payload: CreateMeetingPayload): Observable<MeetingDto> {
    return this.http.post<MeetingDto>(`${this.baseUrl}/meetings`, payload);
  }

  archiveMeeting(id: string): Observable<MeetingDto> {
    return this.http.patch<MeetingDto>(
      `${this.baseUrl}/meetings/${id}/archive`,
      {},
      { params: { userId: this.userId } },
    );
  }
}
