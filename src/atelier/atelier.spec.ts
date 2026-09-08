import { ConfigService } from '@nestjs/config';
import { AtelierService } from './atelier.service';
import { AtelierGameService } from './atelier-game.service';
import { assertDistinct, hash, ITEMS, recipe, visibleKey } from './catalog';
import { PortraitService } from './portrait.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CharacterDto, PublishDto } from './atelier.dto';

const base = recipe(
  Object.fromEntries([
    ['catalogVersion', 1],
    ...Object.entries(ITEMS).map(([slot, ids]) => [slot, ids[0]]),
  ]),
);
function service(query: jest.Mock, settings = {}) {
  const tx = { query };
  const db: any = {
    query,
    manager: tx,
    transaction: jest.fn(async (run) => run(tx)),
  };
  const config = new ConfigService({
    ATELIER_ENABLED: 'true',
    ATELIER_PUBLIC_URL: 'https://api.example.test',
    ...settings,
  });
  return {
    atelier: new AtelierService(db, config, new PortraitService()),
    db,
    tx,
  };
}
describe('atelier contracts and transaction orchestration', () => {
  it('canonicalizes recipes and rejects unknown slots and versions', () => {
    expect(recipe({ ...base })).toEqual(base);
    expect(() => recipe({ ...base, extra: 1 })).toThrow();
    expect(() => recipe({ ...base, catalogVersion: 2 })).toThrow();
    expect(() => recipe({ ...base, hair: '../../secret' })).toThrow();
  });
  it('ignores background and hidden hair for board uniqueness', () => {
    expect(visibleKey(base)).toBe(
      visibleKey({ ...base, backdrop: 'backdrop-mint' }),
    );
    expect(visibleKey({ ...base, hat: 'hat-cap' })).toBe(
      visibleKey({ ...base, hat: 'hat-cap', hair: 'hair-quiff' }),
    );
    expect(() =>
      assertDistinct([base, { ...base, backdrop: 'backdrop-gold' }], 1),
    ).toThrow();
  });
  it('validates nested DTOs and rejects forged ownership', async () => {
    const invalid = plainToInstance(CharacterDto, {
      ...base,
      operationId: 'op',
      id: 'a',
      name: 'Alex',
      expectedRevision: 0,
      recipe: base,
      userId: 9,
    });
    expect(
      (await validate(invalid, { whitelist: true, forbidNonWhitelisted: true }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(PublishDto, {
            operationId: 'op',
            characters: [{ id: 'a', revision: 0 }],
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('replays an existing receipt without business writes', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.startsWith('SELECT request_hash')
        ? [{ request_hash: hash(['test']), response: { ok: true } }]
        : [],
    );
    const { atelier } = service(query);
    const run = jest.fn();
    expect(await (atelier as any).mutate(7, 'op', ['test'], run)).toEqual({
      ok: true,
    });
    expect(run).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith('INSERT INTO atelier_operation'),
      ),
    ).toBe(false);
  });
  it('rejects reuse of an operation key for another payload', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.startsWith('SELECT request_hash')
        ? [{ request_hash: hash(['old']), response: {} }]
        : [],
    );
    const { atelier } = service(query);
    await expect(
      (atelier as any).mutate(7, 'op', ['new'], jest.fn()),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('does not write a success receipt when business validation fails', async () => {
    const query = jest.fn(async () => []);
    const { atelier } = service(query);
    await expect(
      (atelier as any).mutate(7, 'op', [], async () => {
        throw new Error('conflict');
      }),
    ).rejects.toThrow('conflict');
    expect(
      query.mock.calls.some((call: any) =>
        call[0].startsWith('INSERT INTO atelier_operation'),
      ),
    ).toBe(false);
  });
  it('checks price before debit or entitlement grant', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.startsWith('SELECT balance') ? [{ balance: 100, version: 1 }] : [],
    );
    const { atelier } = service(query, { ATELIER_ECONOMY_ENABLED: 'true' });
    await expect(
      atelier.purchase(7, {
        operationId: 'op',
        itemId: 'backdrop-gold',
        expectedPrice: 49,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith('UPDATE atelier_account'),
      ),
    ).toBe(false);
  });
  it('cannot save a premium recipe without ownership', async () => {
    const query = jest.fn(async () => []);
    const { atelier } = service(query);
    await expect(
      atelier.save(7, {
        operationId: 'op',
        id: 'a',
        name: 'Alex',
        expectedRevision: 0,
        recipe: { ...base, backdrop: 'backdrop-gold' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects stale character revisions before changing the library', async () => {
    const query = jest.fn(async (sql: string) =>
      sql.startsWith('SELECT hash')
        ? [{ hash: 'cached' }]
        : sql.startsWith('SELECT * FROM atelier_character')
        ? [{ revision: 2 }]
        : [],
    );
    const { atelier } = service(query);
    await expect(
      atelier.save(7, {
        operationId: 'op',
        id: 'a',
        name: 'Alex',
        expectedRevision: 1,
        recipe: base,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith('INSERT INTO atelier_character'),
      ),
    ).toBe(false);
  });
  it('does not initialize or query the schema while disabled', async () => {
    const query = jest.fn();
    const { atelier } = service(query, { ATELIER_ENABLED: 'false' });
    await atelier.onModuleInit();
    expect(query).not.toHaveBeenCalled();
    expect(() => atelier.catalog()).toThrow();
  });
  it('refuses a stale delete instead of recording a successful receipt', async () => {
    const query = jest.fn(async () => []);
    const { atelier } = service(query);
    await expect(
      atelier.remove(7, 'alex', { operationId: 'delete', expectedRevision: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      query.mock.calls.some((call: any) =>
        call[0].startsWith('INSERT INTO atelier_operation'),
      ),
    ).toBe(false);
  });
});
describe('server-side match verdict', () => {
  const room = {
    id: 1,
    name: 'ROOM',
    match_id: 'uuid',
    hostplayerid: 7,
    guestplayerid: 9,
    hostcharacterid: 11,
    guestcharacterid: 12,
    status: 'closed',
    host_misses: 0,
    guest_misses: 0,
    match_started_at: new Date(),
  };
  function game(overrides = {}, receipt?: object) {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('SELECT * FROM room'))
        return [{ ...room, ...overrides }];
      if (sql.startsWith('SELECT response FROM atelier_guess'))
        return receipt ? [{ response: receipt }] : [];
      if (sql.startsWith('SELECT 1 FROM room_image')) return [{}];
      return [];
    });
    const { atelier, db } = service(query);
    return { game: new AtelierGameService(db, atelier), query };
  }
  it('rejects a forged role against the locked database row', async () => {
    const { game: subject, query } = game();
    await expect(subject.guess('ROOM', 9, 'host', 12)).rejects.toMatchObject({
      status: 403,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('replays a guess without spending another life or awarding points', async () => {
    const { game: subject, query } = game(
      {},
      { right: false, livesLeft: 1, eventId: 'event' },
    );
    expect(await subject.guess('ROOM', 7, 'host', 13)).toMatchObject({
      duplicate: true,
      livesLeft: 1,
    });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
      false,
    );
  });
  it('returns authoritative lives and does not leak secrets on a miss', async () => {
    const { game: subject, query } = game();
    const result = await subject.guess('ROOM', 7, 'host', 13);
    expect(result).toMatchObject({
      right: false,
      livesLeft: 1,
      terminal: false,
    });
    expect(result).not.toHaveProperty('hostCharacterId');
    expect(
      query.mock.calls.some(([sql]) => sql.startsWith('UPDATE "user"')),
    ).toBe(false);
  });
  it('finishes and increments score atomically on the second miss', async () => {
    const { game: subject, query } = game({ host_misses: 1 });
    expect(await subject.guess('ROOM', 7, 'host', 13)).toMatchObject({
      terminal: true,
      livesLeft: 0,
      hostCharacterId: 11,
      guestCharacterId: 12,
    });
    expect(query).toHaveBeenCalledWith(
      'UPDATE "user" SET score=score+8 WHERE id=$1',
      [9],
    );
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith('INSERT INTO atelier_match_result'),
      ),
    ).toBe(true);
  });
  it('rejects new guesses after the game is finished', async () => {
    const { game: subject } = game({ status: 'finished' });
    await expect(subject.guess('ROOM', 7, 'host', 12)).rejects.toMatchObject({
      status: 409,
    });
  });
});
