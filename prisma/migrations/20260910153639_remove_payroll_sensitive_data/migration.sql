-- Gỡ bỏ hoàn toàn dữ liệu lương khỏi hệ thống.
-- Tiền lương là dữ liệu nhạy cảm, đã được quyết định không lưu trữ.
-- Migration này XOÁ VĨNH VIỄN dữ liệu, không hoàn tác được.

-- Bỏ khoá ngoại trước khi xoá bảng
ALTER TABLE "payrolls" DROP CONSTRAINT IF EXISTS "payrolls_employeeId_fkey";

-- Xoá bảng bảng lương
DROP TABLE IF EXISTS "payrolls";

-- Xoá cột lương cơ bản trên hồ sơ nhân viên
ALTER TABLE "employees" DROP COLUMN IF EXISTS "baseSalary";
