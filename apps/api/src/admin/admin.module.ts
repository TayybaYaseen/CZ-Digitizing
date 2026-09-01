import { Module } from '@nestjs/common';
import { FreelancerAccountsController } from './freelancer-accounts.controller';
import { FreelancerAccountsService } from './freelancer-accounts.service';

@Module({
  controllers: [FreelancerAccountsController],
  providers: [FreelancerAccountsService],
})
export class AdminModule {}
