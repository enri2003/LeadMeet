import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { RoomParticipant, ChatMessage, RoomStatePayload } from '../models/meeting-room.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalingService implements OnDestroy {
  private socket!: Socket;
  private readonly serverUrl = environment.apiUrl;

  connect(token?: string): void {
    if (this.socket?.connected) return;
    this.socket = io(`${this.serverUrl}/meeting`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  joinRoom(data: {
    roomId: string;
    userId: string;
    name: string;
    role?: string;
  }): Promise<{ success: boolean; isHost: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('join-room', data, (res: { success: boolean; isHost: boolean }) =>
        resolve(res),
      );
    });
  }

  leaveRoom(roomId: string): void {
    this.socket.emit('leave-room', { roomId });
  }

  endMeeting(roomId: string): void {
    this.socket.emit('end-meeting', { roomId });
  }

  sendOffer(targetSocketId: string, offer: RTCSessionDescriptionInit): void {
    this.socket.emit('webrtc-offer', { targetSocketId, offer });
  }

  sendAnswer(targetSocketId: string, answer: RTCSessionDescriptionInit): void {
    this.socket.emit('webrtc-answer', { targetSocketId, answer });
  }

  sendIceCandidate(targetSocketId: string, candidate: RTCIceCandidateInit): void {
    this.socket.emit('ice-candidate', { targetSocketId, candidate });
  }

  toggleMute(roomId: string, isMuted: boolean): void {
    this.socket.emit('toggle-mute', { roomId, isMuted });
  }

  toggleCamera(roomId: string, isCameraOff: boolean): void {
    this.socket.emit('toggle-camera', { roomId, isCameraOff });
  }

  sendChatMessage(roomId: string, content: string): void {
    this.socket.emit('chat-message', { roomId, content });
  }

  // ─── Observables ────────────────────────────────────────────────────────────

  onRoomState(): Observable<RoomStatePayload> {
    return this.fromEvent<RoomStatePayload>('room-state');
  }

  onUserJoined(): Observable<Omit<RoomParticipant, 'isActiveSpeaker' | 'stream'>> {
    return this.fromEvent('user-joined');
  }

  onUserLeft(): Observable<{ socketId: string }> {
    return this.fromEvent<{ socketId: string }>('user-left');
  }

  onOffer(): Observable<{ offer: RTCSessionDescriptionInit; fromSocketId: string }> {
    return this.fromEvent('webrtc-offer');
  }

  onAnswer(): Observable<{ answer: RTCSessionDescriptionInit; fromSocketId: string }> {
    return this.fromEvent('webrtc-answer');
  }

  onIceCandidate(): Observable<{ candidate: RTCIceCandidateInit; fromSocketId: string }> {
    return this.fromEvent('ice-candidate');
  }

  onMuteChanged(): Observable<{ socketId: string; isMuted: boolean }> {
    return this.fromEvent('participant-mute-changed');
  }

  onCameraChanged(): Observable<{ socketId: string; isCameraOff: boolean }> {
    return this.fromEvent('participant-camera-changed');
  }

  onChatMessage(): Observable<ChatMessage> {
    return this.fromEvent<ChatMessage>('chat-message');
  }

  onMeetingEnded(): Observable<{ endedBy: string }> {
    return this.fromEvent<{ endedBy: string }>('meeting-ended');
  }

  get socketId(): string {
    return this.socket?.id ?? '';
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>((obs) => {
      this.socket.on(event, (data: T) => obs.next(data));
      return () => this.socket.off(event);
    });
  }
}
