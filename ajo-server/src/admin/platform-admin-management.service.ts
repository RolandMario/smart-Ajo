import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';

const SALT_ROUNDS = 10;

export interface PlatformAdminListItem {
  id: string;
  email: string;
  phone: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Lets an existing platform_admin create and manage OTHER
 * platform_admin accounts from ajo-admin-web (Sub-phase E), closing the
 * loop the original seed script (`npm run seed:platform-admin`)
 * intentionally left open — that script exists only to create the
 * FIRST admin account; every subsequent one should go through here.
 *
 * Deactivation (not deletion) is used to revoke access — `JwtStrategy`
 * re-checks `isActive` on every request, so this takes effect
 * immediately rather than waiting for the admin's token to expire.
 */
@Injectable()
export class PlatformAdminManagementService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async listAdmins(): Promise<PlatformAdminListItem[]> {
    const admins = await this.userModel
      .find({ role: Role.PLATFORM_ADMIN })
      .sort({ createdAt: -1 })
      .lean();

    return admins.map((a) => ({
      id: a._id.toString(),
      email: a.email!,
      phone: a.phone,
      name: a.name,
      isActive: a.isActive,
      createdAt: (a as unknown as { createdAt: Date }).createdAt,
    }));
  }

  async createAdmin(
    dto: CreatePlatformAdminDto,
  ): Promise<PlatformAdminListItem> {
    const [existingByEmail, existingByPhone] = await Promise.all([
      this.userModel.findOne({ email: dto.email.toLowerCase() }),
      this.userModel.findOne({ phone: dto.phone }),
    ]);

    if (existingByEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    if (existingByPhone) {
      throw new ConflictException(
        'A user with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const admin = await this.userModel.create({
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      name: dto.name,
      role: Role.PLATFORM_ADMIN,
      isPhoneVerified: true,
      isEmailVerified: true,
    });

    return {
      id: admin._id.toString(),
      email: admin.email!,
      phone: admin.phone,
      name: admin.name,
      isActive: admin.isActive,
      createdAt: (admin as unknown as { createdAt: Date }).createdAt,
    };
  }

  /**
   * Deactivates or reactivates a platform_admin account. An admin can't
   * deactivate their own account — that's a footgun (locking yourself
   * out with no one left to undo it) best prevented outright rather
   * than just discouraged.
   */
  async setActive(
    actingAdminId: string,
    targetAdminId: string,
    isActive: boolean,
  ): Promise<PlatformAdminListItem> {
    if (actingAdminId === targetAdminId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    if (!Types.ObjectId.isValid(targetAdminId)) {
      throw new NotFoundException('Admin not found');
    }

    const admin = await this.userModel.findOne({
      _id: targetAdminId,
      role: Role.PLATFORM_ADMIN,
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.isActive = isActive;
    await admin.save();

    return {
      id: admin._id.toString(),
      email: admin.email!,
      phone: admin.phone,
      name: admin.name,
      isActive: admin.isActive,
      createdAt: (admin as unknown as { createdAt: Date }).createdAt,
    };
  }
}
