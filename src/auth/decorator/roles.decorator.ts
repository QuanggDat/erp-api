import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

//gắn danh sách vai trò được phép vào metadata của route
//RolesGuard sẽ đọc lại metadata này để quyết định cho qua hay chặn
//dùng: @Roles(Role.ADMIN, Role.SALES)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
