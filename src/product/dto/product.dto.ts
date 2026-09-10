import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDTO } from '../../common/dto/pagination.query.dto';
import {
  ToOptionalBoolean,
  ToOptionalInt,
} from '../../common/transform/query.transform';

//tạo sản phẩm mới
export class CreateProductDTO {
  @IsString()
  @IsNotEmpty()
  code!: string; //mã hàng, không được trùng

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  unit?: string; //bỏ trống thì database tự điền "Cái"

  @IsString()
  @IsOptional()
  description?: string;

  //maxDecimalPlaces chặn client gửi giá lẻ tới hàng phần nghìn đồng
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;
}

//sửa sản phẩm: mọi field đều optional theo đúng tinh thần PATCH
export class UpdateProductDTO {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

//query danh sách sản phẩm: kế thừa phân trang, thêm bộ lọc riêng
export class GetProductsQueryDTO extends PaginationQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
