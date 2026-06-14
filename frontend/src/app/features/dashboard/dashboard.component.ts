import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { MeetingsApiService } from '../../core/services/meetings-api.service';
import { DashboardStats } from '../../core/models/dashboard.model';
import { MeetingType } from '../../core/models/meeting.model';
import { DashboardStatsComponent } from './components/dashboard-stats/dashboard-stats.component';
import { NextMeetingHeroComponent } from './components/next-meeting-hero/next-meeting-hero.component';
import { UpcomingMeetingsListComponent } from './components/upcoming-meetings-list/upcoming-meetings-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

  showNewMeetingModal = false;
  showJoinModal = false;
  joinCode = '';
  creatingMeeting = false;
  newMeeting = {
    title: '',
    type: 'general' as MeetingType,
    startTime: '',
    endTime: '',
    description: '',
    isConfidential: false,
  };

  readonly meetingTypes: { value: MeetingType; label: string }[] = [
    { value: 'general',     label: 'General' },
    { value: 'strategy',    label: 'Estrategia' },
    { value: 'negotiation', label: 'Negociación' },
    { value: 'interview',   label: 'Entrevista' },
  ];

  private readonly router      = inject(Router);
  private readonly authSvc     = inject(AuthService);
  private readonly meetingsApi = inject(MeetingsApiService);

  get userName(): string {
    const s = this.authSvc.getSession();
    return s?.fullName || s?.name || 'Usuario';
  }

  constructor(private dashboardService: DashboardService) {}

  onJoinMeeting(): void {
    const raw = this.joinCode.trim();
    if (!raw) return;
    // Acepta enlace completo o solo el código
    const code = raw.includes('/meeting/') ? raw.split('/meeting/').pop()! : raw;
    this.showJoinModal = false;
    this.router.navigate(['/meeting', code]);
  }

  openNewMeeting(): void {
    this.newMeeting = { title: '', type: 'general', startTime: '', endTime: '', description: '', isConfidential: false };
    this.showNewMeetingModal = true;
  }

  onStartNow(): void {
    if (!this.newMeeting.title) return;
    this.creatingMeeting = true;
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    const session = this.authSvc.getSession();
    this.meetingsApi.createMeeting({
      title: this.newMeeting.title,
      type: this.newMeeting.type,
      description: this.newMeeting.description,
      isConfidential: this.newMeeting.isConfidential,
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      userId: session?.userId ?? '',
    }).subscribe({
      next: (meeting) => {
        this.creatingMeeting = false;
        this.showNewMeetingModal = false;
        this.router.navigate(['/meeting', meeting.meetingCode ?? meeting.id]);
      },
      error: () => { this.creatingMeeting = false; },
    });
  }

  onCreateMeeting(): void {
    if (!this.newMeeting.title || !this.newMeeting.startTime || !this.newMeeting.endTime) return;
    this.creatingMeeting = true;
    const session = this.authSvc.getSession();
    this.meetingsApi.createMeeting({
      ...this.newMeeting,
      userId: session?.userId ?? '',
    }).subscribe({
      next: () => {
        this.creatingMeeting = false;
        this.showNewMeetingModal = false;
        this.ngOnInit();
      },
      error: () => { this.creatingMeeting = false; },
    });
  }

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
