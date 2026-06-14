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
import { SettingsService } from '../../core/services/settings.service';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  UserSettings,
  DEFAULT_SETTINGS,
  FONT_LABELS,
  PrivacyLevel,
  Theme,
} from '../../core/models/settings.model';

interface AudioDevice {
  deviceId: string;
  label: string;
}

@Component({
  selector: 'app-advanced-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './advanced-settings.component.html',
})
export class AdvancedSettingsComponent implements OnInit {
  private readonly settingsSvc = inject(SettingsService);
  private readonly authSvc = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  // Working copy — edits happen here before saving
  settings: UserSettings = { ...DEFAULT_SETTINGS };
  private savedSnapshot: UserSettings = { ...DEFAULT_SETTINGS };

  // Task 6.2 — enumerated devices
  audioInputs: AudioDevice[] = [];
  audioOutputs: AudioDevice[] = [];

  saving = false;
  saveSuccess = false;
  loggingOut = false;
  showDeleteModal = false;
  deleteConfirmText = '';
  deleting = false;

  readonly fontLabels = FONT_LABELS;
  readonly privacyOptions: { value: PrivacyLevel; label: string; desc: string }[] = [
    { value: 'organization', label: 'Solo mi organización', desc: 'Solo usuarios de tu dominio' },
    { value: 'anyone',       label: 'Cualquiera con el enlace', desc: 'Acceso público con enlace' },
    { value: 'verified',     label: 'Solo invitados verificados', desc: 'Lista de invitados aprobada' },
  ];
  readonly themes: { value: Theme; label: string; bg: string }[] = [
    { value: 'dark-lead',  label: 'Oscuro Lead',  bg: '#101415' },
    { value: 'light-lead', label: 'Claro Lead',   bg: '#f0f2f5' },
  ];
  readonly captionLangs = [
    { value: 'es', label: 'Español (ES)' },
    { value: 'en', label: 'English (EN)' },
    { value: 'pt', label: 'Português (PT)' },
    { value: 'fr', label: 'Français (FR)' },
  ];

  get fontSizeLabel(): string {
    return this.fontLabels[this.settings.fontSize] ?? `${this.settings.fontSize}px`;
  }

  get isDirty(): boolean {
    return JSON.stringify(this.settings) !== JSON.stringify(this.savedSnapshot);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadDevices();

    this.settingsSvc.load().subscribe({
      next: (s) => {
        this.settings = { ...s };
        this.savedSnapshot = { ...s };
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback to defaults when backend is offline
        this.settings = { ...DEFAULT_SETTINGS };
        this.savedSnapshot = { ...DEFAULT_SETTINGS };
        this.cdr.markForCheck();
      },
    });
  }

  // Task 6.2 — enumerate media devices
  async loadDevices(): Promise<void> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      const all = await navigator.mediaDevices.enumerateDevices();
      this.audioInputs = all
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Micrófono ${d.deviceId.slice(0, 6)}` }));
      this.audioOutputs = all
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Altavoz ${d.deviceId.slice(0, 6)}` }));
    } catch {
      this.audioInputs = [{ deviceId: 'default', label: 'Micrófono predeterminado' }];
      this.audioOutputs = [{ deviceId: 'default', label: 'Altavoz predeterminado' }];
    }
    this.cdr.markForCheck();
  }

  // ─── Control handlers ──────────────────────────────────────────────────────

  onSave(): void {
    this.saving = true;
    this.settingsSvc.save(this.settings).subscribe({
      next: (saved) => {
        this.settings = { ...saved };
        this.savedSnapshot = { ...saved };
        this.saving = false;
        this.saveSuccess = true;
        setTimeout(() => { this.saveSuccess = false; this.cdr.markForCheck(); }, 2500);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        // Optimistic local save
        this.savedSnapshot = { ...this.settings };
        this.saveSuccess = true;
        setTimeout(() => { this.saveSuccess = false; this.cdr.markForCheck(); }, 2500);
        this.cdr.markForCheck();
      },
    });
  }

  onUndo(): void {
    this.settings = { ...this.savedSnapshot };
    this.cdr.markForCheck();
  }

  onReset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.cdr.markForCheck();
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

  // Task 6.5 — global logout
  onLogoutAll(): void {
    if (!confirm('¿Cerrar sesión en todos los dispositivos?')) return;
    this.loggingOut = true;
    this.settingsSvc.logoutAll().subscribe({
      next: () => {
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/register']);
      },
      error: () => {
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/register']);
      },
    });
  }
}
