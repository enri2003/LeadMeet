import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpcomingMeeting } from '../../../../core/models/dashboard.model';

@Component({
  selector: 'app-upcoming-meetings-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upcoming-meetings-list.component.html',
})
export class UpcomingMeetingsListComponent {
  @Input() meetings: UpcomingMeeting[] = [];

  isToday(isoDate: string): boolean {
    const d = new Date(isoDate);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

  isNearStart(isoDate: string): boolean {
    const diff = new Date(isoDate).getTime() - Date.now();
    return diff >= 0 && diff <= 30 * 60 * 1000; // within 30 min
  }

  canEnter(meeting: UpcomingMeeting): boolean {
    return this.isToday(meeting.startTime) && this.isNearStart(meeting.startTime);
  }

  formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (this.isToday(isoDate)) return 'Hoy';
    if (d.getFullYear() === tomorrow.getFullYear() &&
        d.getMonth() === tomorrow.getMonth() &&
        d.getDate() === tomorrow.getDate()) return 'Mañana';

    return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
  }

  formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  typeIconPath(type: string): string {
    switch (type) {
      case 'strategy':    return 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z';
      case 'negotiation': return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      case 'interview':   return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      default:            return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    }
  }

  /** Show max 3 avatars, then +N badge */
  visibleParticipants(meeting: UpcomingMeeting) {
    return meeting.participants.slice(0, 3);
  }

  extraCount(meeting: UpcomingMeeting): number {
    return Math.max(0, meeting.participantCount - 3);
  }

  avatarColor(index: number): string {
    const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600'];
    return colors[index % colors.length];
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
