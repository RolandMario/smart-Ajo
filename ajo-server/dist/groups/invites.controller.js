"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitesController = void 0;
const common_1 = require("@nestjs/common");
const groups_service_1 = require("./groups.service");
const respond_to_invite_dto_1 = require("./dto/respond-to-invite.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let InvitesController = class InvitesController {
    groupsService;
    constructor(groupsService) {
        this.groupsService = groupsService;
    }
    listMine(user) {
        return this.groupsService.listMyInvites(user.userId);
    }
    respond(user, id, dto) {
        return this.groupsService.respondToInvite(user.userId, id, dto.action);
    }
};
exports.InvitesController = InvitesController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InvitesController.prototype, "listMine", null);
__decorate([
    (0, common_1.Patch)(':id/respond'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_to_invite_dto_1.RespondToInviteDto]),
    __metadata("design:returntype", void 0)
], InvitesController.prototype, "respond", null);
exports.InvitesController = InvitesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('invites'),
    __metadata("design:paramtypes", [groups_service_1.GroupsService])
], InvitesController);
//# sourceMappingURL=invites.controller.js.map