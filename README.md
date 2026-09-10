# NestJS RestAPI

Back-end REST API viết bằng NestJS + Prisma + PostgreSQL, phục vụ cho front-end
Next.js (`NextJS-Blogs-Management`).

API gồm 2 phần: **xác thực người dùng** (bảng `users`) và **quản lý blog**
(bảng `notes`).

## Kiến trúc

| Thành phần | Đường dẫn | Port |
|---|---|---|
| Back-end (NestJS)   | `NestJS-RestAPI`          | **3000** |
| Front-end (Next.js) | `NextJS-Blogs-Management` | **3001** |
| Database dev (Postgres) | docker `dev-database`  | 5434 |
| Database test (Postgres) | docker `test-database` | 5435 |

Back-end đã bật CORS cho `http://localhost:3001` trong [`src/main.ts`](src/main.ts)
để trình duyệt cho phép front-end gọi API.

## Cách chạy

**1. Bật database** (Docker phải đang chạy):
```bash
npm run db:dev:create      # tạo & bật container dev-database
npm run prisma:dev:deploy  # chạy migration, tạo bảng users + notes
```

**2. Cài thư viện và bật server**:
```bash
npm install
npm run start:dev          # watch mode, tự restart khi sửa code
```

Server chạy tại http://localhost:3000

> Lần đầu clone project cần chạy thêm `npx prisma generate` để sinh Prisma Client
> vào thư mục `src/generated/prisma`.

**Lệnh hữu ích khác**:
```bash
npm run db:dev:restart     # xoá sạch DB dev, tạo lại từ đầu + chạy migration
npm run start:prod         # chạy bản build production
npm run test:e2e           # chạy e2e test (tự dựng lại test-database)
```

## Danh sách API

### Xác thực — không cần token

| Chức năng | Method | Endpoint | Body |
|---|---|---|---|
| Đăng ký | POST | `/auth/register` | `{ email, password }` |
| Đăng nhập | POST | `/auth/login` | `{ email, password }` |

- `/auth/register` trả về `{ id, email, createdAt }`. Email trùng thì trả **403**
  `Email already exists`.
- `/auth/login` trả về `{ accessToken }`. Sai email/mật khẩu trả **403**.
- `password` phải có **tối thiểu 6 ký tự** (`@MinLength(6)`), sai thì trả **400**.

### Người dùng & Blog — bắt buộc gửi token

Các route bên dưới đều có `@UseGuards(MyJwtGuard)`, phải gửi kèm header:

```
Authorization: Bearer <accessToken>
```

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Thông tin user đang đăng nhập | GET | `/users/me` | |
| Danh sách blog | GET | `/notes` | chỉ trả blog của chính user đó |
| Chi tiết blog | GET | `/notes/:id` | |
| Tạo blog | POST | `/notes` | `userId` tự gắn từ token |
| Sửa blog | PATCH | `/notes/:id` | dùng **PATCH**, không phải PUT |
| Xoá blog | DELETE | `/notes/:id` | trả **204 No Content** |

Thiếu hoặc sai token → **401 Unauthorized**.
Sửa/xoá blog của người khác → **403 Access to resource denied**.

### ERP — bắt buộc gửi token

Toàn bộ route ERP đều qua `MyJwtGuard` và `RolesGuard`. Các route ghi dữ liệu
còn yêu cầu đúng vai trò, khai báo bằng `@Roles(...)`. Vai trò `ADMIN` đi qua
mọi route mà không cần liệt kê.

**Sản phẩm và nhóm hàng** — ghi cần vai trò `PURCHASE` hoặc `WAREHOUSE`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Danh sách nhóm hàng | GET | `/products/categories` | `?page&limit&search` |
| Thêm / sửa / xoá nhóm hàng | POST / PATCH / DELETE | `/products/categories/:id` | còn sản phẩm thì không xoá được (**409**) |
| Danh sách sản phẩm | GET | `/products` | `?page&limit&search&categoryId&isActive` |
| Chi tiết sản phẩm | GET | `/products/:id` | kèm tồn kho ở từng kho |
| Thêm / sửa sản phẩm | POST / PATCH | `/products/:id` | mã trùng trả **409** |
| Ngừng kinh doanh | DELETE | `/products/:id` | chỉ tắt cờ `isActive`, không xoá |

**Đối tác** — ghi cần vai trò `SALES` hoặc `PURCHASE`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Danh sách đối tác | GET | `/partners` | `?type=CUSTOMER` lấy cả đối tác loại `BOTH` |
| Thêm / sửa đối tác | POST / PATCH | `/partners/:id` | |
| Ngừng giao dịch | DELETE | `/partners/:id` | chỉ tắt cờ `isActive` |

**Kho** — ghi cần vai trò `WAREHOUSE`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Tồn kho hiện tại | GET | `/warehouses/stocks` | `?productId&warehouseId` |
| Sổ nhật ký nhập xuất | GET | `/warehouses/stock-movements` | không bao giờ xoá, là dấu vết kiểm toán |
| Điều chỉnh sau kiểm kê | POST | `/warehouses/stocks/adjust` | gửi số **đếm được**, hệ thống tự tính chênh lệch |
| Danh sách kho | GET | `/warehouses` | |
| Thêm / sửa kho | POST / PATCH | `/warehouses/:id` | |
| Ngừng sử dụng kho | DELETE | `/warehouses/:id` | còn tồn thì bị chặn (**409**) |

**Mua hàng** — ghi cần vai trò `PURCHASE`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Danh sách đơn mua | GET | `/purchase-orders` | `?status&supplierId&warehouseId&search` |
| Chi tiết đơn mua | GET | `/purchase-orders/:id` | kèm các dòng hàng |
| Tạo đơn mua | POST | `/purchase-orders` | tạo ra ở trạng thái `DRAFT` |
| Sửa đơn mua | PATCH | `/purchase-orders/:id` | chỉ sửa được đơn `DRAFT` |
| **Xác nhận đơn** | PATCH | `/purchase-orders/:id/confirm` | **hàng vào kho tại đây** |
| Huỷ đơn | PATCH | `/purchase-orders/:id/cancel` | đơn đã xác nhận thì hàng bị trừ khỏi kho |

**Bán hàng** — ghi cần vai trò `SALES`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Danh sách đơn bán | GET | `/sales-orders` | `?status&customerId&warehouseId&search` |
| Chi tiết đơn bán | GET | `/sales-orders/:id` | |
| Tạo đơn bán | POST | `/sales-orders` | bỏ trống `unitPrice` thì lấy giá bán niêm yết |
| Sửa đơn bán | PATCH | `/sales-orders/:id` | chỉ sửa được đơn `DRAFT` |
| **Xác nhận đơn** | PATCH | `/sales-orders/:id/confirm` | **hàng rời kho tại đây**, không đủ tồn trả **409** |
| Huỷ đơn | PATCH | `/sales-orders/:id/cancel` | đơn đã xác nhận thì hàng quay lại kho |

**Nhân sự** — toàn bộ cần vai trò `HR`

| Chức năng | Method | Endpoint | Ghi chú |
|---|---|---|---|
| Phòng ban | GET/POST/PATCH/DELETE | `/hr/departments` | còn nhân viên thì không xoá được |
| Chức danh | GET/POST/PATCH/DELETE | `/hr/positions` | |
| Nhân viên | GET/POST/PATCH | `/hr/employees` | `?departmentId&positionId&isActive&search` |
| Ghi nhận nghỉ việc | DELETE | `/hr/employees/:id` | chỉ tắt cờ `isActive` |
| Chấm công | GET/POST/DELETE | `/hr/attendances` | mỗi nhân viên một bản ghi mỗi ngày |

Sai vai trò → **403**. Vi phạm ràng buộc nghiệp vụ → **409**.

> **Hệ thống không quản lý tiền lương.** Đây là dữ liệu nhạy cảm và đã được gỡ
> bỏ hoàn toàn: không có bảng trong database, không có endpoint, không có cột
> nào trên hồ sơ nhân viên. Nếu client cố gửi trường lương lên, `ValidationPipe`
> với `whitelist: true` sẽ loại bỏ trước khi tới service. Phân hệ nhân sự chỉ
> quản lý hồ sơ, phòng ban, chức danh và chấm công.

### Phân trang

Mọi endpoint danh sách đều nhận `?page` và `?limit`, mặc định trang 1 và
10 bản ghi, `limit` bị chặn trần ở 100. Kết quả trả về:

```json
{
  "items": [ ... ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

Tham số lọc để trống (ví dụ `?categoryId=&isActive=`) được coi là **không lọc**,
nhờ các decorator trong `src/common/transform/query.transform.ts`. Trình duyệt
luôn gửi chuỗi rỗng khi ô lọc chưa được chọn, nếu không xử lý thì `categoryId=`
sẽ thành `NaN` và lọc sạch kết quả.


## Cấu trúc dữ liệu

Xem chi tiết tại [`prisma/schema.prisma`](prisma/schema.prisma).

**Bảng `users`**

| Field | Kiểu | Ghi chú |
|---|---|---|
| id | Int | khoá chính, tự tăng |
| email | String | **unique** |
| hashedPassword | String | mã hoá bằng argon2, không bao giờ trả về client |
| firstName, lastName | String? | có thể để trống |
| createdAt, updatedAt | DateTime | |

**Bảng `notes`**

| Field | Kiểu | Ghi chú |
|---|---|---|
| id | Int | khoá chính, tự tăng |
| title | String | bắt buộc |
| description | String | bắt buộc |
| url | String | bắt buộc, phải đúng định dạng URL (`@IsUrl`) |
| userId | Int | khoá ngoại trỏ tới `users.id` |
| createdAt, updatedAt | DateTime | |

Quan hệ: một `user` viết được nhiều `note` (1–n).

> Khi tạo/sửa blog, `url` phải dạng `https://example.com`. Nhập chuỗi thường
> sẽ bị `ValidationPipe` trả về lỗi **400**.

## Cấu trúc thư mục

```
src/
├── main.ts                     # điểm khởi động: bật CORS + ValidationPipe
├── app.module.ts               # module gốc, gom tất cả module con
├── auth/                       # đăng ký / đăng nhập
│   ├── auth.controller.ts      # nhận request POST /auth/*
│   ├── auth.service.ts         # mã hoá mật khẩu, kiểm tra login, ký JWT
│   ├── dto/auth.dto.ts         # ràng buộc dữ liệu client gửi lên
│   ├── strategy/jwt.strategy.ts# đọc & kiểm tra token, gắn user vào request
│   ├── guard/myjwt.guard.ts    # chặn request không có token hợp lệ
│   └── decorator/              # @GetUser() lấy user ra khỏi request
├── user/
│   └── user.controller.ts      # GET /users/me
├── note/                       # CRUD blog
│   ├── note.controller.ts      # định tuyến GET/POST/PATCH/DELETE /notes
│   ├── note.service.ts         # xử lý nghiệp vụ + kiểm tra quyền sở hữu
│   └── dto/                    # InsertNoteDTO, UpdateNoteDTO
├── common/                     # dùng chung cho mọi phân hệ ERP
│   ├── dto/pagination.query.dto.ts   # ?page & ?limit dùng chung
│   ├── helper/pagination.helper.ts   # gói kết quả thành { items, meta }
│   └── transform/query.transform.ts  # coi tham số lọc rỗng là "không lọc"
├── product/                    # sản phẩm và nhóm hàng
├── partner/                    # khách hàng và nhà cung cấp (một bảng)
├── warehouse/                  # kho, tồn kho, sổ nhập xuất
│   ├── warehouse.service.ts    # quản lý danh sách kho
│   └── stock.service.ts        # LÕI: ghi biến động tồn, chặn tồn âm
├── purchase/                   # đơn mua hàng, xác nhận thì nhập kho
├── sales/                      # đơn bán hàng, xác nhận thì xuất kho
├── hr/                         # nhân sự
│   ├── employee.service.ts
│   ├── org-unit.service.ts     # phòng ban và chức danh dùng chung
│   └── attendance.service.ts   # chấm công
├── prisma/
│   └── prisma.service.ts       # kết nối PostgreSQL
└── generated/prisma/           # Prisma Client tự sinh (không sửa tay)

prisma/
├── schema.prisma               # định nghĩa toàn bộ bảng (users, notes + 15 bảng ERP)
└── migrations/                 # lịch sử thay đổi cấu trúc DB
```

## Luồng xử lý một request

```
Client → Controller → Service → PrismaService → PostgreSQL
             ↑
          Guard + Strategy (kiểm tra token, với route cần đăng nhập)
```

- **Controller**: nhận request, không chứa logic nghiệp vụ.
- **Service**: xử lý nghiệp vụ (mã hoá mật khẩu, kiểm tra quyền, truy vấn DB).
- **DTO**: mô tả dữ liệu client được phép gửi lên. `ValidationPipe` với
  `whitelist: true` sẽ **tự loại bỏ** field không khai báo trong DTO.
- **Guard + Strategy**: đọc token từ header, giải mã, tìm user trong DB rồi gắn
  vào `request.user`.

## Biến môi trường

File [`.env`](.env) (môi trường dev):

```
DATABASE_URL="postgresql://postgres:Abc123456789@localhost:5434/testdb?schema=public"
JWT_SECRET="..."
```

File `.env.test` dùng cho e2e test, trỏ sang `test-database` ở port 5435 nên
chạy test **không ảnh hưởng** dữ liệu dev.

## Lưu ý quan trọng

1. **Token chỉ sống 10 phút** (`expiresIn: '10m'` trong
   [`auth.service.ts`](src/auth/auth.service.ts)). Hết hạn phải đăng nhập lại.
2. **Sửa blog dùng PATCH**, không phải PUT — front-end phải gọi đúng method.
3. **Đổi code trong `main.ts` phải khởi động lại server** thì CORS mới có hiệu lực.
4. Mỗi user chỉ thấy và thao tác được blog của chính mình.

## Nguyên tắc thiết kế của phân hệ ERP

Bốn quy tắc dưới đây được áp dụng xuyên suốt, hiểu chúng thì đọc code rất nhanh.

**1. Không xoá cứng dữ liệu đã dùng trong chứng từ.**
Sản phẩm, đối tác, kho và nhân viên chỉ được tắt cờ `isActive`. Một sản phẩm
đã nằm trong đơn hàng năm ngoái mà bị xoá thì đơn hàng đó hỏng. `DELETE` trên
các bảng này thực chất là ngừng sử dụng, và trả về bản ghi đã cập nhật chứ
không phải 204.

**2. Giá được chép lại tại thời điểm giao dịch.**
`purchase_order_items` và `sales_order_items` đều có cột `unitPrice` riêng,
không trỏ sang bảng `products` để lấy giá hiện tại. Sản phẩm tăng giá thì hoá
đơn cũ vẫn giữ nguyên con số đã in ra cho khách.

**3. Tồn kho là số liệu dẫn xuất, không phải số liệu gốc.**
Bảng `stocks` chỉ được thay đổi qua `StockService.applyMovement`, và mỗi lần
thay đổi đều để lại một dòng trong `stock_movements`. Sổ nhật ký đó không bao
giờ bị xoá. Muốn biết vì sao tồn kho là con số hiện tại, cứ đọc ngược sổ.

**4. Đổi trạng thái chứng từ và ghi kho nằm trong cùng một transaction.**
Xem `confirmPurchaseOrder` và `confirmSalesOrder`. Nếu ghi kho thất bại, chẳng
hạn bán quá số tồn, thì trạng thái đơn cũng không đổi. Không có trường hợp đơn
đã xác nhận mà kho chưa cập nhật.

**5. Không lưu dữ liệu nhạy cảm mà hệ thống không thực sự cần.**
Tiền lương đã được gỡ bỏ hoàn toàn, không phải chỉ ẩn khỏi giao diện. Bảng
`payrolls` bị xoá khỏi database bằng migration, cột lương trên hồ sơ nhân
viên cũng vậy. Cách chắc chắn nhất để dữ liệu nhạy cảm không bị lộ là không
lưu nó ngay từ đầu.

Ngoài ra, tiền và số lượng đều dùng kiểu `Decimal` của Prisma chứ không phải
`Float`. Số thực nhị phân có sai số làm tròn, không chấp nhận được với tiền tệ.
Prisma trả `Decimal` về client dưới dạng chuỗi, nên front-end phải ép kiểu
trước khi tính toán.

## Tài khoản và vai trò

Người dùng mới đăng ký mặc định có vai trò `VIEWER`, chỉ xem được chứ không
tạo sửa xoá được gì. Nâng vai trò bằng SQL trực tiếp:

```bash
docker exec dev-database psql -U postgres -d testdb \
  -c "UPDATE users SET role='ADMIN' WHERE email='ban@email.com'"
```

Sáu vai trò: `ADMIN` (toàn quyền), `SALES` (bán hàng), `PURCHASE` (mua hàng),
`WAREHOUSE` (kho), `HR` (nhân sự), `VIEWER` (chỉ xem). Sau khi đổi vai trò
phải **đăng nhập lại**, vì vai trò được đọc từ database mỗi lần xác thực token.
