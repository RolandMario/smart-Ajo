import { ConfigService } from '@nestjs/config';
export declare class TermiiService {
    private configService;
    private readonly logger;
    private readonly apiKey;
    private readonly senderId;
    private readonly baseUrl;
    constructor(configService: ConfigService);
    sendSms(phone: string, message: string): Promise<void>;
}
