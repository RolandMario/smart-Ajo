import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { BankAccount, BankAccountSchema } from './bank-account.schema';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id!: Types.ObjectId;

  /**
   * E.164 formatted phone number, e.g. +2348012345678.
   * Primary identity for all mobile (non-admin) users.
   */
  @Prop({ required: true, unique: true, trim: true })
  phone!: string;

  /**
   * Optional. Required (and used for login) only for platform_admin users.
   * Stored lowercase. Sparse-unique so multiple users can omit it.
   */
  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  /**
   * Only set for platform_admin accounts (admin web login).
   * Regular mobile users authenticate via OTP and have no password.
   */
  @Prop({ select: false })
  passwordHash?: string;

  /**
   * Hashed transaction PIN, used later for confirming payments/transfers.
   */
  @Prop({ select: false })
  pinHash?: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: String, enum: Role, default: Role.USER })
  role!: Role;

  @Prop({ default: false })
  isPhoneVerified!: boolean;

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  /**
   * Payout bank account, set via POST /wallet/bank-account. Required
   * before this user can be the recipient of a cycle payout.
   */
  @Prop({ type: BankAccountSchema })
  bankAccount?: BankAccount;
}

export const UserSchema = SchemaFactory.createForClass(User);
