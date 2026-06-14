import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MeetingsService } from './meetings.service';
import { UsersService } from '../users/users.service';

interface RoomParticipant {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/meeting',
})
export class WebRtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebRtcGateway.name);

  private readonly rooms = new Map<string, Map<string, RoomParticipant>>();
  private readonly socketToRoom = new Map<string, string>();
  private readonly lockedRooms = new Map<string, boolean>();

  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly usersService: UsersService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`WS connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
    const roomId = this.socketToRoom.get(client.id);
    if (roomId) {
      await this.removeFromRoom(client, roomId);
    }
  }

  // ─── Room management ────────────────────────────────────────────────────────

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; name: string; role?: string },
  ) {
    const { roomId, userId, name, role = 'Participante' } = data;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const room = this.rooms.get(roomId)!;
    const isHost = room.size === 0;

    if (!isHost && this.lockedRooms.get(roomId)) {
      client.emit('join-rejected', { reason: 'La sala está bloqueada por el anfitrión' });
      return { success: false, isHost: false };
    }

    const participant: RoomParticipant = {
      socketId: client.id,
      userId,
      name,
      role: isHost ? 'Anfitrión' : role,
      isMuted: false,
      isCameraOff: false,
      joinedAt: new Date(),
    };

    room.set(client.id, participant);
    this.socketToRoom.set(client.id, roomId);
    await client.join(roomId);

    // Task 6.4 — load privacy settings for this user
    const settings = await this.usersService.getSettings(userId).catch(() => null);

    // Send existing participants to the new joiner so they can initiate offers
    const existingParticipants = Array.from(room.values()).filter(
      (p) => p.socketId !== client.id,
    );
    client.emit('room-state', { participants: existingParticipants, isHost, roomId });

    // Task 6.4 — respect hidePresence: skip broadcast if user wants to be invisible
    if (!settings?.hidePresence) {
      client.to(roomId).emit('user-joined', participant);
    }

    await this.meetingsService.recordJoin(roomId, userId, participant.joinedAt).catch(() => null);

    this.logger.log(`${name} joined room ${roomId} (isHost=${isHost})`);
    return { success: true, isHost };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    await this.removeFromRoom(client, data.roomId);
  }

  @SubscribeMessage('end-meeting')
  async handleEndMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;

    const participant = room.get(client.id);
    if (participant?.role !== 'Anfitrión') return;

    await this.meetingsService.endMeeting(data.roomId).catch(() => null);

    this.server.to(data.roomId).emit('meeting-ended', { endedBy: participant.name });

    // Cleanup all participants
    room.forEach((_, socketId) => this.socketToRoom.delete(socketId));
    this.rooms.delete(data.roomId);

    this.logger.log(`Meeting ${data.roomId} ended by host ${participant.name}`);
  }

  // ─── WebRTC signaling ───────────────────────────────────────────────────────

  @SubscribeMessage('webrtc-offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; offer: RTCSessionDescriptionInit },
  ) {
    this.server.to(data.targetSocketId).emit('webrtc-offer', {
      offer: data.offer,
      fromSocketId: client.id,
    });
  }

  @SubscribeMessage('webrtc-answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; answer: RTCSessionDescriptionInit },
  ) {
    this.server.to(data.targetSocketId).emit('webrtc-answer', {
      answer: data.answer,
      fromSocketId: client.id,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; candidate: RTCIceCandidateInit },
  ) {
    this.server.to(data.targetSocketId).emit('ice-candidate', {
      candidate: data.candidate,
      fromSocketId: client.id,
    });
  }

  // ─── Media state sync ───────────────────────────────────────────────────────

  @SubscribeMessage('toggle-mute')
  handleToggleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isMuted: boolean },
  ) {
    const participant = this.rooms.get(data.roomId)?.get(client.id);
    if (participant) {
      participant.isMuted = data.isMuted;
      client.to(data.roomId).emit('participant-mute-changed', {
        socketId: client.id,
        isMuted: data.isMuted,
      });
    }
  }

  @SubscribeMessage('toggle-camera')
  handleToggleCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isCameraOff: boolean },
  ) {
    const participant = this.rooms.get(data.roomId)?.get(client.id);
    if (participant) {
      participant.isCameraOff = data.isCameraOff;
      client.to(data.roomId).emit('participant-camera-changed', {
        socketId: client.id,
        isCameraOff: data.isCameraOff,
      });
    }
  }

  @SubscribeMessage('emoji-reaction')
  handleEmojiReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; emoji: string },
  ) {
    const participant = this.rooms.get(data.roomId)?.get(client.id);
    if (participant && data.emoji) {
      this.server.to(data.roomId).emit('emoji-reaction', {
        socketId: client.id,
        name: participant.name,
        emoji: data.emoji,
      });
    }
  }

  @SubscribeMessage('speaking')
  handleSpeaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isSpeaking: boolean },
  ) {
    client.to(data.roomId).emit('participant-speaking', {
      socketId: client.id,
      isSpeaking: data.isSpeaking,
    });
  }

  @SubscribeMessage('kick-participant')
  async handleKickParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;
    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;
    const target = room.get(data.targetSocketId);
    if (!target) return;
    room.delete(data.targetSocketId);
    this.socketToRoom.delete(data.targetSocketId);
    const targetSocket = this.server.sockets.sockets.get(data.targetSocketId);
    if (targetSocket) targetSocket.leave(data.roomId);
    this.server.to(data.targetSocketId).emit('you-were-kicked', { by: requester.name });
    this.server.to(data.roomId).emit('user-left', { socketId: data.targetSocketId });
    await this.meetingsService.recordLeave(data.roomId, target.userId, new Date()).catch(() => null);
  }

  @SubscribeMessage('mute-all')
  handleMuteAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;
    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;
    room.forEach((_, socketId) => {
      if (socketId !== client.id) {
        this.server.to(socketId).emit('mute-request', { by: requester.name });
      }
    });
  }

  @SubscribeMessage('toggle-lock')
  handleToggleLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; locked: boolean },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;
    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;
    this.lockedRooms.set(data.roomId, data.locked);
    this.server.to(data.roomId).emit('room-locked', { locked: data.locked });
  }

  @SubscribeMessage('toggle-screen-share')
  handleToggleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isSharingScreen: boolean; screenStreamId?: string },
  ) {
    client.to(data.roomId).emit('participant-screen-share-changed', {
      socketId: client.id,
      isSharingScreen: data.isSharingScreen,
      screenStreamId: data.screenStreamId,
    });
  }

  @SubscribeMessage('mute-participant')
  handleMuteParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;
    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;
    this.server.to(data.targetSocketId).emit('mute-request', { by: requester.name });
  }

  // ─── Chat ───────────────────────────────────────────────────────────────────

  @SubscribeMessage('chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    const participant = this.rooms.get(data.roomId)?.get(client.id);
    if (participant && data.content?.trim()) {
      this.server.to(data.roomId).emit('chat-message', {
        senderId: client.id,
        senderName: participant.name,
        content: data.content.trim(),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async removeFromRoom(client: Socket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.get(client.id);
    if (!participant) return;

    room.delete(client.id);
    this.socketToRoom.delete(client.id);
    client.leave(roomId);

    this.server.to(roomId).emit('user-left', { socketId: client.id });

    await this.meetingsService
      .recordLeave(roomId, participant.userId, new Date())
      .catch(() => null);

    if (room.size === 0) {
      this.rooms.delete(roomId);
      this.lockedRooms.delete(roomId);
    } else if (participant.role === 'Anfitrión') {
      // Transfer host to the next participant in the room
      const nextHost = [...room.values()][0];
      nextHost.role = 'Anfitrión';
      this.server.to(nextHost.socketId).emit('you-are-now-host');
      this.server.to(roomId).emit('participant-role-changed', {
        socketId: nextHost.socketId,
        role: 'Anfitrión',
      });
      this.logger.log(`Host transferred to ${nextHost.name} in room ${roomId}`);
    }

    this.logger.log(`${participant.name} left room ${roomId}`);
  }
}
