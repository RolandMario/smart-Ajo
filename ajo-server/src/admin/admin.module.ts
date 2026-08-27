import { Module } from '@nestjs/common';
import { GroupDashboardService } from './group-dashboard.service';
import { GroupDashboardController } from './group-dashboard.controller';
import { PlatformAdminUsersService } from './platform-admin-users.service';
import { PlatformAdminUsersController } from './platform-admin-users.controller';
import { PlatformAdminGroupsService } from './platform-admin-groups.service';
import { PlatformAdminGroupsController } from './platform-admin-groups.controller';
import { PlatformAdminFinanceService } from './platform-admin-finance.service';
import { PlatformAdminFinanceController } from './platform-admin-finance.controller';
import { PlatformAdminManagementService } from './platform-admin-management.service';
import { PlatformAdminManagementController } from './platform-admin-management.controller';
import { PlatformAdminWalletService } from './platform-admin-wallet.service';
import { PlatformAdminWalletController } from './platform-admin-wallet.controller';
import { PlatformAdminBillsController } from './platform-admin-bills.controller';
import { GroupsModule } from '../groups/groups.module';
import { CyclesModule } from '../cycles/cycles.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsModule } from '../payments/payments.module';
import { BillsModule } from '../bills/bills.module';

/**
 * Five distinct audiences live in this module:
 *  - GroupDashboardService/Controller: a GROUP's own admin, viewing only
 *    their group (Phase 6, consumed by the mobile app).
 *  - PlatformAdminUsersService/Controller: PLATFORM staff, viewing every
 *    user on the platform (Sub-phase B, consumed by ajo-admin-web).
 *  - PlatformAdminGroupsService/Controller: PLATFORM staff, viewing every
 *    group on the platform (Sub-phase C, consumed by ajo-admin-web).
 *  - PlatformAdminFinanceService/Controller: PLATFORM staff, viewing
 *    every financial ledger on the platform — wallet fundings, payouts,
 *    and group wallet movements (Sub-phase D, consumed by
 *    ajo-admin-web).
 *  - PlatformAdminManagementService/Controller: PLATFORM staff, creating
 *    and deactivating OTHER platform_admin accounts (Sub-phase E,
 *    consumed by ajo-admin-web).
 * All five happen to live under "admin" but enforce very different
 * authorization — group-scoped vs PlatformAdminGuard. Keep that
 * distinction in mind if this module grows further.
 */
@Module({
  imports: [
    GroupsModule,
    CyclesModule,
    UsersModule,
    WalletModule,
    PaymentsModule,
    BillsModule,
  ],
  controllers: [
    GroupDashboardController,
    PlatformAdminUsersController,
    PlatformAdminGroupsController,
    PlatformAdminFinanceController,
    PlatformAdminManagementController,
    PlatformAdminWalletController,
    PlatformAdminBillsController,
  ],
  providers: [
    GroupDashboardService,
    PlatformAdminUsersService,
    PlatformAdminGroupsService,
    PlatformAdminFinanceService,
    PlatformAdminManagementService,
    PlatformAdminWalletService,
  ],
  exports: [
    GroupDashboardService,
    PlatformAdminUsersService,
    PlatformAdminGroupsService,
    PlatformAdminFinanceService,
    PlatformAdminManagementService,
  ],
})
export class AdminModule {}
