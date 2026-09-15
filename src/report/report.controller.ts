import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { GetInventoryValueQueryDTO } from './dto';
import { ReportService } from './report.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  //GET: .../reports/inventory-value?warehouseId=1&search=ban
  //Mọi vai trò đăng nhập đều xem được, kể cả VIEWER: đây là báo cáo chỉ đọc
  @Get('inventory-value')
  getInventoryValue(@Query() query: GetInventoryValueQueryDTO) {
    return this.reportService.getInventoryValue(query);
  }
}
