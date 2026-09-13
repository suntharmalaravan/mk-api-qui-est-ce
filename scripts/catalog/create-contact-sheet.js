#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Assemble les images d'un catalogue en planche de contrôle numérotée.
 *
 *   node scripts/catalog/create-contact-sheet.js actors /tmp/actors.jpg
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  const slug = process.argv[2];
  const output =
    process.argv[3] || path.join('/tmp', `${slug}-contact-sheet.jpg`);
  if (!slug) {
    console.error(
      'Usage: node scripts/catalog/create-contact-sheet.js <slug> [output]',
    );
    process.exit(1);
  }

  const directory = path.join(__dirname, '..', '..', 'assets', 'catalog', slug);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'),
  );
  const columns = 4;
  const cardWidth = 280;
  const imageSize = 256;
  const labelHeight = 58;
  const cardHeight = imageSize + labelHeight;
  const entries = manifest.characters || manifest.entries || manifest.images;
  const rows = Math.ceil(entries.length / columns);

  const composites = [];
  for (const [index, entry] of entries.entries()) {
    const left = (index % columns) * cardWidth + 12;
    const top = Math.floor(index / columns) * cardHeight + 10;
    const portrait = await sharp(path.join(directory, entry.file))
      .resize(imageSize, imageSize)
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${imageSize}" height="${labelHeight}">
        <rect width="100%" height="100%" fill="#111827"/>
        <text x="10" y="23" fill="white" font-family="Arial, sans-serif" font-size="17" font-weight="700">${String(
          index + 1,
        ).padStart(2, '0')} · ${escapeXml(entry.name)}</text>
        <text x="10" y="45" fill="#9ca3af" font-family="Arial, sans-serif" font-size="13">${escapeXml(
          entry.attribution?.license || '',
        )}</text>
      </svg>`,
    );
    composites.push({ input: portrait, left, top });
    composites.push({ input: label, left, top: top + imageSize });
  }

  await sharp({
    create: {
      width: columns * cardWidth,
      height: rows * cardHeight + 10,
      channels: 3,
      background: '#e5e7eb',
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(output);

  console.log(`✅ Planche créée: ${output}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
