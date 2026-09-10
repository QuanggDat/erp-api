import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetNotesQueryDTO, InsertNoteDTO, UpdateNoteDTO } from './dto';

@Injectable()
export class NoteService {
  constructor(private prismaService: PrismaService) {}

  //lấy note của riêng user đang đăng nhập, có phân trang
  async getNotes(userId: number, query: GetNotesQueryDTO) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const where = { userId: userId };

    //chạy song song hai truy vấn: lấy 1 trang dữ liệu và đếm tổng số bản ghi
    const [items, total] = await Promise.all([
      this.prismaService.note.findMany({
        where,
        skip: skip,
        take: limit,
        orderBy: {
          createdAt: 'desc', //note mới nhất lên đầu để thứ tự trang luôn ổn định
        },
      }),
      this.prismaService.note.count({ where }),
    ]);

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

  //lấy một note theo id, nhưng vẫn phải đúng chủ sở hữu
  async getNoteById(userId: number, noteId: number) {
    const note = await this.prismaService.note.findFirst({
      where: {
        id: noteId,
        userId: userId, //note của người khác thì coi như không tồn tại
      },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  //tạo note mới, tự gắn userId của người đang đăng nhập
  insertNote(userId: number, insertNoteDTO: InsertNoteDTO) {
    return this.prismaService.note.create({
      data: {
        ...insertNoteDTO,
        userId: userId,
      },
    });
  }

  async updateNoteById(
    userId: number,
    noteId: number,
    updateNoteDTO: UpdateNoteDTO,
  ) {
    //kiểm tra quyền TRƯỚC khi sửa
    const note = await this.prismaService.note.findUnique({
      where: {
        id: noteId,
      },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.userId !== userId) {
      throw new ForbiddenException('Access to resource denied');
    }
    return this.prismaService.note.update({
      where: {
        id: noteId,
      },
      data: {
        ...updateNoteDTO,
      },
    });
  }

  async deleteNoteById(userId: number, noteId: number) {
    //cũng phải kiểm tra quyền TRƯỚC khi xoá
    const note = await this.prismaService.note.findUnique({
      where: {
        id: noteId,
      },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.userId !== userId) {
      throw new ForbiddenException('Access to resource denied');
    }
    await this.prismaService.note.delete({
      where: {
        id: noteId,
      },
    });
  }
}
