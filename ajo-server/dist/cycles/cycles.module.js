"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CyclesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const cycle_schema_1 = require("./schemas/cycle.schema");
const contribution_schema_1 = require("./schemas/contribution.schema");
const group_wallet_schema_1 = require("./schemas/group-wallet.schema");
const group_wallet_transaction_schema_1 = require("./schemas/group-wallet-transaction.schema");
const payout_schema_1 = require("./schemas/payout.schema");
const cycles_service_1 = require("./cycles.service");
const cycles_controller_1 = require("./cycles.controller");
const groups_module_1 = require("../groups/groups.module");
const wallet_module_1 = require("../wallet/wallet.module");
const payments_module_1 = require("../payments/payments.module");
const users_module_1 = require("../users/users.module");
const notifications_module_1 = require("../notifications/notifications.module");
let CyclesModule = class CyclesModule {
};
exports.CyclesModule = CyclesModule;
exports.CyclesModule = CyclesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: cycle_schema_1.Cycle.name, schema: cycle_schema_1.CycleSchema },
                { name: contribution_schema_1.Contribution.name, schema: contribution_schema_1.ContributionSchema },
                { name: group_wallet_schema_1.GroupWallet.name, schema: group_wallet_schema_1.GroupWalletSchema },
                {
                    name: group_wallet_transaction_schema_1.GroupWalletTransaction.name,
                    schema: group_wallet_transaction_schema_1.GroupWalletTransactionSchema,
                },
                { name: payout_schema_1.Payout.name, schema: payout_schema_1.PayoutSchema },
            ]),
            (0, common_1.forwardRef)(() => groups_module_1.GroupsModule),
            wallet_module_1.WalletModule,
            payments_module_1.PaymentsModule,
            users_module_1.UsersModule,
            (0, common_1.forwardRef)(() => notifications_module_1.NotificationsModule),
        ],
        controllers: [cycles_controller_1.CyclesController],
        providers: [cycles_service_1.CyclesService],
        exports: [cycles_service_1.CyclesService, mongoose_1.MongooseModule],
    })
], CyclesModule);
//# sourceMappingURL=cycles.module.js.map