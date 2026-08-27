"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksModule = void 0;
const common_1 = require("@nestjs/common");
const webhook_controller_1 = require("./webhook.controller");
const payments_module_1 = require("../payments/payments.module");
const wallet_module_1 = require("../wallet/wallet.module");
const cycles_module_1 = require("../cycles/cycles.module");
const savings_module_1 = require("../savings/savings.module");
let WebhooksModule = class WebhooksModule {
};
exports.WebhooksModule = WebhooksModule;
exports.WebhooksModule = WebhooksModule = __decorate([
    (0, common_1.Module)({
        imports: [payments_module_1.PaymentsModule, wallet_module_1.WalletModule, cycles_module_1.CyclesModule, savings_module_1.SavingsModule],
        controllers: [webhook_controller_1.WebhookController],
    })
], WebhooksModule);
//# sourceMappingURL=webhooks.module.js.map