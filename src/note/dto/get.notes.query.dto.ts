import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

//DTO cho query string phân trang: .../notes?page=1&limit=10
//query string luôn là chuỗi nên cần @Type(() => Number) để ép về số trước khi validate
export class GetNotesQueryDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  //chặn trần limit để client không kéo cả bảng về trong một request
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;
}
