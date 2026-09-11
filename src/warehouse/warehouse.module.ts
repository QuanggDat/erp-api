import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockService } from './stock.service';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [PrismaModule],
  controllers: [WarehouseController],
  providers: [WarehouseService, StockService],
  //mua hàng và bán hàng cần StockService để ghi kho khi xác nhận đơn
  exports: [WarehouseService, StockService],
})
export class WarehouseModule {}
