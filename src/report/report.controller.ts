import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { GetPurchaseCostMonthlyQueryDTO } from './dto';
import { ReportService } from './report.service';

//Mọi vai trò đăng nhập đều xem được, kể cả VIEWER: đây là các báo cáo chỉ đọc
@UseGuards(MyJwtGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  //GET: .../reports/purchase-cost-monthly?month=2026-09&productId=5
  //Giá mua bình quân gia quyền, mỗi dòng là một sản phẩm trong một tháng
  @Get('purchase-cost-monthly')
  getPurchaseCostMonthly(@Query() query: GetPurchaseCostMonthlyQueryDTO) {
    return this.reportService.getPurchaseCostMonthly(query);
  }
}
