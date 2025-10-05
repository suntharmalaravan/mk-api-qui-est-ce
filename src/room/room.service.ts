import {
  Injectable,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, Room as RoomEntity } from './entities/room.entity';
@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
  ) {}

  create(createRoomDto: CreateRoomDto) {
    const newRoom = this.roomRepository.create(createRoomDto);
    return this.roomRepository.save(newRoom);
  }

  async remove(id: number): Promise<void> {
    await this.roomRepository.delete(id);
  }

  async findByName(name: string) {
    const room = await this.roomRepository.findOne({
      select: {
        id: true,
        hostplayerid: true,
        category: true,
        guestcharacterid: true,
        hostcharacterid: true,
      },
      where: { name },
    });
    return room;
  }
  async findRoomDetailsAndImages(id: number) {
    return await this.roomRepository.findOne({
      select: {
        id: true,
        name: true,
        hostcharacterid: true,
        guestcharacterid: true,
      },
      where: { id },
    });
  }

  async chooseCharacter(name: string, player: string, characterId: number) {
    if (player == 'guest') {
      const room = await this.roomRepository.findOne({
        select: { id: true, guestcharacterid: true },
        where: { name },
      });
      room.guestcharacterid = characterId;
      await this.roomRepository.update(room.id, room);
      return room;
    } else {
      const room = await this.roomRepository.findOne({
        select: { id: true, hostcharacterid: true },
        where: { name },
      });
      room.hostcharacterid = characterId;
      await this.roomRepository.update(room.id, room);
      return room;
    }
  }

  async addGuest(name: string, roomUpdates: any): Promise<Room> {
    const room = await this.roomRepository.findOne({
      select: {
        id: true,
        guestplayerid: true,
        hostplayerid: true,
        status: true,
      },
      where: { name },
    });
    if (!room) {
      throw new NotFoundException('Room is not found');
    }
    if (room.status == 'closed') {
      throw new NotAcceptableException('Room is already closed');
    }
    room.guestplayerid = roomUpdates.guestplayerid;
    room.status = 'closed';
    await this.roomRepository.update(room.id, room);
    return room;
  }

  async selectCharacter(name: string, player: string, characterId: number) {
    const room = await this.roomRepository.findOne({
      select: { id: true, hostcharacterid: true, guestcharacterid: true },
      where: { name },
    });
    if (player == 'guest') {
      return room.guestcharacterid == characterId;
    }
    if (player == 'host') {
      return room.hostcharacterid == characterId;
    }
  }
}
