import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/enums';

//user đã được JwtStrategy.validate() gắn vào request
type JwtUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  createdAt: Date;
};

//decorator "tự chế" để lấy user ra khỏi request cho gọn
//dùng @GetUser() lấy cả object, @GetUser('id') chỉ lấy một field
export const GetUser = createParamDecorator(
  (data: keyof JwtUser | undefined, context: ExecutionContext) => {
    const request: Request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser;
    return data ? user[data] : user;
  },
);
