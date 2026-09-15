import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GetCogsMonthlyQueryDTO, GetInventoryValueQueryDTO } from './dto';

const ZERO = () => new Prisma.Decimal(0);

//Đổi một mốc thời gian thành nhãn tháng dạng YYYY-MM
const nhanThang = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

@Injectable()
export class ReportService {
  constructor(private prismaService: PrismaService) {}

  //=====================================================================
  // BÁO CÁO GIÁ VỐN THEO SẢN PHẨM VÀ THÁNG
  //
  // Mỗi dòng là một cặp sản phẩm và tháng: tháng đó bán bao nhiêu và tốn
  // bao nhiêu tiền vốn. Một sản phẩm bán ở ba tháng thì có ba dòng.
  //
  // Giá vốn KHÔNG tính lại ở đây. Nó đã được chốt lúc xác nhận đơn, khi
  // hàng thật sự rời kho, và lưu vào costAmount của dòng chứng từ. Báo cáo
  // chỉ lọc rồi cộng, nhờ vậy số liệu tháng cũ không đổi khi giá nhập sau
  // này thay đổi.
  //
  // Chỉ tính đơn đã XÁC NHẬN: đơn nháp chưa xuất kho nên chưa có giá vốn,
  // đơn huỷ thì hàng đã quay lại kho.
  //=====================================================================
  async getCogsMonthly(query: GetCogsMonthlyQueryDTO) {
    const { month, productId, search, warehouseId } = query;

    const items = await this.prismaService.salesOrderItem.findMany({
      where: {
        //productId ưu tiên hơn search: chọn đúng một sản phẩm thì bỏ qua từ khoá
        ...(productId !== undefined
          ? { productId }
          : search && {
              product: {
                OR: [
                  { code: { contains: search, mode: 'insensitive' } },
                  { name: { contains: search, mode: 'insensitive' } },
                ],
              },
            }),
        salesOrder: {
          status: OrderStatus.CONFIRMED,
          ...(warehouseId !== undefined && { warehouseId }),
          ...(month && { orderDate: this.khoangThang(month) }),
        },
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        salesOrder: { select: { orderDate: true } },
      },
    });

    //gom theo cặp (tháng, sản phẩm)
    const gom = new Map<
      string,
      {
        month: string;
        productId: number;
        code: string;
        name: string;
        unit: string;
        quantity: Prisma.Decimal;
        cost: Prisma.Decimal;
      }
    >();

    let tongGiaVon = ZERO();
    let tongSoLuong = ZERO();

    for (const item of items) {
      const thang = nhanThang(item.salesOrder.orderDate);
      const key = `${thang}|${item.productId}`;

      const dong = gom.get(key) ?? {
        month: thang,
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        unit: item.product.unit,
        quantity: ZERO(),
        cost: ZERO(),
      };
      dong.quantity = dong.quantity.plus(item.quantity);
      dong.cost = dong.cost.plus(item.costAmount);
      gom.set(key, dong);

      tongSoLuong = tongSoLuong.plus(item.quantity);
      tongGiaVon = tongGiaVon.plus(item.costAmount);
    }

    const rows = [...gom.values()]
      .map((r) => ({
        ...r,
        //đơn giá vốn bình quân của sản phẩm trong tháng đó
        unitCost: r.quantity.isZero()
          ? ZERO()
          : r.cost.dividedBy(r.quantity).toDecimalPlaces(2),
      }))
      //tháng mới nhất lên đầu; trong cùng tháng thì hàng tốn nhiều vốn trước
      .sort((a, b) =>
        a.month === b.month
          ? b.cost.greaterThan(a.cost)
            ? 1
            : -1
          : b.month.localeCompare(a.month),
      );

    return {
      summary: {
        rowCount: rows.length,
        quantity: tongSoLuong,
        cost: tongGiaVon,
      },
      rows,
      //tổng giá vốn từng tháng, để nhìn nhanh tháng nào tốn nhiều vốn nhất
      byMonth: this.gomTheoThang(rows),
      //danh sách tháng có phát sinh, dựng ô chọn tháng ở giao diện
      months: await this.getAvailableMonths(),
    };
  }

  //Cộng giá vốn của mọi sản phẩm trong cùng một tháng
  private gomTheoThang(
    rows: { month: string; cost: Prisma.Decimal }[],
  ): { month: string; cost: Prisma.Decimal }[] {
    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      map.set(r.month, (map.get(r.month) ?? ZERO()).plus(r.cost));
    }
    return [...map.entries()]
      .map(([month, cost]) => ({ month, cost }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  //Khoảng thời gian của một tháng: từ đầu tháng tới trước đầu tháng sau.
  //Dùng lt với đầu tháng sau thay vì lte với cuối tháng, để khỏi phải biết
  //tháng có 28, 30 hay 31 ngày và không bỏ sót đơn lập buổi chiều cuối tháng.
  private khoangThang(month: string): Prisma.DateTimeFilter {
    const [y, m] = month.split('-').map(Number);
    return {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  //Các tháng có đơn đã xác nhận, dạng YYYY-MM, mới nhất trước
  private async getAvailableMonths(): Promise<string[]> {
    const rows = await this.prismaService.salesOrder.findMany({
      where: { status: OrderStatus.CONFIRMED },
      select: { orderDate: true },
      orderBy: { orderDate: 'desc' },
    });

    const set = new Set<string>();
    for (const r of rows) set.add(nhanThang(r.orderDate));
    return [...set];
  }

  //=====================================================================
  // BÁO CÁO GIÁ TRỊ TỒN KHO
  //
  // Trả lời câu hỏi: kho đang giữ bao nhiêu tiền hàng.
  //
  // Mỗi dòng là một cặp sản phẩm và kho, kèm giá trị bằng tiền tính theo
  // đơn giá bình quân gia quyền đang lưu ở bảng tồn.
  //
  // Đây là số liệu TẠI THỜI ĐIỂM XEM, không phải số của một kỳ đã qua.
  // Tồn kho luôn phản ánh hiện trạng mới nhất sau mọi lần nhập xuất.
  //=====================================================================
  async getInventoryValue(query: GetInventoryValueQueryDTO) {
    const { warehouseId, search, includeZero } = query;

    const rows = await this.prismaService.stock.findMany({
      where: {
        ...(warehouseId !== undefined && { warehouseId }),
        //mặc định ẩn dòng tồn bằng 0: sản phẩm đã bán hết không còn giá trị
        //nên để trong bảng chỉ làm loãng thông tin
        ...(!includeZero && { quantity: { not: 0 } }),
        ...(search && {
          product: {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          },
        }),
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    let tongGiaTri = ZERO();
    let soDongTonAm = 0;

    const items = rows.map((r) => {
      //giá trị tồn = số lượng nhân đơn giá bình quân
      const value = r.quantity.times(r.avgCost).toDecimalPlaces(2);
      tongGiaTri = tongGiaTri.plus(value);
      if (r.quantity.lessThan(0)) soDongTonAm++;

      return {
        productId: r.productId,
        code: r.product.code,
        name: r.product.name,
        unit: r.product.unit,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse.name,
        quantity: r.quantity,
        avgCost: r.avgCost,
        value,
        updatedAt: r.updatedAt,
      };
    });

    //hàng chiếm nhiều vốn nhất lên đầu, đây là thứ cần nhìn trước
    items.sort((a, b) => (b.value.greaterThan(a.value) ? 1 : -1));

    return {
      summary: {
        //số cặp sản phẩm-kho, không phải số sản phẩm riêng biệt
        lineCount: items.length,
        totalValue: tongGiaTri,
        //cảnh báo: tồn âm là sai sót cần xử lý ngay, không phải chuyện bình thường
        negativeCount: soDongTonAm,
      },
      items,
      //giá trị tồn gom theo từng kho, để biết kho nào đang giữ nhiều vốn nhất
      byWarehouse: this.gomTheoKho(items),
    };
  }

  //Gom giá trị tồn theo kho. Một sản phẩm nằm ở nhiều kho thì mỗi kho
  //tính riêng, vì đây là câu hỏi "kho nào giữ bao nhiêu tiền".
  private gomTheoKho(
    items: {
      warehouseId: number;
      warehouseName: string;
      value: Prisma.Decimal;
    }[],
  ) {
    const map = new Map<
      number,
      { warehouseId: number; warehouseName: string; value: Prisma.Decimal }
    >();

    for (const it of items) {
      const cur = map.get(it.warehouseId) ?? {
        warehouseId: it.warehouseId,
        warehouseName: it.warehouseName,
        value: ZERO(),
      };
      cur.value = cur.value.plus(it.value);
      map.set(it.warehouseId, cur);
    }

    return [...map.values()].sort((a, b) =>
      b.value.greaterThan(a.value) ? 1 : -1,
    );
  }
}
