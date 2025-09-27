import { Controller } from '@nestjs/common';
import { RoomImageService } from './room-image.service';

@Controller('roomImage')
export class RoomImageController {
  constructor(private readonly roomImageService: RoomImageService) {}
}
