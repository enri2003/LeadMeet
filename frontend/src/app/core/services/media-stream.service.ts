import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MediaStreamService {
  private readonly _localStream = new BehaviorSubject<MediaStream | null>(null);
  private readonly _screenStream = new BehaviorSubject<MediaStream | null>(null);
  private readonly _isMuted = new BehaviorSubject<boolean>(false);
  private readonly _isCameraOff = new BehaviorSubject<boolean>(false);
  private readonly _isSharingScreen = new BehaviorSubject<boolean>(false);

  readonly localStream$ = this._localStream.asObservable();
  readonly screenStream$ = this._screenStream.asObservable();
  readonly isMuted$ = this._isMuted.asObservable();
  readonly isCameraOff$ = this._isCameraOff.asObservable();
  readonly isSharingScreen$ = this._isSharingScreen.asObservable();

  async initLocalStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      // Join with mic and camera OFF by default
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      stream.getVideoTracks().forEach((t) => (t.enabled = false));
      this._isMuted.next(true);
      this._isCameraOff.next(true);
      this._localStream.next(stream);
      console.log('✅ Local stream initialized successfully');
      return stream;
    } catch (err) {
      console.error('❌ Failed to initialize local stream:', err);
      // Create a dummy stream without audio/video but keep the service functional
      throw err;
    }
  }

  toggleMute(): boolean {
    const stream = this._localStream.value;
    if (!stream) {
      console.warn('⚠️ No stream to toggle mute');
      return this._isMuted.value;
    }
    const newMuted = !this._isMuted.value;
    stream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    this._isMuted.next(newMuted);
    console.log(`🔊 Mute toggled: ${newMuted}`);
    return newMuted;
  }

  toggleCamera(): boolean {
    const stream = this._localStream.value;
    if (!stream) {
      console.warn('⚠️ No stream to toggle camera');
      return this._isCameraOff.value;
    }
    const newCameraOff = !this._isCameraOff.value;
    stream.getVideoTracks().forEach((t) => (t.enabled = !newCameraOff));
    this._isCameraOff.next(newCameraOff);
    console.log(`📹 Camera toggled: ${!newCameraOff ? 'ON' : 'OFF'}`, {
      videoTracks: stream.getVideoTracks().length,
      enabled: !newCameraOff,
    });
    return newCameraOff;
  }

  async startScreenShare(withAudio = false): Promise<MediaStream | null> {
    try {
      const mediaDevices = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia(constraints: DisplayMediaStreamOptions): Promise<MediaStream>;
      };
      const screen = await mediaDevices.getDisplayMedia({ video: true, audio: withAudio });
      this._screenStream.next(screen);
      this._isSharingScreen.next(true);
      screen.getVideoTracks()[0].onended = () => this.stopScreenShare();
      return screen;
    } catch {
      return null;
    }
  }

  get currentScreenStream(): MediaStream | null {
    return this._screenStream.value;
  }

  stopScreenShare(): void {
    this._screenStream.value?.getTracks().forEach((t) => t.stop());
    this._screenStream.next(null);
    this._isSharingScreen.next(false);
  }

  stopAll(): void {
    this._localStream.value?.getTracks().forEach((t) => t.stop());
    this._localStream.next(null);
    this.stopScreenShare();
    this._isMuted.next(false);
    this._isCameraOff.next(false);
  }

  replaceVideoTrack(newStream: MediaStream): void {
    const existing = this._localStream.value;
    if (!existing) return;
    existing.getVideoTracks().forEach((t) => {
      existing.removeTrack(t);
      t.stop();
    });
    newStream.getVideoTracks().forEach((t) => existing.addTrack(t));
    this._localStream.next(existing);
  }

  get currentLocalStream(): MediaStream | null {
    return this._localStream.value;
  }
  get currentIsMuted(): boolean {
    return this._isMuted.value;
  }
  get currentIsCameraOff(): boolean {
    return this._isCameraOff.value;
  }
  get currentIsSharingScreen(): boolean {
    return this._isSharingScreen.value;
  }
}
