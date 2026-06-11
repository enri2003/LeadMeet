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
    return (pct >= 0 ? '+' : '') + pct + '%';
  }

  get isPositive(): boolean {
    return (this.stats?.percentageChange ?? 0) >= 0;
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
