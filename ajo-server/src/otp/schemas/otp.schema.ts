import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

export enum OtpPurpose {
  LOGIN_OR_REGISTER = 'login_or_register',
}

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, index: true, trim: true })
  phone!: string;

  /**
   * The OTP code is hashed before storage — never store plain codes.
   */
  @Prop({ required: true, select: false })
  codeHash!: string;

  @Prop({
    type: String,
    enum: OtpPurpose,
    default: OtpPurpose.LOGIN_OR_REGISTER,
  })
  purpose?: OtpPurpose;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  consumed?: boolean;

  /**
   * Number of failed verification attempts against this OTP.
   * Used to lock out brute-force guessing.
   */
  @Prop({ default: 0 })
  attempts?: number;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Auto-expire OTP documents shortly after they expire, so the collection
// stays small and we don't have to manually clean up.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
