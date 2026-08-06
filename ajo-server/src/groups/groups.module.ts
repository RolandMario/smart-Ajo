import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { GroupMember, GroupMemberSchema } from './schemas/group-member.schema';
import { GroupsService } from './groups.service';
import { GroupAccessService } from './group-access.service';
import { GroupsController } from './groups.controller';
import { InvitesController } from './invites.controller';
import { UsersModule } from '../users/users.module';
import { CyclesModule } from '../cycles/cycles.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
    ]),
    UsersModule,
    forwardRef(() => CyclesModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [GroupsController, InvitesController],
  providers: [GroupsService, GroupAccessService],
  exports: [GroupsService, GroupAccessService, MongooseModule],
})
export class GroupsModule {}
