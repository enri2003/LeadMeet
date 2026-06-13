import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingDto, TYPE_COLORS, TYPE_LABELS } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-past-meetings-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './past-meetings-list.component.html',
})
export class PastMeetingsListComponent {
  @Input() meetings: MeetingDto[] = [];
  @Input() showArchiveButton = false;
  @Input() emptyLabel = 'No hay reuniones en esta sección';

  @Output() archive = new EventEmitter<string>();

  readonly typeLabels = TYPE_LABELS;
  readonly typeColors = TYPE_COLORS;

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-BO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}
