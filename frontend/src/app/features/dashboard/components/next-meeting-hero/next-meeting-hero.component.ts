import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpcomingMeeting } from '../../../../core/models/dashboard.model';

@Component({
  selector: 'app-next-meeting-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './next-meeting-hero.component.html',
})
export class NextMeetingHeroComponent implements OnInit, OnDestroy {
  @Input() meeting: UpcomingMeeting | null = null;

  minutesLeft = 0;
  secondsLeft = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private tick(): void {
    if (!this.meeting) return;
    const diffMs = new Date(this.meeting.startTime).getTime() - Date.now();
    if (diffMs <= 0) {
      this.minutesLeft = 0;
      this.secondsLeft = 0;
      return;
    }
    this.minutesLeft = Math.floor(diffMs / 60000);
    this.secondsLeft = Math.floor((diffMs % 60000) / 1000);
  }

  get countdownDisplay(): string {
    if (this.minutesLeft >= 60) {
      const h = Math.floor(this.minutesLeft / 60);
      const m = this.minutesLeft % 60;
      return `${h}h ${m}m`;
    }
    return `${this.minutesLeft}m`;
  }

  get timeRange(): string {
    if (!this.meeting) return '';
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(this.meeting.startTime)} - ${fmt(this.meeting.endTime)}`;
  }

  get typeIcon(): string {
    switch (this.meeting?.type) {
      case 'strategy':    return 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z';
      case 'negotiation': return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      case 'interview':   return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      default:            return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    }
  }
}
