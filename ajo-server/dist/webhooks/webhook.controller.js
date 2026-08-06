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
var WebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const common_1 = require("@nestjs/common");
const paystack_service_1 = require("../payments/paystack.service");
const wallet_service_1 = require("../wallet/wallet.service");
const cycles_service_1 = require("../cycles/cycles.service");
const wallet_enum_1 = require("../common/enums/wallet.enum");
let WebhookController = WebhookController_1 = class WebhookController {
    paystack;
    walletService;
    cyclesService;
    logger = new common_1.Logger(WebhookController_1.name);
    constructor(paystack, walletService, cyclesService) {
        this.paystack = paystack;
        this.walletService = walletService;
        this.cyclesService = cyclesService;
    }
    handleWebhook(req, signature) {
        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new common_1.BadRequestException('Missing raw body — check bodyParser configuration');
        }
        const isValid = this.paystack.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            this.logger.warn('Paystack webhook rejected: invalid signature');
            throw new common_1.BadRequestException('Invalid webhook signature');
        }
        const event = JSON.parse(rawBody.toString('utf8'));
        this.logger.log(`Received Paystack webhook: ${event.event}`);
        setImmediate(() => {
            void this.processEvent(event);
        });
        return { received: true };
    }
    async processEvent(event) {
        try {
            switch (event.event) {
                case 'charge.success':
                    await this.handleChargeSuccess(event.data);
                    break;
                case 'transfer.success':
                    await this.handleTransferSuccess(event.data);
                    break;
                case 'transfer.failed':
                    await this.handleTransferFailed(event.data);
                    break;
                case 'transfer.reversed':
                    await this.handleTransferReversed(event.data);
                    break;
                default:
                    this.logger.debug(`Unhandled Paystack event type: ${event.event}`);
            }
        }
        catch (err) {
            this.logger.error(`Error processing Paystack event ${event.event}: ${String(err)}`);
        }
    }
    async handleChargeSuccess(data) {
        const reference = data.reference;
        const amount = data.amount;
        if (!reference || !amount) {
            this.logger.warn('charge.success missing reference or amount');
            return;
        }
        await this.walletService.confirmFunding(reference, amount / 100, {
            source: 'webhook',
            paystackData: data,
        });
        this.logger.log(`Wallet funded via webhook: ref=${reference}, amount=${amount / 100} NGN`);
    }
    async handleTransferSuccess(data) {
        const reference = data.reference;
        if (!reference) {
            this.logger.warn('transfer.success missing reference');
            return;
        }
        const payout = await this.cyclesService.findPayoutByReference(reference);
        if (!payout) {
            this.logger.warn(`transfer.success: no payout found for reference ${reference}`);
            return;
        }
        if (payout.status === wallet_enum_1.TransferStatus.SUCCESS) {
            this.logger.log(`transfer.success: payout ${payout._id.toString()} already finalized — skipping`);
            return;
        }
        const cycle = await this.cyclesService.findCycleById(payout.cycle);
        if (!cycle) {
            this.logger.error(`transfer.success: cycle ${payout.cycle.toString()} not found`);
            return;
        }
        const group = await this.cyclesService.findGroupById(payout.group);
        if (!group) {
            this.logger.error(`transfer.success: group ${payout.group.toString()} not found`);
            return;
        }
        await this.cyclesService.finalizeSuccessfulPayout(payout, cycle, group);
        this.logger.log(`Payout finalized via webhook: ref=${reference}, payout=${payout._id.toString()}`);
    }
    async handleTransferFailed(data) {
        const reference = data.reference;
        if (!reference) {
            this.logger.warn('transfer.failed missing reference');
            return;
        }
        const payout = await this.cyclesService.findPayoutByReference(reference);
        if (!payout) {
            this.logger.warn(`transfer.failed: no payout found for reference ${reference}`);
            return;
        }
        if (payout.status !== wallet_enum_1.TransferStatus.PENDING) {
            return;
        }
        const reason = data.reason ?? 'Transfer failed';
        await this.cyclesService.handleFailedPayout(payout, payout.group, payout.cycle, reason);
        this.logger.warn(`Payout failed via webhook: ref=${reference}, reason=${reason}`);
    }
    async handleTransferReversed(data) {
        const reference = data.reference;
        if (!reference)
            return;
        const payout = await this.cyclesService.findPayoutByReference(reference);
        if (!payout)
            return;
        const group = await this.cyclesService.findGroupById(payout.group);
        if (!group)
            return;
        await this.cyclesService.handleReversedPayout(payout, group);
        this.logger.warn(`Payout reversed via webhook: ref=${reference}`);
    }
};
exports.WebhookController = WebhookController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-paystack-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Object)
], WebhookController.prototype, "handleWebhook", null);
exports.WebhookController = WebhookController = WebhookController_1 = __decorate([
    (0, common_1.Controller)('webhooks/paystack'),
    __metadata("design:paramtypes", [paystack_service_1.PaystackService,
        wallet_service_1.WalletService,
        cycles_service_1.CyclesService])
], WebhookController);
//# sourceMappingURL=webhook.controller.js.map