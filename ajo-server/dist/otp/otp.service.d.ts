import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { OtpDocument, OtpPurpose } from './schemas/otp.schema';
import { TermiiService } from './termii.service';
export declare class OtpService {
    private otpModel;
    private termiiService;
    private configService;
    private readonly logger;
    private readonly otpLength;
    private readonly otpExpiryMinutes;
    private readonly maxAttempts;
    private readonly isDev;
    constructor(otpModel: Model<OtpDocument>, termiiService: TermiiService, configService: ConfigService);
    private generateCode;
    requestOtp(phone: string, purpose?: OtpPurpose): Promise<void>;
    verifyOtp(phone: string, code: string, purpose?: OtpPurpose): Promise<void>;
}
