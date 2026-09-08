import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import {
  CharacterDto,
  DeleteCharacterDto,
  PublishDto,
  PurchaseDto,
} from './atelier.dto';
import {
  assertDistinct,
  cleanName,
  COLORS,
  fail,
  hash,
  ITEMS_V2,
  HAIR_COLORS,
  portraitHash,
  recipe,
  Recipe,
  visibleKey,
} from './catalog';
import { PortraitService } from './portrait.service';

@Injectable()
export class AtelierService implements OnModuleInit {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly portraits: PortraitService,
  ) {}
  get enabled() {
    return this.config.get('ATELIER_ENABLED') === 'true';
  }
  get economyEnabled() {
    return (
      this.enabled && this.config.get('ATELIER_ECONOMY_ENABLED') === 'true'
    );
  }
  async onModuleInit() {
    if (!this.enabled) return;
    this.portraitUrl('0'.repeat(64));
    for (const [key, fallback] of Object.entries({
      ATELIER_GOLD_PRICE: 50,
      ATELIER_WIN_COINS: 10,
      ATELIER_LOSS_COINS: 3,
      ATELIER_DAILY_CAP: 100,
      ATELIER_MIN_MATCH_SECONDS: 60,
      ATELIER_WRITES_PER_MINUTE: 120,
    }))
      this.amount(key, fallback);
    // Fail startup clearly if the operator enabled the module before applying SQL.
    await this.db.query(
      'SELECT match_id,host_misses,guest_misses,match_started_at FROM room LIMIT 0',
    );
    for (const table of [
      'atelier_account',
      'atelier_portrait',
      'atelier_character',
      'atelier_inventory',
      'atelier_operation',
      'atelier_ledger',
      'atelier_match_result',
      'atelier_guess',
    ])
      await this.db.query('SELECT 1 FROM ' + table + ' LIMIT 0');
    await this.db.query('SELECT atelier_visible_key FROM image LIMIT 0');
  }
  requireEnabled() {
    if (!this.enabled)
      throw new ServiceUnavailableException({
        code: 'ATELIER_UNAVAILABLE',
        message: 'Le serveur de l’atelier n’est pas encore ouvert.',
      });
  }
  amount(key: string, fallback: number): number {
    const n = Number(this.config.get(key) ?? fallback);
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000)
      throw new Error('Invalid atelier configuration: ' + key);
    return n;
  }
  private portraitUrl(key: string) {
    const origin = this.config.get<string>('ATELIER_PUBLIC_URL');
    if (
      !origin ||
      !/^https?:\/\/[^/?#]+\/?$/.test(origin) ||
      new URL(origin).username ||
      new URL(origin).password
    )
      throw new ServiceUnavailableException(
        'ATELIER_PUBLIC_URL must be the public API origin, without a path or credentials',
      );
    return origin.replace(/\/$/, '') + '/api/atelier/portraits/' + key;
  }
  async accountLock(tx: EntityManager, userId: number) {
    await tx.query(
      'INSERT INTO atelier_account(user_id) VALUES($1) ON CONFLICT DO NOTHING',
      [userId],
    );
    return (
      await tx.query(
        'SELECT balance, version FROM atelier_account WHERE user_id=$1 FOR UPDATE',
        [userId],
      )
    )[0];
  }
  async snapshot(tx: EntityManager, userId: number) {
    const account = (
      await tx.query(
        'SELECT balance, version FROM atelier_account WHERE user_id=$1',
        [userId],
      )
    )[0];
    const owned = (
      await tx.query(
        'SELECT item_id FROM atelier_inventory WHERE user_id=$1 ORDER BY item_id',
        [userId],
      )
    ).map((r) => r.item_id);
    return {
      balance: account?.balance ?? 0,
      version: account?.version ?? 0,
      owned,
      prices: this.economyEnabled
        ? { 'backdrop-gold': this.amount('ATELIER_GOLD_PRICE', 50) }
        : {},
      purchasesEnabled: this.economyEnabled,
    };
  }
  async account(userId: number) {
    this.requireEnabled();
    return this.db.transaction(async (tx) => {
      await this.accountLock(tx, userId);
      return this.snapshot(tx, userId);
    });
  }
  catalog() {
    this.requireEnabled();
    return {
      catalogVersion: 2,
      rendererVersion: 2,
      supportedCatalogVersions: [1, 2],
      slots: ITEMS_V2,
      hairColors: HAIR_COLORS,
      colors: COLORS,
      characterLimit: 60,
      deckMinimum: 18,
      deckMaximum: 21,
      purchasesEnabled: this.economyEnabled,
    };
  }
  private dto(row: any) {
    return {
      id: row.id,
      revision: row.revision,
      name: row.name,
      recipe: row.recipe,
      portrait: this.portraitUrl(row.portrait_hash),
      updatedAt: new Date(row.updated_at).toISOString(),
      origin: 'cloud',
    };
  }
  async list(userId: number) {
    this.requireEnabled();
    const rows = await this.db.query(
      'SELECT * FROM atelier_character WHERE user_id=$1 AND NOT deleted ORDER BY updated_at DESC, id LIMIT 60',
      [userId],
    );
    return { characters: rows.map((r) => this.dto(r)) };
  }
  async operation(userId: number, operationId: string) {
    this.requireEnabled();
    const rows = await this.db.query(
      'SELECT response FROM atelier_operation WHERE user_id=$1 AND id=$2',
      [userId, operationId],
    );
    if (!rows.length)
      throw new NotFoundException({
        code: 'OPERATION_NOT_FOUND',
        message: 'Opération non confirmée. Réutilise le même identifiant.',
      });
    return { status: 'succeeded', result: rows[0].response };
  }
  // The receipt and business writes commit together. Errors roll everything back.
  // A timeout/unknown result is retried with the same key, never a new POST identity.
  private async mutate<T>(
    userId: number,
    operationId: string,
    request: unknown,
    run: (tx: EntityManager) => Promise<T>,
  ): Promise<T> {
    this.requireEnabled();
    return this.db.transaction(async (tx) => {
      await this.accountLock(tx, userId);
      const fingerprint = hash(request);
      const previous = (
        await tx.query(
          'SELECT request_hash, response FROM atelier_operation WHERE user_id=$1 AND id=$2',
          [userId, operationId],
        )
      )[0];
      if (previous) {
        if (previous.request_hash !== fingerprint)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Cet identifiant a déjà servi à une autre opération.',
          });
        return previous.response;
      }
      const recent = Number(
        (
          await tx.query(
            "SELECT count(*) AS count FROM atelier_operation WHERE user_id=$1 AND created_at > now()-interval '1 minute'",
            [userId],
          )
        )[0]?.count ?? 0,
      );
      if (recent >= this.amount('ATELIER_WRITES_PER_MINUTE', 120))
        throw new HttpException(
          {
            code: 'ATELIER_RATE_LIMIT',
            message:
              'Trop de changements rapprochés. Réessaie dans une minute.',
          },
          429,
        );
      const result = await run(tx);
      await tx.query(
        'INSERT INTO atelier_operation(user_id,id,request_hash,response) VALUES($1,$2,$3,$4::jsonb)',
        [userId, operationId, fingerprint, JSON.stringify(result)],
      );
      return result;
    });
  }
  private async entitled(tx: EntityManager, userId: number, r: Recipe) {
    if (r.backdrop !== 'backdrop-gold') return;
    const owned = await tx.query(
      'SELECT 1 FROM atelier_inventory WHERE user_id=$1 AND item_id=$2',
      [userId, r.backdrop],
    );
    if (!owned.length)
      throw new ForbiddenException({
        code: 'ITEM_NOT_OWNED',
        message: 'Débloque cet équipement avant de sauvegarder.',
      });
  }
  async save(userId: number, input: CharacterDto) {
    this.requireEnabled();
    const r = recipe(input.recipe),
      name = cleanName(input.name);
    // Entitlements are checked again in the committing transaction.
    await this.entitled(this.db.manager, userId, r);
    const key = portraitHash(r);
    const cached = await this.db.query(
      'SELECT hash FROM atelier_portrait WHERE hash=$1',
      [key],
    );
    const art = cached.length ? null : await this.portraits.render(r);
    return this.mutate(
      userId,
      input.operationId,
      ['save', input.id, input.expectedRevision, name, r],
      async (tx) => {
        const previous = (
          await tx.query(
            'SELECT * FROM atelier_character WHERE user_id=$1 AND id=$2',
            [userId, input.id],
          )
        )[0];
        if (
          (previous?.revision ?? 0) !== input.expectedRevision ||
          previous?.deleted
        )
          throw new ConflictException({
            code: 'REVISION_CONFLICT',
            message:
              'Ce personnage a changé. Recharge la bibliothèque avant de réessayer.',
            currentRevision: previous?.revision,
          });
        await this.entitled(tx, userId, r);
        if (!previous) {
          const count = Number(
            (
              await tx.query(
                'SELECT count(*) FROM atelier_character WHERE user_id=$1 AND NOT deleted',
                [userId],
              )
            )[0].count,
          );
          if (count >= 60)
            fail(
              'CHARACTER_LIMIT',
              'La bibliothèque est limitée à 60 personnages.',
            );
        }
        if (art)
          await tx.query(
            'INSERT INTO atelier_portrait(hash,jpeg) VALUES($1,$2) ON CONFLICT DO NOTHING',
            [key, art.jpeg],
          );
        const rows = await tx.query(
          `INSERT INTO atelier_character(user_id,id,revision,name,recipe,portrait_hash,visible_key)
    VALUES($1,$2,1,$3,$4::jsonb,$5,$6) ON CONFLICT(user_id,id) DO UPDATE
    SET revision=atelier_character.revision+1,name=EXCLUDED.name,recipe=EXCLUDED.recipe,portrait_hash=EXCLUDED.portrait_hash,visible_key=EXCLUDED.visible_key,updated_at=now() RETURNING *`,
          [userId, input.id, name, JSON.stringify(r), key, visibleKey(r)],
        );
        return this.dto(rows[0]);
      },
    );
  }
  async remove(userId: number, id: string, input: DeleteCharacterDto) {
    return this.mutate(
      userId,
      input.operationId,
      ['delete', id, input.expectedRevision],
      async (tx) => {
        // SELECT-shaped result avoids TypeORM's [rows, affectedCount] UPDATE result.
        const rows = await tx.query(
          'WITH removed AS (UPDATE atelier_character SET deleted=true,revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2 AND revision=$3 AND NOT deleted RETURNING id) SELECT id FROM removed',
          [userId, id, input.expectedRevision],
        );
        if (!rows.length)
          throw new ConflictException({
            code: 'REVISION_CONFLICT',
            message: 'Ce personnage a changé ou a été supprimé.',
          });
        return { id, deleted: true };
      },
    );
  }
  async purchase(userId: number, input: PurchaseDto) {
    return this.mutate(
      userId,
      input.operationId,
      ['purchase', input.itemId, input.expectedPrice],
      async (tx) => {
        if (!this.economyEnabled)
          throw new ServiceUnavailableException({
            code: 'PURCHASES_DISABLED',
            message: 'Les achats ne sont pas encore ouverts.',
          });
        if (input.itemId !== 'backdrop-gold')
          fail('ITEM_UNAVAILABLE', 'Cet équipement ne peut pas être acheté.');
        const account = await this.snapshot(tx, userId);
        if (account.owned.includes(input.itemId))
          return { account, operationId: input.operationId, charged: 0 };
        const price = this.amount('ATELIER_GOLD_PRICE', 50);
        if (price !== input.expectedPrice)
          throw new ConflictException({
            code: 'PRICE_CHANGED',
            message: 'Le prix a changé. Vérifie le nouveau prix.',
            currentPrice: price,
          });
        if (account.balance < price)
          throw new ConflictException({
            code: 'INSUFFICIENT_FUNDS',
            message: 'Il te manque des pièces.',
          });
        await tx.query(
          'UPDATE atelier_account SET balance=balance-$2,version=version+1 WHERE user_id=$1',
          [userId, price],
        );
        await tx.query(
          'INSERT INTO atelier_inventory(user_id,item_id) VALUES($1,$2)',
          [userId, input.itemId],
        );
        await tx.query(
          'INSERT INTO atelier_ledger(user_id,source,amount,balance_after) VALUES($1,$2,$3,$4)',
          [userId, 'purchase:' + input.itemId, -price, account.balance - price],
        );
        return {
          account: await this.snapshot(tx, userId),
          operationId: input.operationId,
          charged: price,
        };
      },
    );
  }
  async publish(userId: number, input: PublishDto) {
    return this.mutate(
      userId,
      input.operationId,
      ['publish', input.deckId ?? null, input.name ?? null, input.characters],
      async (tx) => {
        const rows = [];
        for (const ref of input.characters) {
          const row = (
            await tx.query(
              'SELECT * FROM atelier_character WHERE user_id=$1 AND id=$2 AND NOT deleted',
              [userId, ref.id],
            )
          )[0];
          if (!row || row.revision !== ref.revision)
            throw new ConflictException({
              code: 'REVISION_CONFLICT',
              message: 'Un personnage a changé. Recharge la sélection.',
            });
          await this.entitled(tx, userId, recipe(row.recipe));
          rows.push(row);
        }
        assertDistinct(
          rows.map((row) => recipe(row.recipe)),
          input.deckId ? 1 : 18,
        );
        let deck;
        if (input.deckId) {
          deck = (
            await tx.query(
              'SELECT * FROM deck WHERE id=$1 AND user_id=$2 FOR UPDATE',
              [input.deckId, userId],
            )
          )[0];
          if (!deck) throw new NotFoundException('Deck introuvable.');
          const existing = await tx.query(
            'SELECT atelier_visible_key FROM image WHERE deck_id=$1',
            [deck.id],
          );
          if (existing.length + rows.length > 21)
            fail('DECK_FULL', 'Le deck ne peut pas dépasser 21 cartes.');
          if (
            rows.some((row) =>
              existing.some((e) => e.atelier_visible_key === row.visible_key),
            )
          )
            fail(
              'DUPLICATE_SUSPECT',
              'Un de ces suspects est déjà dans le deck.',
            );
        } else {
          const name = input.name?.trim() || 'Mes suspects';
          if (name.length < 2 || name.length > 50)
            fail('INVALID_NAME', 'Nom de deck invalide.');
          deck = (
            await tx.query(
              'INSERT INTO deck(user_id,name,created_at) VALUES($1,$2,now()) RETURNING *',
              [userId, name],
            )
          )[0];
        }
        for (const row of rows)
          await tx.query(
            'INSERT INTO image(user_id,deck_id,url,name,category,atelier_visible_key) VALUES($1,$2,$3,$4,NULL,$5)',
            [
              userId,
              deck.id,
              this.portraitUrl(row.portrait_hash),
              row.name,
              row.visible_key,
            ],
          );
        const images = await tx.query(
          'SELECT id,url,name FROM image WHERE deck_id=$1 ORDER BY id',
          [deck.id],
        );
        return {
          deck: {
            ...deck,
            imageCount: images.length,
            previewImages: images.slice(0, 4),
          },
          operationId: input.operationId,
        };
      },
    );
  }
  async portrait(key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new NotFoundException();
    const row = (
      await this.db.query('SELECT jpeg FROM atelier_portrait WHERE hash=$1', [
        key,
      ])
    )[0];
    if (!row) throw new NotFoundException();
    return row.jpeg as Buffer;
  }
}
