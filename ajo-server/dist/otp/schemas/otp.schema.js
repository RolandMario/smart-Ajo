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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpSchema = exports.Otp = exports.OtpPurpose = void 0;
const mongoose_1 = require("@nestjs/mongoose");
var OtpPurpose;
(function (OtpPurpose) {
    OtpPurpose["LOGIN_OR_REGISTER"] = "login_or_register";
})(OtpPurpose || (exports.OtpPurpose = OtpPurpose = {}));
let Otp = class Otp {
    phone;
    codeHash;
    purpose;
    expiresAt;
    consumed;
    attempts;
};
exports.Otp = Otp;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true, trim: true }),
    __metadata("design:type", String)
], Otp.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, select: false }),
    __metadata("design:type", String)
], Otp.prototype, "codeHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: OtpPurpose,
        default: OtpPurpose.LOGIN_OR_REGISTER,
    }),
    __metadata("design:type", String)
], Otp.prototype, "purpose", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Otp.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Otp.prototype, "consumed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Otp.prototype, "attempts", void 0);
exports.Otp = Otp = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Otp);
exports.OtpSchema = mongoose_1.SchemaFactory.createForClass(Otp);
exports.OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
//# sourceMappingURL=otp.schema.js.map