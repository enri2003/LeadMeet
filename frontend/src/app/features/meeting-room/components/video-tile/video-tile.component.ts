import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-tile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full h-full bg-black rounded-2xl border border-white/5 overflow-hidden select-none">

      <!-- Video element — local view is mirrored so it feels natural -->
      <video
        #videoEl
        autoplay
        playsinline
        [muted]="isLocal"
        [class.hidden]="isCameraOff"
        [style.transform]="isLocal ? 'scaleX(-1)' : ''"
        class="w-full h-full object-cover"
      ></video>

      <!-- Avatar placeholder when camera is off -->
      <div *ngIf="isCameraOff"
           class="absolute inset-0 flex flex-col items-center justify-center"
           [style.background]="avatarBg">
        <div class="w-20 h-20 rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg"
             [style.background]="avatarColor + '55'">
          <span class="text-white text-3xl font-bold" style="text-shadow: 0 2px 8px rgba(0,0,0,0.5)">{{ initials }}</span>
        </div>
        <p class="text-white/60 text-xs font-medium mt-3 tracking-wide">{{ name }}</p>
      </div>

      <!-- Active speaker ring -->
      <div *ngIf="isActiveSpeaker"
           class="absolute inset-0 rounded-2xl border-2 border-[#0055ff] pointer-events-none
                  shadow-[0_0_16px_rgba(0,85,255,0.4)]"></div>

      <!-- Bottom label bar -->
      <div class="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between
                  bg-gradient-to-t from-black/60 to-transparent">
        <span class="text-white text-xs font-medium truncate drop-shadow">
          {{ name }}{{ isLocal ? ' (Tú)' : '' }}
        </span>
        <div class="flex items-center gap-1">
          <span *ngIf="isMuted" class="flex items-center justify-center w-5 h-5 rounded-full bg-red-600/80">
            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  `,
})
export class VideoTileComponent implements OnChanges, AfterViewInit {
  @Input() stream: MediaStream | null | undefined;
  @Input() isLocal = false;
  @Input() name = '';
  @Input() isMuted = false;
  @Input() isCameraOff = false;
  @Input() isActiveSpeaker = false;

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  private static readonly PALETTE = [
    '#1e3a5f','#5f1e1e','#3b1e5f','#1e5f3b',
    '#5f3b1e','#1e5f5f','#5f1e3b','#1e3b5f',
    '#4a1e5f','#2d4a1e','#5f4a1e','#1e4a5f',
  ];

  get initials(): string {
    return (this.name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  get avatarColor(): string {
    const hash = (this.name || 'U').split('').reduce((acc, c, i) => acc + (c.codePointAt(0) ?? 0) * (i + 1), 0);
    return VideoTileComponent.PALETTE[Math.abs(hash) % VideoTileComponent.PALETTE.length];
  }

  get avatarBg(): string {
    return this.avatarColor + 'cc';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stream'] && this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = this.stream ?? null;
    }
  }

  ngAfterViewInit(): void {
    if (this.stream && this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = this.stream;
    }
  }
}
