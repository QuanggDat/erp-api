import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorator';
import { MyJwtGuard } from '../auth/guard';
import { GetNotesQueryDTO, InsertNoteDTO, UpdateNoteDTO } from './dto';
import { NoteService } from './note.service';

//đặt guard ở cấp controller: MỌI route bên dưới đều yêu cầu accessToken
@UseGuards(MyJwtGuard)
@Controller('notes')
export class NoteController {
  constructor(private noteService: NoteService) {}

  //GET: .../notes?page=1&limit=10
  @Get()
  getNotes(@GetUser('id') userId: number, @Query() query: GetNotesQueryDTO) {
    return this.noteService.getNotes(userId, query);
  }

  //GET: .../notes/123
  @Get(':id')
  getNoteById(
    @GetUser('id') userId: number,
    //ParseIntPipe đổi "123" trên URL thành số 123, sai kiểu thì trả 400
    @Param('id', ParseIntPipe) noteId: number,
  ) {
    return this.noteService.getNoteById(userId, noteId);
  }

  //POST: .../notes
  @Post()
  insertNote(
    @GetUser('id') userId: number,
    @Body() insertNoteDTO: InsertNoteDTO,
  ) {
    return this.noteService.insertNote(userId, insertNoteDTO);
  }

  //PATCH: .../notes/123
  @Patch(':id')
  updateNoteById(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) noteId: number,
    @Body() updateNoteDTO: UpdateNoteDTO,
  ) {
    return this.noteService.updateNoteById(userId, noteId, updateNoteDTO);
  }

  //DELETE: .../notes/123
  //xoá xong không trả về gì nên dùng 204 No Content
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteNoteById(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) noteId: number,
  ) {
    return this.noteService.deleteNoteById(userId, noteId);
  }
}
