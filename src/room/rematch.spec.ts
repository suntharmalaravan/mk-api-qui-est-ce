import { RoomGateway } from './room.gateway';

const OLD = {
  id: 1,
  name: 'OLD12',
  status: 'finished',
  hostplayerid: 7,
  guestplayerid: 9,
  category: 'animals',
  mode: 'category',
};
const NEXT = {
  ...OLD,
  id: 2,
  name: 'NEXT1',
  status: 'open',
  guestplayerid: null,
};
function player(id: number, role: 'host' | 'guest', name = OLD.name) {
  const socket: any = {
    id: String(id),
    connected: true,
    rooms: new Set([name]),
    data: {
      authenticatedUserId: id,
      roomSession: { roomId: 1, roomName: name, userId: id, role },
    },
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  socket.join = jest.fn(async (room: string) => socket.rooms.add(room));
  socket.leave = jest.fn(async (room: string) => socket.rooms.delete(room));
  return socket;
}

describe('Rematch agreement and room transfer', () => {
  let gateway: RoomGateway;
  let rooms: any;
  let images: any;
  let broadcast: jest.Mock;
  let host: any;
  let guest: any;
  beforeEach(() => {
    rooms = {
      findByName: jest.fn(async (name) =>
        name === OLD.name ? { ...OLD } : { ...NEXT },
      ),
      create: jest.fn(async () => ({ ...NEXT })),
      addGuest: jest.fn(async () => ({ ...NEXT, guestplayerid: 9 })),
      remove: jest.fn(),
    };
    images = {
      isCategoryVisible: jest.fn(async () => true),
      getUrlsByCategory: jest.fn(async () => []),
    };
    gateway = new RoomGateway(
      rooms,
      images,
      { removeRoomImage: jest.fn() } as any,
      {
        findOne: jest.fn(async (id) => ({ id, username: `Player${id}` })),
      } as any,
      {} as any,
    );
    broadcast = jest.fn();
    (gateway as any).wss = {
      to: jest.fn(() => ({ emit: broadcast })),
      in: jest.fn(() => ({ fetchSockets: jest.fn(async () => []) })),
    };
    host = player(7, 'host');
    guest = player(9, 'guest');
  });
  afterEach(() => gateway.onModuleDestroy());
  const vote = (socket: any) =>
    gateway.askRematch(socket, {
      name: OLD.name,
      player: socket.data.roomSession.role,
    });

  it('records simultaneous votes without mutating fetched socket copies', async () => {
    await Promise.all([vote(host), vote(guest)]);
    expect(broadcast).toHaveBeenCalledWith('rematch can start', {
      roomName: OLD.name,
    });
    expect(broadcast).toHaveBeenCalledWith(
      'rematch state',
      expect.objectContaining({ requested: ['host', 'guest'], phase: 'ready' }),
    );
    expect((gateway as any).wss.in).not.toHaveBeenCalled();
  });

  it('allows withdrawing a pending vote, then accepting a later proposal', async () => {
    await vote(host);
    await gateway.askRematch(host, {
      name: OLD.name,
      player: 'host',
      cancel: true,
    });
    await vote(guest);
    expect(broadcast).not.toHaveBeenCalledWith(
      'rematch can start',
      expect.anything(),
    );
    await vote(host);
    expect(broadcast).toHaveBeenCalledWith('rematch can start', {
      roomName: OLD.name,
    });
  });

  it('replays an opponent proposal to a result screen mounted late', async () => {
    await vote(host);
    await gateway.rematchStatus(guest, { name: OLD.name });
    expect(guest.emit).toHaveBeenCalledWith('rematch state', {
      roomName: OLD.name,
      requested: ['host'],
      phase: 'waiting',
    });
  });

  it('refuses an early rematch before both players agreed', async () => {
    await vote(host);
    await gateway.rematch(host, {
      oldRoomName: OLD.name,
      newRoomName: NEXT.name,
      hostId: 7,
    });
    expect(rooms.create).not.toHaveBeenCalled();
  });

  it('creates exactly one room and joins the host before inviting the guest', async () => {
    await Promise.all([vote(host), vote(guest)]);
    const data = {
      oldRoomName: OLD.name,
      newRoomName: NEXT.name,
      hostId: 7,
      category: 'untrusted',
    };
    await Promise.all([
      gateway.rematch(host, data),
      gateway.rematch(host, data),
    ]);
    expect(rooms.create).toHaveBeenCalledTimes(1);
    expect(rooms.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'animals' }),
    );
    const invited = broadcast.mock.calls.findIndex(
      ([event]) => event === 'rematch invitation',
    );
    expect(host.join.mock.invocationCallOrder[0]).toBeLessThan(
      broadcast.mock.invocationCallOrder[invited],
    );
    await gateway.rematch(host, data);
    expect(rooms.create).toHaveBeenCalledTimes(1);
    expect(host.emit).toHaveBeenCalledWith(
      'room created',
      expect.objectContaining({ roomId: NEXT.id }),
    );
  });

  it('rejects another guest and direct code joins to the reserved rematch', async () => {
    await Promise.all([vote(host), vote(guest)]);
    await gateway.rematch(host, {
      oldRoomName: OLD.name,
      newRoomName: NEXT.name,
      hostId: 7,
    });
    await gateway.joinRematch(player(33, 'guest', 'OTHER'), {
      newRoomName: NEXT.name,
      guestId: 33,
    });
    expect(rooms.addGuest).not.toHaveBeenCalled();
    await expect(
      (gateway as any).addGuestToRoom(NEXT.name, 33),
    ).rejects.toThrow();
  });

  it('does not create a late room after quitting during the database work', async () => {
    await Promise.all([vote(host), vote(guest)]);
    rooms.create.mockImplementation(async () => {
      host.connected = false;
      return { ...NEXT };
    });
    await gateway.rematch(host, {
      oldRoomName: OLD.name,
      newRoomName: NEXT.name,
      hostId: 7,
    });
    expect(host.join).not.toHaveBeenCalled();
    expect(rooms.remove).toHaveBeenCalledWith(NEXT.id);
  });

  it('recovers the host room when the creation acknowledgement was lost', async () => {
    await Promise.all([vote(host), vote(guest)]);
    await gateway.rematch(host, {
      oldRoomName: OLD.name,
      newRoomName: NEXT.name,
      hostId: 7,
    });
    rooms.findByName.mockImplementation(async (name) =>
      name === OLD.name ? null : { ...NEXT },
    );
    const reconnected = player(7, 'host');
    await gateway.resumeRoom(reconnected, { name: OLD.name });
    expect(reconnected.emit).toHaveBeenCalledWith(
      'room resumed',
      expect.objectContaining({
        previousRoomName: OLD.name,
        roomName: NEXT.name,
        role: 'host',
      }),
    );
  });
});
