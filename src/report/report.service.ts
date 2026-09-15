import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetInventoryValueQueryDTO } from './dto';

const ZERO = () => new Prisma.Decimal(0);

@Injectable()
export class ReportService {
  constructor(private prismaService: PrismaService) {}

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
