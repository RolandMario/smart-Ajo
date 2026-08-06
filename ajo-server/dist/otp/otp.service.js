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
var OtpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const otp_schema_1 = require("./schemas/otp.schema");
const termii_service_1 = require("./termii.service");
const SALT_ROUNDS = 10;
let OtpService = OtpService_1 = class OtpService {
    otpModel;
    termiiService;
    configService;
    logger = new common_1.Logger(OtpService_1.name);
    otpLength;
    otpExpiryMinutes;
    maxAttempts;
    isDev;
    constructor(otpModel, termiiService, configService) {
        this.otpModel = otpModel;
        this.termiiService = termiiService;
        this.configService = configService;
        this.otpLength = this.configService.get('OTP_LENGTH');
        this.otpExpiryMinutes =
            this.configService.get('OTP_EXPIRY_MINUTES');
        this.maxAttempts = this.configService.get('OTP_MAX_ATTEMPTS');
        this.isDev = this.configService.get('NODE_ENV') !== 'production';
    }
    generateCode() {
        const max = 10 ** this.otpLength;
        const code = Math.floor(Math.random() * max)
            .toString()
            .padStart(this.otpLength, '0');
        return code;
    }
    async requestOtp(phone, purpose = otp_schema_1.OtpPurpose.LOGIN_OR_REGISTER) {
        await this.otpModel.updateMany({ phone, purpose, consumed: false }, { $set: { consumed: true } });
        const code = this.generateCode();
        const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
        const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
        await this.otpModel.create({ phone, codeHash, purpose, expiresAt });
        const message = `Your Ajo verification code is ${code}. It expires in ${this.otpExpiryMinutes} minutes. Do not share this code with anyone.`;
        this.logger.warn(`OTP for ${phone}: ${code}`);
    }
    async verifyOtp(phone, code, purpose = otp_schema_1.OtpPurpose.LOGIN_OR_REGISTER) {
        const otp = await this.otpModel
            .findOne({ phone, purpose, consumed: false })
            .sort({ createdAt: -1 })
            .select('+codeHash');
        if (!otp) {
            throw new common_1.BadRequestException('Invalid or expired code');
        }
        if (otp.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('Invalid or expired code');
        }
        if (otp.attempts >= this.maxAttempts) {
            throw new common_1.BadRequestException('Too many attempts. Please request a new code.');
        }
        const matches = await bcrypt.compare(code, otp.codeHash);
        if (!matches) {
            otp.attempts += 1;
            await otp.save();
            throw new common_1.BadRequestException('Invalid or expired code');
        }
        otp.consumed = true;
        await otp.save();
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = OtpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(otp_schema_1.Otp.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        termii_service_1.TermiiService,
        config_1.ConfigService])
], OtpService);
//# sourceMappingURL=otp.service.js.map