import { ConfigService } from '@nestjs/config';
import { AtelierService } from './atelier.service';
import { PortraitService } from './portrait.service';
import { hash, ITEMS, recipe, visibleKey } from './catalog';
import { MixedCard, parseMixedManifest } from './mixed-deck';

const base = recipe(Object.fromEntries([['catalogVersion', 1], ...Object.entries(ITEMS).map(([slot, ids]) => [slot, ids[0]])]));
const photos = Array.from({ length: 17 }, (_, i) => ({ url: `https://storage.test/p${i}`, hash: `hash-${i}`, name: `Photo ${i}` }));
const cards: MixedCard[] = [{ kind: 'photo', index: 0, name: 'Photo 0' }, { kind: 'character', id: 'alex', revision: 2 }, ...photos.slice(1).map((p, i): MixedCard => ({ kind: 'photo', index: i + 1, name: p.name }))];
const input = { operationId: 'mixed-1', characters: [{ id: 'alex', revision: 2 }] };
const manifest = (value: unknown) => parseMixedManifest(JSON.stringify(value), 17);

describe('mixed board manifest', () => {
  it('accepts an interleaved board and references every uploaded file once', () => {
    expect(manifest({ operationId: 'op', cards }).cards).toEqual(cards);
  });
  it.each([
    { operationId: '../unsafe', cards },
    { operationId: 'op', cards: cards.slice(0, 17) },
    { operationId: 'op', cards: [...cards, cards[0]] },
    { operationId: 'op', cards: cards.map(c => c.kind === 'character' ? { ...c, revision: 0 } : c) },
    { operationId: 'op', cards: cards.map(c => c.kind === 'character' ? { ...c, url: 'https://forged.test' } : c) },
    { operationId: 'op', cards, userId: 99 },
    null,
  ])('rejects invalid or forged input %#', invalid => { expect(() => manifest(invalid)).toThrow(); });
  it('rejects unreferenced files', () => { expect(() => parseMixedManifest(JSON.stringify({ operationId: 'op', cards }), 18)).toThrow(); });
});
describe('mixed publication transaction', () => {
  it('settles an uncommitted deck under the publication lock and rejects a late upload', async () => {
    let receipt: any;
    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.startsWith('SELECT response FROM atelier_operation')) return receipt ? [{ response: receipt.response }] : [];
      if (sql.startsWith('SELECT request_hash')) return receipt ? [receipt] : [];
      if (sql.startsWith('INSERT INTO atelier_operation')) receipt = { request_hash: params[2], response: JSON.parse(params[3]) };
      return [];
    });
    const db: any = { transaction: jest.fn(async run => run({ query })) };
    const service = new AtelierService(db, new ConfigService({ ATELIER_ENABLED: 'true', ATELIER_PUBLIC_URL: 'https://api.test' }), new PortraitService());
    expect(await service.settleDeck(7, 'mixed-1')).toEqual({ cancelled: true, operationId: 'mixed-1' });
    expect(receipt.request_hash).toBe(hash(['cancelled-deck']));
    const lock = query.mock.calls.findIndex(([sql]) => sql.includes('FOR UPDATE'));
    const insert = query.mock.calls.findIndex(([sql]) => sql.startsWith('INSERT INTO atelier_operation'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(insert);
    await expect(service.publish(7, input, { photos, order: cards })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO deck'))).toBe(false);
  });
  it('returns an already committed deck instead of cancelling or duplicating it', async () => {
    const response = { deck: { id: 42 } };
    const query = jest.fn(async (sql: string) => sql.startsWith('SELECT response FROM atelier_operation') ? [{ response }] : []);
    const db: any = { transaction: jest.fn(async run => run({ query })) };
    const service = new AtelierService(db, new ConfigService({ ATELIER_ENABLED: 'true' }), new PortraitService());
    expect(await service.settleDeck(7, 'mixed-1')).toEqual(response);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO atelier_operation'))).toBe(false);
  });
  function setup(revision = 2) {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.startsWith('SELECT * FROM atelier_character')) return [{ id: 'alex', revision, recipe: base, portrait_hash: 'a'.repeat(64), visible_key: visibleKey(base), name: 'Alex' }];
      if (sql.startsWith('INSERT INTO deck')) return [{ id: 5, user_id: 7, name: 'Mes suspects' }];
      return [];
    });
    const db: any = { transaction: jest.fn(async run => run({ query })) };
    const service = new AtelierService(db, new ConfigService({ ATELIER_ENABLED: 'true', ATELIER_PUBLIC_URL: 'https://api.test' }), new PortraitService());
    return { service, db, query };
  }
  it('inserts all 18 cards in board order, with the receipt in the same transaction', async () => {
    const { service, db, query } = setup();
    await service.publish(7, input, { photos, order: cards });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const inserts = query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO image'));
    expect(inserts).toHaveLength(18);
    expect(inserts[0][1][2]).toBe(photos[0].url);
    expect(inserts[1][1][2]).toBe('https://api.test/api/atelier/portraits/' + 'a'.repeat(64));
    expect(inserts[1][1][4]).toBe(visibleKey(base));
    expect(query.mock.calls.at(-1)[0]).toContain('INSERT INTO atelier_operation');
    expect(query.mock.calls.find(([sql]) => sql.startsWith('SELECT * FROM atelier_character'))[1]).toEqual([7, 'alex']);
  });
  it('chooses an available automatic name instead of failing on the second deck', async () => {
    const { service, query } = setup();
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql, params) => {
      if (sql.startsWith('SELECT name FROM deck')) return [{ name: 'Mes suspects' }, { name: 'Mes suspects 2' }] as any;
      return original(sql, params);
    });
    await service.publish(7, input, { photos, order: cards });
    const insert = query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO deck'));
    expect(insert[0]).toContain('ON CONFLICT (user_id,name) DO NOTHING');
    expect(insert[1]).toEqual([7, 'Mes suspects 3']);
  });
  it('rejects a stale/foreign character before creating a deck or image', async () => {
    const { service, query } = setup(3);
    await expect(service.publish(7, input, { photos, order: cards })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO deck') || sql.startsWith('INSERT INTO image') || sql.startsWith('INSERT INTO atelier_operation'))).toBe(false);
  });
  it('rejects duplicate photo contents before writing', async () => {
    const { service, db } = setup();
    await expect(service.publish(7, input, { photos: photos.map(p => ({ ...p, hash: 'same' })), order: cards })).rejects.toThrow();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
