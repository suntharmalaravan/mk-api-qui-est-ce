import { ConflictException } from '@nestjs/common';
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
      isCategoryVisible: jest.fn().mockResolvedValue(true),
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

  it('broadcasts only an acknowledged theme and enforces the host role', async () => {
    const settings = { roomName: 'room-42', revision: 3 };
    const lobby = { change: jest.fn().mockResolvedValue(settings) };
    (gateway as any).lobby = lobby;
    const { socket } = createSocket(7);
    socket.rooms.add('room-42');
    socket.data.roomSession = {
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'host',
    };
    const data = {
      name: 'room-42',
      mode: 'category',
      category: 'animals',
      revision: 2,
    };
    expect(await gateway.changeLobbyTheme(socket, data)).toEqual(settings);
    expect(lobby.change).toHaveBeenCalledWith('room-42', 7, data, 2);
    expect(serverBroadcast.emit).toHaveBeenCalledWith(
      'lobby theme changed',
      settings,
    );
    socket.data.roomSession.role = 'guest';
    await gateway.changeLobbyTheme(socket, data);
    expect(lobby.change).toHaveBeenCalledTimes(1);
  });

  it('passes the revision into the sole start path and never broadcasts a rejected start', async () => {
    const settings = { roomName: 'room-42', revision: 3, started: true };
    const lobby = { start: jest.fn().mockResolvedValue(settings) };
    (gateway as any).lobby = lobby;
    const { socket } = createSocket(7);
    socket.rooms.add('room-42');
    socket.data.roomSession = {
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'host',
    };
    await gateway.startGame(socket, { name: 'room-42', revision: 3 });
    expect(lobby.start).toHaveBeenCalledWith('room-42', 7, 3);
    expect(serverBroadcast.emit).toHaveBeenCalledWith('game started', settings);
    lobby.start.mockRejectedValue(new Error('Already started'));
    await gateway.startGame(socket, { name: 'room-42', revision: 3 });
    expect(serverBroadcast.emit).toHaveBeenCalledTimes(1);
  });

  it('does not reopen a game already in character selection when its guest leaves', async () => {
    roomService.findByName.mockResolvedValue({
      id: 42,
      name: 'room-42',
      hostplayerid: 1,
      guestplayerid: 7,
      hostcharacterid: null,
      guestcharacterid: null,
      selection_started_at: new Date(),
    });
    await (gateway as any).finalizeDisconnection({
      roomId: 42,
      roomName: 'room-42',
      userId: 7,
      role: 'guest',
    });
    expect(roomService.reopenRoomAfterGuestLeaves).not.toHaveBeenCalled();
    expect(roomService.remove).toHaveBeenCalledWith(42);
  });

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

  it('refuses to create a room on a category hidden from the back office', async () => {
    const { socket } = createSocket(7);
    roomService.findByName.mockResolvedValue(null);
    imageService.isCategoryVisible.mockResolvedValue(false);

    await gateway.createRoom(socket, {
      name: 'room-42',
      userId: 7,
      category: 'animals',
    });

    expect(imageService.isCategoryVisible).toHaveBeenCalledWith('animals');
    expect(imageService.getUrlsByCategory).not.toHaveBeenCalled();
    expect(roomService.create).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        message: expect.stringContaining('plus disponible'),
      }),
    );
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

  function bindToRoom(socket: any, role: 'host' | 'guest', userId = 7) {
    socket.rooms.add('room-42');
    socket.data.roomSession = {
      roomId: 42,
      roomName: 'room-42',
      userId,
      role,
    };
  }

  const startedRoom = {
    id: 42,
    name: 'room-42',
    status: 'closed',
    hostplayerid: 1,
    guestplayerid: 7,
    hostcharacterid: null,
    guestcharacterid: null,
    selection_started_at: new Date(),
  };

  it('acknowledges a refused character choice instead of leaving both players waiting', async () => {
    const { socket, roomBroadcast } = createSocket(7);
    bindToRoom(socket, 'guest');
    roomService.chooseCharacter = jest.fn().mockRejectedValue(
      new ConflictException({
        code: 'CHARACTER_NOT_IN_GAME',
        message: 'Hors deck',
      }),
    );

    const ack = await gateway.chooseCharacter(socket, {
      name: 'room-42',
      player: 'guest',
      characterId: 5,
    });

    expect(ack).toEqual({
      error: { code: 'CHARACTER_NOT_IN_GAME', message: 'Hors deck' },
    });
    expect(serverBroadcast.emit).not.toHaveBeenCalled();
    expect(roomBroadcast.emit).not.toHaveBeenCalled();
  });

  it('tells the opponent a character was chosen without revealing it', async () => {
    const { socket, roomBroadcast } = createSocket(7);
    bindToRoom(socket, 'guest');
    roomService.chooseCharacter = jest
      .fn()
      .mockResolvedValue({ ...startedRoom, guestcharacterid: 5 });

    const ack = await gateway.chooseCharacter(socket, {
      name: 'room-42',
      player: 'guest',
      characterId: '5',
    });

    expect(roomService.chooseCharacter).toHaveBeenCalledWith(
      'room-42',
      'guest',
      5,
    );
    expect(ack).toEqual({ ok: true, bothChosen: false });
    expect(roomBroadcast.emit).toHaveBeenCalledWith('character chosen', {
      player: 'guest',
    });
    expect(socket.emit).toHaveBeenCalledWith('character chosen', {
      player: 'guest',
      characterId: 5,
    });
  });

  it('sends the whole room to the board once the second choice is recorded', async () => {
    const { socket } = createSocket(7);
    bindToRoom(socket, 'guest');
    roomService.chooseCharacter = jest.fn().mockResolvedValue({
      ...startedRoom,
      hostcharacterid: 3,
      guestcharacterid: 5,
    });

    const ack = await gateway.chooseCharacter(socket, {
      name: 'room-42',
      player: 'guest',
      characterId: 5,
    });

    expect(ack).toEqual({ ok: true, bothChosen: true });
    expect(serverBroadcast.emit).toHaveBeenCalledWith('go board', {
      turn: 'host',
    });
  });

  it('closes a started game for the opponent and frees their socket when a player quits', async () => {
    const { socket } = createSocket(7);
    bindToRoom(socket, 'guest');
    const opponent: any = {
      data: {
        roomSession: {
          roomId: 42,
          roomName: 'room-42',
          userId: 1,
          role: 'host',
        },
      },
      leave: jest.fn(),
    };
    (gateway as any).wss.in = jest.fn(() => ({
      fetchSockets: jest.fn().mockResolvedValue([opponent]),
    }));
    roomService.findByName.mockResolvedValue(startedRoom);

    await gateway.quitRoom(socket, { name: 'room-42' });

    expect(serverBroadcast.emit).toHaveBeenCalledWith('quit', { player: 7 });
    expect(opponent.data.roomSession).toBeUndefined();
    expect(opponent.leave).toHaveBeenCalledWith('room-42');
    expect(roomService.reopenRoomAfterGuestLeaves).not.toHaveBeenCalled();
    expect(roomService.remove).toHaveBeenCalledWith(42);
    expect(socket.data.roomSession).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith('room left', {
      roomId: 42,
      roomName: 'room-42',
    });
  });

  it('accepts the legacy leave event and treats leaving a closed room as done', async () => {
    const { socket } = createSocket(7);

    await gateway.leaveRoom(socket, { room: 'room-42' });

    expect(socket.emit).toHaveBeenCalledWith('room left', {
      roomName: 'room-42',
    });
    expect(socket.emit).not.toHaveBeenCalledWith('error', expect.anything());
    expect(roomService.remove).not.toHaveBeenCalled();
  });

  it('announces a dropped player at once but keeps the room during the grace period', () => {
    const { socket } = createSocket(7);
    bindToRoom(socket, 'guest');

    gateway.handleDisconnect(socket);

    expect(serverBroadcast.emit).toHaveBeenCalledWith(
      'player connection lost',
      expect.objectContaining({ userId: 7, role: 'guest' }),
    );
    expect((gateway as any).pendingDisconnects.size).toBe(1);
    expect(roomService.remove).not.toHaveBeenCalled();
  });

  describe('turns', () => {
    const turnOf = () => (gateway as any).turns.get('room-42')?.turn;
    const giveTurnTo = (turn: 'host' | 'guest', since = Date.now()) =>
      (gateway as any).turns.set('room-42', { turn, since });

    it('lets the player holding the turn pass it, exactly once', () => {
      const { socket } = createSocket(7);
      bindToRoom(socket, 'host');
      giveTurnTo('host');
      const pass = { name: 'room-42', player: 'host', intent: 'pass' };

      expect(gateway.changeTurn(socket, pass)).toEqual({ turn: 'guest' });
      expect(serverBroadcast.emit).toHaveBeenCalledWith('start turn', {
        turn: 'guest',
      });

      // A double tap, or the timer racing the button, must not flip it back.
      expect(gateway.changeTurn(socket, pass)).toEqual({ turn: 'guest' });
      expect(serverBroadcast.emit).toHaveBeenCalledTimes(1);
    });

    it('refuses a turn change signed with the opponent role', () => {
      const { socket } = createSocket(7);
      bindToRoom(socket, 'host');
      giveTurnTo('host');

      expect(
        gateway.changeTurn(socket, {
          name: 'room-42',
          player: 'guest',
          intent: 'pass',
        }),
      ).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(turnOf()).toBe('host');
    });

    it('lets the waiting player take a stalled turn only once it has overrun', () => {
      const now = jest.spyOn(Date, 'now');
      try {
        const { socket } = createSocket(7);
        bindToRoom(socket, 'guest');
        giveTurnTo('host', 1_000_000);
        const claim = { name: 'room-42', player: 'guest', intent: 'claim' };

        now.mockReturnValue(1_000_000 + 30_000);
        expect(gateway.changeTurn(socket, claim)).toEqual({ turn: 'host' });
        expect(serverBroadcast.emit).not.toHaveBeenCalled();

        now.mockReturnValue(1_000_000 + 68_000);
        expect(gateway.changeTurn(socket, claim)).toEqual({ turn: 'guest' });
        expect(serverBroadcast.emit).toHaveBeenCalledWith('start turn', {
          turn: 'guest',
        });
      } finally {
        now.mockRestore();
      }
    });

    it('hands the turn over after a wrong guess, but not after the last one', async () => {
      const guess = jest.fn().mockResolvedValue({
        player: 'host',
        right: false,
        livesLeft: 1,
        terminal: false,
      });
      (gateway as any).atelierGame = { enabled: true, guess };
      const { socket } = createSocket(7);
      bindToRoom(socket, 'host');
      giveTurnTo('host');

      await gateway.selectCharacter(socket, {
        name: 'room-42',
        player: 'host',
        characterId: 5,
      });
      expect(guess).toHaveBeenCalledWith('room-42', 7, 'host', 5);
      expect(serverBroadcast.emit).toHaveBeenCalledWith('start turn', {
        turn: 'guest',
      });

      guess.mockResolvedValue({
        player: 'guest',
        right: false,
        livesLeft: 0,
        terminal: true,
      });
      serverBroadcast.emit.mockClear();
      const { socket: guest } = createSocket(1);
      bindToRoom(guest, 'guest', 1);
      await gateway.selectCharacter(guest, {
        name: 'room-42',
        player: 'guest',
        characterId: 3,
      });
      expect(serverBroadcast.emit).not.toHaveBeenCalledWith(
        'start turn',
        expect.anything(),
      );
      expect(turnOf()).toBeUndefined();
    });

    it('refuses a question or a guess from the player without the turn', async () => {
      const guess = jest.fn();
      (gateway as any).atelierGame = { enabled: true, guess };
      const { socket, roomBroadcast } = createSocket(7);
      bindToRoom(socket, 'guest');
      giveTurnTo('host');

      await gateway.selectCharacter(socket, {
        name: 'room-42',
        player: 'guest',
        characterId: 5,
      });
      await gateway.askQuestion(socket, {
        name: 'room-42',
        player: 'guest',
        question: 'Lunettes ?',
      });

      expect(guess).not.toHaveBeenCalled();
      expect(roomBroadcast.emit).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'NOT_YOUR_TURN', action: 'select' }),
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'NOT_YOUR_TURN', action: 'question' }),
      );
    });

    it('gives the first turn to the host once both characters are chosen', async () => {
      const { socket } = createSocket(7);
      bindToRoom(socket, 'guest');
      roomService.chooseCharacter = jest.fn().mockResolvedValue({
        ...startedRoom,
        hostcharacterid: 3,
        guestcharacterid: 5,
      });

      await gateway.chooseCharacter(socket, {
        name: 'room-42',
        player: 'guest',
        characterId: 5,
      });

      expect(serverBroadcast.emit).toHaveBeenCalledWith('start turn', {
        turn: 'host',
      });
      expect(turnOf()).toBe('host');
    });
  });
});
