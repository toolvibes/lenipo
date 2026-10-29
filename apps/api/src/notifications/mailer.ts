import { Inject, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { AppConfig } from '../core/config.js';
import { CONFIG } from '../core/tokens.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The part of a nodemailer transport the mailer uses; tests replace it with a recorder. */
export interface MailTransport {
  sendMail(message: MailMessage & { from: string }): Promise<unknown>;
}

/** Outgoing email over SMTP (E-44); without SMTP_URL nothing is sent. */
@Injectable()
export class Mailer {
  transport: MailTransport | null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) return;
    await this.transport.sendMail({ ...message, from: this.config.MAIL_FROM });
  }
}
