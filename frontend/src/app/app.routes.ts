import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MeetingRoomComponent } from './features/meeting-room/meeting-room.component';

export const routes: Routes = [
  { path: '',                    component: DashboardComponent },
  { path: 'meetings',            component: DashboardComponent },
  { path: 'calendar',            component: DashboardComponent },
  { path: 'profile',             component: DashboardComponent },
  { path: 'room/:roomId',        component: MeetingRoomComponent },
  { path: '**', redirectTo: '' },
];
