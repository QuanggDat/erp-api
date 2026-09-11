import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { GetProfitReportQueryDTO } from './dto';
import { ReportService } from './report.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  //GET: .../reports/profit?fromDate=2026-07-01&toDate=2026-09-30
  //Mọi vai trò đăng nhập đều xem được, kể cả VIEWER: đây là báo cáo chỉ đọc
  @Get('profit')
  getProfitReport(@Query() query: GetProfitReportQueryDTO) {
    return this.reportService.getProfitReport(query);
  }
}
