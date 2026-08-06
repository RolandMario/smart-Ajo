"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformAdminManagementService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bcrypt = __importStar(require("bcrypt"));
const user_schema_1 = require("../users/schemas/user.schema");
const role_enum_1 = require("../common/enums/role.enum");
const SALT_ROUNDS = 10;
let PlatformAdminManagementService = class PlatformAdminManagementService {
    userModel;
    constructor(userModel) {
        this.userModel = userModel;
    }
    async listAdmins() {
        const admins = await this.userModel
            .find({ role: role_enum_1.Role.PLATFORM_ADMIN })
            .sort({ createdAt: -1 })
            .lean();
        return admins.map((a) => ({
            id: a._id.toString(),
            email: a.email,
            phone: a.phone,
            name: a.name,
            isActive: a.isActive,
            createdAt: a.createdAt,
        }));
    }
    async createAdmin(dto) {
        const [existingByEmail, existingByPhone] = await Promise.all([
            this.userModel.findOne({ email: dto.email.toLowerCase() }),
            this.userModel.findOne({ phone: dto.phone }),
        ]);
        if (existingByEmail) {
            throw new common_1.ConflictException('A user with this email already exists');
        }
        if (existingByPhone) {
            throw new common_1.ConflictException('A user with this phone number already exists');
        }
        const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const admin = await this.userModel.create({
            email: dto.email.toLowerCase(),
            phone: dto.phone,
            passwordHash,
            name: dto.name,
            role: role_enum_1.Role.PLATFORM_ADMIN,
            isPhoneVerified: true,
            isEmailVerified: true,
        });
        return {
            id: admin._id.toString(),
            email: admin.email,
            phone: admin.phone,
            name: admin.name,
            isActive: admin.isActive,
            createdAt: admin.createdAt,
        };
    }
    async setActive(actingAdminId, targetAdminId, isActive) {
        if (actingAdminId === targetAdminId) {
            throw new common_1.ForbiddenException('You cannot deactivate your own account');
        }
        if (!mongoose_2.Types.ObjectId.isValid(targetAdminId)) {
            throw new common_1.NotFoundException('Admin not found');
        }
        const admin = await this.userModel.findOne({
            _id: targetAdminId,
            role: role_enum_1.Role.PLATFORM_ADMIN,
        });
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        admin.isActive = isActive;
        await admin.save();
        return {
            id: admin._id.toString(),
            email: admin.email,
            phone: admin.phone,
            name: admin.name,
            isActive: admin.isActive,
            createdAt: admin.createdAt,
        };
    }
};
exports.PlatformAdminManagementService = PlatformAdminManagementService;
exports.PlatformAdminManagementService = PlatformAdminManagementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], PlatformAdminManagementService);
//# sourceMappingURL=platform-admin-management.service.js.map