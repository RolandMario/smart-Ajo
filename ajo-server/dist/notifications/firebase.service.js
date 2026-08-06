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
var FirebaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
let FirebaseService = FirebaseService_1 = class FirebaseService {
    configService;
    logger = new common_1.Logger(FirebaseService_1.name);
    app;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const projectId = this.configService.get('FIREBASE_PROJECT_ID');
        const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.configService
            .get('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n');
        if (!projectId || !clientEmail || !privateKey) {
            this.logger.warn('Firebase credentials not configured — push notifications will be skipped. ' +
                'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env');
            return;
        }
        try {
            this.app = (0, app_1.initializeApp)({
                credential: (0, app_1.cert)({ projectId, clientEmail, privateKey }),
            });
            this.logger.log(`Firebase Admin initialised (project: ${projectId})`);
        }
        catch (error) {
            this.logger.error(`Failed to initialise Firebase Admin: ${String(error)}`);
        }
    }
    get isReady() {
        return !!this.app;
    }
    async sendToToken(token, payload) {
        if (!this.app) {
            return { token, success: false, error: 'Firebase not initialised' };
        }
        try {
            await (0, messaging_1.getMessaging)(this.app).send({
                token,
                notification: { title: payload.title, body: payload.body },
                data: payload.data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            return { token, success: true };
        }
        catch (error) {
            const code = error.code ?? '';
            const isInvalid = code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token';
            return {
                token,
                success: false,
                tokenInvalid: isInvalid,
                error: code || String(error),
            };
        }
    }
    async sendToTokens(tokens, payload) {
        if (tokens.length === 0)
            return [];
        return Promise.all(tokens.map((t) => this.sendToToken(t, payload)));
    }
};
exports.FirebaseService = FirebaseService;
exports.FirebaseService = FirebaseService = FirebaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FirebaseService);
//# sourceMappingURL=firebase.service.js.map