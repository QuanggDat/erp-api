import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GetCogsReportQueryDTO } from './dto';

const ZERO = () => new Prisma.Decimal(0);

@Injectable()
export class ReportService {
  constructor(private prismaService: PrismaService) {}

  //=====================================================================
  // BÁO CÁO GIÁ VỐN THEO SẢN PHẨM
  //
  // Trả về mỗi sản phẩm một dòng: đã bán bao nhiêu và giá vốn bao nhiêu
  // trong tháng được chọn.
  //
  // Chỉ tính đơn đã XÁC NHẬN. Đơn nháp chưa xuất kho nên chưa có giá vốn,
  // đơn huỷ thì hàng đã quay lại kho.
  //=====================================================================
  async getCogsReport(query: GetCogsReportQueryDTO) {
    const items = await this.prismaService.salesOrderItem.findMany({
      where: {
        salesOrder: this.buildOrderFilter(query),
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
      },
    });

    //gom nhiều dòng của cùng một sản phẩm lại thành một
    const theoSanPham = new Map<
      number,
      {
        productId: number;
        code: string;
        name: string;
        unit: string;
        quantity: Prisma.Decimal; //tổng số lượng đã bán
        cost: Prisma.Decimal; //tổng giá vốn
      }
    >();

    let tongGiaVon = ZERO();
    let tongSoLuong = ZERO();

    for (const item of items) {
      const dong = theoSanPham.get(item.productId) ?? {
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        unit: item.product.unit,
        quantity: ZERO(),
        cost: ZERO(),
      };
      dong.quantity = dong.quantity.plus(item.quantity);
      dong.cost = dong.cost.plus(item.costAmount);
      theoSanPham.set(item.productId, dong);

      tongSoLuong = tongSoLuong.plus(item.quantity);
      tongGiaVon = tongGiaVon.plus(item.costAmount);
    }

    const products = [...theoSanPham.values()]
      .map((p) => ({
        ...p,
        //đơn giá vốn bình quân của sản phẩm trong kỳ, tiện đối chiếu
        unitCost: p.quantity.isZero()
          ? ZERO()
          : p.cost.dividedBy(p.quantity).toDecimalPlaces(2),
      }))
      //sản phẩm tốn nhiều vốn nhất lên đầu, đây là thứ cần nhìn trước
      .sort((a, b) => (b.cost.greaterThan(a.cost) ? 1 : -1));

    return {
      summary: {
        productCount: products.length,
        quantity: tongSoLuong,
        cost: tongGiaVon,
      },
      products,
      //danh sách tháng có phát sinh, để giao diện dựng ô chọn tháng
      months: await this.getAvailableMonths(),
    };
  }

  //Điều kiện lọc đơn bán: luôn chỉ lấy đơn đã xác nhận, kèm tháng và kho
  private buildOrderFilter(
    query: GetCogsReportQueryDTO,
  ): Prisma.SalesOrderWhereInput {
    const { month, warehouseId } = query;

    let orderDate: Prisma.DateTimeFilter | undefined;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      orderDate = {
        gte: new Date(Date.UTC(y, m - 1, 1)), //đầu tháng
        lt: new Date(Date.UTC(y, m, 1)), //đầu tháng SAU
      };
    }

    return {
      status: OrderStatus.CONFIRMED,
      ...(warehouseId !== undefined && { warehouseId }),
      ...(orderDate && { orderDate }),
    };
  }

  //Các tháng có đơn đã xác nhận, dạng YYYY-MM, mới nhất trước.
  //Chỉ lấy tháng thật sự có dữ liệu để người dùng không chọn phải tháng rỗng.
  private async getAvailableMonths(): Promise<string[]> {
    const rows = await this.prismaService.salesOrder.findMany({
      where: { status: OrderStatus.CONFIRMED },
      select: { orderDate: true },
      orderBy: { orderDate: 'desc' },
    });

    const set = new Set<string>();
    for (const r of rows) {
      const y = r.orderDate.getUTCFullYear();
      const m = String(r.orderDate.getUTCMonth() + 1).padStart(2, '0');
      set.add(`${y}-${m}`);
    }
    return [...set];
  }
}
