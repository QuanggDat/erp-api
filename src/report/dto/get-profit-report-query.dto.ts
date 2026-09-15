import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';

//Tham số lọc báo cáo lãi lỗ. Tất cả đều tuỳ chọn: không truyền gì thì
//lấy toàn bộ đơn đã xác nhận từ trước tới nay.
export class GetProfitReportQueryDTO {
  //ngày bắt đầu, tính theo orderDate của đơn bán, dạng YYYY-MM-DD
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  //ngày kết thúc, bao gồm cả ngày này
  @IsOptional()
  @IsDateString()
  toDate?: string;

  //Lọc theo một tháng cụ thể, dạng YYYY-MM. Ví dụ 2026-09.
  //Truyền month thì bỏ qua fromDate và toDate, vì hai cách lọc thời gian
  //cùng lúc dễ gây hiểu nhầm về khoảng dữ liệu đang xem.
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month phải có dạng YYYY-MM, ví dụ 2026-09',
  })
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;
}
