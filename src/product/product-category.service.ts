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
import {
  CreateProductCategoryDTO,
  GetProductCategoriesQueryDTO,
  UpdateProductCategoryDTO,
} from './dto';

@Injectable()
export class ProductCategoryService {
  constructor(private prismaService: PrismaService) {}

  async getCategories(query: GetProductCategoriesQueryDTO) {
    const { page, limit, search } = query;
    const where: Prisma.ProductCategoryWhereInput = {
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.productCategory.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { code: 'asc' },
        //đếm số sản phẩm trong nhóm, hữu ích khi hiển thị danh sách
        include: { _count: { select: { products: true } } },
      }),
      this.prismaService.productCategory.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getCategoryById(categoryId: number) {
    const category = await this.prismaService.productCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy nhóm hàng');
    }
    return category;
  }

  async createCategory(dto: CreateProductCategoryDTO) {
    try {
      return await this.prismaService.productCategory.create({ data: dto });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updateCategory(categoryId: number, dto: UpdateProductCategoryDTO) {
    await this.getCategoryById(categoryId);
    try {
      return await this.prismaService.productCategory.update({
        where: { id: categoryId },
        data: dto,
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async deleteCategory(categoryId: number) {
    await this.getCategoryById(categoryId);
    //chặn xoá khi còn sản phẩm bên trong, tránh để sản phẩm mồ côi
    const productCount = await this.prismaService.product.count({
      where: { categoryId },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Nhóm hàng còn ${productCount} sản phẩm, không xoá được`,
      );
    }
    await this.prismaService.productCategory.delete({
      where: { id: categoryId },
    });
  }

  private handleUniqueCodeError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Mã nhóm hàng ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
