import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildPaginatedResult,
  getSkip,
} from '../common/helper/pagination.helper';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDTO,
  GetEmployeesQueryDTO,
  UpdateEmployeeDTO,
} from './dto';

@Injectable()
export class EmployeeService {
  constructor(private prismaService: PrismaService) {}

  async getEmployees(query: GetEmployeesQueryDTO) {
    const { page, limit, search, departmentId, positionId, isActive } = query;

    const where: Prisma.EmployeeWhereInput = {
      ...(departmentId !== undefined && { departmentId }),
      ...(positionId !== undefined && { positionId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.employee.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          department: { select: { id: true, code: true, name: true } },
          position: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prismaService.employee.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getEmployeeById(employeeId: number) {
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, email: true, role: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    return employee;
  }

  async createEmployee(dto: CreateEmployeeDTO) {
    await this.ensureRelationsExist(dto.departmentId, dto.positionId);
    try {
      return await this.prismaService.employee.create({
        data: {
          ...dto,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        },
      });
    } catch (error) {
      throw this.handleUniqueError(error, dto.code);
    }
  }

  async updateEmployee(employeeId: number, dto: UpdateEmployeeDTO) {
    await this.getEmployeeById(employeeId);
    await this.ensureRelationsExist(dto.departmentId, dto.positionId);
    try {
      return await this.prismaService.employee.update({
        where: { id: employeeId },
        data: {
          ...dto,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        },
      });
    } catch (error) {
      throw this.handleUniqueError(error, dto.code);
    }
  }

  //nghỉ việc thì tắt cờ, hồ sơ và bảng lương cũ vẫn phải giữ lại
  async deactivateEmployee(employeeId: number) {
    await this.getEmployeeById(employeeId);
    return this.prismaService.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });
  }

  //dùng cho service chấm công và bảng lương
  async ensureEmployeeIsActive(employeeId: number) {
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    if (!employee.isActive) {
      throw new ConflictException(`Nhân viên ${employee.code} đã nghỉ việc`);
    }
    return employee;
  }

  private async ensureRelationsExist(
    departmentId?: number,
    positionId?: number,
  ) {
    if (departmentId !== undefined) {
      const department = await this.prismaService.department.findUnique({
        where: { id: departmentId },
      });
      if (!department) {
        throw new NotFoundException('Không tìm thấy phòng ban');
      }
    }
    if (positionId !== undefined) {
      const position = await this.prismaService.position.findUnique({
        where: { id: positionId },
      });
      if (!position) {
        throw new NotFoundException('Không tìm thấy chức danh');
      }
    }
  }

  //bảng employees có ba cột unique là code, email và userId
  private handleUniqueError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      //meta.target cho biết cột nào bị trùng, nhờ đó báo lỗi đúng chỗ
      const target = (error.meta?.target as string[] | undefined)?.join(', ');
      if (target?.includes('email')) {
        return new ConflictException('Email nhân viên đã tồn tại');
      }
      if (target?.includes('userId')) {
        return new ConflictException(
          'Tài khoản này đã được gắn với một nhân viên khác',
        );
      }
      return new ConflictException(`Mã nhân viên ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
