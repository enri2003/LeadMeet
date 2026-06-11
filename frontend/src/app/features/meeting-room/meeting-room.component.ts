import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SignalingService } from '../../core/services/signaling.service';
import { MediaStreamService } from '../../core/services/media-stream.service';
import { RoomParticipant, ChatMessage } from '../../core/models/meeting-room.model';
import { VideoTileComponent } from './components/video-tile/video-tile.component';
import { MeetingControlsComponent } from './components/meeting-controls/meeting-controls.component';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoTileComponent, MeetingControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meeting-room.component.html',
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  private readonly signaling = inject(SignalingService);
  private readonly media = inject(MediaStreamService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  // ─── Room state ─────────────────────────────────────────────────────────────
  roomId = '';
  isHost = false;
  participants: RoomParticipant[] = [];
  localParticipant: RoomParticipant | null = null;
  chatMessages: ChatMessage[] = [];
  isChatOpen = true;

  // ─── Controls ────────────────────────────────────────────────────────────────
  isMuted = false;
  isCameraOff = false;
  isSharingScreen = false;

  // ─── Timer ───────────────────────────────────────────────────────────────────
  sessionDuration = '00:00:00';
  private sessionStart = Date.now();
  private timerInterval?: ReturnType<typeof setInterval>;

  // ─── Chat ────────────────────────────────────────────────────────────────────
  chatInput = '';

  // ─── WebRTC ──────────────────────────────────────────────────────────────────
  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly subs: Subscription[] = [];

  // ─── Computed ────────────────────────────────────────────────────────────────
  get mainParticipant(): RoomParticipant | undefined {
    const active = this.participants.find((p) => p.isActiveSpeaker);
    return active ?? this.participants[0] ?? this.localParticipant ?? undefined;
  }

  get thumbnailParticipants(): RoomParticipant[] {
    const mainId = this.mainParticipant?.socketId;
    const all = this.localParticipant
      ? [this.localParticipant, ...this.participants]
      : this.participants;
    return all.filter((p) => p.socketId !== mainId).slice(0, 5);
  }

  get allParticipantsForPanel(): RoomParticipant[] {
    return this.localParticipant
      ? [this.localParticipant, ...this.participants]
      : this.participants;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? 'sala-demo';
    this.startTimer();

    try {
      const localStream = await this.media.initLocalStream();
      this.localParticipant = {
        socketId: 'local',
        userId: 'local-user',
        name: 'Ricardo Mendoza',
        role: 'Anfitrión',
        isMuted: false,
        isCameraOff: false,
        isActiveSpeaker: false,
        stream: localStream,
      };
      this.cdr.markForCheck();
    } catch {
      this.localParticipant = {
        socketId: 'local',
        userId: 'local-user',
        name: 'Ricardo Mendoza',
        role: 'Anfitrión',
        isMuted: false,
        isCameraOff: true,
        isActiveSpeaker: false,
      };
    }

    this.signaling.connect();
    this.registerSignalingHandlers();

    await this.signaling.joinRoom({
      roomId: this.roomId,
      userId: 'local-user',
      name: 'Ricardo Mendoza',
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.media.stopAll();
    this.signaling.disconnect();
    clearInterval(this.timerInterval);
  }

  // ─── Signaling handlers ──────────────────────────────────────────────────────

  private registerSignalingHandlers(): void {
    // Room state: send offers to all existing participants
    this.subs.push(
      this.signaling.onRoomState().subscribe((state) => {
        this.isHost = state.isHost;
        for (const p of state.participants) {
          this.addParticipant(p);
          this.initiateOffer(p.socketId);
        }
        this.refresh();
      }),
    );

    // New user joined: existing users send offers to them
    this.subs.push(
      this.signaling.onUserJoined().subscribe((p) => {
        this.addParticipant(p);
        this.initiateOffer(p.socketId);
        this.refresh();
      }),
    );

    // User left
    this.subs.push(
      this.signaling.onUserLeft().subscribe(({ socketId }) => {
        this.removeParticipant(socketId);
        this.refresh();
      }),
    );

    // Receive offer → send answer
    this.subs.push(
      this.signaling.onOffer().subscribe(async ({ offer, fromSocketId }) => {
        const pc = this.getOrCreatePeer(fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signaling.sendAnswer(fromSocketId, answer);
      }),
    );

    // Receive answer
    this.subs.push(
      this.signaling.onAnswer().subscribe(async ({ answer, fromSocketId }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }),
    );

    // Receive ICE candidate
    this.subs.push(
      this.signaling.onIceCandidate().subscribe(async ({ candidate, fromSocketId }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
      }),
    );

    // Mute state changed
    this.subs.push(
      this.signaling.onMuteChanged().subscribe(({ socketId, isMuted }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.isMuted = isMuted; this.refresh(); }
      }),
    );

    // Camera state changed
    this.subs.push(
      this.signaling.onCameraChanged().subscribe(({ socketId, isCameraOff }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.isCameraOff = isCameraOff; this.refresh(); }
      }),
    );

    // Chat messages
    this.subs.push(
      this.signaling.onChatMessage().subscribe((msg) => {
        this.chatMessages.push(msg);
        this.refresh();
      }),
    );

    // Meeting ended by host
    this.subs.push(
      this.signaling.onMeetingEnded().subscribe(() => {
        this.cleanup();
        this.router.navigate(['/']);
      }),
    );
  }

  // ─── WebRTC helpers ──────────────────────────────────────────────────────────

  private getOrCreatePeer(socketId: string): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) {
      return this.peerConnections.get(socketId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks to the peer connection
    const localStream = this.media.currentLocalStream;
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Relay ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signaling.sendIceCandidate(socketId, candidate.toJSON());
    };

    // Receive remote stream
    pc.ontrack = ({ streams }) => {
      this.zone.run(() => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p && streams[0]) {
          p.stream = streams[0];
          this.refresh();
        }
      });
    };

    this.peerConnections.set(socketId, pc);
    return pc;
  }

  private async initiateOffer(targetSocketId: string): Promise<void> {
    const pc = this.getOrCreatePeer(targetSocketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.sendOffer(targetSocketId, offer);
  }

  // ─── Participant management ──────────────────────────────────────────────────

  private addParticipant(
    p: Omit<RoomParticipant, 'isActiveSpeaker' | 'stream'>,
  ): void {
    if (!this.participants.find((x) => x.socketId === p.socketId)) {
      this.participants.push({ ...p, isActiveSpeaker: false });
    }
  }

  private removeParticipant(socketId: string): void {
    this.participants = this.participants.filter((p) => p.socketId !== socketId);
    const pc = this.peerConnections.get(socketId);
    pc?.close();
    this.peerConnections.delete(socketId);
  }

  // ─── Control handlers ────────────────────────────────────────────────────────

  onToggleMute(): void {
    this.isMuted = this.media.toggleMute();
    if (this.localParticipant) this.localParticipant.isMuted = this.isMuted;
    this.signaling.toggleMute(this.roomId, this.isMuted);
    this.refresh();
  }

  onToggleCamera(): void {
    this.isCameraOff = this.media.toggleCamera();
    if (this.localParticipant) this.localParticipant.isCameraOff = this.isCameraOff;
    this.signaling.toggleCamera(this.roomId, this.isCameraOff);
    this.refresh();
  }

  async onToggleScreenShare(): Promise<void> {
    if (this.isSharingScreen) {
      this.media.stopScreenShare();
      this.isSharingScreen = false;
    } else {
      const screen = await this.media.startScreenShare();
      this.isSharingScreen = screen !== null;
    }
    this.refresh();
  }

  onToggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    this.refresh();
  }

  onSendChat(): void {
    const msg = this.chatInput.trim();
    if (!msg) return;
    this.signaling.sendChatMessage(this.roomId, msg);
    this.chatInput = '';
  }

  onLeaveCall(): void {
    this.signaling.leaveRoom(this.roomId);
    this.cleanup();
    this.router.navigate(['/']);
  }

  onEndMeeting(): void {
    this.signaling.endMeeting(this.roomId);
    this.cleanup();
    this.router.navigate(['/']);
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.sessionStart = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.sessionStart) / 1000);
      const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
      const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      this.sessionDuration = `${h}:${m}:${s}`;
      this.cdr.markForCheck();
    }, 1000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private cleanup(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.media.stopAll();
    clearInterval(this.timerInterval);
  }

  private refresh(): void {
    this.cdr.markForCheck();
  }

  trackBySocketId(_: number, p: RoomParticipant): string {
    return p.socketId;
  }
}
