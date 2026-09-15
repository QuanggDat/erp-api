import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

//Tham số lọc báo cáo giá vốn. Cả hai đều tuỳ chọn: không truyền gì thì
//lấy toàn bộ đơn đã xác nhận từ trước tới nay.
export class GetCogsReportQueryDTO {
  //Lọc theo một tháng cụ thể, dạng YYYY-MM. Ví dụ 2026-09.
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month phải có dạng YYYY-MM, ví dụ 2026-09',
  })
  month?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;
}
