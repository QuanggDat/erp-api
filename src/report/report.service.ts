import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GetProfitReportQueryDTO } from './dto';

const ZERO = () => new Prisma.Decimal(0);

//Tỷ suất lãi gộp tính theo phần trăm doanh thu. Doanh thu bằng 0 thì trả 0
//thay vì chia cho 0.
function marginPercent(revenue: Prisma.Decimal, profit: Prisma.Decimal) {
  if (revenue.isZero()) return 0;
  return Number(profit.dividedBy(revenue).times(100).toFixed(2));
}

@Injectable()
export class ReportService {
  constructor(private prismaService: PrismaService) {}

  //=====================================================================
  // BÁO CÁO LÃI LỖ
  // Chỉ tính đơn đã XÁC NHẬN: đơn nháp chưa xuất kho nên chưa có giá vốn,
  // đơn huỷ thì hàng đã quay lại kho nên không phát sinh doanh thu.
  //=====================================================================
  async getProfitReport(query: GetProfitReportQueryDTO) {
    const where = this.buildWhere(query);

    const orders = await this.prismaService.salesOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: {
        customer: { select: { id: true, code: true, name: true } },
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

    //--- tổng toàn kỳ ---
    let revenue = ZERO();
    let cost = ZERO();

    //--- gom theo sản phẩm, để biết mặt hàng nào lãi nhiều nhất ---
    const byProduct = new Map<
      number,
      {
        productId: number;
        code: string;
        name: string;
        unit: string;
        quantity: Prisma.Decimal;
        revenue: Prisma.Decimal;
        cost: Prisma.Decimal;
      }
    >();

    const orderRows = orders.map((order) => {
      const orderRevenue = order.totalAmount;
      const orderCost = order.totalCost;
      revenue = revenue.plus(orderRevenue);
      cost = cost.plus(orderCost);

      for (const item of order.items) {
        const entry = byProduct.get(item.productId) ?? {
          productId: item.productId,
          code: item.product.code,
          name: item.product.name,
          unit: item.product.unit,
          quantity: ZERO(),
          revenue: ZERO(),
          cost: ZERO(),
        };
        entry.quantity = entry.quantity.plus(item.quantity);
        entry.revenue = entry.revenue.plus(item.amount);
        entry.cost = entry.cost.plus(item.costAmount);
        byProduct.set(item.productId, entry);
      }

      const orderProfit = orderRevenue.minus(orderCost);
      return {
        id: order.id,
        code: order.code,
        orderDate: order.orderDate,
        customer: order.customer,
        warehouse: order.warehouse,
        revenue: orderRevenue,
        cost: orderCost,
        profit: orderProfit,
        marginPercent: marginPercent(orderRevenue, orderProfit),
      };
    });

    const products = [...byProduct.values()]
      .map((p) => {
        const profit = p.revenue.minus(p.cost);
        return {
          ...p,
          profit,
          marginPercent: marginPercent(p.revenue, profit),
        };
      })
      //mặt hàng lãi nhiều nhất lên đầu, đây là thứ người dùng muốn thấy trước
      .sort((a, b) => (b.profit.greaterThan(a.profit) ? 1 : -1));

    const profit = revenue.minus(cost);

    return {
      summary: {
        orderCount: orders.length,
        revenue,
        cost,
        profit,
        marginPercent: marginPercent(revenue, profit),
      },
      products,
      orders: orderRows,
    };
  }

  private buildWhere(
    query: GetProfitReportQueryDTO,
  ): Prisma.SalesOrderWhereInput {
    const { fromDate, toDate, customerId, warehouseId } = query;

    //toDate bao gồm trọn ngày đó: cộng thêm một ngày rồi so sánh nhỏ hơn,
    //nếu dùng lte với 00:00 thì đơn lập buổi chiều sẽ bị bỏ sót
    let toExclusive: Date | undefined;
    if (toDate) {
      toExclusive = new Date(toDate);
      toExclusive.setDate(toExclusive.getDate() + 1);
    }

    return {
      status: OrderStatus.CONFIRMED,
      ...(customerId !== undefined && { customerId }),
      ...(warehouseId !== undefined && { warehouseId }),
      ...((fromDate || toDate) && {
        orderDate: {
          ...(fromDate && { gte: new Date(fromDate) }),
          ...(toExclusive && { lt: toExclusive }),
        },
      }),
    };
  }
}
