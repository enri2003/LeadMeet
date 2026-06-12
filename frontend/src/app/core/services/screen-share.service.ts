import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ScreenShareOptions {
  /** Capture system audio alongside the screen */
  withAudio: boolean;
  /** High-quality mode: 60 fps + higher bitrate for video playback */
  optimizeForVideo: boolean;
  /** Hint to the browser about what surface the user will pick */
  displaySurface?: 'monitor' | 'window' | 'browser';
}

export interface ScreenShareState {
  isSharing: boolean;
  stream: MediaStream | null;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  /** Settings resolved after getUserMedia succeeds */
  resolvedSettings: {
    width: number;
    height: number;
    frameRate: number;
    label: string;
  } | null;
  error: string | null;
}

const INITIAL_STATE: ScreenShareState = {
  isSharing: false,
  stream: null,
  videoTrack: null,
  audioTrack: null,
  resolvedSettings: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class ScreenShareService {
  private readonly _state$ = new BehaviorSubject<ScreenShareState>(INITIAL_STATE);
  readonly state$ = this._state$.asObservable();

  /** Fires when the user stops sharing via the browser's native "Stop sharing" button */
  readonly sharingStopped$ = new Subject<void>();

  constructor(private ngZone: NgZone) {}

  get currentState(): ScreenShareState {
    return this._state$.getValue();
  }

  get isSharing(): boolean {
    return this.currentState.isSharing;
  }

  /**
   * Request screen capture via the Screen Capture API.
   * Builds MediaStreamConstraints based on the chosen options:
   *   - optimizeForVideo → 60 fps, higher resolution cap
   *   - withAudio        → also request system audio track
   */
  async startCapture(options: ScreenShareOptions): Promise<MediaStream> {
    if (this.currentState.isSharing) {
      this.stopCapture();
    }

    const fps = options.optimizeForVideo ? 60 : 30;

    const videoConstraints: MediaTrackConstraints = {
      frameRate: { ideal: fps, max: fps },
      width:     { ideal: 1920 },
      height:    { ideal: 1080 },
      // Chrome-specific constraint — hints which surface picker opens on
      ...(options.displaySurface
        ? { displaySurface: options.displaySurface as unknown as ConstrainDOMString }
        : {}),
    };

    // getDisplayMedia constraints
    const constraints: DisplayMediaStreamOptions = {
      video: videoConstraints,
      audio: options.withAudio
        ? {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 44100,
          }
        : false,
    };

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err: unknown) {
      const msg = this.humanizeError(err);
      this._state$.next({ ...INITIAL_STATE, error: msg });
      throw new Error(msg);
    }

    const videoTrack = stream.getVideoTracks()[0] ?? null;
    const audioTrack = stream.getAudioTracks()[0] ?? null;

    // Apply encoding hints when the track supports it (Chrome/Edge)
    if (videoTrack) {
      this.applyEncodingHints(videoTrack, options.optimizeForVideo);
    }

    // Resolved capture settings (populated after track is live)
    const settings = videoTrack?.getSettings();
    const resolvedSettings = settings
      ? {
          width:     settings.width     ?? 0,
          height:    settings.height    ?? 0,
          frameRate: settings.frameRate ?? fps,
          label:     videoTrack.label   ?? 'Pantalla',
        }
      : null;

    // Listen for the native browser "Stop sharing" button
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        // Re-enter Angular zone so change detection fires
        this.ngZone.run(() => this.onTrackEnded());
      });
    }

    this._state$.next({
      isSharing: true,
      stream,
      videoTrack,
      audioTrack,
      resolvedSettings,
      error: null,
    });

    return stream;
  }

  /**
   * Stop an active screen-share and release all tracks.
   */
  stopCapture(): void {
    const { stream } = this.currentState;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    this._state$.next(INITIAL_STATE);
    this.sharingStopped$.next();
  }

  /**
   * Replace the video track inside an existing RTCPeerConnection sender.
   * Call this after startCapture() to swap the shared screen into the call.
   */
  replaceTrackInSender(
    pc: RTCPeerConnection,
    newTrack: MediaStreamTrack,
  ): void {
    const sender = pc
      .getSenders()
      .find((s) => s.track?.kind === 'video');

    if (sender) {
      sender.replaceTrack(newTrack);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private onTrackEnded(): void {
    const wasSharing = this.currentState.isSharing;
    this._state$.next(INITIAL_STATE);
    if (wasSharing) {
      this.sharingStopped$.next();
    }
  }

  /**
   * Apply ContentHint on the video track.
   * 'motion'  → higher fps priority  (video/animation content)
   * 'detail'  → sharpness priority   (text/code/slides)
   */
  private applyEncodingHints(
    track: MediaStreamTrack,
    optimizeForVideo: boolean,
  ): void {
    try {
      (track as MediaStreamTrack & { contentHint: string }).contentHint =
        optimizeForVideo ? 'motion' : 'detail';
    } catch {
      // contentHint not supported in this browser — safe to ignore
    }
  }

  private humanizeError(err: unknown): string {
    if (!(err instanceof Error)) return 'Error desconocido al capturar pantalla.';
    switch (err.name) {
      case 'NotAllowedError':
        return 'Permiso denegado. El usuario canceló la selección de pantalla.';
      case 'NotFoundError':
        return 'No se encontró ninguna fuente de pantalla disponible.';
      case 'NotSupportedError':
        return 'Tu navegador no soporta la API de captura de pantalla (getDisplayMedia).';
      case 'NotReadableError':
        return 'La pantalla ya está siendo capturada por otra aplicación.';
      case 'OverconstrainedError':
        return 'Los parámetros de captura solicitados no son compatibles con este dispositivo.';
      default:
        return `Error al capturar pantalla: ${err.message}`;
    }
  }
}
