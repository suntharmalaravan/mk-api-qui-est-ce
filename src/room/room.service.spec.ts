import { ConflictException } from '@nestjs/common';
import { RoomService } from './room.service';

function createQueryBuilder(affected: number) {
  const builder: any = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  for (const method of ['update', 'set', 'where', 'andWhere']) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

describe('RoomService atomic lifecycle', () => {
  it('claims the guest slot with a conditional update', async () => {
    const builder = createQueryBuilder(1);
    const room = {
      id: 1,
      name: 'room-1',
      status: 'closed',
      hostplayerid: 10,
      guestplayerid: 20,
    };
    const repository: any = {
      createQueryBuilder: jest.fn(() => builder),
      findOne: jest.fn().mockResolvedValue(room),
    };
    const service = new RoomService(repository);

    await expect(
      service.addGuest('room-1', { guestplayerid: 20 }),
    ).resolves.toEqual(room);
    expect(builder.andWhere).toHaveBeenCalledWith('guestplayerid IS NULL');
    expect(builder.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a second guest when the atomic claim loses the race', async () => {
    const builder = createQueryBuilder(0);
    const repository: any = {
      createQueryBuilder: jest.fn(() => builder),
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'room-1',
        status: 'closed',
        hostplayerid: 10,
        guestplayerid: 20,
      }),
    };
    const service = new RoomService(repository);

    await expect(
      service.addGuest('room-1', { guestplayerid: 30 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records game completion only when the state transition wins', async () => {
    const successfulBuilder = createQueryBuilder(1);
    const failedBuilder = createQueryBuilder(0);
    const repository: any = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(successfulBuilder)
        .mockReturnValueOnce(failedBuilder),
    };
    const service = new RoomService(repository);

    await expect(service.finishGame('room-1')).resolves.toBe(true);
    await expect(service.finishGame('room-1')).resolves.toBe(false);
  });

  it('reopens a guest slot only while no character has been chosen', async () => {
    const builder = createQueryBuilder(1);
    const repository: any = {
      createQueryBuilder: jest.fn(() => builder),
    };
    const service = new RoomService(repository);

    await expect(
      service.reopenRoomAfterGuestLeaves('room-1', 20),
    ).resolves.toBe(true);
    expect(builder.andWhere).toHaveBeenCalledWith('guestcharacterid IS NULL');
    expect(builder.andWhere).toHaveBeenCalledWith(
      'guestplayerid = :guestPlayerId',
      { guestPlayerId: 20 },
    );
  });
});
