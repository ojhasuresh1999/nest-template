import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AllConfigType } from 'src/config/config.types';

export interface RefreshTokenPayload {
  sub: string;
  deviceId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService<AllConfigType>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('auth.jwtRefreshSecret', {
        infer: true,
      }),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload) {
    const refreshToken = req.get('Authorization')?.replace('Bearer ', '').trim();
    return {
      userId: payload.sub,
      deviceId: payload.deviceId,
      refreshToken,
    };
  }
}
