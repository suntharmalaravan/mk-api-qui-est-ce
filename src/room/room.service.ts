import {
  ConflictException,
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
        name: true,
        hostplayerid: true,
        guestplayerid: true,
        status: true,
        category: true,
        guestcharacterid: true,
        hostcharacterid: true,
        mode: true,
        deck_id: true,
        custom_library_user_id: true,
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

  async findAll() {
    return await this.roomRepository.find({
      select: {
        id: true,
        name: true,
        hostplayerid: true,
        guestplayerid: true,
        status: true,
        category: true,
      },
    });
  }

  async chooseCharacter(name: string, player: string, characterId: number) {
    if (player !== 'host' && player !== 'guest') {
      throw new NotAcceptableException('Invalid player role');
    }

    const characterColumn =
      player === 'guest' ? 'guestcharacterid' : 'hostcharacterid';
    const characterUpdate =
      player === 'guest'
        ? { guestcharacterid: characterId }
        : { hostcharacterid: characterId };
    const result = await this.roomRepository
      .createQueryBuilder()
      .update(RoomEntity)
      .set(characterUpdate)
      .where('name = :name', { name })
      .andWhere('status = :status', { status: 'closed' })
      .andWhere(`${characterColumn} IS NULL`)
      .execute();

    if (result.affected !== 1) {
      const room = await this.findByName(name);
      if (!room) throw new NotFoundException('Room is not found');
      throw new ConflictException(
        'Character is already selected or game is not active',
      );
    }

    return this.findByName(name);
  }

  async addGuest(name: string, roomUpdates: any): Promise<Room> {
    const guestPlayerId = Number(roomUpdates.guestplayerid);
    const result = await this.roomRepository
      .createQueryBuilder()
      .update(RoomEntity)
      .set({ guestplayerid: guestPlayerId, status: 'closed' })
      .where('name = :name', { name })
      .andWhere('status = :status', { status: 'open' })
      .andWhere('guestplayerid IS NULL')
      .andWhere('hostplayerid <> :guestPlayerId', { guestPlayerId })
      .execute();

    if (result.affected !== 1) {
      const room = await this.findByName(name);
      if (!room) throw new NotFoundException('Room is not found');
      if (room.hostplayerid === guestPlayerId) {
        throw new NotAcceptableException('Host cannot join as guest');
      }
      throw new ConflictException('Room is already full');
    }

    return (await this.findByName(name)) as Room;
  }

  async reopenRoomAfterGuestLeaves(
    name: string,
    guestPlayerId?: number,
  ): Promise<boolean> {
    const query = this.roomRepository
      .createQueryBuilder()
      .update(RoomEntity)
      .set({ guestplayerid: null, status: 'open' })
      .where('name = :name', { name })
      .andWhere('status = :status', { status: 'closed' })
      .andWhere('hostcharacterid IS NULL')
      .andWhere('guestcharacterid IS NULL');

    if (guestPlayerId !== undefined) {
      query.andWhere('guestplayerid = :guestPlayerId', { guestPlayerId });
    }

    const result = await query.execute();
    return result.affected === 1;
  }

  /** Guarantees that rewards for a game can only be applied once. */
  async finishGame(name: string): Promise<boolean> {
    const result = await this.roomRepository
      .createQueryBuilder()
      .update(RoomEntity)
      .set({ status: 'finished' })
      .where('name = :name', { name })
      .andWhere('status = :status', { status: 'closed' })
      .andWhere('hostcharacterid IS NOT NULL')
      .andWhere('guestcharacterid IS NOT NULL')
      .execute();

    return result.affected === 1;
  }

  async selectCharacter(name: string, player: string, characterId: number) {
    if (player !== 'host' && player !== 'guest') {
      throw new NotAcceptableException('Invalid player role');
    }
    const room = await this.roomRepository.findOne({
      select: {
        id: true,
        status: true,
        hostcharacterid: true,
        guestcharacterid: true,
      },
      where: { name },
    });
    if (!room) throw new NotFoundException('Room is not found');
    if (
      room.status !== 'closed' ||
      room.hostcharacterid === null ||
      room.guestcharacterid === null
    ) {
      throw new NotAcceptableException(
        'Game is not ready for a final selection',
      );
    }
    if (player == 'guest') {
      return room.hostcharacterid == characterId;
    }
    if (player == 'host') {
      return room.guestcharacterid == characterId;
    }
  }
}
