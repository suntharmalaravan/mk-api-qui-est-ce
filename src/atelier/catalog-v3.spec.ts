import { join } from 'path';
import {
  ASSET_FILES,
  ITEMS_V3,
  canonicalRecipe,
  renderLayers,
  upgradeRecipe,
  visibleKey,
} from './catalogContract';
import { recipe } from './catalog';
import { PortraitService } from './portrait.service';
const sharp: typeof import('sharp').default = require('sharp');
const base = recipe(
  Object.fromEntries([
    ['catalogVersion', 3],
    ...Object.entries(ITEMS_V3).map(([slot, ids]) => [slot, ids[0]]),
  ]),
);

describe('atelier v3 production assets', () => {
  it('rejects incomplete and forged recipes without silently upgrading published versions', () => {
    expect(canonicalRecipe({ ...base, neckwear: undefined })).toBeNull();
    expect(canonicalRecipe({ ...base, catalogVersion: 2 })).toBeNull();
    expect(canonicalRecipe({ ...base, extra: true })).toBeNull();
    expect(upgradeRecipe(base, 2)).toEqual(base);
    expect(visibleKey(base)).not.toBe(
      visibleKey({ ...base, neckwear: 'neckwear-scarf' }),
    );
  });
  it('has actual alpha, empty backgrounds and open lenses on the six assets', async () => {
    for (const file of Object.values(ASSET_FILES).filter((file) =>
      file.startsWith('v3/'),
    )) {
      const source = sharp(join(__dirname, 'assets', file));
      const metadata = await source.metadata();
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBe(metadata.height);
      const { data, info } = await source
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const alpha = (x: number, y: number) =>
        data[
          (Math.floor(y * info.height) * info.width +
            Math.floor(x * info.width)) *
            4 +
            3
        ];
      expect(alpha(0, 0)).toBe(0);
      expect(alpha(0.99, 0.01)).toBe(0);
      expect(alpha(0.5, 0.04)).toBe(0);
      if (file.endsWith('aviators.png')) {
        expect(alpha(0.3, 0.48)).toBe(0);
        expect(alpha(0.7, 0.48)).toBe(0);
      }
      if (file.endsWith('varsity.png')) expect(alpha(0.5, 0.61)).toBe(0);
    }
  });
  it.each(ITEMS_V3.face)(
    'renders each piece and crowded combinations on %s',
    async (face) => {
      const renderer = new PortraitService();
      const variations = [
        {},
        { hat: 'hat-beanie' },
        { glasses: 'glasses-aviators' },
        { outfit: 'outfit-varsity' },
        { neckwear: 'neckwear-scarf' },
        {
          hat: 'hat-beanie',
          glasses: 'glasses-aviators',
          outfit: 'outfit-varsity',
          neckwear: 'neckwear-scarf',
          accessory: 'accessory-headphones',
        },
        {
          hair: 'hair-bob',
          hairColor: 'hairColor-brown',
          outfit: 'outfit-hoodie',
          neckwear: 'neckwear-scarf',
        },
        {
          hair: 'hair-curls',
          beard: 'beard-goatee',
          outfit: 'outfit-jacket',
          neckwear: 'neckwear-scarf',
        },
      ];
      const outputs = [];
      for (const look of variations) {
        const r = recipe({ ...base, face, ...look });
        const first = await renderer.render(r);
        expect(await sharp(first.jpeg).metadata()).toMatchObject({
          width: 512,
          height: 512,
          format: 'jpeg',
          hasAlpha: false,
        });
        expect(first.jpeg.length).toBeLessThanOrEqual(524288);
        outputs.push(first.jpeg.toString('base64'));
      }
      expect(new Set(outputs).size).toBe(variations.length);
      expect(
        (await renderer.render({ ...base, face })).jpeg.toString('base64'),
      ).toBe(outputs[0]);
      const capped = { ...base, face, hat: 'hat-beanie' };
      expect(renderLayers(capped)).toEqual(
        renderLayers({
          ...capped,
          hair: 'hair-bob',
          hairColor: 'hairColor-pink',
        }),
      );
    },
  );
});
