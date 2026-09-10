import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorator';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { Role } from '../generated/prisma/enums';
import {
  CreateProductCategoryDTO,
  CreateProductDTO,
  GetProductCategoriesQueryDTO,
  GetProductsQueryDTO,
  UpdateProductCategoryDTO,
  UpdateProductDTO,
} from './dto';
import { ProductCategoryService } from './product-category.service';
import { ProductService } from './product.service';

//MyJwtGuard chạy trước để gắn user vào request, RolesGuard đọc user đó ra
@UseGuards(MyJwtGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(
    private productService: ProductService,
    private productCategoryService: ProductCategoryService,
  ) {}

  //=========== NHÓM HÀNG ===========
  //đặt TRƯỚC route :id, nếu không "categories" sẽ bị hiểu là một id
  //GET: .../products/categories?page=1&limit=10
  @Get('categories')
  getCategories(@Query() query: GetProductCategoriesQueryDTO) {
    return this.productCategoryService.getCategories(query);
  }

  @Get('categories/:id')
  getCategoryById(@Param('id', ParseIntPipe) categoryId: number) {
    return this.productCategoryService.getCategoryById(categoryId);
  }

  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Post('categories')
  createCategory(@Body() dto: CreateProductCategoryDTO) {
    return this.productCategoryService.createCategory(dto);
  }

  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateProductCategoryDTO,
  ) {
    return this.productCategoryService.updateCategory(categoryId, dto);
  }

  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) categoryId: number) {
    return this.productCategoryService.deleteCategory(categoryId);
  }

  //=========== SẢN PHẨM ===========
  //GET: .../products?page=1&limit=10&search=abc&categoryId=1
  @Get()
  getProducts(@Query() query: GetProductsQueryDTO) {
    return this.productService.getProducts(query);
  }

  @Get(':id')
  getProductById(@Param('id', ParseIntPipe) productId: number) {
    return this.productService.getProductById(productId);
  }

  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Post()
  createProduct(@Body() dto: CreateProductDTO) {
    return this.productService.createProduct(dto);
  }

  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Patch(':id')
  updateProduct(
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDTO,
  ) {
    return this.productService.updateProduct(productId, dto);
  }

  //ngừng kinh doanh thay vì xoá, nên trả về bản ghi đã cập nhật
  @Roles(Role.PURCHASE, Role.WAREHOUSE)
  @Delete(':id')
  deactivateProduct(@Param('id', ParseIntPipe) productId: number) {
    return this.productService.deactivateProduct(productId);
  }
}
