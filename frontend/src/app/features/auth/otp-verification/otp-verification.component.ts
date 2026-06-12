import {
  Component,
  OnInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './otp-verification.component.html',
})
export class OtpVerificationComponent implements OnInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits: string[] = ['', '', '', '', '', ''];
  email = '';
  isLoading = false;
  isResending = false;
  serverError: string | null = null;
  successMsg: string | null = null;

  // Countdown 5 min = 300 s
  totalSeconds = 300;
  remainingSeconds = 300;
  private timer: ReturnType<typeof setInterval> | null = null;

  get minutesDisplay(): string {
    return String(Math.floor(this.remainingSeconds / 60)).padStart(2, '0');
  }

  get secondsDisplay(): string {
    return String(this.remainingSeconds % 60).padStart(2, '0');
  }

  get isExpired(): boolean {
    return this.remainingSeconds <= 0;
  }

  get progress(): number {
    return (this.remainingSeconds / this.totalSeconds) * 100;
  }

  get codeComplete(): boolean {
    return this.digits.every((d) => d !== '');
  }

  get maskedEmail(): string {
    if (!this.email) return '';
    const [local, domain] = this.email.split('@');
    const visible = local.slice(0, 2);
    const masked = '*'.repeat(Math.max(local.length - 2, 3));
    return `${visible}${masked}@${domain}`;
  }

  constructor(
    private authSvc: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startTimer(): void {
    this.clearTimer();
    this.remainingSeconds = 300;
    this.timer = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
      } else {
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    const input = this.otpInputs.toArray()[index].nativeElement;

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index]) {
        this.digits[index] = '';
      } else if (index > 0) {
        this.digits[index - 1] = '';
        this.otpInputs.toArray()[index - 1].nativeElement.focus();
      }
      this.serverError = null;
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      this.otpInputs.toArray()[index - 1].nativeElement.focus();
      return;
    }

    if (event.key === 'ArrowRight' && index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    this.digits[index] = event.key;
    input.value = event.key;

    if (index < 5) {
      this.otpInputs.toArray()[index + 1].nativeElement.focus();
    } else {
      this.onSubmit();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const nums = text.replace(/\D/g, '').slice(0, 6).split('');
    nums.forEach((n, i) => {
      if (i < 6) this.digits[i] = n;
    });
    const nextEmpty = this.digits.findIndex((d) => d === '');
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    this.otpInputs.toArray()[focusIndex]?.nativeElement.focus();

    if (this.codeComplete) this.onSubmit();
  }

  onSubmit(): void {
    if (!this.codeComplete || this.isLoading || this.isExpired) return;
    this.isLoading = true;
    this.serverError = null;

    const code = this.digits.join('');
    this.authSvc.verifyOtp({ email: this.email, code }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMsg = res.message;
        this.clearTimer();
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError = err?.error?.message ?? 'Código incorrecto. Inténtalo de nuevo.';
        this.digits = ['', '', '', '', '', ''];
        setTimeout(() => this.otpInputs.toArray()[0]?.nativeElement.focus(), 50);
      },
    });
  }

  resend(): void {
    if (this.isResending) return;
    this.isResending = true;
    this.serverError = null;

    this.authSvc.resendOtp(this.email).subscribe({
      next: () => {
        this.isResending = false;
        this.digits = ['', '', '', '', '', ''];
        this.startTimer();
        setTimeout(() => this.otpInputs.toArray()[0]?.nativeElement.focus(), 50);
      },
      error: (err) => {
        this.isResending = false;
        this.serverError = err?.error?.message ?? 'No se pudo reenviar el código.';
      },
    });
  }
}
