import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { timeout } from 'rxjs';
import { CalendarApiService } from '../../core/services/calendar-api.service';
import { MeetingsApiService } from '../../core/services/meetings-api.service';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  CalendarDay,
  CalendarEventItem,
  CalendarMonthData,
  DAY_HEADERS,
  EVENT_TYPE_DOT,
  MONTH_NAMES,
} from '../../core/models/calendar.model';
import { MeetingType } from '../../core/models/meeting.model';
import { DailyAgendaSidebarComponent } from './components/daily-agenda-sidebar/daily-agenda-sidebar.component';
import { QuickNotesComponent } from './components/quick-notes/quick-notes.component';

@Component({
  selector: 'app-executive-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, DailyAgendaSidebarComponent, QuickNotesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executive-calendar.component.html',
})
export class ExecutiveCalendarComponent implements OnInit {
  private readonly api         = inject(CalendarApiService);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly authSvc     = inject(AuthService);
  private readonly cdr         = inject(ChangeDetectorRef);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);

  // Current view month
  currentYear  = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1; // 1-indexed

  // Selected day
  selectedDate = new Date();

  // Data
  monthData: CalendarMonthData = {};
  selectedMeetings: CalendarEventItem[] = [];
  noteContent = '';
  noteSaving  = false;
  noteSaved   = false;
  loading     = false;

  // Create meeting modal
  showCreateModal = false;
  creatingMeeting = false;
  createError: string | null = null;
  newMeeting = {
    title: '',
    type: 'general' as MeetingType,
    startTime: '',
    endTime: '',
    description: '',
    isConfidential: false,
  };
  readonly meetingTypes: { value: MeetingType; label: string }[] = [
    { value: 'general',     label: 'General' },
    { value: 'strategy',    label: 'Estrategia' },
    { value: 'negotiation', label: 'Negociación' },
    { value: 'interview',   label: 'Entrevista' },
    { value: 'clase',       label: 'Clase' },
  ];

  readonly monthNames   = MONTH_NAMES;
  readonly dayHeaders   = DAY_HEADERS;
  readonly eventTypeDot = EVENT_TYPE_DOT;

  // ─── Computed: 42-cell calendar grid ────────────────────────────────────────

  get calendarDays(): CalendarDay[] {
    const year  = this.currentYear;
    const month = this.currentMonth;
    const today = new Date();

    const firstDay  = new Date(year, month - 1, 1);
    const lastDate  = new Date(year, month, 0).getDate();

    // Monday-first offset (Mon=0 … Sun=6)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: CalendarDay[] = [];

    // Fill from previous month
    for (let i = startOffset; i > 0; i--) {
      days.push(this.makeDay(new Date(year, month - 1, 1 - i), false, today));
    }
    // Current month
    for (let d = 1; d <= lastDate; d++) {
      days.push(this.makeDay(new Date(year, month - 1, d), true, today));
    }
    // Fill to 42
    let next = 1;
    while (days.length < 42) {
      days.push(this.makeDay(new Date(year, month, next++), false, today));
    }
    return days;
  }

  get currentMonthLabel(): string {
    return `${this.monthNames[this.currentMonth - 1]} ${this.currentYear}`;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadMonth();
    this.loadNote();
    // Open create modal if redirected from dashboard with ?create=1
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('create') === '1') {
        this.openCreateModal();
        this.router.navigate([], { replaceUrl: true, queryParams: {} });
      }
    });
  }

  // ─── Month navigation ────────────────────────────────────────────────────────

  prevMonth(): void {
    if (this.currentMonth === 1) { this.currentMonth = 12; this.currentYear--; }
    else { this.currentMonth--; }
    this.monthData = {};
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.currentMonth === 12) { this.currentMonth = 1; this.currentYear++; }
    else { this.currentMonth++; }
    this.monthData = {};
    this.loadMonth();
  }

  // ─── Day selection ───────────────────────────────────────────────────────────

  selectDay(date: Date): void {
    this.selectedDate    = date;
    this.selectedMeetings = this.monthData[date.getDate()] ?? [];
    this.noteContent     = '';
    this.noteSaved       = false;
    this.cdr.markForCheck();
    this.loadNote();
  }

  // ─── Note save (called after debounce in QuickNotesComponent) ───────────────

  onNoteSave(content: string): void {
    const dateStr = this.toDateStr(this.selectedDate);
    this.noteSaving = true;
    this.noteSaved  = false;
    this.cdr.markForCheck();

    this.api.upsertNote(dateStr, content).subscribe({
      next: () => {
        this.noteSaving = false;
        this.noteSaved  = true;
        this.cdr.markForCheck();
        setTimeout(() => { this.noteSaved = false; this.cdr.markForCheck(); }, 2500);
      },
      error: () => {
        this.noteSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  onSchedule(): void {
    this.openCreateModal();
  }

  openCreateModal(): void {
    this.newMeeting = {
      title: '',
      type: 'general',
      startTime: '09:00',
      endTime: '10:00',
      description: '',
      isConfidential: false,
    };
    this.createError = null;
    this.showCreateModal = true;
    this.cdr.markForCheck();
  }

  private buildDateTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  }

  onCreateMeeting(): void {
    if (!this.newMeeting.title || !this.newMeeting.startTime || !this.newMeeting.endTime) return;
    this.createError = null;

    const startISO = this.buildDateTime(this.selectedDate, this.newMeeting.startTime);
    // If end hour <= start hour it crosses midnight — schedule end on the next day
    const [sh] = this.newMeeting.startTime.split(':').map(Number);
    const [eh] = this.newMeeting.endTime.split(':').map(Number);
    const endDate = eh <= sh ? new Date(this.selectedDate.getTime() + 86_400_000) : this.selectedDate;
    const endISO = this.buildDateTime(endDate, this.newMeeting.endTime);

    if (new Date(endISO) <= new Date(startISO)) {
      this.createError = 'La hora de fin debe ser posterior a la hora de inicio.';
      this.cdr.markForCheck();
      return;
    }

    this.creatingMeeting = true;
    const session = this.authSvc.getSession();
    if (!session?.userId) {
      this.creatingMeeting = false;
      this.createError = 'Tu sesión expiró. Inicia sesión de nuevo.';
      this.cdr.markForCheck();
      return;
    }
    this.meetingsApi.createMeeting({
      title: this.newMeeting.title,
      type: this.newMeeting.type,
      description: this.newMeeting.description || undefined,
      isConfidential: this.newMeeting.isConfidential,
      startTime: startISO,
      endTime: endISO,
      userId: session.userId,
    }).pipe(timeout(10000)).subscribe({
      next: () => {
        this.creatingMeeting = false;
        this.showCreateModal = false;
        this.loadMonth();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creatingMeeting = false;
        if (err?.name === 'TimeoutError') {
          this.createError = 'El servidor no respondió. Verifica que el backend esté corriendo.';
        } else {
          this.createError = err?.error?.message ?? 'Error al programar la reunión. Intenta de nuevo.';
        }
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private loadMonth(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.api.getEvents(this.currentYear, this.currentMonth).subscribe({
      next: (data) => {
        this.monthData        = data;
        this.selectedMeetings = data[this.selectedDate.getDate()] ?? [];
        this.loading          = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.monthData = {};
        this.loading   = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadNote(): void {
    this.api.getNote(this.toDateStr(this.selectedDate)).subscribe({
      next: (note) => {
        this.noteContent = note?.content ?? '';
        this.cdr.markForCheck();
      },
    });
  }

  private makeDay(date: Date, isCurrentMonth: boolean, today: Date): CalendarDay {
    const isToday = isCurrentMonth &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth()    === today.getMonth() &&
      date.getDate()     === today.getDate();

    const isSelected =
      date.getFullYear() === this.selectedDate.getFullYear() &&
      date.getMonth()    === this.selectedDate.getMonth() &&
      date.getDate()     === this.selectedDate.getDate();

    return {
      date,
      dayNum:         date.getDate(),
      isCurrentMonth,
      isToday,
      isSelected,
      events: isCurrentMonth ? (this.monthData[date.getDate()] ?? []) : [],
    };
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
