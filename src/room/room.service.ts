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

  async addGuest(id: number, roomUpdates: any): Promise<Room> {
    const room = await this.roomRepository.findOne({
      select: { id: true, guestPlayerId: true, status: true },
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
    await this.roomRepository.update(id, room);
    return room;
  }
}
