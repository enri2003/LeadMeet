import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'meetings', component: DashboardComponent }, // placeholder for future module
  { path: 'calendar', component: DashboardComponent }, // placeholder for future module
  { path: 'profile', component: DashboardComponent },  // placeholder for future module
  { path: '**', redirectTo: '' },
];
