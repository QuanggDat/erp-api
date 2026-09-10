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
  CreatePurchaseOrderDTO,
  GetPurchaseOrdersQueryDTO,
  UpdatePurchaseOrderDTO,
} from './dto';
import { PurchaseService } from './purchase.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('purchase-orders')
export class PurchaseController {
  constructor(private purchaseService: PurchaseService) {}

  //GET: .../purchase-orders?page=1&limit=10&status=DRAFT
  @Get()
  getPurchaseOrders(@Query() query: GetPurchaseOrdersQueryDTO) {
    return this.purchaseService.getPurchaseOrders(query);
  }

  @Get(':id')
  getPurchaseOrderById(@Param('id', ParseIntPipe) orderId: number) {
    return this.purchaseService.getPurchaseOrderById(orderId);
  }

  @Roles(Role.PURCHASE)
  @Post()
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDTO) {
    return this.purchaseService.createPurchaseOrder(dto);
  }

  @Roles(Role.PURCHASE)
  @Patch(':id')
  updatePurchaseOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: UpdatePurchaseOrderDTO,
  ) {
    return this.purchaseService.updatePurchaseOrder(orderId, dto);
  }

  //xác nhận đơn: hàng vào kho tại đây
  //PATCH chứ không POST vì đây là thao tác đổi trạng thái của một tài nguyên
  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Patch(':id/confirm')
  confirmPurchaseOrder(@Param('id', ParseIntPipe) orderId: number) {
    return this.purchaseService.confirmPurchaseOrder(orderId);
  }

  @Roles(Role.PURCHASE)
  @Patch(':id/cancel')
  cancelPurchaseOrder(@Param('id', ParseIntPipe) orderId: number) {
    return this.purchaseService.cancelPurchaseOrder(orderId);
  }
}
