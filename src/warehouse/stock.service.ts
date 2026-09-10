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
import { MovementType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustStockDTO,
  GetStockMovementsQueryDTO,
  GetStocksQueryDTO,
} from './dto';

//một dòng hàng cần ghi kho, dùng chung cho đơn mua và đơn bán
export type StockLine = {
  productId: number;
  quantity: Prisma.Decimal | number;
};

@Injectable()
export class StockService {
  constructor(private prismaService: PrismaService) {}

  async getStocks(query: GetStocksQueryDTO) {
    const { page, limit, productId, warehouseId } = query;
    const where: Prisma.StockWhereInput = {
      ...(productId !== undefined && { productId }),
      ...(warehouseId !== undefined && { warehouseId }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.stock.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }],
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prismaService.stock.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getStockMovements(query: GetStockMovementsQueryDTO) {
    const { page, limit, productId, warehouseId } = query;
    const where: Prisma.StockMovementWhereInput = {
      ...(productId !== undefined && { productId }),
      ...(warehouseId !== undefined && { warehouseId }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.stockMovement.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' }, //mới nhất lên đầu
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prismaService.stockMovement.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  //=====================================================================
  // HÀM LÕI: ghi một biến động tồn kho
  // nhận tx thay vì this.prismaService để dùng được bên trong transaction
  // của đơn mua và đơn bán, đảm bảo hoặc ghi hết hoặc không ghi gì
  //=====================================================================
  async applyMovement(
    tx: Prisma.TransactionClient,
    params: {
      productId: number;
      warehouseId: number;
      type: MovementType;
      quantity: Prisma.Decimal | number;
      refType?: string;
      refId?: number;
      note?: string;
    },
  ) {
    const { productId, warehouseId, type, quantity, refType, refId, note } =
      params;

    //ghi vào sổ nhật ký trước, đây là dấu vết không bao giờ mất
    await tx.stockMovement.create({
      data: { productId, warehouseId, type, quantity, refType, refId, note },
    });

    //nhập thì cộng, xuất thì trừ
    const delta =
      type === MovementType.OUT
        ? new Prisma.Decimal(quantity).negated()
        : new Prisma.Decimal(quantity);

    //upsert vì lần đầu nhập một sản phẩm vào kho thì chưa có dòng tồn nào
    const stock = await tx.stock.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity: delta },
      update: { quantity: { increment: delta } },
    });

    //chặn tồn âm: xuất nhiều hơn số đang có là sai nghiệp vụ
    //ném lỗi ở đây khiến cả transaction bị huỷ, sổ nhật ký cũng không được ghi
    if (stock.quantity.lessThan(0)) {
      throw new ConflictException(
        `Không đủ tồn kho cho sản phẩm id ${productId} tại kho id ${warehouseId}`,
      );
    }
    return stock;
  }

  //ghi nhiều dòng cùng lúc, dùng khi xác nhận một đơn mua hoặc đơn bán
  async applyMovements(
    tx: Prisma.TransactionClient,
    params: {
      warehouseId: number;
      type: MovementType;
      lines: StockLine[];
      refType: string;
      refId: number;
    },
  ) {
    const { warehouseId, type, lines, refType, refId } = params;
    //chạy tuần tự chứ không Promise.all: hai dòng cùng sản phẩm sẽ tranh nhau
    //cập nhật một bản ghi tồn và gây khoá chéo
    for (const line of lines) {
      await this.applyMovement(tx, {
        productId: line.productId,
        warehouseId,
        type,
        quantity: line.quantity,
        refType,
        refId,
      });
    }
  }

  //điều chỉnh sau kiểm kê: client báo số đếm được, hệ thống tính chênh lệch
  async adjustStock(dto: AdjustStockDTO) {
    const { productId, warehouseId, actualQuantity, note } = dto;

    await this.ensureProductExists(productId);
    await this.ensureWarehouseExists(warehouseId);

    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });
      const currentQuantity = current?.quantity ?? new Prisma.Decimal(0);
      const difference = new Prisma.Decimal(actualQuantity).minus(
        currentQuantity,
      );

      if (difference.isZero()) {
        return current; //không lệch thì không ghi gì cả
      }

      //ghi một dòng ADJUST với giá trị tuyệt đối của chênh lệch
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: MovementType.ADJUST,
          quantity: difference.abs(),
          refType: 'ADJUSTMENT',
          note:
            note ??
            `Kiểm kê: ${currentQuantity.toString()} thành ${actualQuantity}`,
        },
      });

      //ADJUST ghi thẳng số đếm được, không cộng dồn
      return tx.stock.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: { productId, warehouseId, quantity: actualQuantity },
        update: { quantity: actualQuantity },
      });
    });
  }

  private async ensureProductExists(productId: number) {
    const product = await this.prismaService.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
  }

  private async ensureWarehouseExists(warehouseId: number) {
    const warehouse = await this.prismaService.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Không tìm thấy kho');
    }
  }
}
