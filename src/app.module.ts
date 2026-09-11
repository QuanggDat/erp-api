import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { HrModule } from './hr/hr.module';
import { NoteModule } from './note/note.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { ReportModule } from './report/report.module';
import { PurchaseModule } from './purchase/purchase.module';
import { SalesModule } from './sales/sales.module';
import { UserModule } from './user/user.module';
import { WarehouseModule } from './warehouse/warehouse.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), //nạp file .env vào process.env
    PrismaModule,
    HealthModule,
    AuthModule,
    UserModule,
    NoteModule,
    //các phân hệ ERP, xếp theo thứ tự phụ thuộc: danh mục trước, chứng từ sau
    PartnerModule,
    ProductModule,
    WarehouseModule,
    PurchaseModule,
    SalesModule,
    ReportModule,
    HrModule,
  ],
})
export class AppModule {}
