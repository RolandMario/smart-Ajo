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
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const app_module_1 = require("../../app.module");
const users_service_1 = require("../../users/users.service");
const SALT_ROUNDS = 10;
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const configService = app.get(config_1.ConfigService);
        const usersService = app.get(users_service_1.UsersService);
        const email = configService.get('SEED_PLATFORM_ADMIN_EMAIL');
        const password = configService.get('SEED_PLATFORM_ADMIN_PASSWORD');
        const phone = configService.get('SEED_PLATFORM_ADMIN_PHONE');
        if (!email || !password || !phone) {
            console.error('SEED_PLATFORM_ADMIN_EMAIL, SEED_PLATFORM_ADMIN_PASSWORD and SEED_PLATFORM_ADMIN_PHONE must be set in .env');
            process.exitCode = 1;
            return;
        }
        const existing = await usersService.findByEmail(email);
        if (existing) {
            console.log(`A user with email ${email} already exists (id: ${existing._id.toString()}). Nothing to do.`);
            return;
        }
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const admin = await usersService.createPlatformAdmin({
            email,
            phone,
            passwordHash,
            name: 'Platform Admin',
        });
        console.log(`Created platform_admin: ${admin.email} (id: ${admin._id.toString()})`);
    }
    finally {
        await app.close();
    }
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed-platform-admin.js.map