import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

type Step = 'email' | 'code' | 'password';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  @ViewChildren('codeInput') codeInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly authSvc = inject(AuthService);
  private readonly router  = inject(Router);
  private readonly cdr     = inject(ChangeDetectorRef);

  step: Step = 'email';
  email = '';
  digits: string[] = ['', '', '', '', '', ''];
  newPassword = '';
  confirmPassword = '';
  showPassword = false;

  isLoading = false;
  serverError: string | null = null;
  successMsg: string | null = null;

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

  sendCode(): void {
    if (!this.email.trim() || this.isLoading) return;
    this.isLoading = true;
    this.serverError = null;
    this.authSvc.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.isLoading = false;
        this.step = 'code';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError = err?.error?.message ?? 'No se pudo enviar el código. Intenta de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    const input = this.codeInputs.toArray()[index].nativeElement;

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index]) {
        this.digits[index] = '';
      } else if (index > 0) {
        this.digits[index - 1] = '';
        this.codeInputs.toArray()[index - 1].nativeElement.focus();
      }
      this.serverError = null;
      this.cdr.markForCheck();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      this.codeInputs.toArray()[index - 1].nativeElement.focus();
      return;
    }
    if (event.key === 'ArrowRight' && index < 5) {
      this.codeInputs.toArray()[index + 1].nativeElement.focus();
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    this.digits[index] = event.key;
    input.value = event.key;
    this.cdr.markForCheck();

    if (index < 5) {
      this.codeInputs.toArray()[index + 1].nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const nums = text.replace(/\D/g, '').slice(0, 6).split('');
    nums.forEach((n, i) => { if (i < 6) this.digits[i] = n; });
    const nextEmpty = this.digits.findIndex((d) => d === '');
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    this.codeInputs.toArray()[focusIndex]?.nativeElement.focus();
    this.cdr.markForCheck();
  }

  verifyCode(): void {
    if (!this.codeComplete || this.isLoading) return;
    this.step = 'password';
    this.cdr.markForCheck();
  }

  resetPassword(): void {
    if (!this.newPassword || this.newPassword !== this.confirmPassword || this.isLoading) return;
    if (this.newPassword.length < 8) {
      this.serverError = 'La contraseña debe tener al menos 8 caracteres.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoading = true;
    this.serverError = null;
    const code = this.digits.join('');
    this.authSvc.resetPassword(this.email.trim(), code, this.newPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMsg = res.message;
        this.cdr.markForCheck();
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError = err?.error?.message ?? 'No se pudo restablecer la contraseña.';
        this.cdr.markForCheck();
      },
    });
  }
}
