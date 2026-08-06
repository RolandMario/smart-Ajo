import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
export interface PlatformAdminListItem {
    id: string;
    email: string;
    phone: string;
    name?: string;
    isActive: boolean;
    createdAt: Date;
}
export declare class PlatformAdminManagementService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    listAdmins(): Promise<PlatformAdminListItem[]>;
    createAdmin(dto: CreatePlatformAdminDto): Promise<PlatformAdminListItem>;
    setActive(actingAdminId: string, targetAdminId: string, isActive: boolean): Promise<PlatformAdminListItem>;
}
