import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-meeting-controls',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meeting-controls.component.html',
})
export class MeetingControlsComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() isMuted = false;
  @Input() isCameraOff = false;
  @Input() isSharingScreen = false;
  @Input() isChatOpen = false;
  @Input() isHost = false;
  @Input() isPanelOpen = true;
  @Input() screenShareWithAudio = false;
  @Input() isLocked = false;

  @Output() toggleMute = new EventEmitter<void>();
  @Output() toggleCamera = new EventEmitter<void>();
  @Output() toggleScreenShare = new EventEmitter<void>();
  @Output() toggleChat = new EventEmitter<void>();
  @Output() togglePanel = new EventEmitter<void>();
  @Output() toggleScreenAudio = new EventEmitter<void>();
  @Output() emojiPicker = new EventEmitter<void>();
  @Output() leaveCall = new EventEmitter<void>();
  @Output() endMeeting = new EventEmitter<void>();

  linkCopied = false;
  showLinkTooltip = false;
  currentLink = '';

  copyInviteLink(): void {
    this.currentLink = globalThis.location.href;
    navigator.clipboard.writeText(this.currentLink).then(() => {
      this.linkCopied = true;
      this.showLinkTooltip = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.linkCopied = false;
        this.showLinkTooltip = false;
        this.cdr.markForCheck();
      }, 4000);
    });
  }
}
