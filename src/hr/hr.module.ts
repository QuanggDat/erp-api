import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceService } from './attendance.service';
import { EmployeeService } from './employee.service';
import { HrController } from './hr.controller';
import { OrgUnitService } from './org-unit.service';

@Module({
  imports: [PrismaModule],
  controllers: [HrController],
  providers: [EmployeeService, OrgUnitService, AttendanceService],
})
export class HrModule {}
