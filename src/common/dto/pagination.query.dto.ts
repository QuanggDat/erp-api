import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToOptionalInt, ToOptionalString } from '../transform/query.transform';

//DTO phân trang dùng chung cho MỌI danh sách trong hệ thống
//các module chỉ cần extends class này rồi thêm bộ lọc riêng của mình
export class PaginationQueryDTO {
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

  //từ khoá tìm kiếm, mỗi module tự quyết định tìm trên cột nào
  @ToOptionalString()
  @IsString()
  @IsOptional()
  search?: string;
}
