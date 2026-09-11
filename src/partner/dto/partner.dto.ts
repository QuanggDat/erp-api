import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDTO } from '../../common/dto/pagination.query.dto';
import { PartnerType } from '../../generated/prisma/enums';
import {
  ToOptionalBoolean,
  ToOptionalEnum,
} from '../../common/transform/query.transform';

export class CreatePartnerDTO {
  @IsString()
  @IsNotEmpty()
  code!: string; //ví dụ KH001 hoặc NCC001

  @IsString()
  @IsNotEmpty()
  name!: string;

  //IsEnum chặn client gửi giá trị lạ, chỉ nhận CUSTOMER, SUPPLIER hoặc BOTH
  @IsEnum(PartnerType)
  @IsOptional()
  type?: PartnerType;

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdatePartnerDTO {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(PartnerType)
  @IsOptional()
  type?: PartnerType;

  @IsString()
  @IsOptional()
  taxCode?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GetPartnersQueryDTO extends PaginationQueryDTO {
  @ToOptionalEnum()
  @IsEnum(PartnerType)
  @IsOptional()
  type?: PartnerType;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
