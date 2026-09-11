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

//một dòng hàng trong đơn mua
export class PurchaseOrderItemDTO {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  productId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001) //số lượng phải dương, đơn mua 0 cái là vô nghĩa
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseOrderDTO {
  @IsString()
  @IsNotEmpty()
  code!: string; //số phiếu, ví dụ PO-2026-0001

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  supplierId!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  warehouseId!: number; //nhập về kho nào

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  //ValidateNested cùng @Type mới kiểm tra được từng phần tử trong mảng
  @IsArray()
  @ArrayMinSize(1) //đơn không có dòng hàng nào thì không có ý nghĩa
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDTO)
  items!: PurchaseOrderItemDTO[];
}

//chỉ sửa được đơn ở trạng thái DRAFT, service sẽ kiểm tra điều đó
export class UpdatePurchaseOrderDTO {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  supplierId?: number;

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

  //gửi items lên thì thay thế TOÀN BỘ các dòng cũ, không gửi thì giữ nguyên
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDTO)
  @IsOptional()
  items?: PurchaseOrderItemDTO[];
}

export class GetPurchaseOrdersQueryDTO extends PaginationQueryDTO {
  @ToOptionalEnum()
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  supplierId?: number;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  warehouseId?: number;
}
