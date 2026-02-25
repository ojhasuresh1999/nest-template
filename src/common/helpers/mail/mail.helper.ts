import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Email from 'email-templates';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { resolve } from 'path';

@Injectable()
export class MailHelper {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a single email with EJS template
   */
  async sendMail(
    to: string | string[],
    subject: string,
    templateName: string,
    locals: Record<string, unknown> = {},
  ): Promise<SMTPTransport.SentMessageInfo> {
    const templateDir = resolve('./src/templates/emails', templateName);

    const email = new Email({
      views: {
        root: templateDir,
        options: { extension: 'ejs' },
      },
    });

    const html = await email.render(templateDir, locals);

    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('mail.host', { infer: true }),
      port: this.configService.getOrThrow<number>('mail.port', { infer: true }),
      secure: this.configService.get<boolean>('mail.secure', { infer: true }) ? true : false,
      auth: {
        user: this.configService.getOrThrow<string>('mail.user', { infer: true }),
        pass: this.configService.getOrThrow<string>('mail.pass', { infer: true }),
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
    });

    const sender =
      this.configService.get<string>('mail.from', { infer: true }) || 'noreply@consultly.com';

    const mailOptions = {
      from: sender,
      to,
      subject,
      html,
    };

    return await transporter.sendMail(mailOptions);
  }

  /**
   * Send multiple emails concurrently
   */
  async sendBulkMail(
    recipients: Array<{
      to: string | string[];
      subject: string;
      templateName: string;
      locals?: Record<string, unknown>;
    }>,
  ): Promise<PromiseSettledResult<SMTPTransport.SentMessageInfo>[]> {
    return Promise.allSettled(
      recipients.map((r) => this.sendMail(r.to, r.subject, r.templateName, r.locals || {})),
    );
  }
}
