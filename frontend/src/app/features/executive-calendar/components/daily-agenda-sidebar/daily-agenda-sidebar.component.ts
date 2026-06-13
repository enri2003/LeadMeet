import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CalendarEventItem, MONTH_NAMES } from '../../../../core/models/calendar.model';

@Component({
  selector: 'app-daily-agenda-sidebar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-agenda-sidebar.component.html',
})
export class DailyAgendaSidebarComponent {
  @Input({ required: true }) selectedDate!: Date;
  @Input() meetings: CalendarEventItem[] = [];
  @Output() schedule = new EventEmitter<void>();

  private readonly router = inject(Router);
  readonly monthNames = MONTH_NAMES;

  get dateLabel(): string {
    const d = this.selectedDate;
    return `${d.getDate()} de ${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  get isToday(): boolean {
    const t = new Date();
    return this.selectedDate.getFullYear() === t.getFullYear() &&
           this.selectedDate.getMonth() === t.getMonth() &&
           this.selectedDate.getDate() === t.getDate();
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  enter(m: CalendarEventItem): void {
    const roomId = m.meetingCode ?? m.id;
    this.router.navigate(['/meeting', roomId]);
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      strategy: 'Estrategia', negotiation: 'Negociación',
      interview: 'Entrevista', general: 'General',
    };
    return map[type] ?? type;
  }

  typeBarColor(type: string): string {
    const map: Record<string, string> = {
      strategy: 'bg-blue-500', negotiation: 'bg-yellow-500',
      interview: 'bg-purple-500', general: 'bg-white/20',
    };
    return map[type] ?? 'bg-white/20';
  }
}
