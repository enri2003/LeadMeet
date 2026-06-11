import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      // Dev mode: allow guest sessions without a token
      client.data.user = {
        id: `guest-${client.id}`,
        name: 'Invitado',
        role: 'Guest',
      };
      return true;
    }

    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Token inválido o expirado');
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    const headerToken = (client.handshake.headers?.authorization as string | undefined)?.replace(
      'Bearer ',
      '',
    );
    return authToken ?? headerToken ?? null;
  }
}
