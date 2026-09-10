import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../decorator/roles.decorator';

//guard này chạy SAU MyJwtGuard, nên request.user đã có sẵn
//nhiệm vụ duy nhất: so vai trò của user với danh sách @Roles(...) trên route
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    //đọc metadata ở cả cấp method và cấp class, method được ưu tiên
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    //route không khai báo @Roles thì ai đăng nhập cũng vào được
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    //JwtStrategy.validate đã gắn user kèm role vào request trước đó
    const request: Request = context.switchToHttp().getRequest();
    const user: { role?: Role } | undefined = request.user;

    if (!user?.role) {
      throw new ForbiddenException('Không xác định được vai trò người dùng');
    }

    //ADMIN đi qua mọi route, khỏi phải liệt kê ở từng chỗ
    if (user.role === Role.ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
