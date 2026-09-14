import { BadRequestException } from '@nestjs/common';
import { AtelierController } from './atelier.controller';
import { AtelierService } from './atelier.service';
import { FirebaseService } from '../firebase/firebase.service';

// Exercise the real decoder and the project's CommonJS compilation settings.
const sharp: typeof import('sharp').default = require('sharp');

describe('mixed deck photo decoding', () => {
  const atelier = { requireEnabled: jest.fn(), publish: jest.fn() };
  const firebase = { uploadLibraryImage: jest.fn() };
  const controller = new AtelierController(
    atelier as unknown as AtelierService,
    firebase as unknown as FirebaseService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    atelier.publish.mockResolvedValue({ deck: { id: 42, imageCount: 19 } });
    firebase.uploadLibraryImage.mockResolvedValue('https://storage.example/photo.jpg');
  });

  it('decodes real photos and publishes all 19 interleaved cards in their selected order', async () => {
    const files: Express.Multer.File[] = [];
    const cards: Array<Record<string, unknown>> = [];
    for (let index = 0; index < 19; index++) {
      if (index % 2 === 0 && index < 16) {
        cards.push({ kind: 'character', id: `character-${index}`, revision: 1 });
      } else {
        const buffer = await sharp({ create: { width: 12, height: 16, channels: 3, background: { r: index * 10, g: 80, b: 160 } } }).png().toBuffer();
        cards.push({ kind: 'photo', index: files.length, name: `Photo ${index}` });
        files.push({ buffer, size: buffer.length, mimetype: 'image/png' } as Express.Multer.File);
      }
    }
    const result = await controller.mixedDeck(
      { user: { id: 7 } }, files, JSON.stringify({ operationId: 'mixed-19', cards }),
    );
    expect(result.deck.imageCount).toBe(19);
    expect(firebase.uploadLibraryImage).toHaveBeenCalledTimes(11);
    const [owner, input, mixed] = atelier.publish.mock.calls[0];
    expect(owner).toBe(7);
    expect(input.characters).toHaveLength(8);
    expect(mixed.photos).toHaveLength(11);
    expect(mixed.order).toEqual(cards);
    expect(new Set(mixed.photos.map(photo => photo.hash)).size).toBe(11);
    for (const call of firebase.uploadLibraryImage.mock.calls) {
      expect(call[2]).toBe('image/jpeg');
      expect(await sharp(call[1]).metadata()).toMatchObject({ format: 'jpeg', width: 12, height: 16 });
    }
  });

  it('still rejects invalid photo bytes without publishing a partial deck', async () => {
    const cards = Array.from({ length: 18 }, (_, i) => ({ kind: 'character', id: `c-${i}`, revision: 1 }));
    const buffer = Buffer.from('not an image');
    await expect(controller.mixedDeck(
      { user: { id: 7 } },
      [{ buffer, size: buffer.length, mimetype: 'image/jpeg' } as Express.Multer.File],
      JSON.stringify({ operationId: 'bad-photo', cards: [...cards, { kind: 'photo', index: 0, name: 'Photo' }] }),
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(firebase.uploadLibraryImage).not.toHaveBeenCalled();
    expect(atelier.publish).not.toHaveBeenCalled();
  });
});
