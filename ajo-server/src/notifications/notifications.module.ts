import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsCronController } from './notifications.cron.controller';
import { FirebaseService } from './firebase.service';
import { DeviceTokenService } from './device-token.service';
import { ReminderScheduler } from './reminder.scheduler';
import { DefaulterScheduler } from './defaulter.scheduler';
import { AutoCollectScheduler } from './auto-collect.scheduler';
import { OtpModule } from '../otp/otp.module';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { CyclesModule } from '../cycles/cycles.module';
import { CronAuthGuard } from '../common/guards/cron-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
    OtpModule, // for TermiiService (SMS fallback)
    UsersModule, // for ReminderScheduler / DefaulterScheduler user lookups
    forwardRef(() => GroupsModule), // re-exports Group + GroupMember models
    forwardRef(() => CyclesModule), // re-exports Cycle + Contribution models, CyclesService
  ],
  controllers: [NotificationsController, NotificationsCronController],
  providers: [
    NotificationsService,
    FirebaseService,
    DeviceTokenService,
    ReminderScheduler,
    DefaulterScheduler,
    AutoCollectScheduler,
    CronAuthGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
