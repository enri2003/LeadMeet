import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  step: 1 | 2 = 1;
  pendingEmail = '';

  credForm: FormGroup;
  otpForm: FormGroup;

  isLoading = false;
  serverError: string | null = null;
  showPassword = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authSvc: AuthService,
    private readonly router: Router,
  ) {
    this.credForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  get fc() { return this.credForm.controls; }
  get fo() { return this.otpForm.controls; }

  onSubmit(): void {
    if (this.credForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.serverError = null;

    const { email, password } = this.credForm.value as { email: string; password: string };

    this.authSvc.login(email, password).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.pendingEmail = res.email;
        this.step = 2;
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError = err?.error?.message ?? 'Error al iniciar sesión. Verifica tus credenciales.';
      },
    });
  }

  onVerifyOtp(): void {
    if (this.otpForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.serverError = null;

    const { code } = this.otpForm.value as { code: string };

    this.authSvc.verifyLoginOtp(this.pendingEmail, code).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError = err?.error?.message ?? 'Código incorrecto o expirado.';
      },
    });
  }

  backToLogin(): void {
    this.step = 1;
    this.serverError = null;
    this.otpForm.reset();
  }
}
