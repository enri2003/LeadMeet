import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStats } from '../../../../core/models/dashboard.model';

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-stats.component.html',
})
export class DashboardStatsComponent {
  @Input() stats: DashboardStats | null = null;

  get percentageLabel(): string {
    const pct = this.stats?.percentageChange;
    if (pct === null || pct === undefined) return '—';
    if (pct === 0) return 'Igual que ayer';
    return (pct > 0 ? '+' : '') + pct + '% vs ayer';
  }

  get isPositive(): boolean {
    return (this.stats?.percentageChange ?? 0) >= 0;
  }

  get totalHoursLabel(): string {
    const hours = this.stats?.totalHours ?? 0;
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0 && m === 0) return '—';
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  get timingLabel(): string {
    const today = this.stats?.meetingsCompletedToday ?? 0;
    const yesterday = this.stats?.meetingsCompletedYesterday ?? 0;
    if (today === 0 && yesterday === 0) return 'Sin datos';
    return today >= yesterday ? 'Óptimo' : 'Por debajo';
  }

  get isOptimal(): boolean {
    return (this.stats?.meetingsCompletedToday ?? 0) >= (this.stats?.meetingsCompletedYesterday ?? 0);
  }
}
