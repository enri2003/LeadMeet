import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
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
  @Input() isMuted = false;
  @Input() isCameraOff = false;
  @Input() isSharingScreen = false;
  @Input() isChatOpen = false;
  @Input() isHost = false;

  @Output() toggleMute = new EventEmitter<void>();
  @Output() toggleCamera = new EventEmitter<void>();
  @Output() toggleScreenShare = new EventEmitter<void>();
  @Output() toggleChat = new EventEmitter<void>();
  @Output() leaveCall = new EventEmitter<void>();
  @Output() endMeeting = new EventEmitter<void>();
}
