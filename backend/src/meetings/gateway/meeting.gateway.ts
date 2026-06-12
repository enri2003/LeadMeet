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

/**
 * Un Map que guarda qué usuario está compartiendo en cada sala.
 * Clave: roomId  →  Valor: userId del usuario que comparte (solo uno a la vez).
 */
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

  /** roomId → userId del participante que está compartiendo */
  private readonly sharingMap: RoomSharingMap = new Map();

  /** socketId → { roomId, userId, userName } para cleanup en disconnect */
  private readonly clientMeta = new Map<
    string,
    { roomId: string; userId: string; userName: string }
  >();

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

    // Unirse a la sala (room de Socket.IO = roomId)
    client.join(roomId);
    this.logger.log(`[${roomId}] Usuario ${userId} conectado (socket: ${client.id})`);

    // Guardar meta del cliente para usarlo en disconnect
    this.clientMeta.set(client.id, { roomId, userId, userName: '' });

    // Informar al cliente si alguien ya está compartiendo en esta sala
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

    // Si este usuario estaba compartiendo, limpiar y notificar a la sala
    if (this.sharingMap.get(roomId) === userId) {
      this.sharingMap.delete(roomId);
      const payload: SharingBroadcastDto = {
        userId,
        userName,
        roomId,
        timestamp: new Date().toISOString(),
      };
      this.server.to(roomId).emit('userStoppedSharing', payload);
      this.logger.log(`[${roomId}] Compartición detenida por desconexión de ${userId}`);
    }

    this.logger.log(`[${roomId}] Usuario ${userId} desconectado (socket: ${client.id})`);
  }

  // ── Eventos de compartir pantalla ──────────────────────────────────────

  /**
   * El cliente emite "startSharing" cuando inicia la captura de pantalla.
   * Regla: solo un usuario puede compartir a la vez por sala.
   */
  @SubscribeMessage('startSharing')
  handleStartSharing(
    @MessageBody() dto: StartSharingDto,
    @ConnectedSocket() client: Socket,
  ): void {
    const { roomId, userId, userName } = dto;

    // Validar que no haya otro usuario compartiendo en esta sala
    const currentSharer = this.sharingMap.get(roomId);
    if (currentSharer && currentSharer !== userId) {
      throw new WsException(
        `Ya hay un participante compartiendo pantalla en la sala ${roomId}.`,
      );
    }

    // Registrar al usuario como compartidor activo
    this.sharingMap.set(roomId, userId);

    // Actualizar userName en los metadatos del cliente
    const meta = this.clientMeta.get(client.id);
    if (meta) meta.userName = userName;

    const payload: SharingBroadcastDto = {
      userId,
      userName,
      roomId,
      timestamp: new Date().toISOString(),
    };

    // Emitir a TODOS los de la sala (incluido el emisor)
    this.server.to(roomId).emit('userStartedSharing', payload);

    this.logger.log(`[${roomId}] ${userName} (${userId}) empezó a compartir pantalla`);
  }

  /**
   * El cliente emite "stopSharing" cuando detiene la captura.
   */
  @SubscribeMessage('stopSharing')
  handleStopSharing(
    @MessageBody() dto: StopSharingDto,
    @ConnectedSocket() _client: Socket,
  ): void {
    const { roomId, userId, userName } = dto;

    // Solo limpiar si este usuario es el que estaba compartiendo
    if (this.sharingMap.get(roomId) === userId) {
      this.sharingMap.delete(roomId);
    }

    const payload: SharingBroadcastDto = {
      userId,
      userName,
      roomId,
      timestamp: new Date().toISOString(),
    };

    this.server.to(roomId).emit('userStoppedSharing', payload);

    this.logger.log(`[${roomId}] ${userName} (${userId}) detuvo la compartición de pantalla`);
  }

  /**
   * Permite consultar quién está compartiendo en una sala.
   */
  @SubscribeMessage('getSharingStatus')
  handleGetSharingStatus(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const sharingUserId = this.sharingMap.get(data.roomId) ?? null;
    client.emit('sharingStatus', { sharingUserId });
  }
}
