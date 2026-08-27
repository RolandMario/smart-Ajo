"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../../app.module");
const paystack_service_1 = require("../../payments/paystack.service");
const cycles_service_1 = require("../../cycles/cycles.service");
const mongoose_1 = require("@nestjs/mongoose");
const payout_schema_1 = require("../../cycles/schemas/payout.schema");
const cycle_schema_1 = require("../../cycles/schemas/cycle.schema");
const wallet_enum_1 = require("../../common/enums/wallet.enum");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const paystack = app.get(paystack_service_1.PaystackService);
        if (!paystack.isTestMode()) {
            console.log('Not in test mode (PAYSTACK_SECRET_KEY does not start with sk_test_). Aborting.');
            process.exitCode = 0;
            return;
        }
        const payoutModel = app.get((0, mongoose_1.getModelToken)(payout_schema_1.Payout.name));
        const cycleModel = app.get((0, mongoose_1.getModelToken)(cycle_schema_1.Cycle.name));
        const groupModel = app.get((0, mongoose_1.getModelToken)('Group'));
        const cyclesService = app.get(cycles_service_1.CyclesService);
        const pendingPayouts = await payoutModel.find({
            status: wallet_enum_1.TransferStatus.PENDING,
        });
        console.log(`Found ${pendingPayouts.length} pending payout(s).`);
        for (const payoutDoc of pendingPayouts) {
            if (!payoutDoc.paystackTransferCode) {
                console.log(`  Skipping payout ${payoutDoc._id.toString()} — no paystackTransferCode`);
                continue;
            }
            const cycle = await cycleModel.findById(payoutDoc.cycle);
            const group = await groupModel.findById(payoutDoc.group);
            if (!cycle) {
                console.log(`  Skipping payout ${payoutDoc._id.toString()} — cycle ${payoutDoc.cycle.toString()} not found`);
                continue;
            }
            if (!group) {
                console.log(`  Skipping payout ${payoutDoc._id.toString()} — group ${payoutDoc.group.toString()} not found`);
                continue;
            }
            console.log(`  Resolving OTP for payout ${payoutDoc._id.toString()} (transfer: ${payoutDoc.paystackTransferCode})...`);
            try {
                await paystack.resolveOtp(payoutDoc.paystackTransferCode, paystack.testTransferOtp());
                console.log(`  OTP resolved successfully.`);
            }
            catch (err) {
                console.warn(`  OTP resolution failed (${String(err)}). This is expected if the transfer already expired. Finalizing directly since we're in test mode.`);
            }
            console.log(`  Finalizing payout ${payoutDoc._id.toString()}...`);
            try {
                await cyclesService.finalizeSuccessfulPayout(payoutDoc, cycle, group);
                console.log(`  ✅ Payout ${payoutDoc._id.toString()} finalized successfully.`);
            }
            catch (err) {
                console.error(`  Failed to finalize payout ${payoutDoc._id.toString()}: ${String(err)}`);
            }
        }
        console.log('Done.');
    }
    finally {
        await app.close();
    }
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=resolve-pending-payouts.js.map