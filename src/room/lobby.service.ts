import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
export type LobbySelection = {
  mode: 'category' | 'custom';
  category?: string;
  deckId?: number;
};
@Injectable()
export class LobbyService {
  constructor(private readonly db: DataSource) {}
  async selection(tx: EntityManager, userId: number, input: LobbySelection) {
    if (input.mode !== 'category' && input.mode !== 'custom')
      throw new BadRequestException('Mode invalide.');
    let images: any[];
    let label: string;
    if (input.mode === 'custom') {
      if (!Number.isSafeInteger(input.deckId) || input.deckId < 1)
        throw new BadRequestException('Deck invalide.');
      const deck = (
        await tx.query('SELECT name FROM deck WHERE id=$1 AND user_id=$2', [
          input.deckId,
          userId,
        ])
      )[0];
      if (!deck) throw new ForbiddenException('Ce deck ne t’appartient pas.');
      label = deck.name;
      images = await tx.query(
        'SELECT id,url,name,author,license,license_url,source_url,restrictions FROM image WHERE deck_id=$1 ORDER BY id',
        [input.deckId],
      );
    } else {
      if (
        typeof input.category !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,50}$/.test(input.category)
      )
        throw new BadRequestException('Thème invalide.');
      label = input.category;
      images = await tx.query(
        'SELECT id,url,name,author,license,license_url,source_url,restrictions FROM image WHERE category=$1 AND user_id IS NULL ORDER BY id',
        [input.category],
      );
    }
    if (images.length < 18 || (input.mode === 'custom' && images.length > 21))
      throw new BadRequestException(
        'Ce thème ne contient pas assez de cartes jouables.',
      );
    return { images, label };
  }
  private async payload(tx: EntityManager, room: any) {
    // Older app versions used an entire personal library, without a deck ID.
    // Keep these existing rooms resumable; new choices must target an owned deck.
    const { images, label } =
      room.mode === 'custom' && !room.deck_id
        ? {
            images: await tx.query(
              'SELECT id,url,name,author,license,license_url,source_url,restrictions FROM image WHERE user_id=$1 ORDER BY id',
              [room.custom_library_user_id || room.hostplayerid],
            ),
            label: 'Deck personnalisé',
          }
        : await this.selection(tx, room.hostplayerid, {
            mode: room.mode || 'category',
            category: room.category,
            deckId: room.deck_id,
          });
    const guest = room.guestplayerid
      ? (
          await tx.query('SELECT id,username FROM "user" WHERE id=$1', [
            room.guestplayerid,
          ])
        )[0] ?? null
      : null;
    return {
      guest,
      roomName: room.name,
      roomId: room.id,
      category: room.category,
      mode: room.mode,
      deckId: room.deck_id,
      label,
      revision: room.lobby_revision,
      started: !!room.selection_started_at,
      images,
      previewImages: images.slice(0, 3),
    };
  }
  async snapshot(name: string, userId: number) {
    const room = (
      await this.db.query('SELECT * FROM room WHERE name=$1', [name])
    )[0];
    if (!room) throw new NotFoundException('Salon introuvable.');
    if (room.hostplayerid !== userId && room.guestplayerid !== userId)
      throw new ForbiddenException();
    return this.payload(this.db.manager, room);
  }
  async change(
    name: string,
    userId: number,
    input: LobbySelection,
    revision: number,
  ) {
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new BadRequestException('Version invalide.');
    return this.db.transaction(async (tx) => {
      const room = (
        await tx.query('SELECT * FROM room WHERE name=$1 FOR UPDATE', [name])
      )[0];
      if (!room) throw new NotFoundException('Salon introuvable.');
      if (room.hostplayerid !== userId)
        throw new ForbiddenException('Seul l’hôte peut choisir le thème.');
      if (
        !['open', 'closed'].includes(room.status) ||
        room.selection_started_at ||
        room.hostcharacterid ||
        room.guestcharacterid
      )
        throw new ConflictException('La partie a déjà commencé.');
      if (room.lobby_revision !== revision)
        throw new ConflictException('Le thème a changé. Réessaie.');
      // Only new choices are refused: a lobby already set on a category hidden
      // afterwards stays startable, since payload() does not re-check it.
      if (
        input.mode === 'category' &&
        (
          await tx.query(
            'SELECT 1 FROM category_setting WHERE slug=$1 AND visible=false',
            [input.category],
          )
        ).length
      )
        throw new BadRequestException('Ce thème n’est plus disponible.');
      await this.selection(tx, userId, input);
      const updated = (
        await tx.query(
          'UPDATE room SET category=$2,mode=$3,deck_id=$4,custom_library_user_id=$5,lobby_revision=lobby_revision+1 WHERE id=$1 RETURNING *',
          [
            room.id,
            input.mode === 'category' ? input.category : 'custom',
            input.mode,
            input.mode === 'custom' ? input.deckId : null,
            input.mode === 'custom' ? userId : null,
          ],
        )
      )[0];
      return this.payload(tx, updated);
    });
  }
  async start(name: string, userId: number, revision?: number) {
    return this.db.transaction(async (tx) => {
      const room = (
        await tx.query('SELECT * FROM room WHERE name=$1 FOR UPDATE', [name])
      )[0];
      if (!room) throw new NotFoundException('Salon introuvable.');
      if (room.hostplayerid !== userId) throw new ForbiddenException();
      if (!room.guestplayerid || room.status !== 'closed')
        throw new ConflictException('Attends ton adversaire.');
      if (
        room.selection_started_at ||
        room.hostcharacterid ||
        room.guestcharacterid
      )
        throw new ConflictException('La partie a déjà commencé.');
      if (revision !== undefined && room.lobby_revision !== revision)
        throw new ConflictException('Le thème a changé. Relance la partie.');
      const payload = await this.payload(tx, room);
      if (payload.images.length < 18)
        throw new BadRequestException('Il faut au moins 18 cartes.');
      await tx.query('UPDATE room SET selection_started_at=now() WHERE id=$1', [
        room.id,
      ]);
      // Freeze the deck for this match. Character choices and guesses are
      // validated against room_image: without these rows every `choose` was
      // refused and both players waited for each other forever.
      await tx.query('DELETE FROM room_image WHERE fk_room=$1', [room.id]);
      await tx.query(
        'INSERT INTO room_image(fk_room,fk_image) SELECT $1, unnest($2::int[])',
        [room.id, payload.images.map((image) => image.id)],
      );
      return { ...payload, started: true };
    });
  }
}
