import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorator';
import { MyJwtGuard, RolesGuard } from '../auth/guard';
import { Role } from '../generated/prisma/enums';
import { CreatePartnerDTO, GetPartnersQueryDTO, UpdatePartnerDTO } from './dto';
import { PartnerService } from './partner.service';

@UseGuards(MyJwtGuard, RolesGuard)
@Controller('partners')
export class PartnerController {
  constructor(private partnerService: PartnerService) {}

  //GET: .../partners?page=1&limit=10&type=CUSTOMER&search=abc
  @Get()
  getPartners(@Query() query: GetPartnersQueryDTO) {
    return this.partnerService.getPartners(query);
  }

  @Get(':id')
  getPartnerById(@Param('id', ParseIntPipe) partnerId: number) {
    return this.partnerService.getPartnerById(partnerId);
  }

  //cả bán hàng lẫn mua hàng đều cần tạo đối tác của mình
  @Roles(Role.SALES, Role.PURCHASE)
  @Post()
  createPartner(@Body() dto: CreatePartnerDTO) {
    return this.partnerService.createPartner(dto);
  }

  @Roles(Role.SALES, Role.PURCHASE)
  @Patch(':id')
  updatePartner(
    @Param('id', ParseIntPipe) partnerId: number,
    @Body() dto: UpdatePartnerDTO,
  ) {
    return this.partnerService.updatePartner(partnerId, dto);
  }

  @Roles(Role.SALES, Role.PURCHASE)
  @Delete(':id')
  deactivatePartner(@Param('id', ParseIntPipe) partnerId: number) {
    return this.partnerService.deactivatePartner(partnerId);
  }
}
