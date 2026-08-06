import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminManagementService } from './platform-admin-management.service';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { SetAdminActiveDto } from './dto/set-admin-active.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Platform-admin-only management of OTHER platform_admin accounts, for
 * ajo-admin-web's Admin Management screen (Sub-phase E). Same
 * authorization shape as the other platform-admin controllers — any
 * active platform_admin can create or deactivate another. There's no
 * "super admin" tier in this system; all platform_admins are peers.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/admins')
export class PlatformAdminManagementController {
  constructor(private managementService: PlatformAdminManagementService) {}

  @Get()
  list() {
    return this.managementService.listAdmins();
  }

  @Post()
  create(@Body() dto: CreatePlatformAdminDto) {
    return this.managementService.createAdmin(dto);
  }

  @Patch(':id/active')
  setActive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetAdminActiveDto,
  ) {
    return this.managementService.setActive(user.userId, id, dto.isActive);
  }
}
