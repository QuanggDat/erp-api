import {
  Body,
  Controller,
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
  CreateSalesOrderDTO,
  GetSalesOrdersQueryDTO,
  UpdateSalesOrderDTO,
} from './dto';
import { SalesService } from './sales.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('sales-orders')
export class SalesController {
  constructor(private salesService: SalesService) {}

  //GET: .../sales-orders?page=1&limit=10&status=DRAFT
  @Get()
  getSalesOrders(@Query() query: GetSalesOrdersQueryDTO) {
    return this.salesService.getSalesOrders(query);
  }

  @Get(':id')
  getSalesOrderById(@Param('id', ParseIntPipe) orderId: number) {
    return this.salesService.getSalesOrderById(orderId);
  }

  @Roles(Role.SALES)
  @Post()
  createSalesOrder(@Body() dto: CreateSalesOrderDTO) {
    return this.salesService.createSalesOrder(dto);
  }

  @Roles(Role.SALES)
  @Patch(':id')
  updateSalesOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: UpdateSalesOrderDTO,
  ) {
    return this.salesService.updateSalesOrder(orderId, dto);
  }

  //xác nhận đơn: hàng rời kho tại đây, không đủ tồn thì bị chặn
  @Roles(Role.SALES, Role.WAREHOUSE)
  @Patch(':id/confirm')
  confirmSalesOrder(@Param('id', ParseIntPipe) orderId: number) {
    return this.salesService.confirmSalesOrder(orderId);
  }

  @Roles(Role.SALES)
  @Patch(':id/cancel')
  cancelSalesOrder(@Param('id', ParseIntPipe) orderId: number) {
    return this.salesService.cancelSalesOrder(orderId);
  }
}
