import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pw && confirm && pw !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './sign-up.component.html',
})
export class SignUpComponent implements OnInit {
  form!: FormGroup;
  isLoading = false;
  serverError: string | null = null;
  showPassword = false;
  showConfirm = false;

  constructor(
    private fb: FormBuilder,
    private authSvc: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        fullName: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch },
    );
  }

  get f() {
    return this.form.controls;
  }

  get passwordMismatch(): boolean {
    return (
      this.form.hasError('passwordsMismatch') &&
      !!this.f['confirmPassword'].touched
    );
  }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading) return;
    this.isLoading = true;
    this.serverError = null;

    const { fullName, email, password } = this.form.value as {
      fullName: string;
      email: string;
      password: string;
    };

    this.authSvc.register({ fullName, email, password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        this.serverError =
          err?.error?.message ?? 'Error al crear la cuenta. Intenta de nuevo.';
      },
    });
  }
}
