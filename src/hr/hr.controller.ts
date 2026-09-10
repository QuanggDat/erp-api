import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorator';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { Role } from '../generated/prisma/enums';
import {
  CreateAttendanceDTO,
  CreateEmployeeDTO,
  CreateOrgUnitDTO,
  GetAttendancesQueryDTO,
  GetEmployeesQueryDTO,
  GetOrgUnitsQueryDTO,
  UpdateEmployeeDTO,
  UpdateOrgUnitDTO,
} from './dto';
import { AttendanceService } from './attendance.service';
import { EmployeeService } from './employee.service';
import { OrgUnitService } from './org-unit.service';

//toàn bộ phân hệ nhân sự chỉ dành cho vai trò HR, ADMIN luôn đi qua được
@UseGuards(MyJwtGuard, RolesGuard)
@Roles(Role.HR)
@Controller('hr')
export class HrController {
  constructor(
    private employeeService: EmployeeService,
    private orgUnitService: OrgUnitService,
    private attendanceService: AttendanceService,
  ) {}

  //=========== PHÒNG BAN ===========
  @Get('departments')
  getDepartments(@Query() query: GetOrgUnitsQueryDTO) {
    return this.orgUnitService.getUnits('department', query);
  }

  @Get('departments/:id')
  getDepartmentById(@Param('id', ParseIntPipe) id: number) {
    return this.orgUnitService.getUnitById('department', id);
  }

  @Post('departments')
  createDepartment(@Body() dto: CreateOrgUnitDTO) {
    return this.orgUnitService.createUnit('department', dto);
  }

  @Patch('departments/:id')
  updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrgUnitDTO,
  ) {
    return this.orgUnitService.updateUnit('department', id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('departments/:id')
  deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    return this.orgUnitService.deleteUnit('department', id);
  }

  //=========== CHỨC DANH ===========
  @Get('positions')
  getPositions(@Query() query: GetOrgUnitsQueryDTO) {
    return this.orgUnitService.getUnits('position', query);
  }

  @Get('positions/:id')
  getPositionById(@Param('id', ParseIntPipe) id: number) {
    return this.orgUnitService.getUnitById('position', id);
  }

  @Post('positions')
  createPosition(@Body() dto: CreateOrgUnitDTO) {
    return this.orgUnitService.createUnit('position', dto);
  }

  @Patch('positions/:id')
  updatePosition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrgUnitDTO,
  ) {
    return this.orgUnitService.updateUnit('position', id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('positions/:id')
  deletePosition(@Param('id', ParseIntPipe) id: number) {
    return this.orgUnitService.deleteUnit('position', id);
  }

  //=========== CHẤM CÔNG ===========
  //đặt trước employees/:id để không bị nhầm thành một id
  @Get('attendances')
  getAttendances(@Query() query: GetAttendancesQueryDTO) {
    return this.attendanceService.getAttendances(query);
  }

  @Post('attendances')
  createAttendance(@Body() dto: CreateAttendanceDTO) {
    return this.attendanceService.createAttendance(dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('attendances/:id')
  deleteAttendance(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.deleteAttendance(id);
  }

  //CỐ Ý KHÔNG CÓ route bảng lương: tiền lương là dữ liệu nhạy cảm,
  //đã được gỡ hoàn toàn khỏi hệ thống.

  //=========== NHÂN VIÊN ===========
  //đặt CUỐI CÙNG vì route :id sẽ nuốt mọi đường dẫn phía trên nếu đặt trước
  @Get('employees')
  getEmployees(@Query() query: GetEmployeesQueryDTO) {
    return this.employeeService.getEmployees(query);
  }

  @Get('employees/:id')
  getEmployeeById(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.getEmployeeById(id);
  }

  @Post('employees')
  createEmployee(@Body() dto: CreateEmployeeDTO) {
    return this.employeeService.createEmployee(dto);
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDTO,
  ) {
    return this.employeeService.updateEmployee(id, dto);
  }

  @Delete('employees/:id')
  deactivateEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.deactivateEmployee(id);
  }
}
