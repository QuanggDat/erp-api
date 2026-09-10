import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDTO } from '../../common/dto/pagination.query.dto';
import {
  ToOptionalInt,
  ToOptionalBoolean,
} from '../../common/transform/query.transform';

//=========== PHÒNG BAN VÀ CHỨC DANH ===========
//hai danh mục này có cấu trúc giống hệt nhau nên dùng chung một cặp DTO

export class CreateOrgUnitDTO {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateOrgUnitDTO {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}

export class GetOrgUnitsQueryDTO extends PaginationQueryDTO {}

//=========== NHÂN VIÊN ===========

export class CreateEmployeeDTO {
  @IsString()
  @IsNotEmpty()
  code!: string; //mã nhân viên

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  positionId?: number;

  //gắn hồ sơ nhân viên với một tài khoản đăng nhập, không bắt buộc
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;
}

export class UpdateEmployeeDTO {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  positionId?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GetEmployeesQueryDTO extends PaginationQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  positionId?: number;

  @ToOptionalBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

//=========== CHẤM CÔNG ===========

export class CreateAttendanceDTO {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  employeeId!: number;

  @IsDateString()
  @IsNotEmpty()
  workDate!: string;

  //giới hạn 24 giờ một ngày, quá số đó chắc chắn là nhập nhầm
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  @IsOptional()
  workHours?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class GetAttendancesQueryDTO extends PaginationQueryDTO {
  @ToOptionalInt()
  @IsInt()
  @IsOptional()
  employeeId?: number;

  //lọc theo khoảng ngày
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

//CỐ Ý KHÔNG CÓ DTO bảng lương: tiền lương là dữ liệu nhạy cảm,
//đã được gỡ hoàn toàn khỏi hệ thống.
