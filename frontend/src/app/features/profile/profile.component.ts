import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth/auth.service';
import { environment } from '../../../environments/environment';

interface ProfileData {
  id: string;
  name: string;
  fullName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private readonly authSvc = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly http = inject(HttpClient);

  profile: ProfileData | null = null;
  loading = true;

  editMode = false;
  editFullName = '';
  editName = '';
  saving = false;
  saveSuccess = false;
  saveError = '';

  get initials(): string {
    const n = this.profile?.fullName || this.profile?.name || 'U';
    return n.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  }

  get displayName(): string {
    return this.profile?.fullName || this.profile?.name || 'Usuario';
  }

  ngOnInit(): void {
    const session = this.authSvc.getSession();
    if (!session) return;

    this.http
      .get<ProfileData>(`${environment.apiUrl}/users/profile?userId=${session.userId}`)
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          // Fallback to session data
          this.profile = {
            id: session.userId,
            name: session.name,
            fullName: session.fullName,
            email: session.email,
            role: session.role,
            avatarUrl: session.avatarUrl,
          };
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  startEdit(): void {
    this.editFullName = this.profile?.fullName ?? '';
    this.editName = this.profile?.name ?? '';
    this.saveError = '';
    this.editMode = true;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editMode = false;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  saveProfile(): void {
    const session = this.authSvc.getSession();
    if (!session || this.saving) return;

    this.saving = true;
    this.saveError = '';

    this.http
      .put<ProfileData>(`${environment.apiUrl}/users/profile?userId=${session.userId}`, {
        fullName: this.editFullName.trim() || null,
        name: this.editName.trim() || this.profile?.name,
      })
      .subscribe({
        next: (updated) => {
          this.profile = updated;
          this.editMode = false;
          this.saving = false;
          this.saveSuccess = true;
          // Update session storage so sidebar reflects new name
          const raw = localStorage.getItem('lm_session');
          if (raw) {
            const stored = JSON.parse(raw);
            stored.fullName = updated.fullName;
            stored.name = updated.name;
            localStorage.setItem('lm_session', JSON.stringify(stored));
          }
          this.cdr.markForCheck();
          setTimeout(() => { this.saveSuccess = false; this.cdr.markForCheck(); }, 2500);
        },
        error: () => {
          this.saving = false;
          this.saveError = 'No se pudo guardar. Inténtalo de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }
}
