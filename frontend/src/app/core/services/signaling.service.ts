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
  }): Promise<{ success: boolean; isHost: boolean; waiting?: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('join-room', data, (res: { success: boolean; isHost: boolean; waiting?: boolean }) =>
        resolve(res),
      );
    });
  }

  admitParticipant(roomId: string, targetSocketId: string): void {
    this.socket.emit('admit-participant', { roomId, targetSocketId });
  }

  rejectParticipant(roomId: string, targetSocketId: string): void {
    this.socket.emit('reject-participant', { roomId, targetSocketId });
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

  toggleScreenShare(roomId: string, isSharingScreen: boolean, screenStreamId?: string): void {
    this.socket.emit('toggle-screen-share', { roomId, isSharingScreen, screenStreamId });
  }

  muteParticipant(roomId: string, targetSocketId: string): void {
    this.socket.emit('mute-participant', { roomId, targetSocketId });
  }

  muteAll(roomId: string): void {
    this.socket.emit('mute-all', { roomId });
  }

  kickParticipant(roomId: string, targetSocketId: string): void {
    this.socket.emit('kick-participant', { roomId, targetSocketId });
  }

  toggleLock(roomId: string, locked: boolean): void {
    this.socket.emit('toggle-lock', { roomId, locked });
  }

  sendEmojiReaction(roomId: string, emoji: string): void {
    this.socket.emit('emoji-reaction', { roomId, emoji });
  }

  sendSpeaking(roomId: string, isSpeaking: boolean): void {
    this.socket.emit('speaking', { roomId, isSpeaking });
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

  onScreenShareChanged(): Observable<{ socketId: string; isSharingScreen: boolean; screenStreamId?: string }> {
    return this.fromEvent('participant-screen-share-changed');
  }

  onBecameHost(): Observable<void> {
    return this.fromEvent('you-are-now-host');
  }

  onParticipantRoleChanged(): Observable<{ socketId: string; role: string }> {
    return this.fromEvent('participant-role-changed');
  }

  onMuteRequest(): Observable<{ by: string }> {
    return this.fromEvent('mute-request');
  }

  onEmojiReaction(): Observable<{ socketId: string; name: string; emoji: string }> {
    return this.fromEvent('emoji-reaction');
  }

  onSpeakingChanged(): Observable<{ socketId: string; isSpeaking: boolean }> {
    return this.fromEvent('participant-speaking');
  }

  onKicked(): Observable<{ by: string }> {
    return this.fromEvent('you-were-kicked');
  }

  onJoinRejected(): Observable<{ reason: string }> {
    return this.fromEvent('join-rejected');
  }

  onRoomLockChanged(): Observable<{ locked: boolean }> {
    return this.fromEvent('room-locked');
  }

  toggleWaitingRoom(roomId: string, enabled: boolean): void {
    this.socket.emit('toggle-waiting-room', { roomId, enabled });
  }

  onParticipantWaiting(): Observable<{ socketId: string; userId: string; name: string }> {
    return this.fromEvent('participant-waiting');
  }

  onAdmittedToRoom(): Observable<{ participants: Omit<RoomParticipant, 'isActiveSpeaker' | 'stream'>[]; isHost: boolean; roomId: string }> {
    return this.fromEvent('admitted-to-room');
  }

  onAdmissionRejected(): Observable<void> {
    return this.fromEvent('admission-rejected');
  }

  onWaitingRoomChanged(): Observable<{ enabled: boolean }> {
    return this.fromEvent('waiting-room-changed');
  }

  onReconnect(): Observable<void> {
    return new Observable((obs) => {
      const handler = () => obs.next();
      this.socket.io.on('reconnect', handler);
      return () => this.socket.io.off('reconnect', handler);
    });
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
