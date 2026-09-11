import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  buildPaginatedResult,
  getSkip,
} from '../common/helper/pagination.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDTO, GetProductsQueryDTO, UpdateProductDTO } from './dto';

@Injectable()
export class ProductService {
  constructor(private prismaService: PrismaService) {}

  async getProducts(query: GetProductsQueryDTO) {
    const { page, limit, search, categoryId, isActive } = query;

    //chỉ thêm điều kiện khi client thực sự gửi lên, tránh lọc nhầm
    const where: Prisma.ProductWhereInput = {
      ...(categoryId !== undefined && { categoryId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prismaService.product.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getProductById(productId: number) {
    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, code: true, name: true } },
        //kèm tồn kho ở từng kho để không phải gọi thêm một API nữa
        stocks: {
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return product;
  }

  async createProduct(dto: CreateProductDTO) {
    //nhóm hàng phải tồn tại, nếu không khoá ngoại sẽ báo lỗi khó hiểu
    if (dto.categoryId !== undefined) {
      await this.ensureCategoryExists(dto.categoryId);
    }
    try {
      return await this.prismaService.product.create({ data: dto });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updateProduct(productId: number, dto: UpdateProductDTO) {
    await this.getProductById(productId); //404 nếu không tồn tại
    if (dto.categoryId !== undefined) {
      await this.ensureCategoryExists(dto.categoryId);
    }
    try {
      return await this.prismaService.product.update({
        where: { id: productId },
        data: dto,
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  //không xoá cứng: sản phẩm đã nằm trong chứng từ cũ thì phải giữ lại
  //ngừng kinh doanh chỉ là tắt cờ isActive
  async deactivateProduct(productId: number) {
    await this.getProductById(productId);
    return this.prismaService.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  }

  private async ensureCategoryExists(categoryId: number) {
    const category = await this.prismaService.productCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy nhóm hàng');
    }
  }

  //P2002 là mã lỗi Prisma cho vi phạm ràng buộc unique
  private handleUniqueCodeError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Mã sản phẩm ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
