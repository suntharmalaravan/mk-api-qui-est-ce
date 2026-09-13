import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LobbyService } from './lobby.service';

describe('LobbyService', () => {
  let service: LobbyService;
  let room: any;
  let query: jest.Mock;
  let images: any[];
  let owned: boolean;
  let frozenDeck: number[] | null;
  beforeEach(() => {
    frozenDeck = null;
    room = {
      id: 4,
      name: 'ABCDE',
      hostplayerid: 1,
      guestplayerid: 2,
      mode: 'category',
      category: 'animals',
      status: 'closed',
      lobby_revision: 0,
      selection_started_at: null,
      hostcharacterid: null,
      guestcharacterid: null,
    };
    images = Array.from({ length: 18 }, (_, id) => ({
      id,
      url: 'https://example.test/' + id,
    }));
    owned = true;
    query = jest.fn(async (sql: string, args: any[]) => {
      if (sql.startsWith('SELECT id,username'))
        return [{ id: 2, username: 'Guest' }];
      if (sql.startsWith('SELECT * FROM room')) return [{ ...room }];
      if (sql.startsWith('SELECT name FROM deck'))
        return owned ? [{ name: 'Les amis' }] : [];
      if (sql.startsWith('SELECT id,url')) return images;
      if (sql.startsWith('UPDATE room SET category')) {
        room = {
          ...room,
          category: args[1],
          mode: args[2],
          deck_id: args[3],
          custom_library_user_id: args[4],
          lobby_revision: room.lobby_revision + 1,
        };
        return [{ ...room }];
      }
      if (sql.startsWith('UPDATE room SET selection_started_at')) {
        room.selection_started_at = new Date();
        return [];
      }
      if (sql.startsWith('DELETE FROM room_image')) {
        frozenDeck = [];
        return [];
      }
      if (sql.startsWith('INSERT INTO room_image')) {
        frozenDeck = args[1];
        return [];
      }
      throw new Error('Unexpected SQL: ' + sql);
    });
    const manager = { query };
    service = new LobbyService({
      query,
      manager,
      transaction: (fn: Function) => fn(manager),
    } as unknown as DataSource);
  });
  it('returns the same three preview cards to both participants', async () => {
    const host = await service.snapshot('ABCDE', 1);
    const guest = await service.snapshot('ABCDE', 2);
    expect(host).toEqual(guest);
    expect(host.previewImages).toEqual(images.slice(0, 3));
    await expect(service.snapshot('ABCDE', 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('changes only configuration, keeping room and participants', async () => {
    const result = await service.change(
      'ABCDE',
      1,
      { mode: 'custom', deckId: 7 },
      0,
    );
    expect(result).toMatchObject({
      roomId: 4,
      roomName: 'ABCDE',
      mode: 'custom',
      deckId: 7,
      label: 'Les amis',
      revision: 1,
    });
    expect(room.hostplayerid).toBe(1);
    expect(room.guestplayerid).toBe(2);
    expect(query).toHaveBeenCalledWith(
      'SELECT * FROM room WHERE name=$1 FOR UPDATE',
      ['ABCDE'],
    );
  });
  it('rejects guests and decks not owned by the host', async () => {
    await expect(
      service.change('ABCDE', 2, { mode: 'category', category: 'animals' }, 0),
    ).rejects.toBeInstanceOf(ForbiddenException);
    owned = false;
    await expect(
      service.change('ABCDE', 1, { mode: 'custom', deckId: 7 }, 0),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(room.lobby_revision).toBe(0);
  });
  it('rejects stale changes and stale starts', async () => {
    room.lobby_revision = 2;
    await expect(
      service.change('ABCDE', 1, { mode: 'category', category: 'animals' }, 0),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.start('ABCDE', 1, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(room.selection_started_at).toBeNull();
  });
  it('latches start and rejects later changes or duplicate starts', async () => {
    expect(await service.start('ABCDE', 1, 0)).toMatchObject({
      started: true,
      revision: 0,
    });
    await expect(
      service.change('ABCDE', 1, { mode: 'category', category: 'animals' }, 0),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.start('ABCDE', 1, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('freezes the deck of a started game for character choices and guesses', async () => {
    await service.start('ABCDE', 1, 0);
    expect(frozenDeck).toEqual(images.map((image) => image.id));
  });
  it('does not start without an opponent or with fewer than 18 cards', async () => {
    room.guestplayerid = null;
    await expect(service.start('ABCDE', 1, 0)).rejects.toBeInstanceOf(
      ConflictException,
    );
    room.guestplayerid = 2;
    images = images.slice(0, 17);
    await expect(service.start('ABCDE', 1, 0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('keeps legacy library rooms resumable but refuses new choices without a deck ID', async () => {
    room.mode = 'custom';
    room.category = 'custom';
    room.custom_library_user_id = 1;
    expect((await service.snapshot('ABCDE', 2)).images).toHaveLength(18);
    await expect(
      service.change('ABCDE', 1, { mode: 'custom' }, 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
