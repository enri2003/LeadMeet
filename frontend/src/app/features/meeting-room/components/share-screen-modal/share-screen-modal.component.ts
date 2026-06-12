import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  ScreenShareService,
  ScreenShareOptions,
} from '../../../../core/services/screen-share.service';

export type ShareTab = 'screen' | 'window' | 'browser';

export interface ScreenSource {
  id: string;
  label: string;
  thumbnailDataUrl: string | null;
  isSelected: boolean;
}

@Component({
  selector: 'app-share-screen-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './share-screen-modal.component.html',
})
export class ShareScreenModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;

  /** Fires when sharing starts successfully (MediaStream ready) */
  @Output() shareStarted = new EventEmitter<MediaStream>();

  /** Fires when user cancels or closes the modal */
  @Output() cancelled = new EventEmitter<void>();

  /** Fires when sharing is stopped (native button or stopCapture()) */
  @Output() shareStopped = new EventEmitter<void>();

  activeTab: ShareTab = 'screen';
  withAudio = false;
  optimizeForVideo = false;
  viewMode: 'grid' | 'list' = 'grid';
  selectedSourceId: string | null = null;
  isLoading = false;
  captureError: string | null = null;

  private sub = new Subscription();

  screenSources: ScreenSource[] = [
    { id: 'screen-1', label: 'Pantalla principal 1', thumbnailDataUrl: null, isSelected: true },
    { id: 'screen-2', label: 'Monitor externo 2',   thumbnailDataUrl: null, isSelected: false },
  ];

  windowSources: ScreenSource[] = [
    { id: 'win-1', label: 'Chrome — Lead Meet',      thumbnailDataUrl: null, isSelected: false },
    { id: 'win-2', label: 'VS Code — proyecto',      thumbnailDataUrl: null, isSelected: false },
    { id: 'win-3', label: 'Terminal',                thumbnailDataUrl: null, isSelected: false },
    { id: 'win-4', label: 'Explorador de archivos',  thumbnailDataUrl: null, isSelected: false },
  ];

  browserTabSources: ScreenSource[] = [
    { id: 'tab-1', label: 'Lead Meet — Dashboard',  thumbnailDataUrl: null, isSelected: false },
    { id: 'tab-2', label: 'Nueva pestaña',           thumbnailDataUrl: null, isSelected: false },
  ];

  tabs: { id: ShareTab; label: string; iconPath: string }[] = [
    {
      id: 'screen',
      label: 'Toda la pantalla',
      iconPath: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1',
    },
    {
      id: 'window',
      label: 'Ventana de aplicación',
      iconPath: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
    },
    {
      id: 'browser',
      label: 'Pestaña del navegador',
      iconPath: 'M3 7a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7z M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2',
    },
  ];

  constructor(private screenShareSvc: ScreenShareService) {}

  ngOnInit(): void {
    this.selectedSourceId = this.screenSources[0].id;

    // Forward "stopped externally" event to parent
    this.sub.add(
      this.screenShareSvc.sharingStopped$.subscribe(() => {
        this.shareStopped.emit();
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get activeSources(): ScreenSource[] {
    switch (this.activeTab) {
      case 'screen':  return this.screenSources;
      case 'window':  return this.windowSources;
      case 'browser': return this.browserTabSources;
    }
  }

  get canShare(): boolean {
    return this.selectedSourceId !== null && !this.isLoading;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  selectTab(tab: ShareTab): void {
    this.activeTab = tab;
    this.selectedSourceId = null;
    this.captureError = null;
  }

  selectSource(source: ScreenSource): void {
    this.selectedSourceId = source.id;
    this.captureError = null;
  }

  isSourceSelected(source: ScreenSource): boolean {
    return this.selectedSourceId === source.id;
  }

  /** Map selected tab to the displaySurface hint understood by the browser */
  private get displaySurface(): 'monitor' | 'window' | 'browser' {
    switch (this.activeTab) {
      case 'screen':  return 'monitor';
      case 'window':  return 'window';
      case 'browser': return 'browser';
    }
  }

  async onShare(): Promise<void> {
    if (!this.canShare) return;

    this.isLoading = true;
    this.captureError = null;

    const opts: ScreenShareOptions = {
      withAudio:        this.withAudio,
      optimizeForVideo: this.optimizeForVideo,
      displaySurface:   this.displaySurface,
    };

    try {
      const stream = await this.screenShareSvc.startCapture(opts);
      this.shareStarted.emit(stream);
    } catch (err: unknown) {
      this.captureError =
        err instanceof Error ? err.message : 'No se pudo iniciar la captura.';
    } finally {
      this.isLoading = false;
    }
  }

  onCancel(): void {
    this.captureError = null;
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onCancel();
    }
  }
}
