import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

//Tham số lọc báo cáo giá trị tồn kho. Tất cả đều tuỳ chọn.
export class GetInventoryValueQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  //tìm theo mã hàng hoặc tên hàng
  @IsOptional()
  @IsString()
  search?: string;

  //Mặc định ẩn dòng tồn bằng 0. Bật cờ này để xem cả sản phẩm đã bán hết,
  //dùng khi cần đối chiếu đủ danh mục chứ không chỉ hàng đang có.
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeZero?: boolean;
}
