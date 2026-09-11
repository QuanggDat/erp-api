import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Danh sách origin được phép gọi API, khai báo qua biến môi trường CORS_ORIGINS
  //(các origin cách nhau bởi dấu phẩy). Khi chưa khai báo thì dùng localhost cho dev.
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  //kiểm tra dữ liệu DTO gửi lên; whitelist loại bỏ field không khai báo trong DTO
  //transform biến payload/query thành instance của DTO, nhờ đó @Type() và giá trị mặc định mới có hiệu lực
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  //đóng Prisma connection pool gọn gàng khi nền tảng gửi SIGTERM
  app.enableShutdownHooks();

  //phải bind 0.0.0.0 để Render/Docker thấy được cổng, mặc định Nest chỉ bind localhost
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
