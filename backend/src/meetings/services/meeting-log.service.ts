import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { MeetingLog, SourceType } from '../entities/meeting-log.entity';

export interface StartLogOptions {
  userId: string;
  roomId: string;
  meetingId?: string;
  sourceType?: SourceType;
  withAudio?: boolean;
}

export interface SharingSessionSummary {
  userId: string;
  roomId: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSec: number | null;
  sourceType: string | null;
  withAudio: boolean;
}

@Injectable()
export class MeetingLogService {
  private readonly logger = new Logger(MeetingLogService.name);

  constructor(
    @InjectRepository(MeetingLog)
    private readonly logRepo: Repository<MeetingLog>,
  ) {}

  /**
   * Registra el inicio de una compartición de pantalla.
   * Devuelve el log creado (su ID se necesita para cerrar la sesión después).
   */
  async logShareStarted(opts: StartLogOptions): Promise<MeetingLog> {
    const log = this.logRepo.create({
      userId:     opts.userId,
      roomId:     opts.roomId,
      meetingId:  opts.meetingId ?? null,
      eventType:  'share_started',
      startedAt:  new Date(),
      sourceType: opts.sourceType ?? null,
      withAudio:  opts.withAudio  ?? false,
    });

    const saved = await this.logRepo.save(log);
    this.logger.log(
      `[LOG] share_started — user=${opts.userId} room=${opts.roomId} id=${saved.id}`,
    );
    return saved;
  }

  /**
   * Cierra la sesión de compartición marcando stopped_at.
   * Busca el registro abierto más reciente del usuario en esa sala.
   */
  async logShareStopped(userId: string, roomId: string): Promise<MeetingLog | null> {
    // Buscar el registro abierto más reciente (sin stopped_at) para este usuario/sala
    const openLog = await this.logRepo.findOne({
      where: {
        userId,
        roomId,
        eventType: 'share_started',
        stoppedAt: IsNull(),
      },
      order: { startedAt: 'DESC' },
    });

    if (!openLog) {
      this.logger.warn(
        `[LOG] No hay sesión abierta para cerrar — user=${userId} room=${roomId}`,
      );
      return null;
    }

    openLog.stoppedAt = new Date();
    openLog.eventType = 'share_stopped';

    const saved = await this.logRepo.save(openLog);

    const durSec = Math.round(
      (saved.stoppedAt!.getTime() - saved.startedAt.getTime()) / 1000,
    );
    this.logger.log(
      `[LOG] share_stopped — user=${userId} room=${roomId} duración=${durSec}s`,
    );
    return saved;
  }

  /**
   * Devuelve el historial de sesiones de un usuario (para analítica).
   */
  async getUserSessions(userId: string): Promise<SharingSessionSummary[]> {
    const logs = await this.logRepo.find({
      where: { userId, stoppedAt: Not(IsNull()) },
      order: { startedAt: 'DESC' },
      take: 50,
    });

    return logs.map((l) => ({
      userId:      l.userId,
      roomId:      l.roomId,
      startedAt:   l.startedAt.toISOString(),
      stoppedAt:   l.stoppedAt?.toISOString() ?? null,
      durationSec: l.stoppedAt
        ? Math.round((l.stoppedAt.getTime() - l.startedAt.getTime()) / 1000)
        : null,
      sourceType: l.sourceType,
      withAudio:  l.withAudio,
    }));
  }
}
