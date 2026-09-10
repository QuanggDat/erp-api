import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductCategoryService } from './product-category.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductController],
  providers: [ProductService, ProductCategoryService],
  //export để module mua hàng và bán hàng dùng lại việc kiểm tra sản phẩm
  exports: [ProductService],
})
export class ProductModule {}
