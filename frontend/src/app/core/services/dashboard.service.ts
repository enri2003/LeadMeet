import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardStats } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = 'http://localhost:3000/dashboard/stats';

  constructor(private http: HttpClient) {}

  getStats(userId?: string): Observable<DashboardStats> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    return this.http.get<DashboardStats>(this.apiUrl, { params });
  }
}
