import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomImage as RoomImageEntity } from './entities/room-image.entity';
import { CreateRoomImageDto } from './dto/create-room-image.dto';
import { UpdateRoomImageDto } from './dto/update-room-image.dto';

@Injectable()
export class RoomImageService {
  constructor(
    @InjectRepository(RoomImageEntity)
    private readonly roomImageRepository: Repository<RoomImageEntity>,
  ) {}
  async findRoomImages(id: number) {
    return await this.roomImageRepository.find({
      select: { fk_image: true },
      where: { fk_room: id },
    });
  }

  async removeRoomImage(id: number) {
    await this.roomImageRepository.delete({
      fk_room: id,
    });
  }

  async insertRoomImage(createRoomImageDto: CreateRoomImageDto) {
    const newRoomImage = await this.roomImageRepository.create(
      createRoomImageDto,
    );
    return this.roomImageRepository.save(newRoomImage);
  }
}
