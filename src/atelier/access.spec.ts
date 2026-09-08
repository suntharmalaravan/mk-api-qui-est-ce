import { RoomController } from '../room/room.controller';
import { JwtStrategy } from '../auth/auth.strategy';
import { ConfigService } from '@nestjs/config';
describe('atelier prerequisite: authenticated identity and secret privacy', () => {
  const room = {
    id: 1,
    name: 'R',
    status: 'closed',
    hostplayerid: 7,
    guestplayerid: 9,
    hostcharacterid: 11,
    guestcharacterid: 12,
  };
  const roomService: any = {
    findRoomDetailsAndImages: jest.fn(async () => room),
  };
  const images: any = { getUrlById: jest.fn() };
  const board: any = { findRoomImages: jest.fn(async () => []) };
  const controller = new RoomController(roomService, images, board);
  beforeEach(() => jest.clearAllMocks());
  it('only returns the caller’s secret before the result', async () => {
    expect(await controller.findOne(1, { user: { id: 7 } })).toMatchObject({
      hostcharacterid: 11,
      guestcharacterid: null,
    });
    expect(await controller.findOne(1, { user: { id: 9 } })).toMatchObject({
      hostcharacterid: null,
      guestcharacterid: 12,
    });
  });
  it('rejects outsiders before reading the board', async () => {
    await expect(
      controller.findOne(1, { user: { id: 42 } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      controller.findOneImages(1, { user: { id: 42 } }),
    ).rejects.toMatchObject({ status: 403 });
    expect(board.findRoomImages).not.toHaveBeenCalled();
  });
  it('resolves HTTP identity from the signed immutable id, never a username', async () => {
    const users: any = {
      findPrincipal: jest.fn(async () => ({ id: 7, username: 'renamed' })),
    };
    const strategy = new JwtStrategy(
      users,
      new ConfigService({ SECRET: 'local-test-secret' }),
    );
    expect(await strategy.validate({ id: 7 })).toEqual({
      id: 7,
      username: 'renamed',
    });
    expect(await strategy.validate({ id: '7' })).toBeNull();
    expect(await strategy.validate({})).toBeNull();
    expect(users.findPrincipal).toHaveBeenCalledTimes(1);
  });
});
