import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GetPurchaseCostMonthlyQueryDTO } from './dto';

const ZERO = () => new Prisma.Decimal(0);

//Đổi một mốc thời gian thành nhãn tháng dạng YYYY-MM
const nhanThang = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

@Injectable()
export class ReportService {
  constructor(private prismaService: PrismaService) {}

  //=====================================================================
  // BÁO CÁO GIÁ MUA BÌNH QUÂN GIA QUYỀN THEO SẢN PHẨM VÀ THÁNG
  //
  // Mỗi dòng là một cặp sản phẩm và tháng: tháng đó nhập về bao nhiêu hàng,
  // trả bao nhiêu tiền, và đơn giá bình quân là bao nhiêu. Một sản phẩm
  // nhập ở ba tháng thì có ba dòng.
  //
  // BÌNH QUÂN GIA QUYỀN CUỐI KỲ: đơn giá của tháng bằng tổng TIỀN mua chia
  // tổng SỐ LƯỢNG mua trong tháng đó. Không lấy trung bình cộng đơn giá của
  // các phiếu nhập, vì phiếu nhập 1000 cái phải nặng ký hơn phiếu nhập 1 cái.
  //
  //   Nhập 10 cái giá 100.000 và 30 cái giá 200.000
  //   -> đúng:  (10×100k + 30×200k) / 40 = 175.000
  //   -> sai:   (100k + 200k) / 2        = 150.000
  //
  // Khác với giá vốn hàng bán ở chỗ báo cáo này nhìn từ phía MUA VÀO. Nó
  // trả lời "tháng này mua hàng đắt hay rẻ", không trả lời "bán hàng lãi
  // bao nhiêu". Phần hàng đã bán xem ở báo cáo giá vốn, phần hàng còn trong
  // kho xem ở báo cáo giá trị tồn kho.
  //
  // Chỉ tính đơn đã XÁC NHẬN: đơn nháp chưa nhập kho, đơn huỷ thì hàng
  // không về.
  //=====================================================================
  async getPurchaseCostMonthly(query: GetPurchaseCostMonthlyQueryDTO) {
    const { month, productId, search, warehouseId } = query;

    //Lấy từ dòng chứng từ chứ không từ đơn mua, vì đơn giá nằm ở mức sản
    //phẩm: một phiếu nhập nhiều mặt hàng thì mỗi mặt hàng một giá riêng.
    //
    //Cố ý KHÔNG lọc theo month ở đây: cần đủ dữ liệu các tháng trước để
    //tháng không nhập hàng còn kế thừa được đơn giá. Lọc tháng làm ở cuối.
    const items = await this.prismaService.purchaseOrderItem.findMany({
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
        purchaseOrder: {
          //CONFIRMED là điều kiện cố định, không phải bộ lọc tuỳ chọn
          status: OrderStatus.CONFIRMED,
          ...(warehouseId !== undefined && { warehouseId }),
        },
      },
      include: {
        //lấy kèm thông tin sản phẩm để khỏi phải truy vấn thêm lần nữa
        product: { select: { id: true, code: true, name: true, unit: true } },
        //orderDate nằm ở đơn, không nằm ở dòng, nhưng lại là thứ quyết định
        //dòng này thuộc tháng nào
        purchaseOrder: { select: { orderDate: true } },
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
        amount: Prisma.Decimal;
      }
    >();

    for (const item of items) {
      const thang = nhanThang(item.purchaseOrder.orderDate);
      const key = `${thang}|${item.productId}`;

      //chưa có dòng cho cặp này thì mở dòng mới với số 0
      const dong = gom.get(key) ?? {
        month: thang,
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        unit: item.product.unit,
        quantity: ZERO(),
        amount: ZERO(),
      };
      dong.quantity = dong.quantity.plus(item.quantity);
      dong.amount = dong.amount.plus(item.amount);
      gom.set(key, dong);
    }

    //Bù đơn giá cho tháng không nhập hàng, trước khi lọc tháng. Xem chú
    //thích ở buDonGiaThangTrong để biết vì sao phải làm bước này.
    const tatCa = this.buDonGiaThangTrong([...gom.values()]);

    //Lọc tháng ở cuối cùng: các bước trên cần nhìn toàn bộ lịch sử, còn
    //người dùng chỉ muốn xem một tháng.
    const rows = month ? tatCa.filter((r) => r.month === month) : tatCa;

    //Tổng chỉ cộng phần thực mua. Dòng kế thừa có quantity và amount bằng 0
    //nên không làm sai tổng, nhưng vẫn cộng tường minh cho rõ ý.
    let tongTienMua = ZERO();
    let tongSoLuong = ZERO();
    for (const r of rows) {
      tongSoLuong = tongSoLuong.plus(r.quantity);
      tongTienMua = tongTienMua.plus(r.amount);
    }

    return {
      summary: {
        //số cặp tháng-sản phẩm, không phải số sản phẩm riêng biệt
        rowCount: rows.length,
        quantity: tongSoLuong,
        amount: tongTienMua,
        //đơn giá bình quân chung của cả báo cáo, cũng chia tiền cho lượng
        avgUnitCost: tongSoLuong.isZero()
          ? ZERO()
          : tongTienMua.dividedBy(tongSoLuong).toDecimalPlaces(2),
      },
      rows,
      //tổng tiền mua từng tháng, để nhìn nhanh tháng nào nhập nhiều nhất
      byMonth: this.gomTheoThang(rows),
      //danh sách tháng có phát sinh, dựng ô chọn tháng ở giao diện
      months: [...new Set(tatCa.map((r) => r.month))].sort((a, b) =>
        b.localeCompare(a),
      ),
    };
  }

  //=====================================================================
  // BÙ ĐƠN GIÁ CHO THÁNG KHÔNG NHẬP HÀNG
  //
  // Tháng 10 không nhập lô nào thì vẫn cần biết đơn giá, vì hàng bán ra
  // tháng 10 chính là hàng đã mua từ trước. Bỏ trống dòng đó sẽ làm biểu đồ
  // giá đứt quãng và người xem tưởng giá về 0.
  //
  // Cách bù: lấy đơn giá của tháng gần nhất CÓ nhập, kéo sang các tháng
  // trống phía sau, cho tới khi gặp tháng có nhập tiếp theo.
  //
  //   T9  nhập 10 @ 100k  -> đơn giá 100k  (thực mua)
  //   T10 không nhập      -> đơn giá 100k  (kế thừa từ T9)
  //   T11 không nhập      -> đơn giá 100k  (vẫn kế thừa T9)
  //   T12 nhập 5 @ 120k   -> đơn giá 120k  (thực mua)
  //
  // Dòng kế thừa có quantity và amount bằng 0, kèm cờ isCarriedOver để
  // giao diện hiển thị nhạt màu hoặc chú thích, tránh hiểu nhầm là đã mua.
  //
  // Chỉ bù các tháng NẰM GIỮA hai lần nhập và tới tháng nhập cuối cùng.
  // Không bù ra tương lai vì không biết báo cáo dừng ở đâu, cũng không bù
  // ngược về quá khứ vì trước lần nhập đầu tiên thì sản phẩm chưa tồn tại.
  //=====================================================================
  private buDonGiaThangTrong(
    rows: {
      month: string;
      productId: number;
      code: string;
      name: string;
      unit: string;
      quantity: Prisma.Decimal;
      amount: Prisma.Decimal;
    }[],
  ) {
    //tách theo sản phẩm, vì mỗi sản phẩm có lịch sử nhập riêng
    const theoSanPham = new Map<number, typeof rows>();
    for (const r of rows) {
      const ds = theoSanPham.get(r.productId) ?? [];
      ds.push(r);
      theoSanPham.set(r.productId, ds);
    }

    const ketQua: ((typeof rows)[number] & {
      unitCost: Prisma.Decimal;
      isCarriedOver: boolean;
    })[] = [];

    for (const ds of theoSanPham.values()) {
      //duyệt từ tháng cũ tới tháng mới, để đơn giá chảy xuôi theo thời gian
      ds.sort((a, b) => a.month.localeCompare(b.month));

      let thangTruoc: string | null = null;
      let donGiaGanNhat = ZERO();

      for (const r of ds) {
        //chèn các tháng trống nằm giữa tháng trước và tháng này
        if (thangTruoc) {
          for (const thangTrong of this.cacThangGiua(thangTruoc, r.month)) {
            ketQua.push({
              ...r,
              month: thangTrong,
              quantity: ZERO(),
              amount: ZERO(),
              unitCost: donGiaGanNhat,
              isCarriedOver: true,
            });
          }
        }

        //tháng có nhập thật: đơn giá bình quân gia quyền của riêng tháng đó
        donGiaGanNhat = r.quantity.isZero()
          ? donGiaGanNhat
          : r.amount.dividedBy(r.quantity).toDecimalPlaces(2);

        ketQua.push({ ...r, unitCost: donGiaGanNhat, isCarriedOver: false });
        thangTruoc = r.month;
      }
    }

    //tháng mới nhất lên đầu; trong cùng tháng thì hàng mua nhiều tiền trước
    return ketQua.sort((a, b) =>
      a.month === b.month
        ? b.amount.greaterThan(a.amount)
          ? 1
          : -1
        : b.month.localeCompare(a.month),
    );
  }

  //Liệt kê các tháng nằm GIỮA hai mốc, không gồm hai đầu.
  //Ví dụ ('2026-09', '2026-12') trả về ['2026-10', '2026-11'].
  private cacThangGiua(tu: string, den: string): string[] {
    const [ty, tm] = tu.split('-').map(Number);
    const [dy, dm] = den.split('-').map(Number);

    const ketQua: string[] = [];
    //đếm tháng bằng tổng số tháng kể từ năm 0, để khỏi xử lý chuyện qua năm
    const mocDau = ty * 12 + (tm - 1);
    const mocCuoi = dy * 12 + (dm - 1);

    for (let i = mocDau + 1; i < mocCuoi; i++) {
      const nam = Math.floor(i / 12);
      const thang = (i % 12) + 1;
      ketQua.push(`${nam}-${String(thang).padStart(2, '0')}`);
    }
    return ketQua;
  }

  //Cộng tiền mua của mọi sản phẩm trong cùng một tháng
  private gomTheoThang(
    rows: { month: string; amount: Prisma.Decimal }[],
  ): { month: string; amount: Prisma.Decimal }[] {
    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      map.set(r.month, (map.get(r.month) ?? ZERO()).plus(r.amount));
    }
    return [...map.entries()]
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }
}
