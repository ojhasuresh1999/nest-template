import { Global, Module } from '@nestjs/common';
import { MailHelper } from '../helpers/mail/mail.helper';

@Global()
@Module({
  providers: [MailHelper],
  exports: [MailHelper],
})
export class MailModule {}
