/**
 * Script nạp dữ liệu mẫu cho hệ thống ERP.
 *
 * Chạy:  DATABASE_URL="..." node prisma/seed.js
 *
 * Script chạy lại được nhiều lần: danh mục dùng upsert theo mã duy nhất nên
 * không sinh dữ liệu trùng. Riêng tồn kho và chứng từ được dựng lại từ đầu
 * để số liệu luôn khớp nhau.
 *
 * Nguyên tắc tôn trọng nghiệp vụ của hệ thống:
 * - Tồn kho (Stock) là số liệu dẫn xuất, chỉ thay đổi qua StockMovement.
 * - Đơn CONFIRMED mới ghi kho; đơn DRAFT và CANCELLED thì không.
 * - Đơn giá trên dòng chứng từ được chép lại tại thời điểm lập, không trỏ
 *   sang giá hiện tại của sản phẩm.
 */
const ROOT = __dirname + '/..';
const { PrismaPg } = require(ROOT + '/node_modules/@prisma/adapter-pg');
const { PrismaClient } = require(ROOT + '/dist/generated/prisma/client.js');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const d = (s) => new Date(s);

// ---------- DANH MỤC NỀN ----------

const CATEGORIES = [
  { code: 'NH001', name: 'Bàn ghế văn phòng' },
  { code: 'NH002', name: 'Thiết bị điện tử' },
  { code: 'NH003', name: 'Văn phòng phẩm' },
  { code: 'NH004', name: 'Thiết bị mạng' },
  { code: 'NH005', name: 'Đồ dùng nhà bếp' },
];

const PRODUCTS = [
  { code: 'SP001', name: 'Bàn làm việc gỗ công nghiệp 1m2', unit: 'Cái', cat: 'NH001', purchasePrice: 1200000, salePrice: 1750000 },
  { code: 'SP002', name: 'Ghế xoay văn phòng lưng lưới', unit: 'Cái', cat: 'NH001', purchasePrice: 850000, salePrice: 1290000 },
  { code: 'SP003', name: 'Tủ hồ sơ sắt 4 ngăn', unit: 'Cái', cat: 'NH001', purchasePrice: 2100000, salePrice: 2950000 },
  { code: 'SP004', name: 'Bàn họp oval 8 chỗ', unit: 'Cái', cat: 'NH001', purchasePrice: 4500000, salePrice: 6200000 },
  { code: 'SP005', name: 'Màn hình LCD 24 inch', unit: 'Cái', cat: 'NH002', purchasePrice: 2400000, salePrice: 3190000 },
  { code: 'SP006', name: 'Bàn phím cơ không dây', unit: 'Cái', cat: 'NH002', purchasePrice: 680000, salePrice: 990000 },
  { code: 'SP007', name: 'Chuột quang không dây', unit: 'Cái', cat: 'NH002', purchasePrice: 180000, salePrice: 320000 },
  { code: 'SP008', name: 'Máy in laser đen trắng', unit: 'Cái', cat: 'NH002', purchasePrice: 3200000, salePrice: 4350000 },
  { code: 'SP009', name: 'Máy chiếu HD 3500 lumen', unit: 'Cái', cat: 'NH002', purchasePrice: 8900000, salePrice: 11500000 },
  { code: 'SP010', name: 'Giấy A4 định lượng 70gsm', unit: 'Ram', cat: 'NH003', purchasePrice: 62000, salePrice: 89000 },
  { code: 'SP011', name: 'Bút bi xanh', unit: 'Hộp', cat: 'NH003', purchasePrice: 45000, salePrice: 72000 },
  { code: 'SP012', name: 'Sổ tay bìa cứng A5', unit: 'Quyển', cat: 'NH003', purchasePrice: 28000, salePrice: 55000 },
  { code: 'SP013', name: 'Bìa còng A4 7cm', unit: 'Cái', cat: 'NH003', purchasePrice: 32000, salePrice: 58000 },
  { code: 'SP014', name: 'Router wifi băng tần kép', unit: 'Cái', cat: 'NH004', purchasePrice: 1150000, salePrice: 1690000 },
  { code: 'SP015', name: 'Switch mạng 8 cổng', unit: 'Cái', cat: 'NH004', purchasePrice: 520000, salePrice: 790000 },
  { code: 'SP016', name: 'Dây mạng CAT6 cuộn 100m', unit: 'Cuộn', cat: 'NH004', purchasePrice: 890000, salePrice: 1250000 },
  { code: 'SP017', name: 'Máy lọc nước nóng lạnh', unit: 'Cái', cat: 'NH005', purchasePrice: 3800000, salePrice: 5100000 },
  { code: 'SP018', name: 'Ấm siêu tốc 1.8 lít', unit: 'Cái', cat: 'NH005', purchasePrice: 320000, salePrice: 520000 },
  { code: 'SP019', name: 'Bộ ly thuỷ tinh 6 cái', unit: 'Bộ', cat: 'NH005', purchasePrice: 135000, salePrice: 235000 },
  { code: 'SP020', name: 'Tủ lạnh mini 50 lít', unit: 'Cái', cat: 'NH005', purchasePrice: 2600000, salePrice: 3590000 },
];

const PARTNERS = [
  { code: 'NCC001', name: 'Công ty TNHH Nội thất Hoà Phát', type: 'SUPPLIER', taxCode: '0101234567', phone: '02838221100', email: 'sales@noithathoaphat.vn', address: '39 Nguyễn Huệ, Quận 1, TP.HCM' },
  { code: 'NCC002', name: 'Công ty CP Thiết bị Tin học Minh Khai', type: 'SUPPLIER', taxCode: '0102345678', phone: '02437654321', email: 'kinhdoanh@minhkhai.com.vn', address: '145 Lê Duẩn, Hai Bà Trưng, Hà Nội' },
  { code: 'NCC003', name: 'Công ty TNHH Văn phòng phẩm Thiên Long', type: 'SUPPLIER', taxCode: '0103456789', phone: '02839991234', email: 'order@thienlong.vn', address: 'Lô 6-8-10-12 KCN Tân Tạo, Bình Tân, TP.HCM' },
  { code: 'NCC004', name: 'Công ty CP Công nghệ Mạng Việt', type: 'SUPPLIER', taxCode: '0104567890', phone: '02836667788', email: 'contact@mangviet.vn', address: '278 Cách Mạng Tháng 8, Quận 3, TP.HCM' },
  { code: 'NCC005', name: 'Công ty TNHH Điện máy Sài Gòn', type: 'SUPPLIER', taxCode: '0105678901', phone: '02835554466', email: 'ban@dienmaysaigon.vn', address: '92 Nguyễn Thị Minh Khai, Quận 3, TP.HCM' },
  { code: 'KH001', name: 'Công ty CP Giải pháp Phần mềm FTech', type: 'CUSTOMER', taxCode: '0301234567', phone: '02873001100', email: 'admin@ftech.com.vn', address: 'Toà nhà Bitexco, Quận 1, TP.HCM' },
  { code: 'KH002', name: 'Công ty TNHH Thương mại An Phát', type: 'CUSTOMER', taxCode: '0302345678', phone: '02862998877', email: 'muahang@anphat.vn', address: '55 Trường Chinh, Tân Bình, TP.HCM' },
  { code: 'KH003', name: 'Trường Cao đẳng Kỹ thuật Đông Á', type: 'CUSTOMER', taxCode: '0303456789', phone: '02363889900', email: 'hanhchinh@cddonga.edu.vn', address: '63 Lê Văn Long, Hải Châu, Đà Nẵng' },
  { code: 'KH004', name: 'Công ty CP Xây dựng Tân Thành', type: 'CUSTOMER', taxCode: '0304567890', phone: '02466778899', email: 'vanphong@tanthanh.com.vn', address: '18 Phạm Hùng, Nam Từ Liêm, Hà Nội' },
  { code: 'KH005', name: 'Phòng khám Đa khoa Việt Mỹ', type: 'CUSTOMER', taxCode: '0305678901', phone: '02838776655', email: 'quantri@vietmyclinic.vn', address: '201 Nguyễn Văn Cừ, Quận 5, TP.HCM' },
  { code: 'KH006', name: 'Công ty TNHH Logistics Đại Dương', type: 'CUSTOMER', taxCode: '0306789012', phone: '02513667788', email: 'hcns@daiduonglog.vn', address: 'KCN Biên Hoà 2, Đồng Nai' },
  { code: 'DT001', name: 'Công ty CP Đầu tư Thương mại Hưng Thịnh', type: 'BOTH', taxCode: '0307890123', phone: '02839112233', email: 'giaodich@hungthinh.vn', address: '72 Điện Biên Phủ, Bình Thạnh, TP.HCM' },
  { code: 'DT002', name: 'Công ty TNHH Xuất nhập khẩu Nam Việt', type: 'BOTH', taxCode: '0308901234', phone: '02923887766', email: 'info@namviet-import.vn', address: '128 Trần Hưng Đạo, Ninh Kiều, Cần Thơ' },
];

const WAREHOUSES = [
  { code: 'KHO001', name: 'Kho trung tâm TP.HCM', address: '15 Đường số 7, KCN Tân Bình, TP.HCM' },
  { code: 'KHO002', name: 'Kho chi nhánh Hà Nội', address: 'Lô C5 KCN Sài Đồng B, Long Biên, Hà Nội' },
  { code: 'KHO003', name: 'Kho chi nhánh Đà Nẵng', address: '234 Nguyễn Hữu Thọ, Cẩm Lệ, Đà Nẵng' },
  { code: 'KHO004', name: 'Kho hàng trả về', address: '15 Đường số 7, KCN Tân Bình, TP.HCM' },
];

const DEPARTMENTS = [
  { code: 'PB001', name: 'Ban Giám đốc' },
  { code: 'PB002', name: 'Phòng Kinh doanh' },
  { code: 'PB003', name: 'Phòng Mua hàng' },
  { code: 'PB004', name: 'Phòng Kho vận' },
  { code: 'PB005', name: 'Phòng Kế toán' },
  { code: 'PB006', name: 'Phòng Nhân sự' },
  { code: 'PB007', name: 'Phòng Kỹ thuật' },
];

const POSITIONS = [
  { code: 'CD001', name: 'Giám đốc' },
  { code: 'CD002', name: 'Phó giám đốc' },
  { code: 'CD003', name: 'Trưởng phòng' },
  { code: 'CD004', name: 'Phó phòng' },
  { code: 'CD005', name: 'Nhân viên kinh doanh' },
  { code: 'CD006', name: 'Nhân viên mua hàng' },
  { code: 'CD007', name: 'Thủ kho' },
  { code: 'CD008', name: 'Kế toán viên' },
  { code: 'CD009', name: 'Chuyên viên nhân sự' },
  { code: 'CD010', name: 'Kỹ thuật viên' },
];

const EMPLOYEES = [
  { code: 'NV001', lastName: 'Trần Quang', firstName: 'Đạt', email: 'dat.tq@erp.vn', phone: '0901234567', dob: '1985-03-12', hire: '2020-01-06', dept: 'PB001', pos: 'CD001' },
  { code: 'NV002', lastName: 'Nguyễn Thị', firstName: 'Lan', email: 'lan.nt@erp.vn', phone: '0912345678', dob: '1988-07-25', hire: '2020-03-02', dept: 'PB002', pos: 'CD003' },
  { code: 'NV003', lastName: 'Lê Văn', firstName: 'Hùng', email: 'hung.lv@erp.vn', phone: '0923456789', dob: '1992-11-08', hire: '2021-05-17', dept: 'PB002', pos: 'CD005' },
  { code: 'NV004', lastName: 'Phạm Thị', firstName: 'Mai', email: 'mai.pt@erp.vn', phone: '0934567890', dob: '1995-02-14', hire: '2022-08-01', dept: 'PB002', pos: 'CD005' },
  { code: 'NV005', lastName: 'Hoàng Văn', firstName: 'Nam', email: 'nam.hv@erp.vn', phone: '0945678901', dob: '1990-09-30', hire: '2021-01-11', dept: 'PB003', pos: 'CD003' },
  { code: 'NV006', lastName: 'Vũ Thị', firstName: 'Hương', email: 'huong.vt@erp.vn', phone: '0956789012', dob: '1993-06-18', hire: '2022-02-14', dept: 'PB003', pos: 'CD006' },
  { code: 'NV007', lastName: 'Đặng Văn', firstName: 'Tuấn', email: 'tuan.dv@erp.vn', phone: '0967890123', dob: '1987-12-05', hire: '2020-06-15', dept: 'PB004', pos: 'CD007' },
  { code: 'NV008', lastName: 'Bùi Thị', firstName: 'Thu', email: 'thu.bt@erp.vn', phone: '0978901234', dob: '1994-04-22', hire: '2023-03-06', dept: 'PB004', pos: 'CD007' },
  { code: 'NV009', lastName: 'Ngô Văn', firstName: 'Sơn', email: 'son.nv@erp.vn', phone: '0989012345', dob: '1991-08-09', hire: '2021-09-20', dept: 'PB005', pos: 'CD003' },
  { code: 'NV010', lastName: 'Dương Thị', firstName: 'Hoa', email: 'hoa.dt@erp.vn', phone: '0990123456', dob: '1996-01-27', hire: '2023-07-03', dept: 'PB005', pos: 'CD008' },
  { code: 'NV011', lastName: 'Trịnh Văn', firstName: 'Khoa', email: 'khoa.tv@erp.vn', phone: '0901112233', dob: '1989-05-16', hire: '2020-11-02', dept: 'PB006', pos: 'CD003' },
  { code: 'NV012', lastName: 'Lý Thị', firstName: 'Ngọc', email: 'ngoc.lt@erp.vn', phone: '0902223344', dob: '1997-10-11', hire: '2024-01-08', dept: 'PB006', pos: 'CD009' },
  { code: 'NV013', lastName: 'Đỗ Văn', firstName: 'Minh', email: 'minh.dv@erp.vn', phone: '0903334455', dob: '1992-03-03', hire: '2021-04-12', dept: 'PB007', pos: 'CD003' },
  { code: 'NV014', lastName: 'Cao Văn', firstName: 'Phong', email: 'phong.cv@erp.vn', phone: '0904445566', dob: '1995-07-19', hire: '2022-10-17', dept: 'PB007', pos: 'CD010' },
  { code: 'NV015', lastName: 'Mai Thị', firstName: 'Yến', email: 'yen.mt@erp.vn', phone: '0905556677', dob: '1998-12-01', hire: '2024-05-06', dept: 'PB007', pos: 'CD010' },
];

// ---------- CHỨNG TỪ ----------

const PO_PLAN = [
  { code: 'PO-2026-0001', sup: 'NCC001', wh: 'KHO001', date: '2026-07-06', status: 'CONFIRMED', note: 'Nhập bàn ghế đợt 1', lines: [['SP001', 40], ['SP002', 60], ['SP003', 25]] },
  { code: 'PO-2026-0002', sup: 'NCC002', wh: 'KHO001', date: '2026-07-13', status: 'CONFIRMED', note: 'Nhập thiết bị điện tử quý 3', lines: [['SP005', 35], ['SP006', 50], ['SP007', 80]] },
  { code: 'PO-2026-0003', sup: 'NCC003', wh: 'KHO001', date: '2026-07-20', status: 'CONFIRMED', note: 'Văn phòng phẩm định kỳ', lines: [['SP010', 300], ['SP011', 150], ['SP012', 200], ['SP013', 120]] },
  { code: 'PO-2026-0004', sup: 'NCC004', wh: 'KHO002', date: '2026-07-27', status: 'CONFIRMED', note: 'Thiết bị mạng cho chi nhánh Hà Nội', lines: [['SP014', 20], ['SP015', 30], ['SP016', 15]] },
  { code: 'PO-2026-0005', sup: 'NCC005', wh: 'KHO001', date: '2026-08-03', status: 'CONFIRMED', note: 'Đồ dùng nhà bếp', lines: [['SP017', 12], ['SP018', 40], ['SP019', 60]] },
  { code: 'PO-2026-0006', sup: 'NCC001', wh: 'KHO002', date: '2026-08-10', status: 'CONFIRMED', note: 'Bổ sung bàn ghế Hà Nội', lines: [['SP001', 25], ['SP002', 35], ['SP004', 8]] },
  { code: 'PO-2026-0007', sup: 'NCC002', wh: 'KHO003', date: '2026-08-17', status: 'CONFIRMED', note: 'Thiết bị cho chi nhánh Đà Nẵng', lines: [['SP005', 18], ['SP008', 10], ['SP009', 5]] },
  { code: 'PO-2026-0008', sup: 'DT001', wh: 'KHO001', date: '2026-08-24', status: 'CONFIRMED', note: 'Nhập hàng tổng hợp', lines: [['SP006', 30], ['SP007', 50], ['SP020', 15]] },
  { code: 'PO-2026-0009', sup: 'NCC003', wh: 'KHO003', date: '2026-08-31', status: 'CONFIRMED', note: 'Văn phòng phẩm Đà Nẵng', lines: [['SP010', 180], ['SP011', 90], ['SP013', 70]] },
  { code: 'PO-2026-0010', sup: 'NCC004', wh: 'KHO001', date: '2026-09-02', status: 'CONFIRMED', note: 'Bổ sung thiết bị mạng', lines: [['SP014', 15], ['SP015', 25]] },
  { code: 'PO-2026-0011', sup: 'NCC005', wh: 'KHO002', date: '2026-09-07', status: 'DRAFT', note: 'Chờ duyệt ngân sách quý 4', lines: [['SP017', 10], ['SP020', 12]] },
  { code: 'PO-2026-0012', sup: 'DT002', wh: 'KHO001', date: '2026-09-09', status: 'DRAFT', note: 'Đang thương lượng giá', lines: [['SP003', 20], ['SP004', 6]] },
  { code: 'PO-2026-0013', sup: 'NCC002', wh: 'KHO001', date: '2026-08-05', status: 'CANCELLED', note: 'Huỷ do nhà cung cấp hết hàng', lines: [['SP009', 8]] },
];

const SO_PLAN = [
  { code: 'SO-2026-0001', cus: 'KH001', wh: 'KHO001', date: '2026-07-22', status: 'CONFIRMED', note: 'Trang bị văn phòng tầng 12', lines: [['SP001', 12], ['SP002', 18]] },
  { code: 'SO-2026-0002', cus: 'KH002', wh: 'KHO001', date: '2026-07-29', status: 'CONFIRMED', note: 'Đơn hàng tháng 7', lines: [['SP005', 8], ['SP006', 12], ['SP007', 20]] },
  { code: 'SO-2026-0003', cus: 'KH003', wh: 'KHO003', date: '2026-08-19', status: 'CONFIRMED', note: 'Trang bị phòng máy', lines: [['SP005', 10], ['SP008', 4]] },
  { code: 'SO-2026-0004', cus: 'KH004', wh: 'KHO002', date: '2026-08-14', status: 'CONFIRMED', note: 'Văn phòng dự án mới', lines: [['SP001', 10], ['SP002', 15], ['SP014', 4]] },
  { code: 'SO-2026-0005', cus: 'KH005', wh: 'KHO001', date: '2026-08-21', status: 'CONFIRMED', note: 'Bổ sung thiết bị phòng khám', lines: [['SP010', 60], ['SP011', 30], ['SP018', 6]] },
  { code: 'SO-2026-0006', cus: 'KH006', wh: 'KHO001', date: '2026-08-26', status: 'CONFIRMED', note: 'Đơn hàng quý 3', lines: [['SP003', 6], ['SP017', 3], ['SP019', 15]] },
  { code: 'SO-2026-0007', cus: 'KH001', wh: 'KHO001', date: '2026-09-01', status: 'CONFIRMED', note: 'Bổ sung đợt 2', lines: [['SP006', 15], ['SP007', 25], ['SP015', 5]] },
  { code: 'SO-2026-0008', cus: 'DT001', wh: 'KHO001', date: '2026-09-03', status: 'CONFIRMED', note: 'Đơn hàng đối tác', lines: [['SP012', 40], ['SP013', 35]] },
  { code: 'SO-2026-0009', cus: 'KH003', wh: 'KHO003', date: '2026-09-05', status: 'CONFIRMED', note: 'Văn phòng phẩm đầu năm học', lines: [['SP010', 80], ['SP011', 40]] },
  { code: 'SO-2026-0010', cus: 'KH002', wh: 'KHO001', date: '2026-09-08', status: 'CONFIRMED', note: 'Đơn hàng tháng 9', lines: [['SP020', 5], ['SP018', 10]] },
  { code: 'SO-2026-0011', cus: 'KH004', wh: 'KHO002', date: '2026-09-09', status: 'DRAFT', note: 'Chờ khách xác nhận số lượng', lines: [['SP001', 8], ['SP004', 2]] },
  { code: 'SO-2026-0012', cus: 'KH005', wh: 'KHO001', date: '2026-09-10', status: 'DRAFT', note: 'Đang chờ duyệt công nợ', lines: [['SP005', 6], ['SP016', 3]] },
  { code: 'SO-2026-0013', cus: 'DT002', wh: 'KHO001', date: '2026-09-10', status: 'DRAFT', note: 'Báo giá gửi khách', lines: [['SP009', 2], ['SP008', 3]] },
  { code: 'SO-2026-0014', cus: 'KH006', wh: 'KHO001', date: '2026-08-12', status: 'CANCELLED', note: 'Khách huỷ do thay đổi kế hoạch', lines: [['SP003', 4]] },
];

const ADJUSTMENTS = [
  { prod: 'SP007', wh: 'KHO001', qty: 3, note: 'Kiểm kê phát hiện thiếu 3 cái' },
  { prod: 'SP011', wh: 'KHO001', qty: 5, note: 'Hỏng hộp trong quá trình lưu kho' },
  { prod: 'SP019', wh: 'KHO001', qty: 2, note: 'Vỡ khi bốc xếp' },
];

const NOTES = [
  { title: 'Quy trình nhập kho', description: 'Đơn mua phải được xác nhận trước khi thủ kho ghi nhận hàng về. Không sửa đơn sau khi đã xác nhận.', url: 'https://noi-bo.erp.vn/quy-trinh/nhap-kho' },
  { title: 'Quy trình xuất kho', description: 'Kiểm tra tồn kho trước khi xác nhận đơn bán. Thiếu hàng thì hệ thống trả lỗi 409 và giữ đơn ở trạng thái nháp.', url: 'https://noi-bo.erp.vn/quy-trinh/xuat-kho' },
  { title: 'Lịch kiểm kê quý 3', description: 'Kiểm kê toàn bộ ba kho trong tuần cuối tháng 9. Chênh lệch ghi nhận bằng phiếu điều chỉnh.', url: 'https://noi-bo.erp.vn/thong-bao/kiem-ke-q3' },
  { title: 'Chính sách công nợ khách hàng', description: 'Khách mới giới hạn 50 triệu. Vượt hạn mức cần Ban Giám đốc duyệt.', url: 'https://noi-bo.erp.vn/chinh-sach/cong-no' },
  { title: 'Hướng dẫn sử dụng phân hệ bán hàng', description: 'Tạo đơn ở trạng thái nháp, kiểm tra lại dòng hàng và đơn giá, rồi mới xác nhận.', url: 'https://noi-bo.erp.vn/huong-dan/ban-hang' },
  { title: 'Danh sách nhà cung cấp ưu tiên', description: 'Năm nhà cung cấp đã ký hợp đồng khung năm 2026, áp dụng chiết khấu theo sản lượng.', url: 'https://noi-bo.erp.vn/mua-hang/ncc-uu-tien' },
];

async function main() {
  console.log('Bat dau nap du lieu mau...\n');

  // ---------- 1. NHÓM HÀNG ----------
  for (const c of CATEGORIES) {
    await prisma.productCategory.upsert({ where: { code: c.code }, update: { name: c.name }, create: c });
  }
  const catByCode = Object.fromEntries((await prisma.productCategory.findMany()).map((c) => [c.code, c.id]));
  console.log('  nhom hang:', CATEGORIES.length);

  // ---------- 2. SẢN PHẨM ----------
  for (const p of PRODUCTS) {
    const data = {
      code: p.code, name: p.name, unit: p.unit,
      purchasePrice: p.purchasePrice, salePrice: p.salePrice,
      categoryId: catByCode[p.cat],
    };
    await prisma.product.upsert({ where: { code: p.code }, update: data, create: data });
  }
  const prodByCode = Object.fromEntries((await prisma.product.findMany()).map((p) => [p.code, p]));
  console.log('  san pham:', PRODUCTS.length);

  // ---------- 3. ĐỐI TÁC ----------
  for (const p of PARTNERS) {
    await prisma.partner.upsert({ where: { code: p.code }, update: p, create: p });
  }
  const partByCode = Object.fromEntries((await prisma.partner.findMany()).map((p) => [p.code, p.id]));
  console.log('  doi tac:', PARTNERS.length);

  // ---------- 4. KHO ----------
  for (const w of WAREHOUSES) {
    await prisma.warehouse.upsert({ where: { code: w.code }, update: w, create: w });
  }
  const whByCode = Object.fromEntries((await prisma.warehouse.findMany()).map((w) => [w.code, w.id]));
  console.log('  kho:', WAREHOUSES.length);

  // ---------- 5. PHÒNG BAN VÀ CHỨC DANH ----------
  for (const x of DEPARTMENTS) {
    await prisma.department.upsert({ where: { code: x.code }, update: x, create: x });
  }
  for (const x of POSITIONS) {
    await prisma.position.upsert({ where: { code: x.code }, update: x, create: x });
  }
  const deptByCode = Object.fromEntries((await prisma.department.findMany()).map((x) => [x.code, x.id]));
  const posByCode = Object.fromEntries((await prisma.position.findMany()).map((x) => [x.code, x.id]));
  console.log('  phong ban:', DEPARTMENTS.length, '| chuc danh:', POSITIONS.length);

  // ---------- 6. NHÂN VIÊN ----------
  for (const e of EMPLOYEES) {
    const data = {
      code: e.code, firstName: e.firstName, lastName: e.lastName,
      email: e.email, phone: e.phone,
      dateOfBirth: d(e.dob), hireDate: d(e.hire),
      departmentId: deptByCode[e.dept], positionId: posByCode[e.pos],
    };
    await prisma.employee.upsert({ where: { code: e.code }, update: data, create: data });
  }
  const employees = await prisma.employee.findMany({ orderBy: { code: 'asc' } });
  console.log('  nhan vien:', employees.length);

  // ---------- 7. CHẤM CÔNG 30 NGÀY LÀM VIỆC GẦN NHẤT ----------
  // Xoá trước vì có ràng buộc unique theo cặp (nhân viên, ngày)
  await prisma.attendance.deleteMany();
  const workDays = [];
  const cursor = new Date('2026-09-11T00:00:00Z');
  while (workDays.length < 30) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) workDays.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const attRows = [];
  for (const emp of employees) {
    for (const wd of workDays) {
      // rải vài ngày nghỉ và tăng ca cho giống dữ liệu thật
      const seed = (emp.id * 31 + wd.getUTCDate() * 7) % 23;
      if (seed === 0) continue; // ngày nghỉ, không có dòng chấm công
      const hours = seed === 1 ? 4 : seed === 2 ? 9.5 : 8;
      attRows.push({
        employeeId: emp.id,
        workDate: wd,
        workHours: hours,
        note: hours === 4 ? 'Nghỉ nửa ngày' : hours === 9.5 ? 'Tăng ca' : null,
      });
    }
  }
  await prisma.attendance.createMany({ data: attRows });
  console.log('  cham cong:', attRows.length, 'dong /', workDays.length, 'ngay lam viec');

  // ---------- 8. CHỨNG TỪ VÀ TỒN KHO ----------
  // Dựng lại từ đầu để tồn kho luôn khớp sổ nhật ký
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stock.deleteMany();

  // tồn kho tích luỹ trong bộ nhớ, ghi xuống database một lần ở cuối
  const stockMap = new Map(); // "productId:warehouseId" -> số lượng
  const addStock = (productId, warehouseId, delta) => {
    const k = productId + ':' + warehouseId;
    stockMap.set(k, (stockMap.get(k) ?? 0) + delta);
  };

  for (const po of PO_PLAN) {
    const items = po.lines.map(([code, qty]) => {
      const prod = prodByCode[code];
      const unitPrice = Number(prod.purchasePrice);
      return { productId: prod.id, quantity: qty, unitPrice, amount: qty * unitPrice };
    });
    const total = items.reduce((s, i) => s + i.amount, 0);
    const created = await prisma.purchaseOrder.create({
      data: {
        code: po.code, orderDate: d(po.date), status: po.status,
        totalAmount: total, note: po.note,
        supplierId: partByCode[po.sup], warehouseId: whByCode[po.wh],
        items: { create: items },
      },
    });
    // chỉ đơn đã xác nhận mới ghi kho
    if (po.status === 'CONFIRMED') {
      for (const it of items) {
        await prisma.stockMovement.create({
          data: {
            type: 'IN', quantity: it.quantity,
            productId: it.productId, warehouseId: whByCode[po.wh],
            refType: 'PURCHASE_ORDER', refId: created.id,
            note: 'Nhập kho theo ' + po.code, createdAt: d(po.date),
          },
        });
        addStock(it.productId, whByCode[po.wh], it.quantity);
      }
    }
  }
  console.log('  don mua:', PO_PLAN.length);

  for (const so of SO_PLAN) {
    const items = so.lines.map(([code, qty]) => {
      const prod = prodByCode[code];
      const unitPrice = Number(prod.salePrice);
      return { productId: prod.id, quantity: qty, unitPrice, amount: qty * unitPrice };
    });
    const total = items.reduce((s, i) => s + i.amount, 0);
    const created = await prisma.salesOrder.create({
      data: {
        code: so.code, orderDate: d(so.date), status: so.status,
        totalAmount: total, note: so.note,
        customerId: partByCode[so.cus], warehouseId: whByCode[so.wh],
        items: { create: items },
      },
    });
    if (so.status === 'CONFIRMED') {
      for (const it of items) {
        await prisma.stockMovement.create({
          data: {
            type: 'OUT', quantity: it.quantity,
            productId: it.productId, warehouseId: whByCode[so.wh],
            refType: 'SALES_ORDER', refId: created.id,
            note: 'Xuất kho theo ' + so.code, createdAt: d(so.date),
          },
        });
        addStock(it.productId, whByCode[so.wh], -it.quantity);
      }
    }
  }
  console.log('  don ban:', SO_PLAN.length);

  for (const a of ADJUSTMENTS) {
    const prod = prodByCode[a.prod];
    await prisma.stockMovement.create({
      data: {
        type: 'ADJUST', quantity: a.qty,
        productId: prod.id, warehouseId: whByCode[a.wh],
        refType: 'ADJUSTMENT', note: a.note, createdAt: d('2026-09-04'),
      },
    });
    addStock(prod.id, whByCode[a.wh], -a.qty);
  }
  console.log('  dieu chinh kiem ke:', ADJUSTMENTS.length);

  const stockRows = [];
  for (const [k, qty] of stockMap) {
    const [productId, warehouseId] = k.split(':').map(Number);
    stockRows.push({ productId, warehouseId, quantity: qty });
  }
  await prisma.stock.createMany({ data: stockRows });
  console.log('  dong ton kho:', stockRows.length);

  // ---------- 9. GHI CHÚ ----------
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ??
    (await prisma.user.findFirst());
  if (admin) {
    await prisma.note.deleteMany();
    await prisma.note.createMany({
      data: NOTES.map((n) => ({ ...n, userId: admin.id })),
    });
    console.log('  ghi chu:', NOTES.length, '(gan voi ' + admin.email + ')');
  } else {
    console.log('  ghi chu: bo qua, chua co tai khoan nao trong he thong');
  }

  // ---------- TỔNG KẾT ----------
  console.log('\n=== TONG KET ===');
  const counts = {
    'Nhom hang': await prisma.productCategory.count(),
    'San pham': await prisma.product.count(),
    'Doi tac': await prisma.partner.count(),
    Kho: await prisma.warehouse.count(),
    'Phong ban': await prisma.department.count(),
    'Chuc danh': await prisma.position.count(),
    'Nhan vien': await prisma.employee.count(),
    'Cham cong': await prisma.attendance.count(),
    'Don mua': await prisma.purchaseOrder.count(),
    'Dong don mua': await prisma.purchaseOrderItem.count(),
    'Don ban': await prisma.salesOrder.count(),
    'Dong don ban': await prisma.salesOrderItem.count(),
    'Nhat ky kho': await prisma.stockMovement.count(),
    'Dong ton kho': await prisma.stock.count(),
    'Ghi chu': await prisma.note.count(),
  };
  let total = 0;
  for (const [k, v] of Object.entries(counts)) {
    console.log('  ' + k.padEnd(16) + String(v).padStart(5));
    total += v;
  }
  console.log('  ' + '-'.repeat(21));
  console.log('  ' + 'TONG CONG'.padEnd(16) + String(total).padStart(5));
}

main()
  .catch((e) => {
    console.error('\nLOI:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
