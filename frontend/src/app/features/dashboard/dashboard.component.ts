import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardStats } from '../../core/models/dashboard.model';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { NextMeetingHeroComponent } from './components/next-meeting-hero/next-meeting-hero.component';
import { UpcomingMeetingsListComponent } from './components/upcoming-meetings-list/upcoming-meetings-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardStatsComponent,
    NextMeetingHeroComponent,
    UpcomingMeetingsListComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el dashboard. Verifique que el backend esté activo.';
        this.loading = false;
      },
    });
  }
}
