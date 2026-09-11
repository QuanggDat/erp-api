import { Module } from '@nestjs/common';
import { PartnerModule } from '../partner/partner.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PrismaModule, PartnerModule, WarehouseModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
