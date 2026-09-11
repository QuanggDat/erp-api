import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDTO } from '../../common/dto/pagination.query.dto';
import { OrderStatus } from '../../generated/prisma/enums';
import {
  ToOptionalEnum,
  ToOptionalInt,
} from '../../common/transform/query.transform';

export class SalesOrderItemDTO {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  //bỏ trống thì service tự lấy giá bán niêm yết của sản phẩm
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  unitPrice?: number;
}

export class CreateSalesOrderDTO {
  @IsString()
  @IsNotEmpty()
  code!: string; //số phiếu, ví dụ SO-2026-0001

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  customerId!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  warehouseId!: number; //xuất từ kho nào

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDTO)
  items!: SalesOrderItemDTO[];
}

export class UpdateSalesOrderDTO {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  customerId?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  warehouseId?: number;

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDTO)
  @IsOptional()
  items?: SalesOrderItemDTO[];
}

export class GetSalesOrdersQueryDTO extends PaginationQueryDTO {
  @ToOptionalEnum()
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  customerId?: number;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  warehouseId?: number;
}
