import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthAdminController } from './auth-admin.controller';
import { AuthUserController } from './auth-user.controller';
import { AuthService } from './auth.service';
import { JwtStrategy, JwtRefreshStrategy } from './strategies';
import { DeviceSessionService, SuspiciousActivityService, OtpService } from './services';
import { UserModule } from '../user/user.module';
import { AllConfigType } from '../../config/config.types';
import {
  DeviceSession,
  DeviceSessionSchema,
  LoginAttempt,
  LoginAttemptSchema,
  SuspiciousActivity,
  SuspiciousActivitySchema,
} from './schemas';
import { LoginAttemptRepository, SuspiciousActivityRepository } from './repositories';

@Global()
@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        secret: configService.getOrThrow('auth.jwtSecret', { infer: true }),
        signOptions: {
          expiresIn:
            configService.get('auth.jwtAccessExpiration', {
              infer: true,
            }) || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: DeviceSession.name, schema: DeviceSessionSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
      { name: SuspiciousActivity.name, schema: SuspiciousActivitySchema },
    ]),
  ],
  controllers: [AuthAdminController, AuthUserController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    DeviceSessionService,
    SuspiciousActivityService,
    OtpService,
    LoginAttemptRepository,
    SuspiciousActivityRepository,
  ],
  exports: [AuthService, JwtStrategy, JwtRefreshStrategy, DeviceSessionService],
})
export class AuthModule {}
