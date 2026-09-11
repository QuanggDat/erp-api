import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

//Route công khai để nền tảng hosting (Render) kiểm tra app còn sống hay không
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    //truy vấn rẻ nhất có thể để xác nhận kết nối Postgres vẫn dùng được
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
