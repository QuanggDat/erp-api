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
  CreateSalesOrderDTO,
  GetSalesOrdersQueryDTO,
  SalesOrderItemDTO,
  UpdateSalesOrderDTO,
} from './dto';

@Injectable()
export class SalesService {
  constructor(
    private prismaService: PrismaService,
    private partnerService: PartnerService,
    private warehouseService: WarehouseService,
    private stockService: StockService,
  ) {}

  async getSalesOrders(query: GetSalesOrdersQueryDTO) {
    const { page, limit, search, status, customerId, warehouseId } = query;

    const where: Prisma.SalesOrderWhereInput = {
      ...(status && { status }),
      ...(customerId !== undefined && { customerId }),
      ...(warehouseId !== undefined && { warehouseId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.salesOrder.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prismaService.salesOrder.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getSalesOrderById(orderId: number) {
    const order = await this.prismaService.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
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
      throw new NotFoundException('Không tìm thấy đơn bán hàng');
    }
    return order;
  }

  async createSalesOrder(dto: CreateSalesOrderDTO) {
    await this.partnerService.ensurePartnerIsValid(
      dto.customerId,
      PartnerType.CUSTOMER,
    );
    await this.warehouseService.ensureWarehouseIsUsable(dto.warehouseId);

    const { itemsData, totalAmount } = await this.buildItems(dto.items);

    try {
      return await this.prismaService.salesOrder.create({
        data: {
          code: dto.code,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          note: dto.note,
          totalAmount,
          status: OrderStatus.DRAFT,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updateSalesOrder(orderId: number, dto: UpdateSalesOrderDTO) {
    const order = await this.getSalesOrderById(orderId);
    this.ensureDraft(order.status, 'sửa');

    if (dto.customerId !== undefined) {
      await this.partnerService.ensurePartnerIsValid(
        dto.customerId,
        PartnerType.CUSTOMER,
      );
    }
    if (dto.warehouseId !== undefined) {
      await this.warehouseService.ensureWarehouseIsUsable(dto.warehouseId);
    }

    if (dto.items === undefined) {
      return this.prismaService.salesOrder.update({
        where: { id: orderId },
        data: {
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          note: dto.note,
        },
        include: { items: true },
      });
    }

    const { itemsData, totalAmount } = await this.buildItems(dto.items);

    return this.prismaService.$transaction(async (tx) => {
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId: orderId } });
      return tx.salesOrder.update({
        where: { id: orderId },
        data: {
          customerId: dto.customerId,
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
  // XÁC NHẬN ĐƠN BÁN: hàng rời kho tại đây
  // StockService.applyMovement tự chặn tồn âm, nếu không đủ hàng thì
  // toàn bộ transaction bị huỷ và đơn vẫn ở trạng thái nháp
  //=====================================================================
  async confirmSalesOrder(orderId: number) {
    const order = await this.getSalesOrderById(orderId);
    this.ensureDraft(order.status, 'xác nhận');

    return this.prismaService.$transaction(async (tx) => {
      //applyMovements trả về đơn giá vốn bình quân đã áp dụng cho từng dòng
      const results = await this.stockService.applyMovements(tx, {
        warehouseId: order.warehouseId,
        type: MovementType.OUT, //bán hàng là XUẤT kho
        lines: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        refType: 'SALES_ORDER',
        refId: order.id,
      });

      //Ghi giá vốn vào từng dòng chi tiết. Chép lại tại đây chứ không tính
      //lúc đọc, vì đơn giá bình quân của kho còn đổi theo các lần nhập sau,
      //còn giá vốn của đơn đã bán thì phải cố định.
      let totalCost = new Prisma.Decimal(0);
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const result = results[i];
        totalCost = totalCost.plus(result.costAmount);
        await tx.salesOrderItem.update({
          where: { id: item.id },
          data: {
            unitCost: result.unitCost,
            costAmount: result.costAmount,
          },
        });
      }

      return tx.salesOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED, totalCost },
        include: { items: true },
      });
    });
  }

  //huỷ đơn đã xác nhận thì hàng quay lại kho
  async cancelSalesOrder(orderId: number) {
    const order = await this.getSalesOrderById(orderId);
    if (order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Đơn bán hàng đã bị huỷ trước đó');
    }

    return this.prismaService.$transaction(async (tx) => {
      if (order.status === OrderStatus.CONFIRMED) {
        await this.stockService.applyMovements(tx, {
          warehouseId: order.warehouseId,
          type: MovementType.IN, //đảo ngược lần xuất trước đó
          lines: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            //trả về kho đúng giá vốn đã xuất, nếu đưa giá khác thì đơn giá
            //bình quân của kho sẽ lệch sau khi huỷ đơn
            unitCost: item.unitCost,
          })),
          refType: 'SALES_ORDER_CANCEL',
          refId: order.id,
        });
      }

      return tx.salesOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  //=========== CÁC HÀM PHỤ ===========

  //khác bên mua: đơn giá có thể bỏ trống, khi đó lấy giá niêm yết của sản phẩm
  //một truy vấn lấy hết sản phẩm, vừa để kiểm tra tồn tại vừa để lấy giá
  private async buildItems(items: SalesOrderItemDTO[]) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prismaService.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, salePrice: true },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Không tìm thấy sản phẩm có id ${missing.join(', ')}`,
      );
    }

    const priceById = new Map(products.map((p) => [p.id, p.salePrice]));

    let totalAmount = new Prisma.Decimal(0);
    const itemsData = items.map((item) => {
      //giá được chép lại tại đây, sau này sản phẩm đổi giá thì đơn cũ không đổi
      const unitPrice =
        item.unitPrice !== undefined
          ? new Prisma.Decimal(item.unitPrice)
          : (priceById.get(item.productId) as Prisma.Decimal);
      const amount = new Prisma.Decimal(item.quantity).times(unitPrice);
      totalAmount = totalAmount.plus(amount);
      return {
        productId: item.productId,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice,
        amount,
      };
    });

    return { itemsData, totalAmount };
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
