import { RoomGateway } from './room.gateway';

function createSocket(userId?: number) {
  const roomBroadcast = { emit: jest.fn() };
  const rooms = new Set<string>(['socket-1']);
  const socket: any = {
    id: 'socket-1',
    data: userId ? { authenticatedUserId: userId } : {},
    rooms,
    handshake: { auth: {}, headers: {} },
    emit: jest.fn(),
    to: jest.fn(() => roomBroadcast),
    join: jest.fn(async (roomName: string) => rooms.add(roomName)),
    leave: jest.fn(async (roomName: string) => rooms.delete(roomName)),
    disconnect: jest.fn(),
  };
  return { socket, roomBroadcast };
}

describe('RoomGateway socket lifecycle', () => {
  let roomService: any;
  let imageService: any;
  let roomImageService: any;
  let userService: any;
  let jwtService: any;
  let gateway: RoomGateway;
  let serverBroadcast: { emit: jest.Mock };

  beforeEach(() => {
    roomService = {
      create: jest.fn(),
      addGuest: jest.fn(),
      findByName: jest.fn(),
      reopenRoomAfterGuestLeaves: jest.fn().mockResolvedValue(true),
      remove: jest.fn(),
    };
    imageService = {
      getUrlsByCategory: jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: 18 }, (_, id) => ({ id: id + 1 })),
        ),
      getDeckImages: jest.fn(),
      getDeckImagesById: jest.fn(),
      findByUserId: jest.fn(),
      count: jest.fn(),
    };
    roomImageService = { removeRoomImage: jest.fn() };
    userService = {
      findOne: jest.fn().mockResolvedValue({ id: 7, username: 'player' }),
    };
    jwtService = { verifyAsync: jest.fn() };
    gateway = new RoomGateway(
      roomService,
      imageService,
      roomImageService,
      userService,
      jwtService,
    );
    serverBroadcast = { emit: jest.fn() };
    (gateway as any).wss = {
      in: jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue([]) })),
      to: jest.fn(() => serverBroadcast),
    };
  });

  afterEach(() => gateway.onModuleDestroy());

  it('rejects an unauthenticated handshake before connection', async () => {
    const { socket } = createSocket();
    let middleware: (client: any, next: (error?: Error) => void) => void;
    let handshakeError: Error | undefined;
    const server: any = {
      use: jest.fn((handler) => {
        middleware = handler;
      }),
    };

    gateway.afterInit(server);
    await new Promise<void>((resolve) => {
      middleware(socket, (error) => {
        handshakeError = error;
        resolve();
      });
    });

    expect(handshakeError).toMatchObject({
      message: 'WebSocket authentication is required',
      data: { code: 'UNAUTHORIZED' },
    });
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('binds a created room to the authenticated host identity', async () => {
    const { socket } = createSocket(7);
    roomService.findByName.mockResolvedValue(null);
    roomService.create.mockResolvedValue({ id: 42, name: 'room-42' });

    await gateway.createRoom(socket, {
      name: 'room-42',
      userId: 7,
      category: 'animals',
    });

    expect(socket.join).toHaveBeenCalledWith('room-42');
    expect(socket.data.roomSession).toEqual({
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'host',
    });
  });

  it('blocks room events when a socket spoofs the other player role', async () => {
    const { socket, roomBroadcast } = createSocket(7);
    socket.rooms.add('room-42');
    socket.data.roomSession = {
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'host',
    };

    await gateway.askQuestion(socket, {
      name: 'room-42',
      player: 'guest',
      question: 'Question?',
    });

    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(roomBroadcast.emit).not.toHaveBeenCalled();
  });

  it('reopens a waiting room when its guest does not reconnect', async () => {
    roomService.findByName.mockResolvedValue({
      id: 42,
      name: 'room-42',
      hostplayerid: 1,
      guestplayerid: 7,
      hostcharacterid: null,
      guestcharacterid: null,
    });

    await (gateway as any).finalizeDisconnection({
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'guest',
    });

    expect(roomService.reopenRoomAfterGuestLeaves).toHaveBeenCalledWith(
      'room-42',
      7,
    );
    expect(serverBroadcast.emit).toHaveBeenCalledWith('guestLeftBeforeStart', {
      roomId: 42,
      roomName: 'room-42',
    });
    expect(roomService.remove).not.toHaveBeenCalled();
  });

  it('deletes a waiting room when its host leaves', async () => {
    roomService.findByName.mockResolvedValue({
      id: 42,
      name: 'room-42',
      hostplayerid: 7,
      guestplayerid: null,
      hostcharacterid: null,
      guestcharacterid: null,
    });

    await (gateway as any).finalizeDisconnection({
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'host',
    });

    expect(roomImageService.removeRoomImage).toHaveBeenCalledWith(42);
    expect(roomService.remove).toHaveBeenCalledWith(42);
    expect(roomService.reopenRoomAfterGuestLeaves).not.toHaveBeenCalled();
  });

  it('resumes only a room that belongs to the authenticated user', async () => {
    const { socket } = createSocket(7);
    roomService.findByName.mockResolvedValue({
      id: 42,
      name: 'room-42',
      status: 'closed',
      hostplayerid: 1,
      guestplayerid: 7,
      hostcharacterid: 3,
      guestcharacterid: null,
    });

    await gateway.resumeRoom(socket, { name: 'room-42' });

    expect(socket.data.roomSession.role).toBe('guest');
    expect(socket.emit).toHaveBeenCalledWith(
      'room resumed',
      expect.objectContaining({ roomId: 42, role: 'guest' }),
    );
  });
});
