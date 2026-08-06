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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceTokenService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const device_token_schema_1 = require("./schemas/device-token.schema");
let DeviceTokenService = class DeviceTokenService {
    deviceTokenModel;
    constructor(deviceTokenModel) {
        this.deviceTokenModel = deviceTokenModel;
    }
    async register(userId, token, platform) {
        await this.deviceTokenModel.findOneAndUpdate({ token }, { user: new mongoose_2.Types.ObjectId(userId), token, platform, isActive: true }, { upsert: true, new: true });
    }
    async deactivate(token) {
        await this.deviceTokenModel.updateOne({ token }, { $set: { isActive: false } });
    }
    async getActiveTokens(userId) {
        const docs = await this.deviceTokenModel
            .find({ user: new mongoose_2.Types.ObjectId(userId), isActive: true })
            .select('token')
            .lean();
        return docs.map((d) => d.token);
    }
    async getActiveTokensForUsers(userIds) {
        const objectIds = userIds.map((id) => new mongoose_2.Types.ObjectId(id));
        const docs = await this.deviceTokenModel
            .find({ user: { $in: objectIds }, isActive: true })
            .select('user token')
            .lean();
        const map = new Map();
        for (const doc of docs) {
            const uid = doc.user.toString();
            const existing = map.get(uid) ?? [];
            existing.push(doc.token);
            map.set(uid, existing);
        }
        return map;
    }
    async removeStaleTokens(tokens) {
        if (tokens.length === 0)
            return;
        await this.deviceTokenModel.deleteMany({ token: { $in: tokens } });
    }
};
exports.DeviceTokenService = DeviceTokenService;
exports.DeviceTokenService = DeviceTokenService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(device_token_schema_1.DeviceToken.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DeviceTokenService);
//# sourceMappingURL=device-token.service.js.map