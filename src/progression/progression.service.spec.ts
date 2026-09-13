import { DataSource } from 'typeorm';
import { ProgressionService } from './progression.service';

describe('ProgressionService', () => {
  it('dérive les statistiques et matérialise les badges gagnés', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          games_played: 10,
          wins: 7,
          direct_wins: 1,
          max_win_streak: 3,
        },
      ])
      .mockResolvedValueOnce([{ characters_created: 1, complete_decks: 0 }])
      .mockResolvedValueOnce([
        {
          match_id: '1c5da130-5104-4ba2-a626-2f9b491beeaa',
          opponent: 'Léa',
          did_win: true,
          reason: 'guess',
          played_at: '2026-09-09T06:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ badge_id: 'first-duel' }])
      .mockResolvedValueOnce([
        {
          badge_id: 'first-duel',
          unlocked_at: '2026-09-09T06:00:00.000Z',
        },
        {
          badge_id: 'sharp-eye',
          unlocked_at: '2026-09-09T06:00:00.000Z',
        },
      ]);
    const service = new ProgressionService({ query } as unknown as DataSource);

    const result = await service.getForUser(42);

    expect(result.stats).toEqual({
      gamesPlayed: 10,
      wins: 7,
      losses: 3,
      winRate: 70,
    });
    expect(result.recentMatches[0]).toEqual({
      id: '1c5da130-5104-4ba2-a626-2f9b491beeaa',
      opponent: 'Léa',
      didIWin: true,
      playedAt: '2026-09-09T06:00:00.000Z',
    });
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('ON CONFLICT (user_id, badge_id) DO NOTHING'),
      [42, ['first-duel', 'sharp-eye', 'hot-streak', 'veteran', 'creator']],
    );
    expect(
      result.badges.find((badge) => badge.id === 'first-duel'),
    ).toMatchObject({
      progress: 1,
      target: 1,
      unlockedAt: '2026-09-09T06:00:00.000Z',
    });
    expect(
      result.badges.find((badge) => badge.id === 'decksmith'),
    ).toMatchObject({
      progress: 0,
      target: 1,
      unlockedAt: null,
    });
    expect(
      result.badges.find((badge) => badge.id === 'master-detective'),
    ).toMatchObject({
      progress: 7,
      target: 50,
      unlockedAt: null,
    });
    expect(result.newlyUnlockedBadgeIds).toEqual(['first-duel']);
  });
});
