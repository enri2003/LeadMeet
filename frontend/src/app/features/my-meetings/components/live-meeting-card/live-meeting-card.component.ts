import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MeetingDto, TYPE_LABELS } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-live-meeting-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-meeting-card.component.html',
})
export class LiveMeetingCardComponent {
  @Input({ required: true }) meeting!: MeetingDto;

  private readonly router = inject(Router);

  readonly typeLabels = TYPE_LABELS;

  readonly avatarColors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600',
    'bg-orange-600', 'bg-pink-600', 'bg-teal-600',
  ];

  get visibleParticipants() {
    return this.meeting.participants.slice(0, 4);
  }

  get extraCount(): number {
    return Math.max(0, this.meeting.participants.length - 4);
  }

  get elapsed(): string {
    const diff = Math.floor((Date.now() - new Date(this.meeting.startTime).getTime()) / 60_000);
    if (diff < 1)  return 'Recién iniciada';
    if (diff < 60) return `${diff} min en curso`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h ${m}min en curso` : `${h}h en curso`;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  enter(): void {
    const roomId = this.meeting.meetingCode ?? this.meeting.id;
    this.router.navigate(['/meeting', roomId]);
  }
}
