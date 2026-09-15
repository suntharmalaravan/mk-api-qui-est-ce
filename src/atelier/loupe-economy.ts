import { EntityManager } from "typeorm";

export const LOUPE_PRICES: Readonly<Record<string, number>> = {
  "backdrop-gold": 80,
  "hat-beret": 110,
  "glasses-rectangular": 140,
  "neckwear-bowtie": 180,
};
export const RANKS = [
  { id: "recrue", title: "Recrue", score: 0 },
  { id: "observateur", title: "Observateur", score: 40 },
  { id: "pisteur", title: "Pisteur", score: 120 },
  { id: "enqueteur", title: "Enquêteur", score: 280 },
  { id: "inspecteur", title: "Inspecteur", score: 560 },
  { id: "commissaire", title: "Commissaire", score: 1000 },
  { id: "maitre", title: "Maître enquêteur", score: 1800 },
  { id: "legende", title: "Légende du Bureau", score: 3000 },
] as const;
export function rankForScore(score: number) {
  return [...RANKS].reverse().find((rank) => score >= rank.score) ?? RANKS[0];
}
export const DAILY_LOUPE_LIMIT = 120;
/** All inputs come from the locked room and durable server history. */
export function duelReward(input: {
  won: boolean;
  seconds: number;
  misses: number;
  sameOpponentToday: number;
  earnedToday: number;
}) {
  const eligible =
    Number.isFinite(input.seconds) &&
    input.seconds >= 15 &&
    input.sameOpponentToday < 5;
  const base = eligible ? (input.won ? 12 : 3) : 0;
  const speed =
    eligible && input.won
      ? input.seconds <= 60
        ? 8
        : input.seconds <= 120
        ? 4
        : 0
      : 0;
  const precision = eligible && input.won ? (input.misses === 0 ? 6 : 2) : 0;
  const factor = input.sameOpponentToday >= 3 ? 0.25 : 1;
  const potential = Math.floor((base + speed + precision) * factor);
  const amount = Math.max(
    0,
    Math.min(potential, DAILY_LOUPE_LIMIT - Math.max(0, input.earnedToday))
  );
  return {
    eligible,
    amount,
    base,
    speed,
    precision,
    factor,
    capped: amount < potential,
    reason:
      input.seconds < 15
        ? "too-short"
        : input.sameOpponentToday >= 5
        ? "opponent-limit"
        : amount < potential
        ? "daily-limit"
        : null,
  };
}

/** Called inside the same transaction as the terminal guess, after both account locks. */
export async function settleLoupeDuel(
  tx: EntityManager,
  room: any,
  winner: number,
  loser: number,
  winningMisses: number
) {
  const seconds = room.match_started_at
    ? Math.max(
        0,
        (Date.now() - new Date(room.match_started_at).getTime()) / 1000
      )
    : 0;
  const [{ count }] = await tx.query(
    `SELECT count(*)::int AS count FROM atelier_match_result
    WHERE match_id<>$3 AND LEAST(winner_id,loser_id)=LEAST($1::integer,$2::integer) AND GREATEST(winner_id,loser_id)=GREATEST($1::integer,$2::integer)
    AND finished_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
    [winner, loser, room.match_id]
  );
  for (const userId of [winner, loser]) {
    const [{ total }] = await tx.query(
      `SELECT COALESCE(sum(amount),0)::int AS total FROM atelier_ledger
      WHERE user_id=$1 AND source LIKE 'duel:%' AND amount>0
      AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
      [userId]
    );
    const reward = duelReward({
      won: userId === winner,
      seconds,
      misses: winningMisses,
      sameOpponentToday: Number(count),
      earnedToday: Number(total),
    });
    const [{ score: before }] = await tx.query(
      'SELECT score FROM "user" WHERE id=$1 FOR UPDATE',
      [userId]
    );
    // Instant/repeated farming games do not mint XP or level bonuses either.
    const xp = userId === winner && reward.eligible ? 8 : 0;
    const after = Number(before) + xp;
    if (xp)
      await tx.query('UPDATE "user" SET score=score+$2 WHERE id=$1', [
        userId,
        xp,
      ]);
    const levels = xp
      ? await tx.query(
          `SELECT id,title,score,ROW_NUMBER() OVER(ORDER BY score,id)::int AS ordinal FROM level ORDER BY score,id`
        )
      : [];
    const crossed = levels.filter(
      (level) =>
        Number(level.score) > Number(before) && Number(level.score) <= after
    );
    let balance = Number(
      (
        await tx.query("SELECT balance FROM atelier_account WHERE user_id=$1", [
          userId,
        ])
      )[0].balance
    );
    const credit = async (source: string, requested: number) => {
      const amount = Math.min(requested, 1000000000 - balance);
      if (amount <= 0) return 0;
      const inserted = await tx.query(
        `INSERT INTO atelier_ledger(user_id,source,amount,balance_after)
        VALUES($1,$2,$3,$4) ON CONFLICT(user_id,source) DO NOTHING RETURNING id`,
        [userId, source, amount, balance + amount]
      );
      if (!inserted.length) return 0;
      balance += amount;
      await tx.query(
        "UPDATE atelier_account SET balance=$2,version=version+1 WHERE user_id=$1",
        [userId, balance]
      );
      return amount;
    };
    const duelAmount = await credit("duel:" + room.match_id, reward.amount);
    const levelUps = [];
    for (const level of crossed) {
      const amount = await credit(
        "level:" + level.id,
        10 + 5 * Number(level.ordinal)
      );
      levelUps.push({ level: Number(level.id), title: level.title, amount });
    }
    const amount =
      duelAmount + levelUps.reduce((sum, level) => sum + level.amount, 0);
    const payload = {
      amount,
      duelAmount,
      balanceAfter: balance,
      xp,
      breakdown: reward,
      levelUps,
      rankBefore: rankForScore(Number(before)),
      rankAfter: rankForScore(after),
    };
    await tx.query(
      `INSERT INTO loupe_reward(user_id,match_id,payload,acknowledged_at) VALUES($1,$2,$3::jsonb,CASE WHEN $4 THEN now() ELSE NULL END)
      ON CONFLICT(user_id,match_id) DO NOTHING`,
      [
        userId,
        room.match_id,
        JSON.stringify(payload),
        amount === 0 &&
          !levelUps.length &&
          payload.rankBefore.id === payload.rankAfter.id,
      ]
    );
  }
}
