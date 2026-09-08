import { Get, Param, Controller, UseGuards, Req, ParseIntPipe, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from 'src/image/image.service';
import { RoomImageService } from 'src/room-image/room-image.service';

@Controller('api/rooms')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
    private readonly roomImageService: RoomImageService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: { user: { id: number } }) {
    const roomDetails = await this.memberRoom(id, req.user.id);
    const roomImageIds = await this.roomImageService.findRoomImages(+id);
    const images = [];
    for (let i = 0; i < roomImageIds.length; i++) {
      images[i] = await this.imageService.getUrlById(roomImageIds[i].fk_image);
    }
    return {
      id: roomDetails.id,
      name: roomDetails.name,
      hostcharacterid: roomDetails.status === 'finished' || roomDetails.hostplayerid === req.user.id ? roomDetails.hostcharacterid : null,
      guestcharacterid: roomDetails.status === 'finished' || roomDetails.guestplayerid === req.user.id ? roomDetails.guestcharacterid : null,
      images,
    };
  }

  @Get(':id/images')
  @UseGuards(JwtAuthGuard)
  async findOneImages(@Param('id', ParseIntPipe) id: number, @Req() req: { user: { id: number } }) {
    await this.memberRoom(id, req.user.id);
    const roomImageIds = await this.roomImageService.findRoomImages(+id);
    const images = [];
    for (let i = 0; i < roomImageIds.length; i++) {
      images[i] = await this.imageService.getUrlById(roomImageIds[i].fk_image);
    }
    return {
      images,
    };
  }

  private async memberRoom(id: number, userId: number) {
    const room = await this.roomService.findRoomDetailsAndImages(id);
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostplayerid !== userId && room.guestplayerid !== userId) throw new ForbiddenException();
    return room;
  }
}
