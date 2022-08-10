import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id/scores')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() score: number) {
    return this.userService.updateScore(+id, score);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() request: any) {
    if (+id == request.user.id) {
      return this.userService.remove(+id);
    } else {
      throw new UnauthorizedException();
    }
  }
}
