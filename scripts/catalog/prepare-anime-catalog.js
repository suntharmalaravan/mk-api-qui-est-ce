#!/usr/bin/env node
// Prépare uniquement les exports locaux ; aucune écriture distante.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const roster = require('./anime.roster.json');
const dir = path.resolve(__dirname, '../../assets/catalog/anime');
async function main() {
  if (roster.characters.length !== 24 || new Set(roster.characters.map(c => c.name)).size !== 24) throw new Error('24 personnages uniques requis');
  const images = [];
  for (const c of roster.characters) {
    const source = path.join(dir, c.file);
    const metadata = await sharp(source).metadata();
    if (metadata.width !== metadata.height || metadata.width < 768) throw new Error(`Portrait carré trop petit : ${c.name}`);
    const file = c.file.replace(/\.png$/, '.jpg');
    const buffer = await sharp(source).resize(768, 768).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(dir, file), buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const reference = c.reference;
    images.push({ file, name: c.name, universe: c.universe, original: c.file, sha256, bytes: buffer.length, width: 768, height: 768,
      storagePath: `catalog/anime/v1/${sha256.slice(0, 12)}-${file}`,
      reference,
      attribution: { author: null, license: null, licenseUrl: null, sourceFile: reference.pageUrl, restrictions: 'Illustration générée par IA ; personnage de fiction.' } });
  }
  const manifestPath = path.join(dir, 'manifest.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : null;
  for (const image of images) {
    const match = previous?.images.find(i => i.sha256 === image.sha256 && i.name === image.name);
    if (match?.url) image.url = match.url;
  }
  const manifest = { slug: roster.slug, label: roster.label, generationMode: 'built-in image_gen',
    attribution: { required: false, note: 'Portraits générés. Les références servent à identifier les personnages et ne sont pas les images publiées. Aucune licence libre attribuée aux personnages.' }, images };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`24 portraits validés, ${Math.round(images.reduce((n, i) => n + i.bytes, 0) / 1024)} Ko au total.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
