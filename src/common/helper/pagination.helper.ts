//kiểu trả về chuẩn cho mọi danh sách có phân trang
export type PaginatedResult<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

//gom công thức tính skip và đóng gói kết quả vào một chỗ
//nhờ vậy mọi service không phải lặp lại (page - 1) * limit
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

//Prisma nhận số bản ghi cần bỏ qua, không nhận số trang
export function getSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
