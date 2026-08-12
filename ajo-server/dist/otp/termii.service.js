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
var TermiiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermiiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importStar(require("axios"));
let TermiiService = TermiiService_1 = class TermiiService {
    configService;
    logger = new common_1.Logger(TermiiService_1.name);
    apiKey;
    senderId;
    baseUrl;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('TERMII_API_KEY');
        this.senderId = this.configService.get('TERMII_SENDER_ID');
        this.baseUrl = (this.configService.get('TERMII_BASE_URL') ?? '').replace(/\/+$/, '');
    }
    async sendSms(phone, message) {
        const to = phone.startsWith('+') ? phone.slice(1) : phone;
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/sms/send`, {
                api_key: this.apiKey,
                to,
                from: this.senderId,
                sms: message,
                type: 'plain',
                channel: 'dnd',
            }, {
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.data?.code && response.data.code !== 'ok') {
                this.logger.error(`Termii responded with non-ok code: ${JSON.stringify(response.data)}`);
                throw new common_1.InternalServerErrorException('Failed to send SMS');
            }
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                const status = error.response?.status;
                const data = error.response?.data;
                this.logger.error(`Smart Ajo SMS send failed for ${to}: Status ${status}, Response: ${JSON.stringify(data)}`);
            }
            else {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Smart Ajo SMS send failed for ${to}: ${message}`);
            }
            throw new common_1.InternalServerErrorException('Failed to send SMS');
        }
    }
};
exports.TermiiService = TermiiService;
exports.TermiiService = TermiiService = TermiiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TermiiService);
//# sourceMappingURL=termii.service.js.map