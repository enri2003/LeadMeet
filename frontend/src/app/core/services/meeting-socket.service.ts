import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface SharingEvent {
  userId: string;
  userName: string;
  roomId: string;
}

@Injectable({ providedIn: 'root' })
export class MeetingSocketService implements OnDestroy {
  private socket: Socket | null = null;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$ = this._connected$.asObservable();

  /** Alguien en la sala empezó a compartir pantalla */
  readonly userStartedSharing$ = new Subject<SharingEvent>();

  /** Alguien en la sala dejó de compartir pantalla */
  readonly userStoppedSharing$ = new Subject<SharingEvent>();

  /** Error general del socket */
  readonly socketError$ = new Subject<string>();

  connect(serverUrl: string, roomId: string, userId: string): void {
    if (this.socket?.connected) return;

    this.socket = io(serverUrl, {
      query: { roomId, userId },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => this._connected$.next(true));
    this.socket.on('disconnect', () => this._connected$.next(false));
    this.socket.on('connect_error', (err) => this.socketError$.next(err.message));

    this.socket.on('userStartedSharing', (data: SharingEvent) => {
      this.userStartedSharing$.next(data);
    });

    this.socket.on('userStoppedSharing', (data: SharingEvent) => {
      this.userStoppedSharing$.next(data);
    });
  }

  /** Notifica al servidor que este usuario comenzó a compartir */
  emitStartSharing(roomId: string, userId: string, userName: string): void {
    this.socket?.emit('startSharing', { roomId, userId, userName });
  }

  /** Notifica al servidor que este usuario dejó de compartir */
  emitStopSharing(roomId: string, userId: string, userName: string): void {
    this.socket?.emit('stopSharing', { roomId, userId, userName });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
