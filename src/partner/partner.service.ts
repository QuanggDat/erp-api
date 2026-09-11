import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildPaginatedResult,
  getSkip,
} from '../common/helper/pagination.helper';
import { Prisma } from '../generated/prisma/client';
import { PartnerType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDTO, GetPartnersQueryDTO, UpdatePartnerDTO } from './dto';

@Injectable()
export class PartnerService {
  constructor(private prismaService: PrismaService) {}

  async getPartners(query: GetPartnersQueryDTO) {
    const { page, limit, search, type, isActive } = query;

    const where: Prisma.PartnerWhereInput = {
      //lọc CUSTOMER phải lấy cả BOTH, vì công ty vừa mua vừa bán cũng là khách hàng
      ...(type && { type: { in: this.expandType(type) } }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { taxCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prismaService.partner.findMany({
        where,
        skip: getSkip(page, limit),
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prismaService.partner.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getPartnerById(partnerId: number) {
    const partner = await this.prismaService.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác');
    }
    return partner;
  }

  async createPartner(dto: CreatePartnerDTO) {
    try {
      return await this.prismaService.partner.create({ data: dto });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  async updatePartner(partnerId: number, dto: UpdatePartnerDTO) {
    await this.getPartnerById(partnerId);
    try {
      return await this.prismaService.partner.update({
        where: { id: partnerId },
        data: dto,
      });
    } catch (error) {
      throw this.handleUniqueCodeError(error, dto.code);
    }
  }

  //ngừng giao dịch thay vì xoá, vì đối tác còn nằm trong chứng từ cũ
  async deactivatePartner(partnerId: number) {
    await this.getPartnerById(partnerId);
    return this.prismaService.partner.update({
      where: { id: partnerId },
      data: { isActive: false },
    });
  }

  //dùng cho module mua hàng và bán hàng: kiểm tra đối tác đúng vai trò
  async ensurePartnerIsValid(partnerId: number, requiredType: PartnerType) {
    const partner = await this.getPartnerById(partnerId);
    if (!partner.isActive) {
      throw new ConflictException(`Đối tác ${partner.code} đã ngừng giao dịch`);
    }
    if (!this.expandType(requiredType).includes(partner.type)) {
      const label =
        requiredType === PartnerType.SUPPLIER ? 'nhà cung cấp' : 'khách hàng';
      throw new ConflictException(
        `Đối tác ${partner.code} không phải ${label}`,
      );
    }
    return partner;
  }

  //BOTH vừa là khách hàng vừa là nhà cung cấp nên luôn nằm trong kết quả
  private expandType(type: PartnerType): PartnerType[] {
    if (type === PartnerType.BOTH) {
      return [PartnerType.BOTH];
    }
    return [type, PartnerType.BOTH];
  }

  private handleUniqueCodeError(error: unknown, code?: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Mã đối tác ${code ?? ''} đã tồn tại`);
    }
    return error;
  }
}
