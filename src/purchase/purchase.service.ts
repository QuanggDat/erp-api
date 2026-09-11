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
import {
  MovementType,
  OrderStatus,
  PartnerType,
} from '../generated/prisma/enums';
import { PartnerService } from '../partner/partner.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../warehouse/stock.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import {
  CreatePurchaseOrderDTO,
  GetPurchaseOrdersQueryDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderDTO,
} from './dto';

@Injectable()
export class PurchaseService {
  constructor(
    private prismaService: PrismaService,
    private partnerService: PartnerService,
    private warehouseService: WarehouseService,
    private stockService: StockService,
  ) {}

  async getPurchaseOrders(query: GetPurchaseOrdersQueryDTO) {
    const { page, limit, search, status, supplierId, warehouseId } = query;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(status && { status }),
      ...(supplierId !== undefined && { supplierId }),
      ...(warehouseId !== undefined && { warehouseId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.purchaseOrder.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prismaService.purchaseOrder.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getPurchaseOrderById(orderId: number) {
    const order = await this.prismaService.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        supplier: true,
        warehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn mua hàng');
    }
    return order;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDTO) {
    //kiểm tra mọi thứ TRƯỚC khi ghi, để không tạo ra đơn hỏng
    await this.partnerService.ensurePartnerIsValid(
      dto.supplierId,
      PartnerType.SUPPLIER,
    );
    await this.warehouseService.ensureWarehouseIsUsable(dto.warehouseId);
    await this.ensureProductsExist(dto.items);

    const { itemsData, totalAmount } = this.buildItems(dto.items);

    try {
      return await this.prismaService.purchaseOrder.create({
        data: {
          code: dto.code,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          note: dto.note,
          totalAmount,
          status: OrderStatus.DRAFT, //tạo ra luôn ở trạng thái nháp
          items: { create: itemsData },
        },
        include: { items: true },
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updatePurchaseOrder(orderId: number, dto: UpdatePurchaseOrderDTO) {
    const order = await this.getPurchaseOrderById(orderId);
    //đơn đã xác nhận là đã ghi kho, sửa sẽ làm sai tồn kho
    this.ensureDraft(order.status, 'sửa');

    if (dto.supplierId !== undefined) {
      await this.partnerService.ensurePartnerIsValid(
        dto.supplierId,
        PartnerType.SUPPLIER,
      );
    }
    if (dto.warehouseId !== undefined) {
      await this.warehouseService.ensureWarehouseIsUsable(dto.warehouseId);
    }

    //không gửi items thì giữ nguyên các dòng cũ và giữ nguyên tổng tiền
    if (dto.items === undefined) {
      return this.prismaService.purchaseOrder.update({
        where: { id: orderId },
        data: {
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          note: dto.note,
        },
        include: { items: true },
      });
    }

    await this.ensureProductsExist(dto.items);
    const { itemsData, totalAmount } = this.buildItems(dto.items);

    //xoá hết dòng cũ rồi tạo lại, đơn giản hơn nhiều so với so khớp từng dòng
    return this.prismaService.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: orderId },
      });
      return tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          note: dto.note,
          totalAmount,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });
  }

  //=====================================================================
  // XÁC NHẬN ĐƠN: đây là lúc hàng thực sự vào kho
  // đổi trạng thái và ghi kho phải nằm trong CÙNG một transaction,
  // nếu không sẽ có trường hợp đơn đã xác nhận mà kho chưa cộng
  //=====================================================================
  async confirmPurchaseOrder(orderId: number) {
    const order = await this.getPurchaseOrderById(orderId);
    this.ensureDraft(order.status, 'xác nhận');

    return this.prismaService.$transaction(async (tx) => {
      await this.stockService.applyMovements(tx, {
        warehouseId: order.warehouseId,
        type: MovementType.IN, //mua hàng là NHẬP kho
        lines: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          //giá mua thực tế của đơn này, dùng để tính lại đơn giá bình quân
          unitCost: item.unitPrice,
        })),
        refType: 'PURCHASE_ORDER',
        refId: order.id,
      });

      return tx.purchaseOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
        include: { items: true },
      });
    });
  }

  //huỷ đơn đã xác nhận phải trả hàng ra khỏi kho
  async cancelPurchaseOrder(orderId: number) {
    const order = await this.getPurchaseOrderById(orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Đơn mua hàng đã bị huỷ trước đó');
    }

    return this.prismaService.$transaction(async (tx) => {
      //đơn còn nháp thì chưa ghi kho, không cần đảo ngược gì
      if (order.status === OrderStatus.CONFIRMED) {
        await this.stockService.applyMovements(tx, {
          warehouseId: order.warehouseId,
          type: MovementType.OUT, //đảo ngược lần nhập trước đó
          lines: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          refType: 'PURCHASE_ORDER_CANCEL',
          refId: order.id,
        });
      }

      return tx.purchaseOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  //=========== CÁC HÀM PHỤ ===========

  //tính thành tiền từng dòng và tổng tiền của đơn
  //Decimal chứ không phải phép nhân số thực, tránh sai số làm tròn
  private buildItems(items: PurchaseOrderItemDTO[]) {
    let totalAmount = new Prisma.Decimal(0);
    const itemsData = items.map((item) => {
      const amount = new Prisma.Decimal(item.quantity).times(item.unitPrice);
      totalAmount = totalAmount.plus(amount);
      return {
        productId: item.productId,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: new Prisma.Decimal(item.unitPrice),
        amount,
      };
    });
    return { itemsData, totalAmount };
  }

  //một truy vấn duy nhất cho mọi sản phẩm, thay vì gọi lặp trong vòng lặp
  private async ensureProductsExist(items: PurchaseOrderItemDTO[]) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const found = await this.prismaService.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (found.length !== productIds.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Không tìm thấy sản phẩm có id ${missing.join(', ')}`,
      );
    }
  }

  private ensureDraft(status: OrderStatus, action: string) {
    if (status !== OrderStatus.DRAFT) {
      throw new ConflictException(
        `Chỉ ${action} được đơn ở trạng thái nháp, đơn này đang ở ${status}`,
      );
    }
  }

  private handleUniqueCodeError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Số phiếu ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
