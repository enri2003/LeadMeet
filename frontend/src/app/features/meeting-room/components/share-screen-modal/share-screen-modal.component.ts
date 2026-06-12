import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

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

  /** Emits the chosen options when user clicks "Compartir ahora" */
  @Output() shareConfirmed = new EventEmitter<{
    sourceType: ShareTab;
    withAudio: boolean;
    optimizeForVideo: boolean;
  }>();

  @Output() cancelled = new EventEmitter<void>();

  activeTab: ShareTab = 'screen';
  withAudio = false;
  optimizeForVideo = false;
  viewMode: 'grid' | 'list' = 'grid';

  selectedSourceId: string | null = null;

  /** Placeholder sources shown per tab */
  screenSources: ScreenSource[] = [
    { id: 'screen-1', label: 'Pantalla principal 1', thumbnailDataUrl: null, isSelected: true },
    { id: 'screen-2', label: 'Monitor externo 2',   thumbnailDataUrl: null, isSelected: false },
  ];

  windowSources: ScreenSource[] = [
    { id: 'win-1', label: 'Chrome — Lead Meet',   thumbnailDataUrl: null, isSelected: false },
    { id: 'win-2', label: 'VS Code — proyecto',   thumbnailDataUrl: null, isSelected: false },
    { id: 'win-3', label: 'Terminal',              thumbnailDataUrl: null, isSelected: false },
    { id: 'win-4', label: 'Explorador de archivos', thumbnailDataUrl: null, isSelected: false },
  ];

  browserTabSources: ScreenSource[] = [
    { id: 'tab-1', label: 'Lead Meet — Dashboard', thumbnailDataUrl: null, isSelected: false },
    { id: 'tab-2', label: 'Nueva pestaña',          thumbnailDataUrl: null, isSelected: false },
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

  ngOnInit(): void {
    this.selectedSourceId = this.screenSources[0].id;
  }

  ngOnDestroy(): void {}

  get activeSources(): ScreenSource[] {
    switch (this.activeTab) {
      case 'screen':  return this.screenSources;
      case 'window':  return this.windowSources;
      case 'browser': return this.browserTabSources;
    }
  }

  get canShare(): boolean {
    return this.selectedSourceId !== null;
  }

  selectTab(tab: ShareTab): void {
    this.activeTab = tab;
    this.selectedSourceId = null;
  }

  selectSource(source: ScreenSource): void {
    this.selectedSourceId = source.id;
  }

  isSourceSelected(source: ScreenSource): boolean {
    return this.selectedSourceId === source.id;
  }

  onShare(): void {
    if (!this.canShare) return;
    this.shareConfirmed.emit({
      sourceType: this.activeTab,
      withAudio: this.withAudio,
      optimizeForVideo: this.optimizeForVideo,
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onCancel();
    }
  }
}
