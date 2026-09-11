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
import { CreateOrgUnitDTO, GetOrgUnitsQueryDTO, UpdateOrgUnitDTO } from './dto';

//phòng ban và chức danh có cùng cấu trúc và cùng nghiệp vụ
//gộp vào một service, phân biệt bằng tham số unit thay vì viết hai lần
type OrgUnit = 'department' | 'position';

const LABEL: Record<OrgUnit, string> = {
  department: 'phòng ban',
  position: 'chức danh',
};

@Injectable()
export class OrgUnitService {
  constructor(private prismaService: PrismaService) {}

  async getUnits(unit: OrgUnit, query: GetOrgUnitsQueryDTO) {
    const { page, limit, search } = query;
    //không chú thích kiểu ở đây: Prisma sinh DepartmentWhereInput và
    //PositionWhereInput là hai kiểu riêng biệt dù nội dung giống hệt nhau
    const where = {
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const args = {
      where,
      skip: getSkip(page, limit),
      take: limit,
      orderBy: { code: 'asc' as const },
      include: { _count: { select: { employees: true } } },
    };

    //phải tách nhánh rõ ràng: TypeScript không gọi được hàm trên union
    //của hai delegate Prisma khác nhau, dù chúng trông giống hệt nhau
    const [items, total] =
      unit === 'department'
        ? await Promise.all([
            this.prismaService.department.findMany(args),
            this.prismaService.department.count({ where }),
          ])
        : await Promise.all([
            this.prismaService.position.findMany(args),
            this.prismaService.position.count({ where }),
          ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getUnitById(unit: OrgUnit, unitId: number) {
    const found =
      unit === 'department'
        ? await this.prismaService.department.findUnique({
            where: { id: unitId },
          })
        : await this.prismaService.position.findUnique({
            where: { id: unitId },
          });
    if (!found) {
      throw new NotFoundException(`Không tìm thấy ${LABEL[unit]}`);
    }
    return found;
  }

  async createUnit(unit: OrgUnit, dto: CreateOrgUnitDTO) {
    try {
      return unit === 'department'
        ? await this.prismaService.department.create({ data: dto })
        : await this.prismaService.position.create({ data: dto });
    } catch (error) {
      throw this.handleUniqueCodeError(error, unit, dto.code);
    }
  }

  async updateUnit(unit: OrgUnit, unitId: number, dto: UpdateOrgUnitDTO) {
    await this.getUnitById(unit, unitId);
    try {
      return unit === 'department'
        ? await this.prismaService.department.update({
            where: { id: unitId },
            data: dto,
          })
        : await this.prismaService.position.update({
            where: { id: unitId },
            data: dto,
          });
    } catch (error) {
      throw this.handleUniqueCodeError(error, unit, dto.code);
    }
  }

  async deleteUnit(unit: OrgUnit, unitId: number) {
    await this.getUnitById(unit, unitId);
    //chặn xoá khi còn nhân viên, tránh để nhân viên mồ côi
    const employeeCount = await this.prismaService.employee.count({
      where:
        unit === 'department'
          ? { departmentId: unitId }
          : { positionId: unitId },
    });
    if (employeeCount > 0) {
      throw new ConflictException(
        `${LABEL[unit]} còn ${employeeCount} nhân viên, không xoá được`,
      );
    }
    if (unit === 'department') {
      await this.prismaService.department.delete({ where: { id: unitId } });
    } else {
      await this.prismaService.position.delete({ where: { id: unitId } });
    }
  }

  private handleUniqueCodeError(error: unknown, unit: OrgUnit, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        `Mã ${LABEL[unit]} ${code ?? ''} đã tồn tại`,
      );
    }
    return error;
  }
}
