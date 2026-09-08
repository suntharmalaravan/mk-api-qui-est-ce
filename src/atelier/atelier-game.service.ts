import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AtelierService } from './atelier.service';

@Injectable()
export class AtelierGameService {
  constructor(
    private readonly db: DataSource,
    private readonly atelier: AtelierService,
  ) {}
  get enabled() {
    return this.atelier.enabled;
  }
  async started(name: string) {
    if (!this.enabled) return;
    await this.db.query(
      "UPDATE room SET match_started_at=COALESCE(match_started_at,now()) WHERE name=$1 AND status='closed' AND hostcharacterid IS NOT NULL AND guestcharacterid IS NOT NULL",
      [name],
    );
  }
  async state(name: string) {
    if (!this.enabled) return {};
    const row = (
      await this.db.query(
        'SELECT match_id,host_misses,guest_misses FROM room WHERE name=$1',
        [name],
      )
    )[0];
    if (!row) return {};
    const result = (
      await this.db.query(
        'SELECT winner_id,loser_id,reason FROM atelier_match_result WHERE match_id=$1',
        [row.match_id],
      )
    )[0];
    const lastResult = result
      ? (
          await this.db.query(
            "SELECT response FROM atelier_guess WHERE match_id=$1 AND response->>'terminal'='true' LIMIT 1",
            [row.match_id],
          )
        )[0]?.response
      : null;
    return {
      lives: {
        host: Math.max(0, 2 - row.host_misses),
        guest: Math.max(0, 2 - row.guest_misses),
      },
      matchResult: result ?? null,
      lastResult,
    };
  }
  private async reward(
    tx: EntityManager,
    userId: number,
    matchId: string,
    amount: number,
  ) {
    const daily = Number(
      (
        await tx.query(
          "SELECT COALESCE(sum(amount),0) AS total FROM atelier_ledger WHERE user_id=$1 AND amount>0 AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
          [userId],
        )
      )[0].total,
    );
    const account = await this.atelier.snapshot(tx, userId);
    const grant = Math.min(
      amount,
      Math.max(0, this.atelier.amount('ATELIER_DAILY_CAP', 100) - daily),
      1000000000 - account.balance,
    );
    if (grant <= 0) return;
    await tx.query(
      'INSERT INTO atelier_ledger(user_id,source,amount,balance_after) VALUES($1,$2,$3,$4)',
      [userId, 'match:' + matchId, grant, account.balance + grant],
    );
    await tx.query(
      'UPDATE atelier_account SET balance=balance+$2,version=version+1 WHERE user_id=$1',
      [userId, grant],
    );
  }
  async guess(
    name: string,
    actor: number,
    role: 'host' | 'guest',
    characterId: number,
  ) {
    return this.db.transaction(async (tx) => {
      const room = (
        await tx.query('SELECT * FROM room WHERE name=$1 FOR UPDATE', [name])
      )[0];
      if (!room) throw new NotFoundException('Room not found');
      if (
        (role !== 'host' && role !== 'guest') ||
        actor !== (role === 'host' ? room.hostplayerid : room.guestplayerid)
      )
        throw new ForbiddenException();
      const previous = (
        await tx.query(
          'SELECT response FROM atelier_guess WHERE match_id=$1 AND player_id=$2 AND character_id=$3',
          [room.match_id, actor, characterId],
        )
      )[0];
      if (previous) return { ...previous.response, duplicate: true };
      if (
        room.status !== 'closed' ||
        !room.hostcharacterid ||
        !room.guestcharacterid
      )
        throw new ConflictException({
          code: 'GAME_ALREADY_FINISHED',
          message: 'La partie est terminée ou non prête.',
        });
      if (
        !(
          await tx.query(
            'SELECT 1 FROM room_image WHERE fk_room=$1 AND fk_image=$2',
            [room.id, characterId],
          )
        ).length
      )
        throw new ForbiddenException('Character outside this game');
      const right =
        characterId ===
        (role === 'host' ? room.guestcharacterid : room.hostcharacterid);
      const misses =
        (role === 'host' ? room.host_misses : room.guest_misses) +
        (right ? 0 : 1);
      const terminal = right || misses >= 2;
      const column = role === 'host' ? 'host_misses' : 'guest_misses';
      await tx.query(`UPDATE room SET ${column}=$2 WHERE id=$1`, [
        room.id,
        misses,
      ]);
      const winnerId = right
        ? actor
        : role === 'host'
        ? room.guestplayerid
        : room.hostplayerid;
      const loserId =
        winnerId === room.hostplayerid ? room.guestplayerid : room.hostplayerid;
      if (terminal) {
        // One lock order for both participants prevents deadlocks between simultaneous games.
        for (const id of [winnerId, loserId].sort((a, b) => a - b))
          await this.atelier.accountLock(tx, id);
        await tx.query("UPDATE room SET status='finished' WHERE id=$1", [
          room.id,
        ]);
        await tx.query(
          'INSERT INTO atelier_match_result(match_id,winner_id,loser_id,reason) VALUES($1,$2,$3,$4)',
          [room.match_id, winnerId, loserId, right ? 'guess' : 'lives'],
        );
        await tx.query('UPDATE "user" SET score=score+8 WHERE id=$1', [
          winnerId,
        ]);
        const elapsed = room.match_started_at
          ? Date.now() - new Date(room.match_started_at).getTime()
          : 0;
        if (
          this.atelier.economyEnabled &&
          elapsed >= this.atelier.amount('ATELIER_MIN_MATCH_SECONDS', 60) * 1000
        ) {
          await this.reward(
            tx,
            winnerId,
            room.match_id,
            this.atelier.amount('ATELIER_WIN_COINS', 10),
          );
          await this.reward(
            tx,
            loserId,
            room.match_id,
            this.atelier.amount('ATELIER_LOSS_COINS', 3),
          );
        }
      }
      const result = {
        player: role,
        right,
        livesLeft: Math.max(0, 2 - misses),
        terminal,
        eventId: `${room.match_id}:${actor}:${characterId}`,
        ...(terminal
          ? {
              hostCharacterId: room.hostcharacterid,
              guestCharacterId: room.guestcharacterid,
            }
          : {}),
      };
      await tx.query(
        'INSERT INTO atelier_guess(match_id,player_id,character_id,right_answer,response) VALUES($1,$2,$3,$4,$5::jsonb)',
        [room.match_id, actor, characterId, right, JSON.stringify(result)],
      );
      return result;
    });
  }
}
