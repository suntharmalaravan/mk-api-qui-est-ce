#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { characters } = require('./anime.roster.json');
const dir = path.resolve(__dirname, '../../assets/catalog/anime/references');
async function main() {
  fs.mkdirSync(dir, { recursive: true });
  let failures = 0;
  for (const c of characters) {
    const target = path.join(dir, `${c.id}.jpg`);
    if (fs.existsSync(target)) {
      const meta = await sharp(target).metadata();
      if (meta.width >= 80 && meta.height >= 80) continue;
    }
    try {
      const { pageUrl, imageUrl: url } = c.reference;
      await new Promise(resolve => setTimeout(resolve, 1500));
      const img = await fetch(url.replace(/&amp;/g, '&').replace(/\/\d+px-/, '/250px-'), { signal: AbortSignal.timeout(20000) });
      if (!img.ok) throw new Error(`Image HTTP ${img.status}`);
      const data = Buffer.from(await img.arrayBuffer());
      const metadata = await sharp(data).metadata();
      if (metadata.width < 80 || metadata.height < 80) throw new Error('Reference image too small');
      fs.writeFileSync(target, data);
      fs.writeFileSync(path.join(dir, `${c.id}.source.json`), JSON.stringify({ pageUrl, imageUrl: url }, null, 2));
      console.log(`OK ${c.id}`);
    } catch (e) { failures++; console.log(`FAILED ${c.id}: ${e.message}`); }
  }
  if (failures) throw new Error(`${failures} references missing; rerun to resume.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
