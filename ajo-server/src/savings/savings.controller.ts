import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingPlanDto } from './dto/create-saving-plan.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingsController {
  constructor(private savingsService: SavingsService) {}

  @Post('plans')
  createPlan(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSavingPlanDto,
  ) {
    return this.savingsService.createPlan(user.userId, dto);
  }

  @Get('plans')
  listPlans(@CurrentUser() user: RequestUser) {
    return this.savingsService.listPlans(user.userId);
  }

  @Get('plans/:id')
  getPlan(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.savingsService.getPlan(user.userId, id);
  }

  @Post('plans/:id/withdraw')
  withdraw(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.savingsService.withdraw(user.userId, id);
  }

  @Post('plans/:id/continue')
  continuePlan(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.savingsService.continuePlan(user.userId, id);
  }

  @Delete('plans/:id')
  deletePlan(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.savingsService.deletePlan(user.userId, id);
  }
}
