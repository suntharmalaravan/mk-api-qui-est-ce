import {
  Inject,
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, Room as RoomEntity } from './entities/room.entity';
import { RoomImage as RoomImageEntity } from './entities/roomImage.entity';
@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
    @InjectRepository(RoomImageEntity)
    private readonly roomImageRepository: Repository<RoomImageEntity>,
  ) {}

  create(createRoomDto: CreateRoomDto) {
    const newRoom = this.roomRepository.create(createRoomDto);
    return this.roomRepository.save(newRoom);
  }

  async remove(id: number): Promise<void> {
    await this.roomRepository.delete(id);
  }

  async findByName(name: string) {
    const user = await this.roomRepository.findOne({
      select: { id: true, hostPlayerId: true },
      where: { name },
    });
    return user;
  }
  async findRoomDetailsAndImages(id: number) {
    return await this.roomRepository.findOne({
      select: {
        id: true,
        name: true,
        hostCharacterId: true,
        guestCharacterId: true,
      },
      where: { id },
    });
  }
  async findRoomImagesId(id: number) {
    return await this.roomImageRepository.find({
      select: { fk_image: true },
      where: { fk_room: id },
    });
  }
  async chooseCharacter(id: number, player: string, characterId: number) {
    if (player == 'guest') {
      const room = await this.roomRepository.findOne({
        select: { id: true, guestCharacterId: true },
        where: { id },
      });
      room.guestCharacterId = characterId;
      await this.roomRepository.update(id, room);
      return room;
    } else {
      const room = await this.roomRepository.findOne({
        select: { id: true, hostCharacterId: true },
        where: { id },
      });
      room.hostCharacterId = characterId;
      await this.roomRepository.update(id, room);
      return room;
    }
  }

  async addGuest(id: number, roomUpdates: any): Promise<Room> {
    const room = await this.roomRepository.findOne({
      select: {
        guestPlayerId: true,
        status: true,
      },
      where: { id },
    });
    if (!room) {
      throw new NotFoundException('Room is not found');
    }
    if (room.status == 'closed') {
      throw new NotAcceptableException('Room is already closed');
    }
    room.guestPlayerId = roomUpdates.guestPlayerId;
    room.status = 'closed';
    console.log(room);
    await this.roomRepository.update(id, room);
    return room;
  }
}
