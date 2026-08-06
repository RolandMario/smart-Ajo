"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const group_schema_1 = require("./schemas/group.schema");
const group_member_schema_1 = require("./schemas/group-member.schema");
const groups_service_1 = require("./groups.service");
const group_access_service_1 = require("./group-access.service");
const groups_controller_1 = require("./groups.controller");
const invites_controller_1 = require("./invites.controller");
const users_module_1 = require("../users/users.module");
const cycles_module_1 = require("../cycles/cycles.module");
const notifications_module_1 = require("../notifications/notifications.module");
let GroupsModule = class GroupsModule {
};
exports.GroupsModule = GroupsModule;
exports.GroupsModule = GroupsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: group_schema_1.Group.name, schema: group_schema_1.GroupSchema },
                { name: group_member_schema_1.GroupMember.name, schema: group_member_schema_1.GroupMemberSchema },
            ]),
            users_module_1.UsersModule,
            (0, common_1.forwardRef)(() => cycles_module_1.CyclesModule),
            (0, common_1.forwardRef)(() => notifications_module_1.NotificationsModule),
        ],
        controllers: [groups_controller_1.GroupsController, invites_controller_1.InvitesController],
        providers: [groups_service_1.GroupsService, group_access_service_1.GroupAccessService],
        exports: [groups_service_1.GroupsService, group_access_service_1.GroupAccessService, mongoose_1.MongooseModule],
    })
], GroupsModule);
//# sourceMappingURL=groups.module.js.map