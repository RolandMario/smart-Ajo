import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PlatformSetting,
  PlatformSettingSchema,
} from './schemas/platform-setting.schema';
import { PlatformSettingsService } from './platform-settings.service';

/**
 * Platform-wide settings (currently the two service charges). Imported by
 * every module that moves money between wallets, escrow, and bank
 * accounts so they all read the same rates.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
    ]),
  ],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
