import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { GetCogsReportQueryDTO } from './dto';
import { ReportService } from './report.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  //GET: .../reports/cogs?month=2026-09&warehouseId=1
  //Mọi vai trò đăng nhập đều xem được, kể cả VIEWER: đây là báo cáo chỉ đọc
  @Get('cogs')
  getCogsReport(@Query() query: GetCogsReportQueryDTO) {
    return this.reportService.getCogsReport(query);
  }
}
