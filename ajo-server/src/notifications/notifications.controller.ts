import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private deviceTokenService: DeviceTokenService,
  ) {}

  // ---- In-app inbox ----------------------------------------------------------

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notificationsService.listForUser(user.userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }

  @Patch('read')
  markRead(@CurrentUser() user: RequestUser, @Body() dto: MarkReadDto) {
    return this.notificationsService.markRead(user.userId, dto.notificationIds);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  // ---- Device token management -----------------------------------------------

  /**
   * Called by the mobile app on launch (and whenever FCM issues a new
   * token) to register / refresh the device push token.
   */
  @Post('device-token')
  registerToken(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.deviceTokenService.register(
      user.userId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('device-token/:token')
  deactivateToken(@Param('token') token: string) {
    return this.deviceTokenService.deactivate(token);
  }
}
