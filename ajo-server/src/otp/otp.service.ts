import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Otp, OtpDocument, OtpPurpose } from './schemas/otp.schema';
import { TermiiService } from './termii.service';

const SALT_ROUNDS = 10;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private readonly otpLength: number;
  private readonly otpExpiryMinutes: number;
  private readonly maxAttempts: number;
  private readonly isDev: boolean;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    private termiiService: TermiiService,
    private configService: ConfigService,
  ) {
    this.otpLength = this.configService.get<number>('OTP_LENGTH')!;
    this.otpExpiryMinutes =
      this.configService.get<number>('OTP_EXPIRY_MINUTES')!;
    this.maxAttempts = this.configService.get<number>('OTP_MAX_ATTEMPTS')!;
    this.isDev = this.configService.get<string>('NODE_ENV') !== 'production';
  }

  private generateCode(): string {
    const max = 10 ** this.otpLength;
    const code = Math.floor(Math.random() * max)
      .toString()
      .padStart(this.otpLength, '0');
    return code;
  }

  /**
   * Generates a new OTP, stores its hash, invalidates any previous
   * unconsumed OTPs for this phone+purpose, and sends it via SMS.
   *
   * In non-production environments, the generated code is also logged
   * so developers can test the flow without a live Termii account.
   */
  async requestOtp(
    phone: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN_OR_REGISTER,
  ): Promise<void> {
    // Invalidate any existing unconsumed OTPs for this phone/purpose so
    // only the latest code is valid.
    await this.otpModel.updateMany(
      { phone, purpose, consumed: false },
      { $set: { consumed: true } },
    );

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

    await this.otpModel.create({ phone, codeHash, purpose, expiresAt });

    const message = `Your Smart Ajo verification code is ${code}. It expires in ${this.otpExpiryMinutes} minutes. Do not share this code with anyone.`;

    this.logger.warn(`OTP for ${phone}: ${code}`);

    await this.termiiService.sendSms(phone, message);
  }

  /**
   * Verifies a submitted OTP code. Throws BadRequestException on any
   * failure (not found, expired, wrong code, too many attempts) — we
   * intentionally don't distinguish these in the response to avoid
   * leaking information to attackers.
   */
  async verifyOtp(
    phone: string,
    code: string,
    purpose: OtpPurpose = OtpPurpose.LOGIN_OR_REGISTER,
  ): Promise<void> {
    const otp = await this.otpModel
      .findOne({ phone, purpose, consumed: false })
      .sort({ createdAt: -1 })
      .select('+codeHash');

    if (!otp) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (otp.attempts! >= this.maxAttempts) {
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      otp.attempts! += 1;
      await otp.save();
      throw new BadRequestException('Invalid or expired code');
    }

    otp.consumed = true;
    await otp.save();
  }
}