import { DataSource, EntityManager, Repository } from 'typeorm';
import { ImageService } from './image.service';
import { Image } from './entities/image.entity';
import { Deck } from './entities/deck.entity';

describe('ImageService', () => {
  let calls: string[];
  let deckRepository: { findOne: jest.Mock; delete: jest.Mock };
  let imageRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let service: ImageService;

  beforeEach(() => {
    calls = [];
    deckRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 3, user_id: 9 }),
      delete: jest.fn(async () => {
        calls.push('DELETE deck');
        return { affected: 1 };
      }),
    };
    imageRepository = {
      find: jest.fn().mockResolvedValue([{ id: 60 }, { id: 61 }]),
      findOne: jest.fn().mockResolvedValue({ id: 60, user_id: 9 }),
      delete: jest.fn(async () => {
        calls.push('DELETE image');
        return { affected: 1 };
      }),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === Deck ? deckRepository : imageRepository,
      query: jest.fn(async (sql: string) => {
        calls.push(sql);
        return [];
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: (fn: (tx: EntityManager) => unknown) => fn(manager),
    } as unknown as DataSource;
    service = new ImageService(
      imageRepository as unknown as Repository<Image>,
      deckRepository as unknown as Repository<Deck>,
      dataSource,
    );
  });

  it('détache les cartes jouées des parties avant de supprimer le deck', async () => {
    await expect(service.deleteDeck(3, 9)).resolves.toBe(true);

    expect(calls).toEqual([
      'UPDATE room SET hostcharacterid = NULL WHERE hostcharacterid = ANY($1::int[])',
      'UPDATE room SET guestcharacterid = NULL WHERE guestcharacterid = ANY($1::int[])',
      'DELETE FROM room_image WHERE fk_image = ANY($1::int[])',
      'DELETE deck',
    ]);
    expect(imageRepository.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { deck_id: 3 },
    });
  });

  it("ne touche à aucune partie quand le deck n'appartient pas à l'utilisateur", async () => {
    deckRepository.findOne.mockResolvedValue(null);

    await expect(service.deleteDeck(3, 42)).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it('détache une carte seule avant de la supprimer', async () => {
    await expect(service.remove(60, 9)).resolves.toBe(true);

    expect(calls.at(-1)).toBe('DELETE image');
    expect(calls).toHaveLength(4);
  });
});
