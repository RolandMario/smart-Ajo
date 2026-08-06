"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const mongoose_1 = require("@nestjs/mongoose");
const app_module_1 = require("../../app.module");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const connection = app.get(mongoose_1.InjectConnection);
        if (!connection.db) {
            console.error('Database connection not available');
            process.exitCode = 1;
            return;
        }
        console.log('Starting wallet balance migration...');
        const result = await connection.db
            .collection('wallets')
            .updateMany({ $or: [{ balance: { $exists: false } }, { balance: null }] }, { $set: { balance: 0 } });
        console.log(`Migration complete. Updated ${result.modifiedCount} wallets.`);
    }
    finally {
        await app.close();
    }
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=fix-wallet-balances.js.map