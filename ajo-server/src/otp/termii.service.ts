import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

/**
 * Thin wrapper around Termii's generic SMS "send" endpoint.
 *
 * We deliberately do NOT use Termii's hosted OTP/Token API — OTP
 * generation, hashing, storage and verification are handled by
 * OtpService so the rest of the app isn't coupled to a specific
 * provider's verification semantics. Termii here is purely an SMS
 * delivery channel.
 */
@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TERMII_API_KEY')!;
    this.senderId = this.configService.get<string>('TERMII_SENDER_ID')!;
    // Normalize the base URL so a trailing slash in config doesn't produce a
    // double slash (e.g. https://api.ng.termii.com//api/sms/send) which Termii
    // rejects with a 404.
    this.baseUrl = (
      this.configService.get<string>('TERMII_BASE_URL') ?? ''
    ).replace(/\/+$/, '');
  }

  /**
   * Sends a plain-text SMS to the given phone number (E.164 format,
   * e.g. +2348012345678 — Termii expects this without the leading '+').
   */
  async sendSms(phone: string, message: string): Promise<void> {
    const to = phone.startsWith('+') ? phone.slice(1) : phone;

    try {
      const response = await axios.post<{ code?: string }>(
        `${this.baseUrl}/api/sms/send`,
        {
          api_key: this.apiKey,
          to,
          from: this.senderId,
          sms: message,
          type: 'plain',
          channel: 'dnd',
        },
       {
         headers: { 'Content-Type': 'application/json' },
       },
     );

     if (response.data?.code && response.data.code !== 'ok') {
       this.logger.error(
         `Termii responded with non-ok code: ${JSON.stringify(response.data)}`,
       );
       throw new InternalServerErrorException('Failed to send SMS');
     }
   } catch (error) {
     if (error instanceof AxiosError) {
       const status = error.response?.status;
       const data = error.response?.data;
       this.logger.error(
         `Smart Ajo SMS send failed for ${to}: Status ${status}, Response: ${JSON.stringify(data)}`,
       );
     } else {
       const message = error instanceof Error ? error.message : String(error);
       this.logger.error(`Smart Ajo SMS send failed for ${to}: ${message}`);
     }
     throw new InternalServerErrorException('Failed to send SMS');
   }
  }
}
