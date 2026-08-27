"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const group_dashboard_service_1 = require("./group-dashboard.service");
const group_dashboard_controller_1 = require("./group-dashboard.controller");
const platform_admin_users_service_1 = require("./platform-admin-users.service");
const platform_admin_users_controller_1 = require("./platform-admin-users.controller");
const platform_admin_groups_service_1 = require("./platform-admin-groups.service");
const platform_admin_groups_controller_1 = require("./platform-admin-groups.controller");
const platform_admin_finance_service_1 = require("./platform-admin-finance.service");
const platform_admin_finance_controller_1 = require("./platform-admin-finance.controller");
const platform_admin_management_service_1 = require("./platform-admin-management.service");
const platform_admin_management_controller_1 = require("./platform-admin-management.controller");
const platform_admin_wallet_service_1 = require("./platform-admin-wallet.service");
const platform_admin_wallet_controller_1 = require("./platform-admin-wallet.controller");
const platform_admin_bills_controller_1 = require("./platform-admin-bills.controller");
const groups_module_1 = require("../groups/groups.module");
const cycles_module_1 = require("../cycles/cycles.module");
const users_module_1 = require("../users/users.module");
const wallet_module_1 = require("../wallet/wallet.module");
const payments_module_1 = require("../payments/payments.module");
const bills_module_1 = require("../bills/bills.module");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            groups_module_1.GroupsModule,
            cycles_module_1.CyclesModule,
            users_module_1.UsersModule,
            wallet_module_1.WalletModule,
            payments_module_1.PaymentsModule,
            bills_module_1.BillsModule,
        ],
        controllers: [
            group_dashboard_controller_1.GroupDashboardController,
            platform_admin_users_controller_1.PlatformAdminUsersController,
            platform_admin_groups_controller_1.PlatformAdminGroupsController,
            platform_admin_finance_controller_1.PlatformAdminFinanceController,
            platform_admin_management_controller_1.PlatformAdminManagementController,
            platform_admin_wallet_controller_1.PlatformAdminWalletController,
            platform_admin_bills_controller_1.PlatformAdminBillsController,
        ],
        providers: [
            group_dashboard_service_1.GroupDashboardService,
            platform_admin_users_service_1.PlatformAdminUsersService,
            platform_admin_groups_service_1.PlatformAdminGroupsService,
            platform_admin_finance_service_1.PlatformAdminFinanceService,
            platform_admin_management_service_1.PlatformAdminManagementService,
            platform_admin_wallet_service_1.PlatformAdminWalletService,
        ],
        exports: [
            group_dashboard_service_1.GroupDashboardService,
            platform_admin_users_service_1.PlatformAdminUsersService,
            platform_admin_groups_service_1.PlatformAdminGroupsService,
            platform_admin_finance_service_1.PlatformAdminFinanceService,
            platform_admin_management_service_1.PlatformAdminManagementService,
        ],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map