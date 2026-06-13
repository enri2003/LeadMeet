import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quick-notes',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-notes.component.html',
})
export class QuickNotesComponent implements OnInit, OnDestroy {
  @Input() content = '';
  @Input() saving  = false;
  @Input() saved   = false;

  @Output() save = new EventEmitter<string>();

  private readonly noteSubject = new Subject<string>();
  private readonly destroy$    = new Subject<void>();

  ngOnInit(): void {
    this.noteSubject
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe((val) => this.save.emit(val));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.noteSubject.next(val);
  }
}
