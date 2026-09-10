import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    super({
      //token được gửi kèm mọi request (trừ login / register)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  //payload là nội dung đã ký trong signJwtToken
  async validate(payload: { sub: number; email: string }) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
      //không trả hashedPassword ra ngoài
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true, //RolesGuard cần cột này để kiểm tra quyền
        createdAt: true,
      },
    });
    //giá trị trả về sẽ được gắn vào request.user
    return user;
  }
}
