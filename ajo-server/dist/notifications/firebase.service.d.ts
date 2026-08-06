import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}
export interface PushResult {
    token: string;
    success: boolean;
    tokenInvalid?: boolean;
    error?: string;
}
export declare class FirebaseService implements OnModuleInit {
    private configService;
    private readonly logger;
    private app?;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    get isReady(): boolean;
    sendToToken(token: string, payload: PushPayload): Promise<PushResult>;
    sendToTokens(tokens: string[], payload: PushPayload): Promise<PushResult[]>;
}
