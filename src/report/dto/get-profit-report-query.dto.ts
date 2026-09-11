import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

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
