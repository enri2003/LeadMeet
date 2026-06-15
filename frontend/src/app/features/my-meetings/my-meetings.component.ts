import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  private readonly api    = inject(MeetingsApiService);
  private readonly cdr    = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  activeTab: Tab = 'upcoming';
  meetings: MeetingDto[] = [];
  liveMeeting: MeetingDto | null = null;
  loading = false;

  // Filter state
  startDate = '';
  endDate   = '';
  typeFilter = '';

  // Edit modal state
  editingMeeting: MeetingDto | null = null;
  editForm = { title: '', type: '', startTime: '', endTime: '', description: '' };
  editSaving = false;
  editError: string | null = null;

  readonly meetingTypeOptions = [
    { value: 'general',     label: 'General' },
    { value: 'strategy',    label: 'Estrategia' },
    { value: 'negotiation', label: 'Negociación' },
    { value: 'interview',   label: 'Entrevista' },
    { value: 'clase',       label: 'Clase' },
  ];

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
        this.meetings = this.meetings.filter((m) => m.id !== id);
        this.cdr.markForCheck();
      },
    });
  }

  onUnarchive(id: string): void {
    this.api.unarchiveMeeting(id).subscribe({
      next: () => this.loadMeetings(),
      error: () => {
        this.meetings = this.meetings.filter((m) => m.id !== id);
        this.cdr.markForCheck();
      },
    });
  }

  onDelete(id: string): void {
    if (!confirm('¿Estás seguro de que quieres eliminar esta reunión?')) return;
    this.api.deleteMeeting(id).subscribe({
      next: () => this.loadMeetings(),
      error: () => {
        this.meetings = this.meetings.filter((m) => m.id !== id);
        this.cdr.markForCheck();
      },
    });
  }

  onEnterMeeting(meeting: MeetingDto): void {
    const code = meeting.meetingCode ?? meeting.id;
    this.router.navigate(['/meeting', code]);
  }

  openEdit(meeting: MeetingDto): void {
    this.editingMeeting = meeting;
    this.editError = null;
    const start = new Date(meeting.startTime);
    const end   = new Date(meeting.endTime);
    this.editForm = {
      title:       meeting.title,
      type:        meeting.type,
      description: meeting.description ?? '',
      startTime:   `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
      endTime:     `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`,
    };
    this.cdr.markForCheck();
  }

  closeEdit(): void {
    this.editingMeeting = null;
    this.editError = null;
    this.cdr.markForCheck();
  }

  onSaveEdit(): void {
    if (!this.editingMeeting || !this.editForm.title || !this.editForm.startTime || !this.editForm.endTime) return;
    this.editError = null;

    const base = new Date(this.editingMeeting.startTime);
    base.setSeconds(0, 0);

    const [sh, sm] = this.editForm.startTime.split(':').map(Number);
    const [eh, em] = this.editForm.endTime.split(':').map(Number);

    const startDt = new Date(base); startDt.setHours(sh, sm, 0, 0);
    const endBase = eh <= sh ? new Date(base.getTime() + 86_400_000) : new Date(base);
    const endDt   = new Date(endBase); endDt.setHours(eh, em, 0, 0);

    if (endDt <= startDt) {
      this.editError = 'La hora de fin debe ser posterior a la hora de inicio.';
      this.cdr.markForCheck();
      return;
    }

    this.editSaving = true;
    this.api.updateMeeting(this.editingMeeting.id, {
      title:       this.editForm.title,
      type:        this.editForm.type,
      description: this.editForm.description || undefined,
      startTime:   startDt.toISOString(),
      endTime:     endDt.toISOString(),
    }).subscribe({
      next: () => {
        this.editSaving = false;
        this.editingMeeting = null;
        this.loadMeetings();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.editSaving = false;
        this.editError = err?.error?.message ?? 'Error al guardar. Intenta de nuevo.';
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
