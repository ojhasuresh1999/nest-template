import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AllConfigType } from '../../../config/config.types';
import { UserRepository } from '../../user/repositories/user.repository';
import { AuthenticatedSocket } from '../types/socket.types';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Missing authentication token');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow('auth.jwtSecret', { infer: true }),
      });

      const user = await this.userRepository.findById(payload.sub);
      if (!user || user.isDeleted || user.status !== 'Active') {
        throw new WsException('User not found or inactive');
      }

      (client as AuthenticatedSocket).user = {
        userId: payload.sub,
        email: payload.email,
        deviceId: payload.deviceId,
        role: user.role,
      };

      return true;
    } catch (error) {
      this.logger.warn(`WebSocket authentication failed: ${error.message}`);
      throw new WsException('Authentication failed');
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
