import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateServiceFeeDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  serviceFee?: number;
}