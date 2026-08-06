import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { BankAccount } from './schemas/bank-account.schema';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  findByPhone(phone: string) {
    // passwordHash is select:false by default; the phone-based password
    // login (loginWithPassword) and resetPassword both need it.
    return this.userModel.findOne({ phone }).select('+passwordHash');
  }

  findByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash'); // passwordHash is select:false by default
  }

  findById(id: string) {
    return this.userModel.findById(id);
  }

  /**
   * Used by the mobile OTP flow: if a user with this phone number doesn't
   * exist yet, create one (role defaults to USER, isPhoneVerified=true
   * since they just proved ownership of the number via OTP).
   */
  async findOrCreateByPhone(phone: string): Promise<UserDocument> {
    let user = await this.userModel.findOne({ phone });
    if (!user) {
      user = await this.userModel.create({
        phone,
        role: Role.USER,
        isPhoneVerified: true,
      });
    } else if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }
    return user;
  }

  /**
   * Creates a new user with the given properties. Used by the registration flow.
   */
  async create(params: {
    phone: string;
    email: string;
    passwordHash: string;
    role: Role;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
  }): Promise<UserDocument> {
    return this.userModel.create(params);
  }

  /**
   * Sets/replaces the user's payout bank account. Called after the
   * account number has been resolved and a Paystack transfer recipient
   * created.
   */
  async setBankAccount(
    userId: string,
    bankAccount: BankAccount,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.bankAccount = bankAccount;
    await user.save();
    return user;
  }

  /**
   * Used only by the seed script to create the first platform_admin.
   */
  async createPlatformAdmin(params: {
    phone: string;
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserDocument> {
    return this.userModel.create({
      phone: params.phone,
      email: params.email,
      passwordHash: params.passwordHash,
      name: params.name,
      role: Role.PLATFORM_ADMIN,
      isPhoneVerified: true,
      isEmailVerified: true,
    });
  }

  /**
   * Finds the first platform admin user. Used for service fee collection
   * to credit the platform admin's wallet.
   * @throws NotFoundException if no platform admin exists
   */
  async findPlatformAdmin(): Promise<UserDocument> {
    const admin = await this.userModel.findOne({ role: Role.PLATFORM_ADMIN });
    if (!admin) {
      throw new NotFoundException('No platform admin found');
    }
    return admin;
  }
}