import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialService } from './social.service';
class FriendRequestDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^@?[a-zA-Z0-9_]{3,20}$/)
  identifier: string;
}
class InviteDto {
  @IsInt() @Min(1) recipientId: number;
  @IsString() @Matches(/^[a-zA-Z0-9]{5}$/) roomName: string;
}
type AuthRequest = { user: { id: number } };
@Controller('api/social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}
  @Get() list(@Request() req: AuthRequest) {
    return this.social.list(req.user.id);
  }
  @Get('players/:id') player(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.social.player(req.user.id, id);
  }
  @Get('opponents/:roomName') opponent(
    @Request() req: AuthRequest,
    @Param('roomName') roomName: string,
  ) {
    return this.social.opponent(req.user.id, roomName);
  }
  @Post('friends') request(
    @Request() req: AuthRequest,
    @Body() dto: FriendRequestDto,
  ) {
    return this.social.request(req.user.id, dto.identifier);
  }
  @Post('friends/:id/accept') accept(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.social.respond(req.user.id, id, 'accept');
  }
  @Delete('friends/:id') remove(
    @Request() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.social.respond(req.user.id, id, 'remove');
  }
  @Post('invitations') invite(
    @Request() req: AuthRequest,
    @Body() dto: InviteDto,
  ) {
    return this.social.invite(req.user.id, dto.recipientId, dto.roomName);
  }
  @Delete('invitations/:id') dismiss(
    @Request() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.social.dismiss(req.user.id, id);
  }
}
