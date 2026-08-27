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
exports.PurchaseCableDto = void 0;
const class_validator_1 = require("class-validator");
class PurchaseCableDto {
    serviceProvider;
    smartCardNumber;
    amount;
    variationCode;
    customerName;
}
exports.PurchaseCableDto = PurchaseCableDto;
__decorate([
    (0, class_validator_1.IsDefined)(),
    (0, class_validator_1.IsIn)(['dstv', 'gotv', 'startimes']),
    __metadata("design:type", String)
], PurchaseCableDto.prototype, "serviceProvider", void 0);
__decorate([
    (0, class_validator_1.IsDefined)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseCableDto.prototype, "smartCardNumber", void 0);
__decorate([
    (0, class_validator_1.IsDefined)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(100),
    __metadata("design:type", Number)
], PurchaseCableDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseCableDto.prototype, "variationCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseCableDto.prototype, "customerName", void 0);
//# sourceMappingURL=purchase-cable.dto.js.map