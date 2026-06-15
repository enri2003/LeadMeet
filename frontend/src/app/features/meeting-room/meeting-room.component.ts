import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SignalingService } from '../../core/services/signaling.service';
import { MediaStreamService } from '../../core/services/media-stream.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { RoomParticipant, ChatMessage } from '../../core/models/meeting-room.model';
import { VideoTileComponent } from './components/video-tile/video-tile.component';
import { MeetingControlsComponent } from './components/meeting-controls/meeting-controls.component';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const AVATAR_PALETTE = [
  '#1e3a5f', '#5f1e1e', '#3b1e5f', '#1e5f3b',
  '#5f3b1e', '#1e5f5f', '#5f1e3b', '#1e3b5f',
  '#4a1e5f', '#2d4a1e', '#5f4a1e', '#1e4a5f',
];

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoTileComponent, MeetingControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meeting-room.component.html',
})
export class MeetingRoomComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly signaling = inject(SignalingService);
  private readonly media = inject(MediaStreamService);
  private readonly authSvc = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  get sessionName(): string {
    const s = this.authSvc.getSession();
    return s?.fullName || s?.name || 'Usuario';
  }

  get sessionUserId(): string {
    return this.authSvc.getSession()?.userId ?? 'local-user';
  }

  roomId = '';
  isHost = false;
  isWaiting = false;
  participants: RoomParticipant[] = [];
  localParticipant: RoomParticipant | null = null;
  chatMessages: ChatMessage[] = [];
  isChatOpen = false;
  isPanelOpen = true;
  isLocked = false;

  waitingParticipants: { socketId: string; userId: string; name: string }[] = [];
  isWaitingRoomEnabled = false;

  isMuted = true;
  isCameraOff = true;
  isSharingScreen = false;
  screenShareWithAudio = false;

  sessionDuration = '00:00:00';
  private sessionStart = Date.now();
  private timerInterval?: ReturnType<typeof setInterval>;

  chatInput = '';

  joinNotification: string | null = null;
  rejectedReason: string | null = null;
  rejectedScheduledAt: string | null = null;

  showEmojiPicker = false;
  floatingReactions: { id: number; emoji: string; name: string; x: number }[] = [];
  private reactionCounter = 0;
  readonly reactionEmojis = ['👍', '👎', '😂', '❤️', '😮', '👏', '🎉', '🔥', '😍', '🤔', '👋', '💯', '🙌', '😢', '🚀', '✅'];

  private speakingRafId?: number;
  private audioCtx?: AudioContext;

  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly screenSenders = new Map<string, RTCRtpSender[]>();
  private readonly subs: Subscription[] = [];
  private readonly offerFallbackTimers: ReturnType<typeof setTimeout>[] = [];

  @ViewChild('screenVideoEl') screenVideoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('waitingCamEl') waitingCamEl?: ElementRef<HTMLVideoElement>;

  get allParticipants(): RoomParticipant[] {
    return this.localParticipant
      ? [this.localParticipant, ...this.participants]
      : this.participants;
  }

  get screenSharingParticipant(): RoomParticipant | undefined {
    return this.allParticipants.find((p) => p.isSharingScreen);
  }

  get screenShareStream(): MediaStream | null | undefined {
    const sharer = this.screenSharingParticipant;
    if (!sharer) return null;
    if (sharer.socketId === 'local') return this.media.currentScreenStream;
    return sharer.screenStream ?? null;
  }

  get gridCols(): number {
    const n = this.allParticipants.length;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    if (n <= 6) return 3;
    return 4;
  }

  getAvatarColor(name: string): string {
    const hash = (name || 'U').split('').reduce(
      (acc, c, i) => acc + (c.codePointAt(0) ?? 0) * (i + 1),
      0,
    );
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  }

  ngOnInit(): void {
    void this.initializeRoom();
  }

  private async initializeRoom(): Promise<void> {
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? 'sala-demo';
    this.startTimer();

    try {
      const localStream = await this.media.initLocalStream();
      this.localParticipant = {
        socketId: 'local',
        userId: this.sessionUserId,
        name: this.sessionName,
        role: 'Participante',
        isMuted: true,
        isCameraOff: true,
        isActiveSpeaker: false,
        stream: localStream,
      };
      this.setupSpeakingDetection(localStream);
    } catch (err) {
      const name = (err as DOMException)?.name ?? '';
      const msg = name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Permite el acceso al micrófono y cámara en tu navegador'
        : 'Presiona los botones para activar micrófono o cámara';
      this.localParticipant = {
        socketId: 'local',
        userId: this.sessionUserId,
        name: this.sessionName,
        role: 'Participante',
        isMuted: true,
        isCameraOff: true,
        isActiveSpeaker: false,
      };
      this.showNotification(msg);
    }

    this.signaling.connect();
    this.registerSignalingHandlers();

    const joinResult = await this.signaling.joinRoom({
      roomId: this.roomId,
      userId: this.sessionUserId,
      name: this.sessionName,
    });

    if (joinResult.waiting) {
      this.isWaiting = true;
      this.refresh();
      return;
    }

    if (!joinResult.success) {
      await this.router.navigate(['/']);
      return;
    }

    this.refresh();
  }

  private async rejoinAfterReconnect(): Promise<void> {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.screenSenders.clear();
    this.participants = [];
    this.waitingParticipants = [];
    this.isWaiting = false;

    const joinResult = await this.signaling.joinRoom({
      roomId: this.roomId,
      userId: this.sessionUserId,
      name: this.sessionName,
    });

    if (joinResult.waiting) {
      this.isWaiting = true;
      this.isHost = false;
      if (this.localParticipant) {
        this.localParticipant.role = 'Participante';
      }
    } else if (joinResult.success) {
      this.isHost = joinResult.isHost;
      if (this.localParticipant) {
        this.localParticipant.role = joinResult.isHost ? 'Anfitrión' : 'Participante';
      }
    }
    // isWaitingRoomEnabled and isLocked are received via room-state event

    this.refresh();
  }

  ngAfterViewChecked(): void {
    const screenEl = this.screenVideoEl?.nativeElement;
    if (screenEl) {
      const stream = this.screenShareStream ?? null;
      if (screenEl.srcObject !== stream) {
        screenEl.srcObject = stream;
      }
    }

    const waitEl = this.waitingCamEl?.nativeElement;
    if (waitEl) {
      const stream = this.localParticipant?.stream ?? null;
      if (waitEl.srcObject !== stream) {
        waitEl.srcObject = stream;
      }
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.offerFallbackTimers.forEach((t) => clearTimeout(t));
    this.media.stopAll();
    this.signaling.disconnect();
    clearInterval(this.timerInterval);
    if (this.speakingRafId) {
      cancelAnimationFrame(this.speakingRafId);
    }
    void this.audioCtx?.close().catch(() => null);
  }

  private registerSignalingHandlers(): void {
    const subscriptions: Subscription[] = [
      this.signaling.onRoomState().subscribe((state) => {
        this.isHost = state.isHost;
        this.isWaitingRoomEnabled = state.isWaitingRoomEnabled ?? false;
        this.isLocked = state.isLocked ?? false;
        if (this.localParticipant) {
          this.localParticipant.role = state.isHost ? 'Anfitrión' : 'Participante';
        }
        for (const p of state.participants) {
          this.addParticipant(p);
        }
        this.refresh();
        // If no peer connection is established within 2 s, initiate from our side
        if (state.participants.length > 0) {
          this.scheduleOfferFallback(state.participants.map((p) => p.socketId));
        }
      }),

      this.signaling.onUserJoined().subscribe((p) => {
        this.addParticipant(p);
        void this.initiateOffer(p.socketId);
        this.showNotification(`${p.name} se unió`);
        this.refresh();
      }),

      this.signaling.onUserLeft().subscribe(({ socketId, kicked }) => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        if (participant) {
          if (kicked) {
            this.showNotification(
              this.isHost ? `Expulsaste a ${participant.name}` : `${participant.name} fue expulsado`,
            );
          } else {
            this.showNotification(`${participant.name} salió`);
          }
        }
        this.removeParticipant(socketId);
        this.refresh();
      }),

      this.signaling.onOffer().subscribe(({ offer, fromSocketId }) => {
        void this.handleOffer(offer, fromSocketId);
      }),

      this.signaling.onAnswer().subscribe(({ answer, fromSocketId }) => {
        void this.handleAnswer(answer, fromSocketId);
      }),

      this.signaling.onIceCandidate().subscribe(({ candidate, fromSocketId }) => {
        void this.handleIceCandidate(candidate, fromSocketId);
      }),

      this.signaling.onMuteChanged().subscribe(({ socketId, isMuted }) => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        if (participant) {
          participant.isMuted = isMuted;
          this.refresh();
        }
      }),

      this.signaling.onCameraChanged().subscribe(({ socketId, isCameraOff }) => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        if (participant) {
          participant.isCameraOff = isCameraOff;
          this.refresh();
        }
      }),

      this.signaling.onScreenShareChanged().subscribe(({ socketId, isSharingScreen }) => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        if (participant) {
          participant.isSharingScreen = isSharingScreen;
          if (!isSharingScreen) {
            participant.screenStream = undefined;
          }
          this.refresh();
        }
      }),

      this.signaling.onChatMessage().subscribe((msg) => {
        this.chatMessages.push(msg);
        this.refresh();
      }),

      this.signaling.onMuteRequest().subscribe(() => {
        if (!this.isMuted) {
          this.onToggleMute();
        }
      }),

      this.signaling.onEmojiReaction().subscribe((data) => {
        this.addFloatingReaction(data);
      }),

      this.signaling.onSpeakingChanged().subscribe(({ socketId, isSpeaking }) => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        if (participant) {
          participant.isActiveSpeaker = isSpeaking;
          this.refresh();
        }
      }),

      this.signaling.onKicked().subscribe(() => {
        this.cleanup();
        void this.router.navigate(['/']);
      }),

      this.signaling.onRoomLockChanged().subscribe(({ locked }) => {
        this.isLocked = locked;
        this.refresh();
      }),

      this.signaling.onMeetingEnded().subscribe(() => {
        this.cleanup();
        void this.router.navigate(['/']);
      }),

      this.signaling.onBecameHost().subscribe(() => {
        this.isHost = true;
        if (this.localParticipant) {
          this.localParticipant.role = 'Anfitrión';
        }
        this.showNotification('Ahora eres el anfitrión');
        this.refresh();
      }),

      this.signaling.onParticipantRoleChanged().subscribe(({ socketId, role }) => {
        if (socketId === this.signaling.socketId) {
          // Cambio de rol para nuestro propio socket (ej: el creador reconecta y recupera el anfitrionato)
          this.isHost = role === 'Anfitrión';
          if (this.localParticipant) {
            this.localParticipant.role = role;
          }
        } else {
          const participant = this.participants.find((x) => x.socketId === socketId);
          if (participant) {
            participant.role = role;
          }
        }
        this.refresh();
      }),

      this.signaling.onParticipantWaiting().subscribe((waiting) => {
        this.waitingParticipants.push(waiting);
        this.showNotification(`${waiting.name} quiere unirse`);
        if (!this.isPanelOpen) {
          this.isPanelOpen = true;
        }
        this.refresh();
      }),

      this.signaling.onAdmittedToRoom().subscribe((state) => {
        this.isWaiting = false;
        this.isHost = false;
        if (this.localParticipant) {
          this.localParticipant.role = 'Participante';
        }
        for (const p of state.participants) {
          this.addParticipant(p);
        }
        this.refresh();
        if (state.participants.length > 0) {
          this.scheduleOfferFallback(state.participants.map((p) => p.socketId));
        }
      }),

      this.signaling.onAdmissionRejected().subscribe(() => {
        this.cleanup();
        void this.router.navigate(['/']);
      }),

      this.signaling.onWaitingRoomChanged().subscribe(({ enabled }) => {
        this.isWaitingRoomEnabled = enabled;
        this.refresh();
      }),

      this.signaling.onReconnect().subscribe(() => {
        void this.rejoinAfterReconnect();
      }),

      this.signaling.onJoinRejected().subscribe(({ reason, scheduledAt }) => {
        this.rejectedReason = reason ?? 'No puedes unirte a esta sala.';
        this.rejectedScheduledAt = scheduledAt ?? null;
        this.cdr.markForCheck();
      }),
    ];

    this.subs.push(...subscriptions);
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    fromSocketId: string,
  ): Promise<void> {
    const pc = this.getOrCreatePeer(fromSocketId);

    if (pc.signalingState === 'have-local-offer') {
      await pc.setLocalDescription({ type: 'rollback' }).catch(() => null);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signaling.sendAnswer(fromSocketId, answer);
  }

  private async handleAnswer(
    answer: RTCSessionDescriptionInit,
    fromSocketId: string,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromSocketId);
    if (pc?.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(
    candidate: RTCIceCandidateInit,
    fromSocketId: string,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromSocketId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
    }
  }

  private getOrCreatePeer(socketId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(socketId);
    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const localStream = this.media.currentLocalStream;

    localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    if (this.isSharingScreen && this.media.currentScreenStream) {
      const screenStream = this.media.currentScreenStream;
      const senders: RTCRtpSender[] = [];
      screenStream.getTracks().forEach((track) => {
        senders.push(pc.addTrack(track, screenStream));
      });
      this.screenSenders.set(socketId, senders);
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.sendIceCandidate(socketId, candidate.toJSON());
      }
    };

    pc.ontrack = ({ streams }) => {
      this.zone.run(() => {
        const participant = this.participants.find((x) => x.socketId === socketId);
        const stream = streams[0];

        if (!participant || !stream) {
          return;
        }

        if (!participant.stream) {
          participant.stream = stream;
        } else if (stream.id !== participant.stream.id) {
          participant.screenStream = stream;
          participant.isSharingScreen = true;
        }

        this.refresh();
      });
    };

    this.peerConnections.set(socketId, pc);
    return pc;
  }

  private async initiateOffer(targetSocketId: string): Promise<void> {
    const pc = this.getOrCreatePeer(targetSocketId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signaling.sendOffer(targetSocketId, offer);
    } catch {
      // ignore
    }
  }

  private addParticipant(
    participant: Omit<RoomParticipant, 'isActiveSpeaker' | 'stream' | 'screenStream'>,
  ): void {
    const alreadyExists = this.participants.some(
      (x) => x.socketId === participant.socketId,
    );

    if (!alreadyExists) {
      this.participants.push({ ...participant, isActiveSpeaker: false });
    }
  }

  private removeParticipant(socketId: string): void {
    this.participants = this.participants.filter((p) => p.socketId !== socketId);
    const pc = this.peerConnections.get(socketId);
    pc?.close();
    this.peerConnections.delete(socketId);
    this.screenSenders.delete(socketId);
  }

  admitWaitingParticipant(socketId: string): void {
    this.signaling.admitParticipant(this.roomId, socketId);
    this.waitingParticipants = this.waitingParticipants.filter((p) => p.socketId !== socketId);
    this.refresh();
  }

  rejectWaitingParticipant(socketId: string): void {
    this.signaling.rejectParticipant(this.roomId, socketId);
    this.waitingParticipants = this.waitingParticipants.filter((p) => p.socketId !== socketId);
    this.refresh();
  }

  onToggleWaitingRoom(): void {
    this.isWaitingRoomEnabled = !this.isWaitingRoomEnabled;
    this.signaling.toggleWaitingRoom(this.roomId, this.isWaitingRoomEnabled);
    this.refresh();
  }

  onToggleMute(): void {
    if (!this.media.currentLocalStream) {
      void this.ensureLocalStream().then((ok) => {
        if (ok) this.zone.run(() => this.applyMuteToggle());
      });
      return;
    }
    this.applyMuteToggle();
  }

  onToggleCamera(): void {
    if (!this.media.currentLocalStream) {
      void this.ensureLocalStream().then((ok) => {
        if (ok) this.zone.run(() => this.applyCameraToggle());
      });
      return;
    }
    this.applyCameraToggle();
  }

  private applyMuteToggle(): void {
    this.isMuted = this.media.toggleMute();
    if (this.localParticipant) {
      this.localParticipant.isMuted = this.isMuted;
    }
    this.signaling.toggleMute(this.roomId, this.isMuted);
    this.cdr.detectChanges();
  }

  private applyCameraToggle(): void {
    this.isCameraOff = this.media.toggleCamera();
    if (this.localParticipant) {
      this.localParticipant.isCameraOff = this.isCameraOff;
    }
    this.signaling.toggleCamera(this.roomId, this.isCameraOff);
    void this.renegotiateWithAllPeers();
    this.cdr.detectChanges();
  }

  private async ensureLocalStream(): Promise<boolean> {
    try {
      const stream = await this.media.initLocalStream();
      this.zone.run(() => {
        if (this.localParticipant) {
          this.localParticipant.stream = stream;
        }
        if (!this.audioCtx) {
          this.setupSpeakingDetection(stream);
        }
        this.addLocalStreamToPeers();
        void this.renegotiateWithAllPeers();
        this.cdr.detectChanges();
      });
      return true;
    } catch (err) {
      const name = (err as DOMException)?.name ?? '';
      this.zone.run(() => {
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          this.showNotification('Permite el acceso al micrófono y cámara en tu navegador');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          this.showNotification('No se detectó micrófono o cámara conectados');
        } else {
          this.showNotification('No se pudo acceder al micrófono o cámara');
        }
      });
      return false;
    }
  }

  private addLocalStreamToPeers(): void {
    const stream = this.media.currentLocalStream;
    if (!stream) return;
    for (const [, pc] of this.peerConnections) {
      const existingKinds = new Set(pc.getSenders().map((s) => s.track?.kind));
      for (const track of stream.getTracks()) {
        if (!existingKinds.has(track.kind)) {
          pc.addTrack(track, stream);
        }
      }
    }
  }

  private async renegotiateWithAllPeers(): Promise<void> {
    for (const [socketId, pc] of this.peerConnections) {
      if (pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.signaling.sendOffer(socketId, offer);
        } catch (err) {
          console.warn(`Failed to renegotiate with ${socketId}:`, err);
        }
      }
    }
  }

  async onToggleScreenShare(): Promise<void> {
    if (this.isSharingScreen) {
      await this.stopScreenSharingFlow();
    } else {
      await this.startScreenSharingFlow();
    }

    this.refresh();
  }

  private async stopScreenSharingFlow(): Promise<void> {
    this.removeScreenTracksFromPeers();
    this.media.stopScreenShare();
    this.isSharingScreen = false;

    if (this.localParticipant) {
      this.localParticipant.isSharingScreen = false;
    }

    this.signaling.toggleScreenShare(this.roomId, false);
    await this.renegotiateStablePeers();
  }

  private async startScreenSharingFlow(): Promise<void> {
    const screen = await this.media.startScreenShare(this.screenShareWithAudio);
    if (!screen) {
      return;
    }

    this.isSharingScreen = true;

    if (this.localParticipant) {
      this.localParticipant.isSharingScreen = true;
    }

    this.signaling.toggleScreenShare(this.roomId, true, screen.id);
    this.attachScreenTracksToPeers(screen);
    await this.renegotiateStablePeers();
    this.bindScreenShareEnd(screen);
  }

  private removeScreenTracksFromPeers(): void {
    this.peerConnections.forEach((pc, socketId) => {
      (this.screenSenders.get(socketId) ?? []).forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch {
          // ignore
        }
      });

      this.screenSenders.delete(socketId);
    });
  }

  private attachScreenTracksToPeers(screen: MediaStream): void {
    for (const [socketId, pc] of this.peerConnections) {
      const senders: RTCRtpSender[] = [];

      screen.getTracks().forEach((track) => {
        senders.push(pc.addTrack(track, screen));
      });

      this.screenSenders.set(socketId, senders);
    }
  }

  private async renegotiateStablePeers(): Promise<void> {
    for (const [socketId, pc] of this.peerConnections) {
      if (pc.signalingState !== 'stable') {
        continue;
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.signaling.sendOffer(socketId, offer);
      } catch {
        // ignore
      }
    }
  }

  private bindScreenShareEnd(screen: MediaStream): void {
    const videoTrack = screen.getVideoTracks()[0];
    if (!videoTrack) {
      return;
    }

    videoTrack.onended = () => {
      this.zone.run(() => {
        if (this.isSharingScreen) {
          void this.onToggleScreenShare();
        }
      });
    };
  }

  onMuteParticipant(socketId: string): void {
    this.signaling.muteParticipant(this.roomId, socketId);
  }

  onMuteAll(): void {
    this.signaling.muteAll(this.roomId);
  }

  onKickParticipant(socketId: string): void {
    if (confirm('¿Expulsar a este participante?')) {
      this.signaling.kickParticipant(this.roomId, socketId);
    }
  }

  onToggleLock(): void {
    this.isLocked = !this.isLocked;
    this.signaling.toggleLock(this.roomId, this.isLocked);
    this.refresh();
  }

  onTogglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
    this.refresh();
  }

  onToggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen && !this.isPanelOpen) {
      this.isPanelOpen = true;
    }
    this.refresh();
  }

  onSendChat(): void {
    const msg = this.chatInput.trim();
    if (!msg) {
      return;
    }
    this.signaling.sendChatMessage(this.roomId, msg);
    this.chatInput = '';
  }

  onLeaveCall(): void {
    this.signaling.leaveRoom(this.roomId);
    this.cleanup();
    void this.router.navigate(['/']);
  }

  onEndMeeting(): void {
    const durationSeconds = Math.floor((Date.now() - this.sessionStart) / 1000);
    this.signaling.endMeeting(this.roomId, durationSeconds);
    this.cleanup();
    void this.router.navigate(['/']);
  }

  toggleScreenShareAudio(): void {
    this.screenShareWithAudio = !this.screenShareWithAudio;
    this.refresh();
  }

  openEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
    this.refresh();
  }

  sendReaction(emoji: string): void {
    this.showEmojiPicker = false;
    this.signaling.sendEmojiReaction(this.roomId, emoji);
    this.addFloatingReaction({ socketId: 'local', name: this.sessionName, emoji });
  }

  addFloatingReaction(data: { socketId: string; name: string; emoji: string }): void {
    const id = ++this.reactionCounter;
    const x = 5 + Math.random() * 65;

    this.floatingReactions.push({
      id,
      emoji: data.emoji,
      name: data.name,
      x,
    });

    this.zone.run(() => this.refresh());

    setTimeout(() => {
      this.floatingReactions = this.floatingReactions.filter((reaction) => reaction.id !== id);
      this.zone.run(() => this.refresh());
    }, 3500);
  }

  private setupSpeakingDetection(stream: MediaStream): void {
    try {
      this.audioCtx = new AudioContext();

      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = this.audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeaking = false;
      let lastEmit = 0;

      const check = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = !this.isMuted && avg > 12;
        const now = Date.now();

        if (speaking !== lastSpeaking && now - lastEmit > 300) {
          lastSpeaking = speaking;
          lastEmit = now;

          if (this.localParticipant) {
            this.localParticipant.isActiveSpeaker = speaking;
            this.signaling.sendSpeaking(this.roomId, speaking);
            this.zone.run(() => this.refresh());
          }
        }

        this.speakingRafId = requestAnimationFrame(check);
      };

      this.speakingRafId = requestAnimationFrame(check);
    } catch {
      // AudioContext no disponible
    }
  }

  private startTimer(): void {
    const key = `lm_meeting_start_${this.roomId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      this.sessionStart = parseInt(stored, 10);
    } else {
      this.sessionStart = Date.now();
      localStorage.setItem(key, String(this.sessionStart));
    }

    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.sessionStart) / 1000);
      const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
      const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      this.sessionDuration = `${h}:${m}:${s}`;
      this.cdr.markForCheck();
    }, 1000);
  }

  private showNotification(message: string): void {
    this.joinNotification = message;
    this.refresh();

    setTimeout(() => {
      this.joinNotification = null;
      this.refresh();
    }, 3000);
  }

  private cleanup(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.screenSenders.clear();
    this.offerFallbackTimers.forEach((t) => clearTimeout(t));
    this.media.stopAll();
    clearInterval(this.timerInterval);
    localStorage.removeItem(`lm_meeting_start_${this.roomId}`);

    if (this.speakingRafId) {
      cancelAnimationFrame(this.speakingRafId);
    }

    void this.audioCtx?.close().catch(() => null);
  }

  private scheduleOfferFallback(socketIds: string[]): void {
    const timer = setTimeout(() => {
      for (const id of socketIds) {
        if (!this.peerConnections.has(id)) {
          void this.initiateOffer(id);
        }
      }
    }, 2000);
    this.offerFallbackTimers.push(timer);
  }

  private refresh(): void {
    this.cdr.markForCheck();
  }

  trackBySocketId(_: number, participant: RoomParticipant): string {
    return participant.socketId;
  }
}