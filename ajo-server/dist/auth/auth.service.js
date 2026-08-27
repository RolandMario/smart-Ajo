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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const otp_service_1 = require("../otp/otp.service");
const users_service_1 = require("../users/users.service");
const role_enum_1 = require("../common/enums/role.enum");
let AuthService = class AuthService {
    otpService;
    usersService;
    jwtService;
    constructor(otpService, usersService, jwtService) {
        this.otpService = otpService;
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async issueToken(payload) {
        return this.jwtService.signAsync(payload);
    }
    async requestOtp(phone) {
        await this.otpService.requestOtp(phone);
        return { message: 'OTP sent' };
    }
    async verifyOtpAndLogin(phone, code) {
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
    async updateProfile(userId, dto) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        if (dto.name !== undefined) {
            user.name = dto.name;
        }
        if (dto.email !== undefined && dto.email !== user.email) {
            user.email = dto.email;
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
    async register(dto) {
        const existing = await this.usersService.findByPhone(dto.phone);
        if (existing) {
            throw new common_1.ConflictException('An account with this phone number already exists');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.usersService.create({
            phone: dto.phone,
            email: dto.email.toLowerCase(),
            passwordHash,
            role: role_enum_1.Role.USER,
            isPhoneVerified: false,
            isEmailVerified: false,
        });
        await this.otpService.requestOtp(dto.phone);
        return {
            message: 'Registration successful. Please verify your phone number.',
            userId: user._id.toString(),
        };
    }
    async loginWithPassword(dto) {
        const user = await this.usersService.findByPhone(dto.phone);
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid phone number or password');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Account is deactivated');
        }
        const matches = await bcrypt.compare(dto.password, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException('Invalid phone number or password');
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
    async forgotPassword(dto) {
        const user = await this.usersService.findByPhone(dto.phone);
        if (!user) {
            return {
                message: 'If an account with that phone exists, an OTP has been sent.',
            };
        }
        await this.otpService.requestOtp(dto.phone);
        return {
            message: 'If an account with that phone exists, an OTP has been sent.',
        };
    }
    async resetPassword(dto) {
        await this.otpService.verifyOtp(dto.phone, dto.code);
        const user = await this.usersService.findByPhone(dto.phone);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        user.passwordHash = passwordHash;
        await user.save();
        return { message: 'Password has been reset successfully.' };
    }
    async adminLogin(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user || user.role !== role_enum_1.Role.PLATFORM_ADMIN || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Account is deactivated');
        }
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException('Invalid credentials');
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [otp_service_1.OtpService,
        users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map