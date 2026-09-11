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
  //đơn giá vốn của dòng này, chỉ cần khi NHẬP kho (giá mua thực tế).
  //Khi xuất thì bỏ trống, hệ thống tự lấy đơn giá bình quân của kho.
  unitCost?: Prisma.Decimal | number;
};

//kết quả ghi kho của một dòng, trả về giá vốn đã dùng để bên gọi ghi lại
export type MovementResult = {
  productId: number;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal; //đơn giá vốn thực tế đã áp dụng
  costAmount: Prisma.Decimal; //quantity nhân unitCost
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
      unitCost?: Prisma.Decimal | number; //chỉ dùng khi NHẬP
      refType?: string;
      refId?: number;
      note?: string;
    },
  ): Promise<MovementResult> {
    const {
      productId,
      warehouseId,
      type,
      quantity,
      unitCost,
      refType,
      refId,
      note,
    } = params;

    const qty = new Prisma.Decimal(quantity);

    //tồn hiện tại, cần biết trước để tính bình quân gia quyền
    const current = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    const currentQty = current?.quantity ?? new Prisma.Decimal(0);
    const currentAvg = current?.avgCost ?? new Prisma.Decimal(0);

    //=================================================================
    // GIÁ VỐN
    // Nhập: đơn giá bình quân mới = (giá trị tồn cũ + giá trị nhập)
    //       chia (số lượng cũ + số lượng nhập).
    // Xuất: lấy đúng đơn giá bình quân đang có làm giá vốn, và KHÔNG
    //       đổi đơn giá bình quân, vì xuất hàng không làm thay đổi
    //       giá trị trung bình của số hàng còn lại.
    //=================================================================
    let appliedCost: Prisma.Decimal;
    let newAvg = currentAvg;

    if (type === MovementType.IN) {
      appliedCost =
        unitCost !== undefined ? new Prisma.Decimal(unitCost) : currentAvg;
      const totalQty = currentQty.plus(qty);
      if (totalQty.greaterThan(0)) {
        const totalValue = currentQty
          .times(currentAvg)
          .plus(qty.times(appliedCost));
        newAvg = totalValue.dividedBy(totalQty);
      }
    } else {
      //xuất và điều chỉnh đều dùng đơn giá bình quân hiện tại
      appliedCost = currentAvg;
    }

    //ghi vào sổ nhật ký trước, đây là dấu vết không bao giờ mất
    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type,
        quantity: qty,
        unitCost: appliedCost,
        refType,
        refId,
        note,
      },
    });

    //nhập thì cộng, xuất thì trừ
    const delta = type === MovementType.OUT ? qty.negated() : qty;

    //upsert vì lần đầu nhập một sản phẩm vào kho thì chưa có dòng tồn nào
    const stock = await tx.stock.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: {
        productId,
        warehouseId,
        quantity: delta,
        avgCost: type === MovementType.IN ? appliedCost : new Prisma.Decimal(0),
      },
      update: { quantity: { increment: delta }, avgCost: newAvg },
    });

    //chặn tồn âm: xuất nhiều hơn số đang có là sai nghiệp vụ
    //ném lỗi ở đây khiến cả transaction bị huỷ, sổ nhật ký cũng không được ghi
    if (stock.quantity.lessThan(0)) {
      throw new ConflictException(
        `Không đủ tồn kho cho sản phẩm id ${productId} tại kho id ${warehouseId}`,
      );
    }

    return {
      productId,
      quantity: qty,
      unitCost: appliedCost,
      costAmount: qty.times(appliedCost),
    };
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
    const results: MovementResult[] = [];
    for (const line of lines) {
      results.push(
        await this.applyMovement(tx, {
          productId: line.productId,
          warehouseId,
          type,
          quantity: line.quantity,
          unitCost: line.unitCost,
          refType,
          refId,
        }),
      );
    }
    //trả về giá vốn đã áp dụng để đơn bán ghi lại vào từng dòng chi tiết
    return results;
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
