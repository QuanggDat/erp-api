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
import { CreateAttendanceDTO, GetAttendancesQueryDTO } from './dto';
import { EmployeeService } from './employee.service';

//Chấm công. Trước đây file này còn xử lý cả bảng lương, nhưng tiền lương
//là dữ liệu nhạy cảm nên đã được gỡ hoàn toàn khỏi hệ thống.
@Injectable()
export class AttendanceService {
  constructor(
    private prismaService: PrismaService,
    private employeeService: EmployeeService,
  ) {}

  async getAttendances(query: GetAttendancesQueryDTO) {
    const { page, limit, employeeId, fromDate, toDate } = query;

    const where: Prisma.AttendanceWhereInput = {
      ...(employeeId !== undefined && { employeeId }),
      ...((fromDate || toDate) && {
        workDate: {
          ...(fromDate && { gte: new Date(fromDate) }),
          ...(toDate && { lte: new Date(toDate) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.attendance.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { workDate: 'desc' },
        include: {
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prismaService.attendance.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async createAttendance(dto: CreateAttendanceDTO) {
    await this.employeeService.ensureEmployeeIsActive(dto.employeeId);
    try {
      return await this.prismaService.attendance.create({
        data: {
          employeeId: dto.employeeId,
          workDate: new Date(dto.workDate),
          workHours: dto.workHours,
          note: dto.note,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException(
          'Nhân viên này đã được chấm công cho ngày đó',
        );
      }
      throw error;
    }
  }

  async deleteAttendance(attendanceId: number) {
    const attendance = await this.prismaService.attendance.findUnique({
      where: { id: attendanceId },
    });
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản chấm công');
    }
    await this.prismaService.attendance.delete({ where: { id: attendanceId } });
  }

  //P2002 là mã lỗi Prisma cho vi phạm ràng buộc unique
  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
