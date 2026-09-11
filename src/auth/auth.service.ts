import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDTO } from './dto';

@Injectable() //đây là "Dependency Injection" - tiêm phụ thuộc
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(authDTO: AuthDTO) {
    //mã hoá mật khẩu thành hashedPassword
    const hashedPassword = await argon.hash(authDTO.password);
    try {
      //thêm dữ liệu vào database
      const user = await this.prismaService.user.create({
        data: {
          email: authDTO.email,
          hashedPassword: hashedPassword,
          firstName: '',
          lastName: '',
        },
        //chỉ lấy về id, email, createdAt (không trả hashedPassword cho client)
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });
      return user;
    } catch (error) {
      //P2002 = vi phạm ràng buộc unique (email đã tồn tại)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException('Email already exists');
      }
      throw error;
    }
    //nên thêm ràng buộc "unique" cho bảng user
  }

  async login(authDTO: AuthDTO) {
    //tìm user theo email được gửi lên
    const user = await this.prismaService.user.findUnique({
      where: {
        email: authDTO.email,
      },
    });
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    //so sánh mật khẩu gửi lên với hash đã lưu trong DB
    const passwordMatched = await argon.verify(
      user.hashedPassword,
      authDTO.password,
    );
    if (!passwordMatched) {
      throw new ForbiddenException('Incorrect password');
    }
    //đăng nhập thành công thì trả về access token
    return await this.signJwtToken(user.id, user.email);
  }

  //trả về một object, không phải string
  async signJwtToken(
    userId: number,
    email: string,
  ): Promise<{ accessToken: string }> {
    const payload = {
      sub: userId, //"sub" là quy ước của JWT để chứa id người dùng
      email,
    };
    const jwtString = await this.jwtService.signAsync(payload, {
      //Thời hạn token đọc từ biến JWT_EXPIRES_IN, mặc định 30 ngày.
      //Chấp nhận dạng '30d', '12h', '60m'. Đặt dài thì đỡ phải đăng nhập lại,
      //đổi lại token lỡ bị lộ sẽ dùng được tới tận lúc hết hạn: hệ thống không
      //lưu token ở đâu nên không thu hồi được, kể cả khi đổi mật khẩu.
      //ms khai báo expiresIn là literal dạng '30d' chứ không phải string
      //chung, nên phải ép về StringValue sau khi đọc từ biến môi trường
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
        '30d') as StringValue,
      secret: this.configService.get<string>('JWT_SECRET'),
    });
    return {
      accessToken: jwtString,
    };
  }
}
