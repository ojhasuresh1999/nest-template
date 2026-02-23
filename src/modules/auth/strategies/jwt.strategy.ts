import { Injectable } from '@nestjs/common';
import { ApiError } from '../../../common/errors/api-error';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AllConfigType } from '../../../config/config.types';
import { UserRepository } from '../../user/repositories/user.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  deviceId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('auth.jwtSecret', { infer: true }),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findById(payload.sub);

    if (!user || user.isDeleted || user.status !== 'Active') {
      throw ApiError.unauthorized('User not found or inactive');
    }

    if (user.role) {
      await user.populate('role');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: user.role,
      deviceId: payload.deviceId,
    };
  }
}
