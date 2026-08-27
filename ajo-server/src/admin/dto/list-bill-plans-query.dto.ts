import { Type } from 'class-transformer';
import { IsOptional, IsIn, IsString, IsInt, Min, Max } from 'class-validator';

export class ListBillPlansQueryDto {
  @IsOptional()
  @IsIn(['airtime', 'data', 'cable', 'electricity'])
  serviceType?: string;

  @IsOptional()
  @IsIn(['vtpass', 'gladtidings'])
  provider?: string;

  @IsOptional()
  @IsString()
  bucket?: string;

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
  limit?: number = 50;
}
