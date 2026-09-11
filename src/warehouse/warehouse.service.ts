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
  CreateWarehouseDTO,
  GetWarehousesQueryDTO,
  UpdateWarehouseDTO,
} from './dto';

@Injectable()
export class WarehouseService {
  constructor(private prismaService: PrismaService) {}

  async getWarehouses(query: GetWarehousesQueryDTO) {
    const { page, limit, search, isActive } = query;
    const where: Prisma.WarehouseWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.warehouse.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prismaService.warehouse.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getWarehouseById(warehouseId: number) {
    const warehouse = await this.prismaService.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Không tìm thấy kho');
    }
    return warehouse;
  }

  async createWarehouse(dto: CreateWarehouseDTO) {
    try {
      return await this.prismaService.warehouse.create({ data: dto });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updateWarehouse(warehouseId: number, dto: UpdateWarehouseDTO) {
    await this.getWarehouseById(warehouseId);
    try {
      return await this.prismaService.warehouse.update({
        where: { id: warehouseId },
        data: dto,
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  //ngừng sử dụng kho, chặn lại nếu còn hàng bên trong
  async deactivateWarehouse(warehouseId: number) {
    await this.getWarehouseById(warehouseId);
    const remaining = await this.prismaService.stock.count({
      where: { warehouseId, quantity: { gt: 0 } },
    });
    if (remaining > 0) {
      throw new ConflictException(
        `Kho còn tồn ${remaining} mặt hàng, cần xuất hết trước khi ngừng sử dụng`,
      );
    }
    return this.prismaService.warehouse.update({
      where: { id: warehouseId },
      data: { isActive: false },
    });
  }

  //dùng cho module mua hàng và bán hàng
  async ensureWarehouseIsUsable(warehouseId: number) {
    const warehouse = await this.getWarehouseById(warehouseId);
    if (!warehouse.isActive) {
      throw new ConflictException(`Kho ${warehouse.code} đã ngừng sử dụng`);
    }
    return warehouse;
  }

  private handleUniqueCodeError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Mã kho ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
