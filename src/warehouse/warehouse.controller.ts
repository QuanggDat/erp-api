import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorator';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { Role } from '../generated/prisma/enums';
import {
  AdjustStockDTO,
  CreateWarehouseDTO,
  GetStockMovementsQueryDTO,
  GetStocksQueryDTO,
  GetWarehousesQueryDTO,
  UpdateWarehouseDTO,
} from './dto';
import { StockService } from './stock.service';
import { WarehouseService } from './warehouse.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('warehouses')
export class WarehouseController {
  constructor(
    private warehouseService: WarehouseService,
    private stockService: StockService,
  ) {}

  //=========== TỒN KHO ===========
  //đặt TRƯỚC route :id để "stocks" không bị hiểu là một id
  //GET: .../warehouses/stocks?productId=1&warehouseId=2
  @Get('stocks')
  getStocks(@Query() query: GetStocksQueryDTO) {
    return this.stockService.getStocks(query);
  }

  //sổ nhật ký nhập xuất
  @Get('stock-movements')
  getStockMovements(@Query() query: GetStockMovementsQueryDTO) {
    return this.stockService.getStockMovements(query);
  }

  //điều chỉnh tồn sau kiểm kê, chỉ thủ kho được làm
  @Roles(Role.WAREHOUSE)
  @Post('stocks/adjust')
  adjustStock(@Body() dto: AdjustStockDTO) {
    return this.stockService.adjustStock(dto);
  }

  //=========== DANH SÁCH KHO ===========
  @Get()
  getWarehouses(@Query() query: GetWarehousesQueryDTO) {
    return this.warehouseService.getWarehouses(query);
  }

  @Get(':id')
  getWarehouseById(@Param('id', ParseIntPipe) warehouseId: number) {
    return this.warehouseService.getWarehouseById(warehouseId);
  }

  @Roles(Role.WAREHOUSE)
  @Post()
  createWarehouse(@Body() dto: CreateWarehouseDTO) {
    return this.warehouseService.createWarehouse(dto);
  }

  @Roles(Role.WAREHOUSE)
  @Patch(':id')
  updateWarehouse(
    @Param('id', ParseIntPipe) warehouseId: number,
    @Body() dto: UpdateWarehouseDTO,
  ) {
    return this.warehouseService.updateWarehouse(warehouseId, dto);
  }

  @Roles(Role.WAREHOUSE)
  @Delete(':id')
  deactivateWarehouse(@Param('id', ParseIntPipe) warehouseId: number) {
    return this.warehouseService.deactivateWarehouse(warehouseId);
  }
}
