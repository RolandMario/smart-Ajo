"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TermiiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermiiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
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
        this.baseUrl = this.configService.get('TERMII_BASE_URL');
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
                channel: 'generic',
            });
            if (response.data?.code && response.data.code !== 'ok') {
                this.logger.error(`Termii responded with non-ok code: ${JSON.stringify(response.data)}`);
                throw new common_1.InternalServerErrorException('Failed to send SMS');
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Termii SMS send failed for ${to}: ${message}`);
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