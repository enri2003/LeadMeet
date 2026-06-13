import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MeetingRoomComponent } from './features/meeting-room/meeting-room.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Auth (guest only) ────────────────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/sign-up/sign-up.component').then(m => m.SignUpComponent),
  },
  {
    path: 'verify-otp',
    loadComponent: () =>
      import('./features/auth/otp-verification/otp-verification.component').then(
        m => m.OtpVerificationComponent,
      ),
  },

  // ── Protected (auth required) ────────────────────────────────────────────────
  { path: '',        canActivate: [authGuard], component: DashboardComponent },
  { path: 'profile', canActivate: [authGuard], component: DashboardComponent },
  {
    path: 'meetings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/my-meetings/my-meetings.component').then(m => m.MyMeetingsComponent),
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/executive-calendar/executive-calendar.component').then(
        m => m.ExecutiveCalendarComponent,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/advanced-settings/advanced-settings.component').then(
        m => m.AdvancedSettingsComponent,
      ),
  },
  {
    path: 'meeting/:roomId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/meeting-room/meeting-room.component').then(m => m.MeetingRoomComponent),
  },
  { path: 'room/:roomId', canActivate: [authGuard], component: MeetingRoomComponent },

  // ── Fallback ─────────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
