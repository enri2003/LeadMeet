import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingsApiService } from '../../core/services/meetings-api.service';
import { MeetingDto, MeetingFilter } from '../../core/models/meeting.model';
import { LiveMeetingCardComponent } from './components/live-meeting-card/live-meeting-card.component';
import { PastMeetingsListComponent } from './components/past-meetings-list/past-meetings-list.component';

type Tab = 'upcoming' | 'past' | 'archived';

interface QuickFilter {
  label: string;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-my-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, LiveMeetingCardComponent, PastMeetingsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-meetings.component.html',
})
export class MyMeetingsComponent implements OnInit {
  private readonly api = inject(MeetingsApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  activeTab: Tab = 'upcoming';
  meetings: MeetingDto[] = [];
  liveMeeting: MeetingDto | null = null;
  loading = false;

  // Filter state
  startDate = '';
  endDate   = '';
  typeFilter = '';

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    {
      key: 'upcoming',
      label: 'Próximas',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      key: 'past',
      label: 'Pasadas',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    {
      key: 'archived',
      label: 'Archivadas',
      icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    },
  ];

  readonly quickFilters: QuickFilter[] = [
    {
      label: 'Esta semana',
      startDate: this.weekStart(),
      endDate: this.weekEnd(),
    },
    {
      label: 'Este mes',
      startDate: this.monthStart(),
      endDate: this.monthEnd(),
    },
  ];

  get filteredMeetings(): MeetingDto[] {
    if (!this.typeFilter) return this.meetings;
    return this.meetings.filter((m) => m.type === this.typeFilter);
  }

  get emptyLabel(): string {
    const map: Record<Tab, string> = {
      upcoming: 'No tienes reuniones próximas',
      past: 'No hay reuniones pasadas',
      archived: 'No hay reuniones archivadas',
    };
    return map[this.activeTab];
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadLive();
    this.loadMeetings();
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.startDate = '';
    this.endDate   = '';
    this.typeFilter = '';
    this.loadMeetings();
  }

  applyQuickFilter(qf: QuickFilter): void {
    this.startDate = qf.startDate;
    this.endDate   = qf.endDate;
    this.loadMeetings();
  }

  clearDates(): void {
    this.startDate = '';
    this.endDate   = '';
    this.loadMeetings();
  }

  onArchive(id: string): void {
    this.api.archiveMeeting(id).subscribe({
      next: () => this.loadMeetings(),
      error: () => {
        // Optimistic: remove locally until refresh
        this.meetings = this.meetings.filter((m) => m.id !== id);
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Data loading ────────────────────────────────────────────────────────────

  private loadLive(): void {
    this.api.getLiveMeeting().subscribe({
      next: (m) => { this.liveMeeting = m; this.cdr.markForCheck(); },
      error: ()  => { this.liveMeeting = null; },
    });
  }

  private loadMeetings(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const filter: MeetingFilter = this.activeTab === 'upcoming' ? 'upcoming'
      : this.activeTab === 'past' ? 'past' : 'archived';

    this.api
      .getMeetings(filter, this.startDate || undefined, this.endDate || undefined)
      .subscribe({
        next: (list) => {
          this.meetings = list;
          this.loading  = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.meetings = [];
          this.loading  = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Date helpers ────────────────────────────────────────────────────────────

  private weekStart(): string {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().slice(0, 10);
  }

  private weekEnd(): string {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 7);
    return d.toISOString().slice(0, 10);
  }

  private monthStart(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }

  private monthEnd(): string {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }
}
