import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsService } from '../../core/services/settings.service';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-advanced-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './advanced-settings.component.html',
})
export class AdvancedSettingsComponent {
  private readonly settingsSvc = inject(SettingsService);
  private readonly authSvc = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  loggingOut = false;
  showDeleteModal = false;
  deleteConfirmText = '';
  deleting = false;

  onLogoutAll(): void {
    if (!confirm('¿Cerrar sesión en todos los dispositivos?')) return;
    this.loggingOut = true;
    this.settingsSvc.logoutAll().subscribe({
      next: () => {
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
    });
  }

  onDeleteAccount(): void {
    if (this.deleteConfirmText !== 'ELIMINAR' || this.deleting) return;
    this.deleting = true;
    this.authSvc.deleteAccount().subscribe({
      next: () => {
        this.authSvc.logout();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.cdr.markForCheck();
      },
    });
  }
}
