import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { UpdateServiceChargesDto } from '../platform-settings/dto/update-service-charges.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Platform-admin-only configuration endpoints, for ajo-admin-web's
 * Financial Oversight screen. Currently just the platform service
 * charges (wallet -> escrow transfer fee and bank payout fee).
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/settings')
export class PlatformAdminSettingsController {
  constructor(private platformSettings: PlatformSettingsService) {}

  /** Current service-charge rates, as percentages. */
  @Get('service-charges')
  getServiceCharges() {
    return this.platformSettings.getServiceCharges();
  }

  /**
   * Updates the service-charge rates. Only the supplied fields change, so
   * the console can save one rate without resending the other.
   */
  @Patch('service-charges')
  updateServiceCharges(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateServiceChargesDto,
  ) {
    return this.platformSettings.updateServiceCharges(dto, user.userId);
  }
}
