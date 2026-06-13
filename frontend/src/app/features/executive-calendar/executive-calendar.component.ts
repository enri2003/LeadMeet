import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CalendarApiService } from '../../core/services/calendar-api.service';
import {
  CalendarDay,
  CalendarEventItem,
  CalendarMonthData,
  DAY_HEADERS,
  EVENT_TYPE_DOT,
  MONTH_NAMES,
} from '../../core/models/calendar.model';
import { DailyAgendaSidebarComponent } from './components/daily-agenda-sidebar/daily-agenda-sidebar.component';
import { QuickNotesComponent } from './components/quick-notes/quick-notes.component';

@Component({
  selector: 'app-executive-calendar',
  standalone: true,
  imports: [CommonModule, DailyAgendaSidebarComponent, QuickNotesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executive-calendar.component.html',
})
export class ExecutiveCalendarComponent implements OnInit {
  private readonly api    = inject(CalendarApiService);
  private readonly cdr    = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

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
    // Navigate to meetings page — extend later with a create-meeting modal
    this.router.navigate(['/meetings']);
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
