import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  dayInTimeZone,
  isValidDay,
  LEADERBOARD_TOP,
  LeaderboardService,
  shiftDay,
} from './leaderboard.service';

class ClockedService extends LeaderboardService {
  clock = new Date('2026-09-13T10:00:00.000Z');
  protected now() {
    return this.clock;
  }
}

const rankingRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    user_id: String(index + 1),
    username: `joueur-${index + 1}`,
    image_url: index === 0 ? 'https://cdn/1.png' : null,
    wins: String(count - index),
    games: String(count - index + 1),
    rank: String(index + 1),
  }));

function setup(
  ranking = rankingRows(3),
  days = [{ day: '2026-09-11', players: '4' }],
) {
  const query = jest.fn((sql: string) =>
    Promise.resolve(sql.includes('COUNT(DISTINCT winner_id)') ? days : ranking),
  );
  const service = new ClockedService({ query } as unknown as DataSource);
  const rankingCalls = () =>
    query.mock.calls.filter(([sql]) => sql.includes('ROW_NUMBER')).length;
  return { service, query, rankingCalls };
}

describe('leaderboard days', () => {
  it('uses the Paris calendar day, not the UTC one', () => {
    expect(dayInTimeZone(new Date('2026-09-12T22:30:00.000Z'))).toBe(
      '2026-09-13',
    );
    expect(dayInTimeZone(new Date('2026-12-31T22:59:00.000Z'))).toBe(
      '2026-12-31',
    );
  });

  it('shifts across months and rejects impossible dates', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-9-1')).toBe(false);
    expect(isValidDay('2026-09-01')).toBe(true);
  });
});

describe('LeaderboardService', () => {
  it('returns the top of the day and the caller even outside of it', async () => {
    const { service } = setup(rankingRows(60));

    const result = await service.getDaily(58);

    expect(result.date).toBe('2026-09-13');
    expect(result.entries).toHaveLength(LEADERBOARD_TOP);
    expect(result.totalPlayers).toBe(60);
    expect(result.entries[0]).toEqual({
      rank: 1,
      userId: 1,
      username: 'joueur-1',
      grade: { id: 'recrue', title: 'Recrue', score: 0 },
      imageUrl: 'https://cdn/1.png',
      wins: 60,
      games: 61,
    });
    expect(result.me).toMatchObject({ rank: 58, userId: 58 });
  });

  it('only ranks players with a win, and has no "me" without one', async () => {
    const { service, query } = setup([]);

    const result = await service.getDaily(7);

    expect(result.me).toBeNull();
    expect(result.entries).toEqual([]);
    const rankingSql = query.mock.calls.find(([sql]) =>
      sql.includes('ROW_NUMBER'),
    )![0];
    expect(rankingSql).toContain('HAVING SUM(win) > 0');
    // A range on the indexed column, never a function applied to it.
    expect(rankingSql).toContain('finished_at >= (');
  });

  it('always lists today first, even before anyone has won', async () => {
    const { service } = setup();

    const { days } = await service.getDaily(1);

    expect(days).toEqual([
      { date: '2026-09-13', players: 0 },
      { date: '2026-09-11', players: 4 },
    ]);
  });

  it('refuses days outside the window', async () => {
    const { service, query } = setup();

    // 14 days, today included: 2026-08-31 → 2026-09-13.
    for (const date of ['2026-08-30', '2026-09-14', '2026-02-30', 'hier']) {
      await expect(service.getDaily(1, date)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(query).not.toHaveBeenCalled();

    await expect(service.getDaily(1, '2026-08-31')).resolves.toMatchObject({
      date: '2026-08-31',
    });
  });

  it('shares one query between simultaneous requests and caches today briefly', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { service, rankingCalls } = setup();

    await Promise.all([service.getDaily(1), service.getDaily(2)]);
    expect(rankingCalls()).toBe(1);

    now.mockReturnValue(1_000_000 + 29_000);
    await service.getDaily(3);
    expect(rankingCalls()).toBe(1);

    now.mockReturnValue(1_000_000 + 31_000);
    await service.getDaily(3);
    expect(rankingCalls()).toBe(2);

    now.mockRestore();
  });

  it('forgets a failed load so the next request retries', async () => {
    const { service, query } = setup();
    query.mockImplementationOnce(() => Promise.resolve([]));
    query.mockImplementationOnce(() => Promise.reject(new Error('db down')));

    await expect(service.getDaily(1)).rejects.toThrow('db down');
    query.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('ROW_NUMBER') ? rankingRows(1) : []),
    );
    await expect(service.getDaily(1)).resolves.toMatchObject({
      totalPlayers: 1,
    });
  });
});
