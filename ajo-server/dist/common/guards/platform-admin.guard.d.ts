import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class PlatformAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
