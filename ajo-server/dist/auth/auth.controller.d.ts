import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
export declare class AuthController {
    private authService;
    private usersService;
    constructor(authService: AuthService, usersService: UsersService);
    requestOtp(dto: RequestOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: import("../common/enums/role.enum").Role;
            isPhoneVerified: boolean;
            isEmailVerified: boolean;
        };
    }>;
    register(dto: RegisterDto): Promise<{
        message: string;
        userId: string;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: import("../common/enums/role.enum").Role;
            isPhoneVerified: boolean;
            isEmailVerified: boolean;
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    me(user: RequestUser): Promise<{
        id: string;
        phone: string;
        email: string | undefined;
        name: string | undefined;
        role: import("../common/enums/role.enum").Role;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
    }>;
    updateProfile(user: RequestUser, dto: UpdateProfileDto): Promise<{
        id: string;
        phone: string;
        email: string | undefined;
        name: string | undefined;
        role: import("../common/enums/role.enum").Role;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
    }>;
    adminLogin(dto: AdminLoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: import("../common/enums/role.enum").Role.PLATFORM_ADMIN;
        };
    }>;
}
