import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';

@Module({
  imports: [PrismaModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  //mua hàng và bán hàng dùng lại ensurePartnerIsValid
  exports: [PartnerService],
})
export class PartnerModule {}
