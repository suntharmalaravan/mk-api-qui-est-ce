import { PortraitService } from './portrait.service';
import { ITEMS, recipe } from './catalog';
const sharp: typeof import('sharp').default = require('sharp');
const base = recipe(
  Object.fromEntries([
    ['catalogVersion', 1],
    ...Object.entries(ITEMS).map(([s, ids]) => [s, ids[0]]),
  ]),
);
describe('canonical portrait renderer with the actual production assets', () => {
  it('produces deterministic opaque 512px JPEGs within the storage limit', async () => {
    const renderer = new PortraitService();
    const first = await renderer.render(base);
    const second = await renderer.render(base);
    const metadata = await sharp(first.jpeg).metadata();
    expect(metadata).toMatchObject({
      width: 512,
      height: 512,
      format: 'jpeg',
      hasAlpha: false,
    });
    expect(first.jpeg.length).toBeLessThanOrEqual(524288);
    expect(first.jpeg.equals(second.jpeg)).toBe(true);
    expect(first.hash).toBe(second.hash);
  });
  it('clips translated layers and makes hidden hairstyles visually identical', async () => {
    const renderer = new PortraitService();
    const cap = {
      ...base,
      hat: 'hat-cap',
      glasses: 'glasses-round',
      beard: 'beard-goatee',
      outfit: 'outfit-jacket',
    };
    const a = await renderer.render(cap),
      b = await renderer.render({ ...cap, hair: 'hair-quiff' });
    expect(a.jpeg.equals(b.jpeg)).toBe(true);
    expect(a.hash).not.toBe(b.hash);
  });
});
