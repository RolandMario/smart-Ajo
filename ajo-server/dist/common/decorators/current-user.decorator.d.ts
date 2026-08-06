import { Role } from '../enums/role.enum';
export interface RequestUser {
    userId: string;
    phone: string;
    email?: string;
    role: Role;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
