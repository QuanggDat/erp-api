import { Prisma } from '../generated/prisma/client';
import { MovementType } from '../generated/prisma/enums';

/**
 * TÍNH GIÁ VỐN HÀNG BÁN THEO BÌNH QUÂN GIA QUYỀN
 *
 * Toàn bộ công thức giá vốn của hệ thống nằm gọn trong file này. Tách riêng
 * khỏi StockService vì ba lý do:
 *   - Đọc một chỗ là hiểu hết cách tính, không lẫn với code ghi database
 *   - Kiểm chứng được độc lập, chỉ cần truyền số vào và so kết quả
 *   - Sau này đổi sang phương pháp khác (ví dụ nhập trước xuất trước) thì
 *     chỉ sửa file này, StockService không phải động tới
 *
 * NGUYÊN TẮC
 *   Nhập kho: trộn giá mới vào bình quân cũ theo trọng số SỐ LƯỢNG.
 *             Cộng TIỀN rồi chia lại cho tổng số lượng, không lấy trung
 *             bình hai đơn giá, vì lô nhiều hàng phải ảnh hưởng nhiều hơn.
 *
 *   Xuất kho: lấy đúng bình quân đang có làm giá vốn, và GIỮ NGUYÊN bình
 *             quân. Lấy 5 cái ra khỏi 20 cái đồng giá thì 15 cái còn lại
 *             vẫn đúng giá đó, giá trị trung bình không đổi.
 *
 * VÍ DỤ
 *   Nhập 10 cái giá 100.000  ->  bình quân 100.000
 *   Nhập 10 cái giá 200.000  ->  bình quân (10×100k + 10×200k) / 20 = 150.000
 *   Bán   5 cái              ->  giá vốn 5 × 150.000 = 750.000
 *                                bình quân vẫn 150.000
 *   Nhập  1 cái giá 500.000  ->  bình quân (15×150k + 1×500k) / 16 = 171.875
 *                                (chỉ nhích nhẹ vì lô mới có đúng 1 cái)
 *
 * Mọi phép tính dùng Prisma.Decimal chứ không dùng số thường, vì số dấu
 * phẩy động có sai số làm tròn và tiền tệ thì không được phép sai số.
 */

//Trạng thái kho trước khi ghi biến động, cùng thông tin của lần ghi này
export type CogsInput = {
  type: MovementType;
  qty: Prisma.Decimal; //số lượng của lần biến động, luôn dương
  currentQty: Prisma.Decimal; //tồn đang có trước khi ghi
  currentAvg: Prisma.Decimal; //đơn giá bình quân đang có
  //Giá mua thực tế, CHỈ dùng khi nhập kho. Bỏ trống khi xuất, hoặc khi
  //hoàn hàng bán về kho thì truyền lại đúng giá vốn đã xuất.
  unitCost?: Prisma.Decimal | number;
};

export type CogsResult = {
  //giá vốn áp dụng cho CHÍNH lần biến động này, ghi vào sổ nhật ký và
  //vào dòng chứng từ; đây là con số cố định vĩnh viễn
  appliedCost: Prisma.Decimal;
  //đơn giá bình quân MỚI của kho sau lần biến động, ghi vào bảng tồn;
  //con số này còn thay đổi theo các lần nhập sau
  newAvg: Prisma.Decimal;
};

export function tinhGiaVon(input: CogsInput): CogsResult {
  const { type, qty, currentQty, currentAvg, unitCost } = input;

  //--- XUẤT và ĐIỀU CHỈNH: lấy bình quân hiện tại, bình quân không đổi ---
  if (type !== MovementType.IN) {
    return { appliedCost: currentAvg, newAvg: currentAvg };
  }

  //--- NHẬP: giá vốn là giá mua thực tế ---
  //Không truyền giá thì giữ bình quân cũ. Trường hợp này xảy ra khi hoàn
  //hàng về kho mà bên gọi không biết giá vốn gốc.
  const appliedCost =
    unitCost !== undefined ? new Prisma.Decimal(unitCost) : currentAvg;

  const totalQty = currentQty.plus(qty);

  //Kho rỗng và nhập 0 cái thì không có gì để tính, chặn chia cho 0
  if (!totalQty.greaterThan(0)) {
    return { appliedCost, newAvg: currentAvg };
  }

  //Bình quân gia quyền: cộng TIỀN rồi chia cho tổng SỐ LƯỢNG
  //  totalValue = (số cũ × bình quân cũ) + (số nhập × giá nhập)
  const totalValue = currentQty.times(currentAvg).plus(qty.times(appliedCost));

  return { appliedCost, newAvg: totalValue.dividedBy(totalQty) };
}
