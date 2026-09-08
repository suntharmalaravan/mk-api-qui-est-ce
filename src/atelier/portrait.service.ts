import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OverlayOptions } from 'sharp';
import { join } from 'path';
import { COLORS, portraitHash, Recipe } from './catalog';
import { ANCHORS, ASSET_FILES, renderLayers } from './catalogContract';
const sharp: typeof import('sharp').default = require('sharp');
const SIZE = 512;
@Injectable()
export class PortraitService {
  private active = 0;
  async render(r: Recipe): Promise<{ hash: string; jpeg: Buffer }> {
    if (this.active >= 2)
      throw new ServiceUnavailableException({
        code: 'RENDER_BUSY',
        message: 'Atelier occupé. Réessaie dans un instant.',
      });
    this.active++;
    try {
      const layers = renderLayers(r);
      const overlays: OverlayOptions[] = [];
      for (const layer of layers) {
        const { scale, y } = ANCHORS[layer.art];
        const edge = Math.round(SIZE * scale);
        const top = Math.round((SIZE - edge) / 2 + y * SIZE);
        const left = Math.round((SIZE - edge) / 2);
        const width = Math.min(
          edge + Math.min(0, left),
          SIZE - Math.max(0, left),
        );
        const height = Math.min(
          edge + Math.min(0, top),
          SIZE - Math.max(0, top),
        );
        let source = sharp(join(__dirname, 'assets', ASSET_FILES[layer.art]));
        // Mirror React Native Image tintColor (source-in) and layer opacity.
        // The unmodified v1 pipeline stays byte-for-byte identical.
        if (layer.tint || layer.opacity !== undefined) {
          const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const rgb = layer.tint ? [1, 3, 5].map(start => parseInt(layer.tint.slice(start, start + 2), 16)) : null;
          for (let i = 0; i < data.length; i += 4) {
            if (rgb) { data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; }
            if (layer.opacity !== undefined) data[i + 3] = Math.round(data[i + 3] * layer.opacity);
          }
          source = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
        }
        const input = await source
          .resize(edge, edge, { fit: 'fill' })
          .extract({
            left: Math.max(0, -left),
            top: Math.max(0, -top),
            width,
            height,
          })
          .png()
          .toBuffer();
        overlays.push({
          input,
          top: Math.max(0, top),
          left: Math.max(0, left),
        });
      }
      const jpeg = await sharp({
        create: {
          width: SIZE,
          height: SIZE,
          channels: 3,
          background: COLORS[r.backdrop],
        },
      })
        .composite(overlays)
        .jpeg({ quality: 90 })
        .toBuffer();
      if (jpeg.length > 524288) throw new Error('Portrait too large');
      return { hash: portraitHash(r), jpeg };
    } finally {
      this.active--;
    }
  }
}
