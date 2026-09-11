-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "costAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN     "avgCost" DECIMAL(18,2) NOT NULL DEFAULT 0;
