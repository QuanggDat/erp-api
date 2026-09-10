import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDTO } from '../../common/dto/pagination.query.dto';

export class CreateProductCategoryDTO {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateProductCategoryDTO {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}

//nhóm hàng chỉ cần phân trang và tìm kiếm, không có bộ lọc riêng
export class GetProductCategoriesQueryDTO extends PaginationQueryDTO {}
