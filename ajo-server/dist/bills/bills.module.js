"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bills_controller_1 = require("./bills.controller");
const bills_service_1 = require("./bills.service");
const vtpass_service_1 = require("../payments/vtpass.service");
const gladtidings_service_1 = require("../payments/gladtidings.service");
const wallet_module_1 = require("../wallet/wallet.module");
const notifications_module_1 = require("../notifications/notifications.module");
const users_module_1 = require("../users/users.module");
const bill_transaction_schema_1 = require("./schemas/bill-transaction.schema");
const bill_provider_config_schema_1 = require("./schemas/bill-provider-config.schema");
const bill_service_plan_schema_1 = require("./schemas/bill-service-plan.schema");
let BillsModule = class BillsModule {
};
exports.BillsModule = BillsModule;
exports.BillsModule = BillsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: bill_transaction_schema_1.BillTransaction.name, schema: bill_transaction_schema_1.BillTransactionSchema },
                { name: bill_provider_config_schema_1.BillProviderConfig.name, schema: bill_provider_config_schema_1.BillProviderConfigSchema },
                { name: bill_service_plan_schema_1.BillServicePlan.name, schema: bill_service_plan_schema_1.BillServicePlanSchema },
            ]),
            wallet_module_1.WalletModule,
            notifications_module_1.NotificationsModule,
            users_module_1.UsersModule,
        ],
        controllers: [bills_controller_1.BillsController],
        providers: [bills_service_1.BillsService, vtpass_service_1.VTPassService, gladtidings_service_1.GladTidingsService],
        exports: [bills_service_1.BillsService],
    })
], BillsModule);
//# sourceMappingURL=bills.module.js.map