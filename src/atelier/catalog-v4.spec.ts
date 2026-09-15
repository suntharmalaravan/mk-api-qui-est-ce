import { createHash } from 'crypto';
import { join } from 'path';
import {
  ASSET_FILES,
  ITEMS_V3,
  ITEMS_V4,
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
    ['catalogVersion', 4],
    ...Object.entries(ITEMS_V4).map(([slot, ids]) => [slot, ids[0]]),
  ]),
);

describe('atelier v4 and retirement of the lilac hoodie', () => {
  it('rejects the hoodie for v4 while keeping old recipes and JPEG bytes intact', async () => {
    expect(ITEMS_V4.outfit).not.toContain('outfit-hoodie');
    expect(canonicalRecipe({ ...base, outfit: 'outfit-hoodie' })).toBeNull();
    const old = { ...base, catalogVersion: 3, outfit: 'outfit-hoodie' };
    expect(canonicalRecipe(old)).toEqual(old);
    expect(upgradeRecipe(old, 4)).toEqual({ ...base, outfit: 'outfit-tee' });
    const v3 = recipe(
      Object.fromEntries([
        ['catalogVersion', 3],
        ...Object.entries(ITEMS_V3).map(([slot, ids]) => [
          slot,
          ids[ids.length - 1],
        ]),
      ]),
    );
    const portrait = await new PortraitService().render(v3);
    expect(createHash('sha256').update(portrait.jpeg).digest('hex')).toBe(
      'aa5a182c66aa373e4e0a078d17b57498f7ea34c5dd6109eab5ac68cdd50ba623',
    );
    expect(visibleKey(upgradeRecipe(v3, 4))).toBe(visibleKey(v3));
  });
  it('requires true alpha, transparent face/neck/lens openings and empty upper corners', async () => {
    for (const [art, file] of Object.entries(ASSET_FILES).filter(([, file]) =>
      file.startsWith('v4/'),
    )) {
      const source = sharp(join(__dirname, 'assets', file));
      const metadata = await source.metadata();
      expect(metadata.hasAlpha).toBe(true);
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
      if (art === 'pixie' || art === 'braids') expect(alpha(0.5, 0.55)).toBe(0);
      if (art === 'denim' || art === 'mariniere')
        expect(alpha(0.5, 0.73)).toBe(0);
      if (art === 'rectangular') {
        expect(alpha(0.35, 0.51)).toBe(0);
        expect(alpha(0.65, 0.51)).toBe(0);
      }
    }
  });
  it.each(ITEMS_V4.face)(
    'renders the new pieces and layered combinations on %s',
    async (face) => {
      const renderer = new PortraitService();
      const looks = [
        { hair: 'hair-pixie' },
        { hair: 'hair-braids' },
        { hat: 'hat-beret' },
        { hat: 'hat-bucket' },
        { glasses: 'glasses-rectangular' },
        { outfit: 'outfit-denim' },
        { outfit: 'outfit-mariniere' },
        { neckwear: 'neckwear-bowtie' },
        {
          hair: 'hair-braids',
          hairColor: 'hairColor-black',
          glasses: 'glasses-rectangular',
          outfit: 'outfit-denim',
          neckwear: 'neckwear-scarf',
          accessory: 'accessory-headphones',
        },
        {
          hat: 'hat-bucket',
          glasses: 'glasses-aviators',
          outfit: 'outfit-mariniere',
          neckwear: 'neckwear-bowtie',
          accessory: 'accessory-headphones',
        },
      ];
      const outputs = [];
      for (const look of looks) {
        const r = recipe({ ...base, face, ...look });
        const result = await renderer.render(r);
        expect(result.jpeg.length).toBeLessThanOrEqual(524288);
        expect(await sharp(result.jpeg).metadata()).toMatchObject({
          width: 512,
          height: 512,
          format: 'jpeg',
          hasAlpha: false,
        });
        outputs.push(result.jpeg.toString('base64'));
      }
      expect(new Set(outputs).size).toBe(looks.length);
      for (const hair of ['hair-pixie', 'hair-braids']) {
        const blue = { ...base, face, hair, hairColor: 'hairColor-blue' };
        const pink = { ...blue, hairColor: 'hairColor-pink' };
        expect(
          (await renderer.render(blue)).jpeg.equals(
            (await renderer.render(pink)).jpeg,
          ),
        ).toBe(false);
        expect(renderLayers({ ...blue, hat: 'hat-beret' })).toEqual(
          renderLayers({ ...pink, hat: 'hat-beret' }),
        );
      }
    },
    20000,
  );
});
