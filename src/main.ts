import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //cho phép front-end Next.js (chạy ở port 3001) gọi API từ trình duyệt
  app.enableCors({
    origin: ['http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  //kiểm tra dữ liệu DTO gửi lên; whitelist loại bỏ field không khai báo trong DTO
  //transform biến payload/query thành instance của DTO, nhờ đó @Type() và giá trị mặc định mới có hiệu lực
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
