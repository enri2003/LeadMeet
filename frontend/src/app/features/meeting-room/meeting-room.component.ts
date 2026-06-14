import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
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
  '#1e3a5f','#5f1e1e','#3b1e5f','#1e5f3b',
  '#5f3b1e','#1e5f5f','#5f1e3b','#1e3b5f',
  '#4a1e5f','#2d4a1e','#5f4a1e','#1e4a5f',
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  get sessionName(): string {
    const s = this.authSvc.getSession();
    return s?.fullName || s?.name || 'Usuario';
  }
  private get sessionUserId(): string {
    return this.authSvc.getSession()?.userId ?? 'local-user';
  }

  // ─── Room state ──────────────────────────────────────────────────────────────
  roomId = '';
  isHost = false;
  isWaiting = false;
  participants: RoomParticipant[] = [];
  localParticipant: RoomParticipant | null = null;
  chatMessages: ChatMessage[] = [];
  isChatOpen = false;
  isPanelOpen = true;
  isLocked = false;

  // ─── Sala de espera (para el anfitrión) ──────────────────────────────────────
  waitingParticipants: { socketId: string; userId: string; name: string }[] = [];
  isWaitingRoomEnabled = false;

  // ─── Controls ────────────────────────────────────────────────────────────────
  isMuted = true;
  isCameraOff = true;
  isSharingScreen = false;
  screenShareWithAudio = false;

  // ─── Timer ───────────────────────────────────────────────────────────────────
  sessionDuration = '00:00:00';
  private sessionStart = Date.now();
  private timerInterval?: ReturnType<typeof setInterval>;

  // ─── Chat ────────────────────────────────────────────────────────────────────
  chatInput = '';

  // ─── Notificaciones ──────────────────────────────────────────────────────────
  joinNotification: string | null = null;

  // ─── Emoji ───────────────────────────────────────────────────────────────────
  showEmojiPicker = false;
  floatingReactions: { id: number; emoji: string; name: string; x: number }[] = [];
  private reactionCounter = 0;
  readonly reactionEmojis = ['👍','👎','😂','❤️','😮','👏','🎉','🔥','😍','🤔','👋','💯','🙌','😢','🚀','✅'];

  // ─── Audio detection ─────────────────────────────────────────────────────────
  private speakingRafId?: number;
  private audioCtx?: AudioContext;

  // ─── WebRTC ──────────────────────────────────────────────────────────────────
  private readonly peerConnections = new Map<string, RTCPeerConnection>();
  private readonly screenSenders = new Map<string, RTCRtpSender[]>();
  private readonly subs: Subscription[] = [];

  @ViewChild('screenVideoEl') screenVideoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('waitingCamEl') waitingCamEl?: ElementRef<HTMLVideoElement>;

  // ─── Computed ────────────────────────────────────────────────────────────────

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
      (acc, c, i) => acc + (c.codePointAt(0) ?? 0) * (i + 1), 0
    );
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
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
    } catch {
      this.localParticipant = {
        socketId: 'local',
        userId: this.sessionUserId,
        name: this.sessionName,
        role: 'Participante',
        isMuted: true,
        isCameraOff: true,
        isActiveSpeaker: false,
      };
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
      alert('No puedes unirte — la sala está bloqueada por el anfitrión.');
      this.router.navigate(['/']);
      return;
    }

    this.refresh();
  }

  private async rejoinAfterReconnect(): Promise<void> {
    const prevWaitingRoomEnabled = this.isWaitingRoomEnabled;

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.screenSenders.clear();
    this.participants = [];
    this.waitingParticipants = [];
    this.isWaiting = false;
    this.isWaitingRoomEnabled = false;

    const joinResult = await this.signaling.joinRoom({
      roomId: this.roomId,
      userId: this.sessionUserId,
      name: this.sessionName,
    });

    if (joinResult.waiting) {
      this.isWaiting = true;
      this.isHost = false;
      if (this.localParticipant) this.localParticipant.role = 'Participante';
    } else if (joinResult.success) {
      this.isHost = joinResult.isHost;
      if (this.localParticipant) {
        this.localParticipant.role = joinResult.isHost ? 'Anfitrión' : 'Participante';
      }
      if (joinResult.isHost && prevWaitingRoomEnabled) {
        this.isWaitingRoomEnabled = true;
        this.signaling.toggleWaitingRoom(this.roomId, true);
      }
    }
    this.refresh();
  }

  ngAfterViewChecked(): void {
    // Sync screen share video srcObject every CD cycle
    const screenEl = this.screenVideoEl?.nativeElement;
    if (screenEl) {
      const stream = this.screenShareStream ?? null;
      if (screenEl.srcObject !== stream) screenEl.srcObject = stream;
    }

    // Sync waiting room camera preview
    const waitEl = this.waitingCamEl?.nativeElement;
    if (waitEl) {
      const stream = this.localParticipant?.stream ?? null;
      if (waitEl.srcObject !== stream) waitEl.srcObject = stream;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.media.stopAll();
    this.signaling.disconnect();
    clearInterval(this.timerInterval);
    if (this.speakingRafId) cancelAnimationFrame(this.speakingRafId);
    this.audioCtx?.close().catch(() => null);
  }

  // ─── Signaling ───────────────────────────────────────────────────────────────

  private registerSignalingHandlers(): void {
    this.subs.push(
      this.signaling.onRoomState().subscribe((state) => {
        this.isHost = state.isHost;
        if (this.localParticipant) {
          this.localParticipant.role = state.isHost ? 'Anfitrión' : 'Participante';
        }
        for (const p of state.participants) this.addParticipant(p);
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onUserJoined().subscribe((p) => {
        this.addParticipant(p);
        this.initiateOffer(p.socketId);
        this.showNotification(`${p.name} se unió`);
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onUserLeft().subscribe(({ socketId }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) this.showNotification(`${p.name} salió`);
        this.removeParticipant(socketId);
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onOffer().subscribe(async ({ offer, fromSocketId }) => {
        const pc = this.getOrCreatePeer(fromSocketId);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' }).catch(() => null);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signaling.sendAnswer(fromSocketId, answer);
      }),
    );

    this.subs.push(
      this.signaling.onAnswer().subscribe(async ({ answer, fromSocketId }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc?.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      }),
    );

    this.subs.push(
      this.signaling.onIceCandidate().subscribe(async ({ candidate, fromSocketId }) => {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
      }),
    );

    this.subs.push(
      this.signaling.onMuteChanged().subscribe(({ socketId, isMuted }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.isMuted = isMuted; this.refresh(); }
      }),
    );

    this.subs.push(
      this.signaling.onCameraChanged().subscribe(({ socketId, isCameraOff }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.isCameraOff = isCameraOff; this.refresh(); }
      }),
    );

    this.subs.push(
      this.signaling.onScreenShareChanged().subscribe(({ socketId, isSharingScreen }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) {
          p.isSharingScreen = isSharingScreen;
          if (!isSharingScreen) p.screenStream = undefined;
          this.refresh();
        }
      }),
    );

    this.subs.push(
      this.signaling.onChatMessage().subscribe((msg) => {
        this.chatMessages.push(msg);
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onMuteRequest().subscribe(() => {
        if (!this.isMuted) this.onToggleMute();
      }),
    );

    this.subs.push(
      this.signaling.onEmojiReaction().subscribe((data) => {
        this.addFloatingReaction(data);
      }),
    );

    this.subs.push(
      this.signaling.onSpeakingChanged().subscribe(({ socketId, isSpeaking }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.isActiveSpeaker = isSpeaking; this.refresh(); }
      }),
    );

    this.subs.push(
      this.signaling.onKicked().subscribe(() => {
        this.cleanup();
        this.router.navigate(['/']);
      }),
    );

    this.subs.push(
      this.signaling.onRoomLockChanged().subscribe(({ locked }) => {
        this.isLocked = locked;
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onMeetingEnded().subscribe(() => {
        this.cleanup();
        this.router.navigate(['/']);
      }),
    );

    this.subs.push(
      this.signaling.onBecameHost().subscribe(() => {
        this.isHost = true;
        if (this.localParticipant) this.localParticipant.role = 'Anfitrión';
        this.showNotification('Ahora eres el anfitrión');
        this.refresh();
      }),
    );

    this.subs.push(
      this.signaling.onParticipantRoleChanged().subscribe(({ socketId, role }) => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (p) { p.role = role; this.refresh(); }
      }),
    );

    // ─── Sala de espera ──────────────────────────────────────────────────────

    // Host: alguien está esperando ser admitido
    this.subs.push(
      this.signaling.onParticipantWaiting().subscribe((waiting) => {
        this.waitingParticipants.push(waiting);
        this.showNotification(`${waiting.name} quiere unirse`);
        if (!this.isPanelOpen) this.isPanelOpen = true;
        this.refresh();
      }),
    );

    // Participante: el anfitrión lo admitió
    this.subs.push(
      this.signaling.onAdmittedToRoom().subscribe((state) => {
        this.isWaiting = false;
        this.isHost = false;
        if (this.localParticipant) this.localParticipant.role = 'Participante';
        for (const p of state.participants) this.addParticipant(p);
        this.refresh();
        // Los participantes existentes recibirán user-joined e iniciarán las ofertas WebRTC
      }),
    );

    // Participante: el anfitrión lo rechazó
    this.subs.push(
      this.signaling.onAdmissionRejected().subscribe(() => {
        this.cleanup();
        this.router.navigate(['/']);
      }),
    );

    // Estado de sala de espera (notifica a todos en la sala)
    this.subs.push(
      this.signaling.onWaitingRoomChanged().subscribe(({ enabled }) => {
        this.isWaitingRoomEnabled = enabled;
        this.refresh();
      }),
    );

    // Reconexión automática tras caída del backend
    this.subs.push(
      this.signaling.onReconnect().subscribe(() => {
        this.rejoinAfterReconnect();
      }),
    );
  }

  // ─── WebRTC ──────────────────────────────────────────────────────────────────

  private getOrCreatePeer(socketId: string): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) return this.peerConnections.get(socketId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const localStream = this.media.currentLocalStream;
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signaling.sendIceCandidate(socketId, candidate.toJSON());
    };

    pc.ontrack = ({ streams }) => {
      this.zone.run(() => {
        const p = this.participants.find((x) => x.socketId === socketId);
        if (!p || !streams[0]) return;
        if (!p.stream) {
          p.stream = streams[0];
        } else if (streams[0].id !== p.stream.id) {
          p.screenStream = streams[0];
          p.isSharingScreen = true;
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
    } catch { /* ignore */ }
  }

  // ─── Participants ─────────────────────────────────────────────────────────────

  private addParticipant(p: Omit<RoomParticipant, 'isActiveSpeaker' | 'stream' | 'screenStream'>): void {
    if (!this.participants.find((x) => x.socketId === p.socketId)) {
      this.participants.push({ ...p, isActiveSpeaker: false });
    }
  }

  private removeParticipant(socketId: string): void {
    this.participants = this.participants.filter((p) => p.socketId !== socketId);
    const pc = this.peerConnections.get(socketId);
    pc?.close();
    this.peerConnections.delete(socketId);
    this.screenSenders.delete(socketId);
  }

  // ─── Sala de espera (anfitrión) ───────────────────────────────────────────────

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

  // ─── Controls ────────────────────────────────────────────────────────────────

  onToggleMute(): void {
    this.isMuted = this.media.toggleMute();
    if (this.localParticipant) this.localParticipant.isMuted = this.isMuted;
    this.signaling.toggleMute(this.roomId, this.isMuted);
    // Re-negotiate SDP with all peers to sync audio track state
    this.renegotiateWithAllPeers();
    this.refresh();
  }

  onToggleCamera(): void {
    this.isCameraOff = this.media.toggleCamera();
    if (this.localParticipant) this.localParticipant.isCameraOff = this.isCameraOff;
    this.signaling.toggleCamera(this.roomId, this.isCameraOff);
    // Re-negotiate SDP with all peers to sync video track state
    this.renegotiateWithAllPeers();
    this.refresh();
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
      this.peerConnections.forEach((pc, socketId) => {
        (this.screenSenders.get(socketId) ?? []).forEach((s) => {
          try { pc.removeTrack(s); } catch { /* ignore */ }
        });
        this.screenSenders.delete(socketId);
      });

      this.media.stopScreenShare();
      this.isSharingScreen = false;
      if (this.localParticipant) this.localParticipant.isSharingScreen = false;
      this.signaling.toggleScreenShare(this.roomId, false);

      for (const [socketId, pc] of this.peerConnections) {
        if (pc.signalingState === 'stable') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.signaling.sendOffer(socketId, offer);
          } catch { /* ignore */ }
        }
      }

    } else {
      const screen = await this.media.startScreenShare(this.screenShareWithAudio);
      if (!screen) return;

      this.isSharingScreen = true;
      if (this.localParticipant) this.localParticipant.isSharingScreen = true;
      this.signaling.toggleScreenShare(this.roomId, true, screen.id);

      for (const [socketId, pc] of this.peerConnections) {
        const senders: RTCRtpSender[] = [];
        screen.getTracks().forEach((t) => senders.push(pc.addTrack(t, screen)));
        this.screenSenders.set(socketId, senders);

        if (pc.signalingState === 'stable') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this.signaling.sendOffer(socketId, offer);
          } catch { /* ignore */ }
        }
      }

      screen.getVideoTracks()[0].onended = () =>
        this.zone.run(() => { if (this.isSharingScreen) this.onToggleScreenShare(); });
    }

    this.refresh();
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
    if (this.isChatOpen && !this.isPanelOpen) this.isPanelOpen = true;
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
    // Calculate duration in seconds
    const durationSeconds = Math.floor((Date.now() - this.sessionStart) / 1000);
    this.signaling.endMeeting(this.roomId, durationSeconds);
    this.cleanup();
    this.router.navigate(['/']);
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
    this.floatingReactions.push({ id, emoji: data.emoji, name: data.name, x });
    this.zone.run(() => this.refresh());
    setTimeout(() => {
      this.floatingReactions = this.floatingReactions.filter((r) => r.id !== id);
      this.zone.run(() => this.refresh());
    }, 3500);
  }

  // ─── Speaking detection ───────────────────────────────────────────────────────

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
    } catch { /* AudioContext no disponible */ }
  }

  // ─── Timer ───────────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.sessionStart = Date.now();
    this.timerInterval = setInterval(() => {
      const e = Math.floor((Date.now() - this.sessionStart) / 1000);
      const h = Math.floor(e / 3600).toString().padStart(2, '0');
      const m = Math.floor((e % 3600) / 60).toString().padStart(2, '0');
      const s = (e % 60).toString().padStart(2, '0');
      this.sessionDuration = `${h}:${m}:${s}`;
      this.cdr.markForCheck();
    }, 1000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private showNotification(msg: string): void {
    this.joinNotification = msg;
    this.refresh();
    setTimeout(() => { this.joinNotification = null; this.refresh(); }, 3000);
  }

  private cleanup(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.screenSenders.clear();
    this.media.stopAll();
    clearInterval(this.timerInterval);
    if (this.speakingRafId) cancelAnimationFrame(this.speakingRafId);
    this.audioCtx?.close().catch(() => null);
  }

  private refresh(): void {
    this.cdr.markForCheck();
  }

  trackBySocketId(_: number, p: RoomParticipant): string {
    return p.socketId;
  }
}
