import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { GetCogsMonthlyQueryDTO, GetInventoryValueQueryDTO } from './dto';
import { ReportService } from './report.service';

//Mọi vai trò đăng nhập đều xem được, kể cả VIEWER: đây là các báo cáo chỉ đọc
@UseGuards(MyJwtGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  //GET: .../reports/cogs-monthly?month=2026-09&productId=5
  //Giá vốn hàng bán, mỗi dòng là một sản phẩm trong một tháng
  @Get('cogs-monthly')
  getCogsMonthly(@Query() query: GetCogsMonthlyQueryDTO) {
    return this.reportService.getCogsMonthly(query);
  }

  //GET: .../reports/inventory-value?warehouseId=1&search=ban
  //Giá trị hàng đang nằm trong kho tại thời điểm xem
  @Get('inventory-value')
  getInventoryValue(@Query() query: GetInventoryValueQueryDTO) {
    return this.reportService.getInventoryValue(query);
  }
}
