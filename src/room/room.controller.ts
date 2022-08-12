import { Get, Param, Controller, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from 'src/image/image.service';

@Controller('api/rooms')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const roomDetails = await this.roomService.findRoomDetailsAndImages(+id);
    const roomImageIds = await this.roomService.findRoomImagesId(+id);
    const images = [];
    for (let i = 0; i < roomImageIds.length; i++) {
      images[i] = await this.imageService.getUrlById(roomImageIds[i].fk_image);
    }
    return {
      id: roomDetails.id,
      name: roomDetails.name,
      hostCharacterId: roomDetails.hostCharacterId,
      guestCharacterId: roomDetails.guestCharacterId,
      images,
    };
  }

  @Get(':id/images')
  @UseGuards(JwtAuthGuard)
  async findOneImages(@Param('id') id: string) {
    const roomImageIds = await this.roomService.findRoomImagesId(+id);
    const images = [];
    for (let i = 0; i < roomImageIds.length; i++) {
      images[i] = await this.imageService.getUrlById(roomImageIds[i].fk_image);
    }
    return {
      images,
    };
  }
}
