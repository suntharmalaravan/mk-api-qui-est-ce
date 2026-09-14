import { createHash } from 'crypto';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  ASSET_FILES,
  canonicalRecipe,
  ITEMS_V2,
  ITEMS_V3,
  HAIR_COLORS,
  upgradeRecipe,
  visibleKey,
} from './catalogContract';
import { portraitHash, recipe } from './catalog';
import { PortraitService } from './portrait.service';
import { AtelierService } from './atelier.service';
const sharp: typeof import('sharp').default = require('sharp');
const legacy = recipe({
  catalogVersion: 1,
  hair: 'hair-quiff',
  glasses: 'glasses-round',
  hat: 'hat-none',
  beard: 'beard-goatee',
  outfit: 'outfit-jacket',
  backdrop: 'backdrop-ice',
});
const modern = recipe({
  ...upgradeRecipe(legacy),
  face: 'face-feminine',
  hair: 'hair-bob',
  hairColor: 'hairColor-pink',
  glasses: 'glasses-y2k',
  beard: 'beard-none',
  outfit: 'outfit-hoodie',
  accessory: 'accessory-headphones',
});
describe('atelier v2', () => {
  it('preserves published v1 hashes and JPEG bytes', async () => {
    const result = await new PortraitService().render(legacy);
    expect(result.hash).toBe(
      'b99fe9ae219d22c4f45a965545192583183f8895811245259abdbf982608f2fb',
    );
    expect(createHash('sha256').update(result.jpeg).digest('hex')).toBe(
      'dd65220e714556b044e73d76827d4983816d9f0f67e0cbf2a6177dfc4d39593b',
    );
    const compatible = await new PortraitService().render(
      upgradeRecipe(legacy),
    );
    expect(compatible.jpeg.equals(result.jpeg)).toBe(true);
    expect(visibleKey(upgradeRecipe(legacy))).toBe(visibleKey(legacy));
    expect(compatible.hash).not.toBe(result.hash);
  });
  it('preserves published v2 JPEG bytes', async () => {
    const result = await new PortraitService().render(modern);
    expect(createHash('sha256').update(result.jpeg).digest('hex')).toBe(
      'a1841536cf91e139e3c6d8c6a3e8b053c53c0e21ea2a9f08dd89011cccf903ed',
    );
  });
  it('validates v2, canonicalizes property order and rejects forged v1 or colors', () => {
    expect(
      recipe(Object.fromEntries(Object.entries(modern).reverse())),
    ).toEqual(modern);
    expect(
      portraitHash(
        recipe(Object.fromEntries(Object.entries(modern).reverse())),
      ),
    ).toBe(portraitHash(modern));
    expect(canonicalRecipe({ ...legacy, hair: 'hair-bob' })).toBeNull();
    expect(canonicalRecipe({ ...modern, hairColor: '#000000' })).toBeNull();
    expect(canonicalRecipe({ ...modern, extra: true })).toBeNull();
    expect(canonicalRecipe({ ...modern, accessory: undefined })).toBeNull();
    expect(Object.keys(HAIR_COLORS)).toHaveLength(12);
  });
  it('has real alpha on every new asset, with empty corners and an empty face opening', async () => {
    for (const file of Object.values(ASSET_FILES).filter((value) =>
      value.startsWith('v2/'),
    )) {
      const src = sharp(join(__dirname, 'assets', file));
      expect((await src.metadata()).hasAlpha).toBe(true);
      const { data, info } = await src
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data[3]).toBe(0);
      expect(data[(info.width - 1) * 4 + 3]).toBe(0);
      if (file.endsWith('headphones.png')) {
        expect(
          data[
            (Math.floor(info.height / 2) * info.width +
              Math.floor(info.width / 2)) *
              4 +
              3
          ],
        ).toBe(0);
      }
    }
  });
  it('renders every face and cut with deterministic, distinct colors and bounded JPEG size', async () => {
    const renderer = new PortraitService();
    for (const face of ITEMS_V2.face)
      for (const hair of ITEMS_V2.hair) {
        const a = recipe({
          ...modern,
          face,
          hair,
          hairColor: 'hairColor-blue',
        });
        const b = recipe({ ...a, hairColor: 'hairColor-pink' });
        const first = await renderer.render(a),
          second = await renderer.render(b);
        expect(first.hash).toBe(portraitHash(a));
        expect(first.jpeg.length).toBeLessThanOrEqual(524288);
        expect(first.jpeg.equals(second.jpeg)).toBe(hair === 'hair-none');
      }
    const capped = recipe({ ...modern, hat: 'hat-cap' });
    const hidden = recipe({
      ...capped,
      hair: 'hair-curls',
      hairColor: 'hairColor-mint',
    });
    expect(visibleKey(capped)).toBe(visibleKey(hidden));
    expect(
      (await renderer.render(capped)).jpeg.equals(
        (await renderer.render(hidden)).jpeg,
      ),
    ).toBe(true);
  }, 20000);
  it.each([
    modern,
    recipe({
      ...upgradeRecipe(modern, 3),
      face: 'face-umber',
      neckwear: 'neckwear-scarf',
      outfit: 'outfit-varsity',
    }),
  ])(
    'stores every slot and returns the same recipe on list: %j',
    async (savedRecipe) => {
      let row: any;
      const query = jest.fn(async (sql: string, args: any[] = []) => {
        if (sql.startsWith('SELECT count')) return [{ count: 0 }];
        if (sql.startsWith('INSERT INTO atelier_character')) {
          row = {
            id: args[1],
            name: args[2],
            recipe: JSON.parse(args[3]),
            portrait_hash: args[4],
            visible_key: args[5],
            revision: 1,
            updated_at: new Date(),
          };
          return [row];
        }
        if (sql.includes('ORDER BY updated_at')) return [row];
        return [];
      });
      const db: any = {
        query,
        manager: { query },
        transaction: async (run) => run({ query }),
      };
      const renderer = new PortraitService();
      const atelier = new AtelierService(
        db,
        new ConfigService({
          ATELIER_ENABLED: 'true',
          ATELIER_PUBLIC_URL: 'https://api.example.test',
        }),
        renderer,
      );
      const result = await atelier.save(7, {
        id: 'v2-suspect',
        operationId: 'save-v2',
        expectedRevision: 0,
        name: 'Alex rose',
        recipe: savedRecipe,
      });
      expect(result.recipe).toEqual(savedRecipe);
      expect(result.portrait.endsWith(portraitHash(savedRecipe))).toBe(true);
      expect(query).toHaveBeenCalledWith(
        'SELECT hash FROM atelier_portrait WHERE hash=$1',
        [portraitHash(savedRecipe)],
      );
      expect((await atelier.list(7)).characters[0].recipe).toEqual(savedRecipe);
      expect(atelier.catalog()).toMatchObject({
        catalogVersion: 3,
        supportedCatalogVersions: [1, 2, 3],
        slots: ITEMS_V3,
      });
    },
  );
});
