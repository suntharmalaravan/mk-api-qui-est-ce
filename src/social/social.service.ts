import { rankForScore } from '../atelier/loupe-economy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class SocialService {
  constructor(private readonly db: DataSource) {}
  async list(userId: number) {
    const friends = await this.db.query(
      `SELECT u.id::text AS "userId",u.username,u.score,u.public_identifier AS identifier,u.image_url AS "imageUrl",f.status,
      CASE WHEN f.requester_id=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM friendship f JOIN "user" u ON u.id=CASE WHEN f.user_low=$1 THEN f.user_high ELSE f.user_low END
      WHERE $1 IN (f.user_low,f.user_high) ORDER BY f.status,u.username,u.id`,
      [userId],
    );
    const invitations = await this.db.query(
      `SELECT i.id,i.sender_id::text AS "senderId",i.recipient_id::text AS "recipientId",
      u.username AS "senderName",v.username AS "recipientName",r.name AS "roomName",r.category,
      i.status,i.expires_at AS "expiresAt"
      FROM duel_invitation i JOIN room r ON r.id=i.room_id JOIN "user" u ON u.id=i.sender_id JOIN "user" v ON v.id=i.recipient_id
      WHERE $1 IN(i.sender_id,i.recipient_id) AND (i.status='pending' OR (i.status='accepted' AND i.recipient_id=$1)) AND i.expires_at>now()
        AND ((r.status='open' AND r.guestplayerid IS NULL) OR (i.status='accepted' AND r.status='closed' AND r.guestplayerid=$1)) AND r.selection_started_at IS NULL
      ORDER BY i.created_at DESC LIMIT 50`,
      [userId],
    );
    const me = (
      await this.db.query('SELECT public_identifier FROM "user" WHERE id=$1', [
        userId,
      ])
    )[0];
    return { friends: friends.map(friend => ({ ...friend, grade: rankForScore(Number(friend.score)) })), invitations, identifier: me?.public_identifier };
  }
  async player(userId: number, otherId: number) {
    const rows = await this.db.query(
      `SELECT u.id::text AS "userId",u.username,u.score,u.public_identifier AS identifier,u.image_url AS "imageUrl",f.status,
      CASE WHEN f.requester_id=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM "user" u LEFT JOIN friendship f ON f.user_low=LEAST($1,u.id) AND f.user_high=GREATEST($1,u.id)
      WHERE u.id=$2 AND u.id<>$1`,
      [userId, otherId],
    );
    if (!rows.length) throw new NotFoundException('Joueur introuvable.');
    return { ...rows[0], grade: rankForScore(Number(rows[0].score)) };
  }
  async opponent(userId: number, roomName: string) {
    const rows = await this.db.query(
      `SELECT u.id::text AS "userId",u.username,u.score,u.public_identifier AS identifier,u.image_url AS "imageUrl",f.status,
      CASE WHEN f.requester_id=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM room r JOIN "user" u ON u.id=CASE WHEN r.hostplayerid=$1 THEN r.guestplayerid ELSE r.hostplayerid END
      LEFT JOIN friendship f ON f.user_low=LEAST($1,u.id) AND f.user_high=GREATEST($1,u.id)
      WHERE r.name=$2 AND $1 IN(r.hostplayerid,r.guestplayerid) AND r.status='finished'`,
      [userId, roomName],
    );
    if (!rows.length) throw new NotFoundException('Adversaire introuvable.');
    return { ...rows[0], grade: rankForScore(Number(rows[0].score)) };
  }
  async request(userId: number, identifier: string) {
    return this.db.transaction(async (tx) => {
      const target = (
        await tx.query(
          'SELECT id FROM "user" WHERE lower(public_identifier)=$1',
          [identifier.trim().toLowerCase().replace(/^@/, '')],
        )
      )[0];
      if (!target)
        throw new NotFoundException('Aucun joueur avec cet identifiant.');
      if (target.id === userId)
        throw new BadRequestException('C’est ton identifiant.');
      const low = Math.min(userId, target.id),
        high = Math.max(userId, target.id);
      await tx.query('SELECT pg_advisory_xact_lock(719205,$1)', [low]);
      await tx.query('SELECT pg_advisory_xact_lock(719205,$1)', [high]);
      await tx.query('SELECT pg_advisory_xact_lock($1,$2)', [low, high]);
      const existing = (
        await tx.query(
          'SELECT * FROM friendship WHERE user_low=$1 AND user_high=$2',
          [low, high],
        )
      )[0];
      if (existing)
        return {
          status: existing.status,
          direction: existing.requester_id === userId ? 'outgoing' : 'incoming',
        };
      const counts = (
        await tx.query(
          `SELECT count(*)::int AS total FROM friendship WHERE $1 IN(user_low,user_high)`,
          [userId],
        )
      )[0];
      const targetCount = (
        await tx.query(
          'SELECT count(*)::int AS total FROM friendship WHERE $1 IN(user_low,user_high)',
          [target.id],
        )
      )[0];
      if (counts.total >= 500 || targetCount.total >= 500)
        throw new ConflictException(
          'Ta liste est pleine. Retire une demande ou un ami.',
        );
      await tx.query(
        'INSERT INTO friendship(user_low,user_high,requester_id) VALUES($1,$2,$3)',
        [low, high, userId],
      );
      return { status: 'pending', direction: 'outgoing' };
    });
  }
  async respond(userId: number, otherId: number, action: 'accept' | 'remove') {
    if (userId === otherId) throw new BadRequestException();
    const low = Math.min(userId, otherId),
      high = Math.max(userId, otherId);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1,$2)', [low, high]);
      const row = (
        await tx.query(
          'SELECT * FROM friendship WHERE user_low=$1 AND user_high=$2 FOR UPDATE',
          [low, high],
        )
      )[0];
      if (!row) {
        if (action === 'remove') return { success: true };
        throw new NotFoundException('Demande introuvable.');
      }
      if (action === 'accept') {
        if (row.status === 'accepted') return { success: true };
        if (row.requester_id === userId)
          throw new ForbiddenException('Seul le destinataire peut accepter.');
        await tx.query(
          "UPDATE friendship SET status='accepted',updated_at=now() WHERE user_low=$1 AND user_high=$2",
          [low, high],
        );
      } else {
        await tx.query(
          'DELETE FROM friendship WHERE user_low=$1 AND user_high=$2',
          [low, high],
        );
        await tx.query(
          "UPDATE duel_invitation SET status='cancelled' WHERE status='pending' AND LEAST(sender_id,recipient_id)=$1 AND GREATEST(sender_id,recipient_id)=$2",
          [low, high],
        );
      }
      return { success: true };
    });
  }
  private async assertFriends(
    tx: EntityManager,
    userId: number,
    otherId: number,
  ) {
    const rows = await tx.query(
      "SELECT 1 FROM friendship WHERE user_low=$1 AND user_high=$2 AND status='accepted' FOR SHARE",
      [Math.min(userId, otherId), Math.max(userId, otherId)],
    );
    if (!rows.length)
      throw new ForbiddenException(
        'Ajoute ce joueur à tes amis avant de le défier.',
      );
  }
  async invite(userId: number, recipientId: number, roomName: string) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(719206,$1)', [userId]);
      await this.assertFriends(tx, userId, recipientId);
      const room = (
        await tx.query('SELECT * FROM room WHERE name=$1 FOR UPDATE', [
          roomName,
        ])
      )[0];
      if (!room || room.hostplayerid !== userId)
        throw new ForbiddenException('Seul l’hôte peut inviter.');
      if (
        room.status !== 'open' ||
        room.guestplayerid ||
        room.selection_started_at
      )
        throw new ConflictException('Ce salon n’est plus disponible.');
      await tx.query(
        "UPDATE duel_invitation SET status='expired' WHERE room_id=$1 AND status='pending' AND expires_at<=now()",
        [room.id],
      );
      const existing = (
        await tx.query(
          "SELECT id FROM duel_invitation WHERE room_id=$1 AND recipient_id=$2 AND status='pending'",
          [room.id, recipientId],
        )
      )[0];
      if (existing) return existing;
      const recent = (
        await tx.query(
          "SELECT count(*)::int AS count FROM duel_invitation WHERE sender_id=$1 AND created_at>now()-interval '1 hour'",
          [userId],
        )
      )[0];
      if (recent.count >= 30)
        throw new ConflictException(
          'Trop d’invitations. Réessaie un peu plus tard.',
        );
      const id = randomUUID();
      await tx.query(
        'INSERT INTO duel_invitation(id,sender_id,recipient_id,room_id) VALUES($1,$2,$3,$4)',
        [id, userId, recipientId, room.id],
      );
      return { id };
    });
  }
  async dismiss(userId: number, id: string) {
    await this.db.query(
      `UPDATE duel_invitation SET status=CASE WHEN sender_id=$1 THEN 'cancelled' ELSE 'declined' END
      WHERE id=$2 AND $1 IN(sender_id,recipient_id) AND status='pending'`,
      [userId, id],
    );
    return { success: true };
  }
  /** The socket calls this: acceptance and claiming the last seat commit together. */
  async acceptInvitation(userId: number, id: string, roomName: string) {
    return this.db.transaction(async (tx) => {
      // Same lock order as invite (friendship, room, invitation).
      const initial = (
        await tx.query(
          'SELECT * FROM duel_invitation WHERE id=$1 AND recipient_id=$2',
          [id, userId],
        )
      )[0];
      if (!initial) throw new NotFoundException('Invitation introuvable.');
      await this.assertFriends(tx, userId, initial.sender_id);
      const room = (
        await tx.query('SELECT * FROM room WHERE id=$1 FOR UPDATE', [
          initial.room_id,
        ])
      )[0];
      const invitation = (
        await tx.query('SELECT * FROM duel_invitation WHERE id=$1 FOR UPDATE', [
          id,
        ])
      )[0];
      if (!room || room.name !== roomName)
        throw new NotFoundException('Salon introuvable.');
      if (
        invitation.status === 'accepted' &&
        room.guestplayerid === userId &&
        room.status === 'closed' &&
        !room.selection_started_at
      )
        return room;
      if (
        !['pending', 'accepted'].includes(invitation.status) ||
        new Date(invitation.expires_at).getTime() <= Date.now()
      )
        throw new ConflictException(
          'Cette invitation a expiré ou a été annulée.',
        );
      if (
        room.status !== 'open' ||
        room.guestplayerid ||
        room.selection_started_at
      )
        throw new ConflictException('Ce salon est déjà complet ou fermé.');
      await tx.query(
        "UPDATE room SET guestplayerid=$2,status='closed' WHERE id=$1",
        [room.id, userId],
      );
      await tx.query(
        "UPDATE duel_invitation SET status=CASE WHEN id=$2 THEN 'accepted' ELSE 'cancelled' END WHERE room_id=$1 AND status='pending'",
        [room.id, id],
      );
      return { ...room, guestplayerid: userId, status: 'closed' };
    });
  }
}
