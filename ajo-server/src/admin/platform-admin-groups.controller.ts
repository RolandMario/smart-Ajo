import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGroupsService } from './platform-admin-groups.service';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';
import { UpdateServiceFeeDto } from './dto/update-service-fee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/**
 * Platform-admin-only directory of every group on the platform, for
 * ajo-admin-web's Groups screen. Guarded by JwtAuthGuard + PlatformAdminGuard
 * — same authorization shape as PlatformAdminUsersController.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/groups')
export class PlatformAdminGroupsController {
  constructor(private platformAdminGroupsService: PlatformAdminGroupsService) {}

  @Get()
  list(@Query() query: ListGroupsQueryDto) {
    return this.platformAdminGroupsService.listGroups(query);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.platformAdminGroupsService.getGroupDetail(id);
  }

  @Patch(':id/service-fee')
  updateServiceFee(
    @Param('id') id: string,
    @Body() dto: UpdateServiceFeeDto,
  ) {
    return this.platformAdminGroupsService.updateServiceFee(id, dto.serviceFee);
  }
}
