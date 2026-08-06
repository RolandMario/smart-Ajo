import { JwtService } from '@nestjs/jwt';
import { OtpService } from '../otp/otp.service';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthService {
    private otpService;
    private usersService;
    private jwtService;
    constructor(otpService: OtpService, usersService: UsersService, jwtService: JwtService);
    private issueToken;
    requestOtp(phone: string): Promise<{
        message: string;
    }>;
    verifyOtpAndLogin(phone: string, code: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: Role;
            isPhoneVerified: boolean;
            isEmailVerified: boolean;
        };
    }>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        phone: string;
        email: string | undefined;
        name: string | undefined;
        role: Role;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
    }>;
    register(dto: RegisterDto): Promise<{
        message: string;
        userId: string;
    }>;
    loginWithPassword(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: Role;
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
    adminLogin(email: string, password: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            phone: string;
            email: string | undefined;
            name: string | undefined;
            role: Role.PLATFORM_ADMIN;
        };
    }>;
}
