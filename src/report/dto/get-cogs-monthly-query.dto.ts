import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

//Tham số lọc báo cáo giá vốn theo tháng. Tất cả đều tuỳ chọn.
export class GetCogsMonthlyQueryDTO {
  //Chỉ lấy một tháng, dạng YYYY-MM. Bỏ trống thì lấy mọi tháng có phát sinh.
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month phải có dạng YYYY-MM, ví dụ 2026-09',
  })
  month?: string;

  //Lọc đúng một sản phẩm, dùng khi cần xem diễn biến giá vốn của nó qua
  //các tháng. Ưu tiên cao hơn search: có productId thì bỏ qua search.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  //Tìm theo mã hàng hoặc tên hàng
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;
}
