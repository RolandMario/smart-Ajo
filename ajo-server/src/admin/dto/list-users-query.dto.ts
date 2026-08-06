import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  /** Free-text search across name, phone, and email (case-insensitive substring match). */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['user', 'platform_admin'])
  role?: 'user' | 'platform_admin';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
