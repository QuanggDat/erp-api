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
  ToOptionalInt,
  ToOptionalBoolean,
} from '../../common/transform/query.transform';

export class CreateWarehouseDTO {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdateWarehouseDTO {
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
  address?: string;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GetWarehousesQueryDTO extends PaginationQueryDTO {
  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

//xem tồn kho, lọc được theo sản phẩm hoặc theo kho
export class GetStocksQueryDTO extends PaginationQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  productId?: number;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  warehouseId?: number;
}

//xem sổ nhật ký nhập xuất
export class GetStockMovementsQueryDTO extends PaginationQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  productId?: number;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  warehouseId?: number;
}

//điều chỉnh tồn kho sau khi kiểm kê
//client gửi số lượng ĐÚNG đếm được, hệ thống tự tính phần chênh lệch
export class AdjustStockDTO {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  warehouseId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  actualQuantity!: number;

  @IsString()
  @IsOptional()
  note?: string;
}
