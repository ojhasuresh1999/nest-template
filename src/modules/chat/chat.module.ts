import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { Conversation, ConversationSchema, Message, MessageSchema } from './schemas';
import { ConversationRepository, MessageRepository } from './repositories';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { UserModule } from '../user/user.module';
import { AllConfigType } from '../../config/config.types';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        secret: configService.getOrThrow('auth.jwtSecret', { infer: true }),
        signOptions: {
          expiresIn: configService.get('auth.jwtAccessExpiration', { infer: true }) || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ConversationRepository, MessageRepository, WsJwtGuard],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
