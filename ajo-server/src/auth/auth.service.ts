import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OtpService } from '../otp/otp.service';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private otpService: OtpService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private async issueToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload);
  }

  // ---- Mobile: phone + OTP -------------------------------------------------

  async requestOtp(phone: string): Promise<{ message: string }> {
    await this.otpService.requestOtp(phone);
    return { message: 'OTP sent' };
  }

  async verifyOtpAndLogin(phone: string, code: string) {
    await this.otpService.verifyOtp(phone, code);

    const user = await this.usersService.findOrCreateByPhone(phone);

    const accessToken = await this.issueToken({
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      user.email = dto.email;
      // Email changes require re-verification. Verification flow (e.g.
      // confirmation link/code) is out of scope for Phase 1.
      user.isEmailVerified = false;
    }

    await user.save();

    return {
      id: user._id.toString(),
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
    };
  }

  // ---- Mobile: email/password registration & login -------------------------

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByPhone(dto.phone);
    if (existing) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      phone: dto.phone,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: Role.USER,
      isPhoneVerified: false,
      isEmailVerified: false,
    });

    // Send OTP for phone verification
    await this.otpService.requestOtp(dto.phone);

    return {
      message: 'Registration successful. Please verify your phone number.',
      userId: user._id.toString(),
    };
  }

  async loginWithPassword(dto: LoginDto) {
    const user = await this.usersService.findByPhone(dto.phone);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const accessToken = await this.issueToken({
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  // ---- Forgot / Reset password ---------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      // Don't reveal whether the phone exists — just send OTP if it does
      return { message: 'If an account with that phone exists, an OTP has been sent.' };
    }

    await this.otpService.requestOtp(dto.phone);
    return { message: 'If an account with that phone exists, an OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Verify the OTP first
    await this.otpService.verifyOtp(dto.phone, dto.code);

    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    return { message: 'Password has been reset successfully.' };
  }

  // ---- Admin web: email + password -----------------------------------------

  async adminLogin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || user.role !== Role.PLATFORM_ADMIN || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.issueToken({
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}