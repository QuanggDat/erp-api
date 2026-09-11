import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ToOptionalInt } from '../../common/transform/query.transform';

//DTO cho query string phân trang: .../notes?page=1&limit=10
//query string luôn là chuỗi nên cần ToOptionalInt để ép về số trước khi validate
export class GetNotesQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  //chặn trần limit để client không kéo cả bảng về trong một request
  @ToOptionalInt()
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;
}
