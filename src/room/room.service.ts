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

  async addGuest(name: string, roomUpdates: any): Promise<Room> {
    const room = await this.roomRepository.findOne({
      select: {
        id: true,
        guestPlayerId: true,
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
    room.guestPlayerId = roomUpdates.guestPlayerId;
    room.status = 'closed';
    await this.roomRepository.update(room.id, room);
    return room;
  }
}
