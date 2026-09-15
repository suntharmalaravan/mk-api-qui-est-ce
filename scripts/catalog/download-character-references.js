#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const slug = process.argv[2];
if (!/^[a-z][a-z0-9_]*$/.test(slug || '')) throw new Error('Usage: download-character-references.js <slug>');
const rosterPath = path.join(__dirname, `${slug}.roster.json`);
const roster = JSON.parse(fs.readFileSync(rosterPath));
const dir = path.resolve(__dirname, '../../assets/catalog', slug, 'references');
async function main() {
  fs.mkdirSync(dir, { recursive: true });
  let failures = 0;
  for (const c of roster.characters) {
    const target = path.join(dir, `${c.id}.jpg`);
    if (fs.existsSync(target) && c.reference) continue;
    try {
      const pageUrl = `https://en.wikipedia.org/wiki/${c.wiki}`;
      let url = c.reference?.imageUrl;
      if (!url) {
        const response = await fetch(pageUrl, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Page HTTP ${response.status}`);
        const html = await response.text();
        const raw = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
          || html.match(/<table[^>]*class="[^"]*infobox[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1];
        url = raw?.startsWith('//') ? `https:${raw}` : raw;
        if (!url) throw new Error('No character image');
        url = url.replace(/&amp;/g, '&').split('?')[0];
      }
      c.reference = { pageUrl, imageUrl: url };
      fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2) + '\n');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const img = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!img.ok) throw new Error(`Image HTTP ${img.status}`);
      const data = Buffer.from(await img.arrayBuffer());
      const metadata = await sharp(data).metadata();
      if (metadata.width < 80 || metadata.height < 80) throw new Error('Reference too small');
      fs.writeFileSync(target, data);
      console.log(`OK ${c.id}`);
    } catch (e) { failures++; console.log(`FAILED ${c.id}: ${e.message}`); }
  }
  if (failures) throw new Error(`${failures} references missing; rerun to resume.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
