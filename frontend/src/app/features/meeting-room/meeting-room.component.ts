import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { ScreenShareService } from '../../core/services/screen-share.service';
import { MeetingSocketService } from '../../core/services/meeting-socket.service';
import { ShareScreenModalComponent } from './components/share-screen-modal/share-screen-modal.component';

const SOCKET_URL = 'http://localhost:3000';
const DEMO_USER_ID   = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const DEMO_USER_NAME = 'Ricardo Mendoza';

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule, ShareScreenModalComponent],
  templateUrl: './meeting-room.component.html',
})
export class MeetingRoomComponent implements OnInit, OnDestroy {
  /** Referencia al elemento <video> que muestra la pantalla compartida */
  @ViewChild('screenVideo') screenVideoRef!: ElementRef<HTMLVideoElement>;
  /** Referencia al <video> de la cámara local */
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;

  roomId = 'default-room';
  userId   = DEMO_USER_ID;
  userName = DEMO_USER_NAME;

  isModalOpen    = false;
  isSharing      = false;
  isMicOn        = true;
  isCameraOn     = true;

  /** Nombre del participante que está compartiendo (puede ser otro usuario) */
  sharingParticipantName: string | null = null;

  /** RTCPeerConnection — se crearía al unirse a la sala */
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private screenShareSvc: ScreenShareService,
    private socketSvc: MeetingSocketService,
  ) {}

  ngOnInit(): void {
    // Leer roomId desde la URL si existe
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? this.roomId;

    // Conectar al socket de la sala
    this.socketSvc.connect(SOCKET_URL, this.roomId, this.userId);

    // Escuchar estado del propio servicio de captura
    this.subs.add(
      this.screenShareSvc.state$.subscribe((state) => {
        this.isSharing = state.isSharing;

        // Mostrar la pantalla compartida en el <video>
        if (state.isSharing && state.stream && this.screenVideoRef?.nativeElement) {
          this.attachStreamToVideo(this.screenVideoRef.nativeElement, state.stream);
        }
      }),
    );

    // Escuchar cuando este usuario deja de compartir (botón nativo del browser)
    this.subs.add(
      this.screenShareSvc.sharingStopped$.subscribe(() => {
        this.isSharing = false;
        this.sharingParticipantName = null;
        this.socketSvc.emitStopSharing(this.roomId, this.userId, this.userName);
        this.clearScreenVideo();
      }),
    );

    // Escuchar cuando OTRO participante empieza a compartir
    this.subs.add(
      this.socketSvc.userStartedSharing$.subscribe((evt) => {
        if (evt.userId !== this.userId) {
          this.sharingParticipantName = evt.userName;
        }
      }),
    );

    // Escuchar cuando OTRO participante deja de compartir
    this.subs.add(
      this.socketSvc.userStoppedSharing$.subscribe((evt) => {
        if (evt.userId !== this.userId) {
          this.sharingParticipantName = null;
        }
      }),
    );

    // Iniciar cámara local (sin bloquear si el usuario niega permisos)
    this.startLocalCamera();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.screenShareSvc.stopCapture();
    this.socketSvc.disconnect();
    this.localStream?.getTracks().forEach((t) => t.stop());
  }

  // ── Acciones del usuario ─────────────────────────────────────────────────

  openShareModal(): void {
    this.isModalOpen = true;
  }

  closeShareModal(): void {
    this.isModalOpen = false;
  }

  /** Llamado por el modal cuando el stream de pantalla está listo */
  onShareStarted(stream: MediaStream): void {
    this.isModalOpen = false;
    this.isSharing   = true;

    // Conectar el stream al <video> de pantalla
    if (this.screenVideoRef?.nativeElement) {
      this.attachStreamToVideo(this.screenVideoRef.nativeElement, stream);
    }

    // Reemplazar track de video en la RTCPeerConnection si hay una activa
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && this.peerConnection) {
      this.screenShareSvc.replaceTrackInSender(this.peerConnection, videoTrack);
    }

    // Notificar a la sala vía WebSocket
    this.socketSvc.emitStartSharing(this.roomId, this.userId, this.userName);
  }

  /** Botón "Dejar de compartir" dentro de la sala */
  stopSharing(): void {
    this.screenShareSvc.stopCapture();
    // El subject sharingStopped$ se encarga del resto
  }

  toggleMic(): void {
    this.isMicOn = !this.isMicOn;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = this.isMicOn));
  }

  toggleCamera(): void {
    this.isCameraOn = !this.isCameraOn;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = this.isCameraOn));
  }

  // ── Helpers privados ────────────────────────────────────────────────────

  private attachStreamToVideo(
    video: HTMLVideoElement,
    stream: MediaStream,
  ): void {
    video.srcObject = stream;
    video.muted     = true; // evitar eco
    video.play().catch(() => {
      // Autoplay bloqueado en algunos navegadores — el usuario debe interactuar
    });
  }

  private clearScreenVideo(): void {
    const video = this.screenVideoRef?.nativeElement;
    if (!video) return;
    video.srcObject = null;
  }

  private async startLocalCamera(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (this.localVideoRef?.nativeElement) {
        this.attachStreamToVideo(this.localVideoRef.nativeElement, this.localStream);
      }
    } catch {
      // Sin cámara o permiso denegado — no es bloqueante
    }
  }
}
