import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  /** User id (Mongo ObjectId as string) */
  sub: string;
  role: Role;
  phone: string;
  email?: string;
}
