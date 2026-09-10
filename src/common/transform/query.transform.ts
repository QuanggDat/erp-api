import { Transform } from 'class-transformer';

//Trình duyệt gửi tham số rỗng khi người dùng chưa chọn gì trong ô lọc,
//ví dụ "...?categoryId=&isActive=". Nếu để nguyên @Type(() => Number),
//chuỗi rỗng biến thành NaN và chuỗi rỗng thành false, cả hai lọt qua
//@IsOptional rồi vào truy vấn Prisma và lọc sạch kết quả.
//Ba decorator dưới đây coi chuỗi rỗng là "không lọc" và bỏ hẳn tham số đi.

//Số nguyên tuỳ chọn: "" và "abc" đều thành undefined
export const ToOptionalInt = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

//Số thực tuỳ chọn, dùng cho tiền và số lượng
export const ToOptionalNumber = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  });

//Boolean tuỳ chọn: chỉ "true" và "false" mới có nghĩa,
//mọi giá trị khác kể cả chuỗi rỗng đều là "không lọc"
export const ToOptionalBoolean = () =>
  Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  });

//Enum tuỳ chọn: ô chọn để trống gửi lên chuỗi rỗng, mà @IsEnum
//từ chối chuỗi rỗng và trả về 400. Coi chuỗi rỗng là "không lọc".
export const ToOptionalEnum = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === null ? undefined : value,
  );

//Chuỗi tuỳ chọn: ô tìm kiếm để trống gửi lên chuỗi rỗng.
//Bỏ hẳn tham số đi cho gọn thay vì để service tự kiểm tra chuỗi rỗng.
export const ToOptionalString = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });
