import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  SharingBroadcastDto,
  StartSharingDto,
  StopSharingDto,
} from '../dto/sharing-event.dto';
import { MeetingLogService } from '../services/meeting-log.service';
import { SourceType } from '../entities/meeting-log.entity';

/** roomId → userId del participante que está compartiendo */
type RoomSharingMap = Map<string, string>;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200', credentials: true },
  namespace: '/',
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MeetingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(MeetingGateway.name);

  private readonly sharingMap: RoomSharingMap = new Map();

  /** socketId → { roomId, userId, userName } para cleanup en disconnect */
  private readonly clientMeta = new Map<
    string,
    { roomId: string; userId: string; userName: string }
  >();

  constructor(private readonly meetingLogSvc: MeetingLogService) {}

  // ── Ciclo de vida ──────────────────────────────────────────────────────

  afterInit(): void {
    this.logger.log('MeetingGateway iniciado — Socket.IO listo');
  }

  handleConnection(client: Socket): void {
    const { roomId, userId } = client.handshake.query as Record<string, string>;

    if (!roomId || !userId) {
      this.logger.warn(`Cliente ${client.id} sin roomId/userId — desconectando`);
      client.disconnect(true);
      return;
    }

    client.join(roomId);
    this.clientMeta.set(client.id, { roomId, userId, userName: '' });
    this.logger.log(`[${roomId}] Usuario ${userId} conectado (socket: ${client.id})`);

    // Informar al nuevo participante si alguien ya comparte en la sala
    const currentSharer = this.sharingMap.get(roomId);
    if (currentSharer) {
      client.emit('sharingStatus', { sharingUserId: currentSharer });
    }
  }

  handleDisconnect(client: Socket): void {
    const meta = this.clientMeta.get(client.id);
    if (!meta) return;

    const { roomId, userId, userName } = meta;
    this.clientMeta.delete(client.id);

    // Si este usuario estaba compartiendo, limpiar y notificar
    if (this.sharingMap.get(roomId) === userId) {
      this.sharingMap.delete(roomId);

      // Cerrar el log de actividad
      void this.meetingLogSvc.logShareStopped(userId, roomId);

      const payload: SharingBroadcastDto = {
        userId,
        userName,
        roomId,
        timestamp: new Date().toISOString(),
      };
      this.server.to(roomId).emit('userStoppedSharing', payload);
      this.logger.log(`[${roomId}] Compartición detenida por desconexión de ${userId}`);
    }

    this.logger.log(`[${roomId}] Usuario ${userId} desconectado`);
  }

  // ── Eventos de compartir pantalla ──────────────────────────────────────

  @SubscribeMessage('startSharing')
  async handleStartSharing(
    @MessageBody() dto: StartSharingDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { roomId, userId, userName } = dto;

    const currentSharer = this.sharingMap.get(roomId);
    if (currentSharer && currentSharer !== userId) {
      throw new WsException(
        `Ya hay un participante compartiendo pantalla en la sala ${roomId}.`,
      );
    }

    this.sharingMap.set(roomId, userId);

    const meta = this.clientMeta.get(client.id);
    if (meta) meta.userName = userName;

    // --- Registrar en base de datos (Tarea 5.5) ---
    await this.meetingLogSvc.logShareStarted({
      userId,
      roomId,
      sourceType: (dto as StartSharingDto & { sourceType?: SourceType }).sourceType,
      withAudio:  (dto as StartSharingDto & { withAudio?: boolean }).withAudio ?? false,
    });

    const payload: SharingBroadcastDto = {
      userId,
      userName,
      roomId,
      timestamp: new Date().toISOString(),
    };
    this.server.to(roomId).emit('userStartedSharing', payload);
    this.logger.log(`[${roomId}] ${userName} (${userId}) empezó a compartir`);
  }

  @SubscribeMessage('stopSharing')
  async handleStopSharing(
    @MessageBody() dto: StopSharingDto,
  ): Promise<void> {
    const { roomId, userId, userName } = dto;

    if (this.sharingMap.get(roomId) === userId) {
      this.sharingMap.delete(roomId);
    }

    // --- Cerrar el registro en base de datos (Tarea 5.5) ---
    await this.meetingLogSvc.logShareStopped(userId, roomId);

    const payload: SharingBroadcastDto = {
      userId,
      userName,
      roomId,
      timestamp: new Date().toISOString(),
    };
    this.server.to(roomId).emit('userStoppedSharing', payload);
    this.logger.log(`[${roomId}] ${userName} (${userId}) detuvo la compartición`);
  }

  @SubscribeMessage('getSharingStatus')
  handleGetSharingStatus(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const sharingUserId = this.sharingMap.get(data.roomId) ?? null;
    client.emit('sharingStatus', { sharingUserId });
  }
}
