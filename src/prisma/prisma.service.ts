import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
//service này dùng để kết nối DB
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      //không hardcode connection string, lấy từ .env qua ConfigService
      //url: 'postgresql://postgres:Abc123456789@localhost:5434/testdb'
      adapter: new PrismaPg({
        connectionString: configService.get<string>('DATABASE_URL'),
      }),
    });
    console.log(
      'configService DATABASE_URL : ' +
        configService.get<string>('DATABASE_URL'),
    );
  }

  //Nest gọi hook này khi app đóng -> đóng luôn connection pool tới Postgres
  async onModuleDestroy() {
    await this.$disconnect();
  }

  //dọn sạch dữ liệu trước mỗi lần chạy e2e test
  //THỨ TỰ RẤT QUAN TRỌNG: bảng con phải xoá trước bảng cha,
  //vì bảng con giữ khoá ngoại trỏ ngược lên bảng cha
  cleanDb() {
    return this.$transaction([
      //chi tiết chứng từ trước, đầu chứng từ sau
      this.purchaseOrderItem.deleteMany(),
      this.salesOrderItem.deleteMany(),
      this.purchaseOrder.deleteMany(),
      this.salesOrder.deleteMany(),
      //kho: sổ nhật ký và tồn đều trỏ tới sản phẩm lẫn kho
      this.stockMovement.deleteMany(),
      this.stock.deleteMany(),
      this.warehouse.deleteMany(),
      //sản phẩm trước nhóm hàng
      this.product.deleteMany(),
      this.productCategory.deleteMany(),
      this.partner.deleteMany(),
      //nhân sự: chấm công trỏ tới nhân viên
      this.attendance.deleteMany(),
      this.employee.deleteMany(),
      this.department.deleteMany(),
      this.position.deleteMany(),
      //cuối cùng mới tới notes và users
      this.note.deleteMany(),
      this.user.deleteMany(),
    ]);
  }
}
