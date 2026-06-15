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
  isSharingScreen: boolean;
  joinedAt: Date;
}

interface WaitingEntry {
  socketId: string;
  userId: string;
  name: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/meeting',
})
export class WebRtcGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebRtcGateway.name);

  private readonly rooms = new Map<string, Map<string, RoomParticipant>>();
  private readonly socketToRoom = new Map<string, string>();
  private readonly lockedRooms = new Map<string, boolean>();
  private readonly waitingRoomEnabled = new Map<string, boolean>();
  private readonly waitingRooms = new Map<string, Map<string, WaitingEntry>>();
  // Maps roomId → actual meeting.id (UUID) for FK-safe DB ops
  private readonly roomToMeetingId = new Map<string, string>();
  // Maps roomId → creatorUserId (so creator leaving ends the meeting)
  private readonly roomCreators = new Map<string, string>();
  // Maps roomId → Set<userId> of users admitted/joined (bypass waiting room on reconnect)
  private readonly admittedUsers = new Map<string, Set<string>>();

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
      // Page reload / connection drop — NOT intentional leave
      await this.removeFromRoom(client, roomId, false);
    } else {
      // Was in waiting room — clean up waiting room entries
      this.waitingRooms.forEach((waitingRoom) => {
        waitingRoom.delete(client.id);
      });
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; name: string; role?: string },
  ) {
    const { roomId, userId, name } = data;

    const freshRoom = !this.rooms.has(roomId);
    if (freshRoom) {
      this.rooms.set(roomId, new Map());
      // Always start a fresh room with waiting room and lock OFF
      this.waitingRoomEnabled.set(roomId, false);
      this.lockedRooms.set(roomId, false);
    }

    const room = this.rooms.get(roomId)!;

    // Resolve meeting and cache the real UUID for FK-safe DB operations
    let isCreator = false;
    let resolvedMeeting: Awaited<ReturnType<typeof this.meetingsService.findByCodeOrId>> = null;
    try {
      resolvedMeeting = await this.meetingsService.findByCodeOrId(roomId);
      if (resolvedMeeting) {
        this.roomToMeetingId.set(roomId, resolvedMeeting.id);
        isCreator = resolvedMeeting.createdById === userId;
      }
    } catch { /* fallback */ }

    // Block entry to completed/cancelled meetings
    if (resolvedMeeting && (resolvedMeeting.status === 'completed' || resolvedMeeting.status === 'cancelled' || resolvedMeeting.status === 'archived')) {
      client.emit('join-rejected', {
        reason: 'Esta reunión ya ha finalizado y fue cerrada.',
      });
      if (freshRoom) this.cleanupRoom(roomId);
      return { success: false, isHost: false };
    }

    // Block entry before scheduled start time (except for creator)
    if (resolvedMeeting && !isCreator && resolvedMeeting.status === 'scheduled') {
      const now = new Date();
      if (now < resolvedMeeting.startTime) {
        client.emit('join-rejected', {
          reason: 'La reunión aún no ha comenzado. Por favor, regresa a la hora programada.',
          scheduledAt: resolvedMeeting.startTime.toISOString(),
        });
        if (freshRoom) this.cleanupRoom(roomId);
        return { success: false, isHost: false };
      }
    }

    // Persist the creator for this room (used in removeFromRoom)
    if (isCreator) {
      this.roomCreators.set(roomId, userId);
    }

    // Remove any stale entry for this same userId (reconnect with new socket)
    for (const [oldSocketId, oldParticipant] of room.entries()) {
      if (oldParticipant.userId === userId && oldSocketId !== client.id) {
        room.delete(oldSocketId);
        this.socketToRoom.delete(oldSocketId);
        this.server.to(roomId).emit('user-left', { socketId: oldSocketId });
        this.logger.log(`Replaced stale socket for ${name} in room ${roomId}`);
        break;
      }
    }

    const isHost = isCreator || room.size === 0;

    if (!isHost) {
      // Check if user was already admitted (reconnecting after page reload)
      const alreadyAdmitted = this.admittedUsers.get(roomId)?.has(userId) ?? false;

      if (!alreadyAdmitted) {
        if (this.lockedRooms.get(roomId)) {
          client.emit('join-rejected', { reason: 'La sala está bloqueada por el anfitrión' });
          return { success: false, isHost: false };
        }

        if (this.waitingRoomEnabled.get(roomId)) {
          if (!this.waitingRooms.has(roomId)) {
            this.waitingRooms.set(roomId, new Map());
          }

          const waitingRoom = this.waitingRooms.get(roomId)!;

          // Remove any duplicate waiting-room entries for this userId (page reloads)
          for (const [wSocketId, entry] of waitingRoom.entries()) {
            if (entry.userId === userId) {
              waitingRoom.delete(wSocketId);
            }
          }

          const waiting: WaitingEntry = { socketId: client.id, userId, name };
          waitingRoom.set(client.id, waiting);

          const host = [...room.values()].find((p) => p.role === 'Anfitrión');
          if (host) {
            this.server.to(host.socketId).emit('participant-waiting', waiting);
          }

          this.logger.log(`${name} waiting for admission in room ${roomId}`);
          return { success: false, isHost: false, waiting: true };
        }
      }
    }

    // If the creator joins after someone else was temporarily host, transfer the role back
    if (isCreator && room.size > 0) {
      const prevHost = [...room.values()].find((p) => p.role === 'Anfitrión');
      if (prevHost && prevHost.userId !== userId) {
        prevHost.role = 'Participante';
        this.server.to(prevHost.socketId).emit('participant-role-changed', {
          socketId: prevHost.socketId,
          role: 'Participante',
        });
        this.server.to(roomId).emit('participant-role-changed', {
          socketId: prevHost.socketId,
          role: 'Participante',
        });
      }
    }

    const participant: RoomParticipant = {
      socketId: client.id,
      userId,
      name,
      role: isHost ? 'Anfitrión' : 'Participante',
      isMuted: true,
      isCameraOff: true,
      isSharingScreen: false,
      joinedAt: new Date(),
    };

    room.set(client.id, participant);
    this.socketToRoom.set(client.id, roomId);
    await client.join(roomId);

    // Track admitted users so they can bypass the waiting room on reconnect
    if (!this.admittedUsers.has(roomId)) {
      this.admittedUsers.set(roomId, new Set());
    }
    this.admittedUsers.get(roomId)!.add(userId);

    const settings = await this.usersService.getSettings(userId).catch(() => null);

    const existingParticipants = Array.from(room.values()).filter(
      (p) => p.socketId !== client.id,
    );

    client.emit('room-state', {
      participants: existingParticipants,
      isHost,
      roomId,
      isWaitingRoomEnabled: this.waitingRoomEnabled.get(roomId) ?? false,
      isLocked: this.lockedRooms.get(roomId) ?? false,
    });

    if (!settings?.hidePresence) {
      client.to(roomId).emit('user-joined', participant);
    }

    const meetingId = this.roomToMeetingId.get(roomId) ?? roomId;
    await this.meetingsService.recordJoin(meetingId, userId, participant.joinedAt).catch(() => null);

    this.logger.log(`${name} joined room ${roomId} (isHost=${isHost}, alreadyAdmitted=${this.admittedUsers.get(roomId)?.has(userId)})`);
    return { success: true, isHost };
  }

  @SubscribeMessage('admit-participant')
  async handleAdmitParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;

    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;

    const waitingRoom = this.waitingRooms.get(data.roomId);
    const waiting = waitingRoom?.get(data.targetSocketId);
    if (!waiting) return;

    waitingRoom!.delete(data.targetSocketId);

    const participant: RoomParticipant = {
      socketId: data.targetSocketId,
      userId: waiting.userId,
      name: waiting.name,
      role: 'Participante',
      isMuted: true,
      isCameraOff: true,
      isSharingScreen: false,
      joinedAt: new Date(),
    };

    room.set(data.targetSocketId, participant);
    this.socketToRoom.set(data.targetSocketId, data.roomId);

    this.server.in(data.targetSocketId).socketsJoin(data.roomId);

    // Track admitted so they can rejoin directly on page reload
    if (!this.admittedUsers.has(data.roomId)) {
      this.admittedUsers.set(data.roomId, new Set());
    }
    this.admittedUsers.get(data.roomId)!.add(waiting.userId);

    const existingParticipants = [...room.values()].filter(
      (p) => p.socketId !== data.targetSocketId,
    );

    this.server.to(data.targetSocketId).emit('admitted-to-room', {
      participants: existingParticipants,
      isHost: false,
      roomId: data.roomId,
    });

    this.server
      .to(data.roomId)
      .except(data.targetSocketId)
      .emit('user-joined', participant);

    const meetingId = this.roomToMeetingId.get(data.roomId) ?? data.roomId;
    await this.meetingsService.recordJoin(meetingId, waiting.userId, new Date()).catch(() => null);
    this.logger.log(`${waiting.name} admitted to room ${data.roomId}`);
  }

  @SubscribeMessage('reject-participant')
  handleRejectParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId: string },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;

    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;

    const waitingRoom = this.waitingRooms.get(data.roomId);
    if (waitingRoom?.has(data.targetSocketId)) {
      const waiting = waitingRoom.get(data.targetSocketId)!;
      waitingRoom.delete(data.targetSocketId);
      this.server.to(data.targetSocketId).emit('admission-rejected');
      this.logger.log(`${waiting.name} rejected from room ${data.roomId}`);
    }
  }

  @SubscribeMessage('toggle-waiting-room')
  handleToggleWaitingRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; enabled: boolean },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;

    const requester = room.get(client.id);
    if (requester?.role !== 'Anfitrión') return;

    this.waitingRoomEnabled.set(data.roomId, data.enabled);
    this.server.to(data.roomId).emit('waiting-room-changed', { enabled: data.enabled });
    this.logger.log(`Waiting room ${data.enabled ? 'enabled' : 'disabled'} in room ${data.roomId}`);
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    // Intentional leave — if creator, ends meeting for all
    await this.removeFromRoom(client, data.roomId, true);
  }

  @SubscribeMessage('end-meeting')
  async handleEndMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; durationSeconds?: number },
  ) {
    const room = this.rooms.get(data.roomId);
    if (!room) return;

    const participant = room.get(client.id);
    if (participant?.role !== 'Anfitrión') return;

    const durationMinutes = data.durationSeconds
      ? Math.round(data.durationSeconds / 60)
      : undefined;

    const meetingId = this.roomToMeetingId.get(data.roomId) ?? data.roomId;
    await this.meetingsService.endMeeting(meetingId, durationMinutes).catch(() => null);

    this.server.to(data.roomId).emit('meeting-ended', { endedBy: participant.name });

    const waitingRoom = this.waitingRooms.get(data.roomId);
    waitingRoom?.forEach((_, socketId) => {
      this.server.to(socketId).emit('admission-rejected');
    });

    room.forEach((_, socketId) => this.socketToRoom.delete(socketId));
    this.cleanupRoom(data.roomId);

    this.logger.log(
      `Meeting ${data.roomId} ended by host ${participant.name} (duration: ${durationMinutes ?? 'N/A'} min)`,
    );
  }

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

    // Remove from admitted so they go through waiting room if they try to rejoin
    this.admittedUsers.get(data.roomId)?.delete(target.userId);

    this.server.to(data.targetSocketId).emit('you-were-kicked', { by: requester.name });
    await this.server.in(data.targetSocketId).socketsLeave(data.roomId);
    this.server.to(data.roomId).emit('user-left', { socketId: data.targetSocketId, kicked: true });

    const meetingId = this.roomToMeetingId.get(data.roomId) ?? data.roomId;
    await this.meetingsService.recordLeave(meetingId, target.userId, new Date()).catch(() => null);
    this.logger.log(`${target.name} kicked from room ${data.roomId} by ${requester.name}`);
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
    const participant = this.rooms.get(data.roomId)?.get(client.id);
    if (participant) {
      participant.isSharingScreen = data.isSharingScreen;
    }
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

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Remove a participant from a room.
   * @param intentionalLeave true when the user explicitly clicked "Salir" (leave-room event).
   *                         false when the socket just disconnected (page reload / network drop).
   *
   * When the CREATOR intentionally leaves → end meeting for everyone.
   * When any host disconnects without intent (reload) → transfer host temporarily.
   */
  private async removeFromRoom(client: Socket, roomId: string, intentionalLeave: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.get(client.id);
    if (!participant) return;

    room.delete(client.id);
    this.socketToRoom.delete(client.id);
    await client.leave(roomId);

    this.server.to(roomId).emit('user-left', { socketId: client.id });

    const meetingId = this.roomToMeetingId.get(roomId) ?? roomId;
    await this.meetingsService.recordLeave(meetingId, participant.userId, new Date()).catch(() => null);

    const creatorUserId = this.roomCreators.get(roomId);
    const isCreatorLeaving = !!creatorUserId && participant.userId === creatorUserId;

    if (room.size === 0) {
      this.cleanupRoom(roomId);
      this.logger.log(`Room ${roomId} vacía, sala cerrada (sin cambiar estado en BD)`);
    } else if (intentionalLeave && isCreatorLeaving) {
      const meetingId2 = this.roomToMeetingId.get(roomId) ?? roomId;
      await this.meetingsService.endMeeting(meetingId2).catch(() => null);
      this.server.to(roomId).emit('meeting-ended', { endedBy: participant.name });
      // Reject any participants waiting
      const waitingRoom = this.waitingRooms.get(roomId);
      waitingRoom?.forEach((_, socketId) => {
        this.server.to(socketId).emit('admission-rejected');
      });
      // Clear socketToRoom for remaining participants before cleanup
      room.forEach((_, socketId) => this.socketToRoom.delete(socketId));
      this.cleanupRoom(roomId);
      this.logger.log(`Meeting ${roomId} ended because creator ${participant.name} left`);
    } else if (participant.role === 'Anfitrión') {
      // Host left temporarily (page reload / network drop) → transfer to next participant
      const nextHost = [...room.values()][0];
      nextHost.role = 'Anfitrión';
      this.server.to(nextHost.socketId).emit('you-are-now-host');
      this.server.to(roomId).emit('participant-role-changed', {
        socketId: nextHost.socketId,
        role: 'Anfitrión',
      });
      this.logger.log(`Host temporarily transferred to ${nextHost.name} in room ${roomId}`);
    }

    this.logger.log(`${participant.name} left room ${roomId} (intentional=${intentionalLeave})`);
  }

  private cleanupRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.lockedRooms.delete(roomId);
    this.waitingRoomEnabled.delete(roomId);
    this.roomToMeetingId.delete(roomId);
    this.roomCreators.delete(roomId);
    this.admittedUsers.delete(roomId);
    this.waitingRooms.delete(roomId);
  }
}
