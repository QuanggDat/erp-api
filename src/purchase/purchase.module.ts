import { Module } from '@nestjs/common';
import { PartnerModule } from '../partner/partner.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

@Module({
  //PartnerModule cho việc kiểm tra nhà cung cấp, WarehouseModule cho việc ghi kho
  imports: [PrismaModule, PartnerModule, WarehouseModule],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
