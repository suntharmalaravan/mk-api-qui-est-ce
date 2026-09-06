#!/usr/bin/env node
/**
 * Télécharge une catégorie de personnages réels depuis Wikimedia Commons,
 * recadre en carré autour du visage et écrit les crédits d'auteur.
 *
 *   node scripts/catalog/download-photo-catalog.js footballers
 *
 * Les licences CC BY et CC BY-SA obligent à créditer l'auteur et à nommer la
 * licence partout où l'image est affichée : le manifeste et CREDITS.md
 * produits ici sont ce qui rend la catégorie publiable légalement.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const USER_AGENT = 'mk-api-quiestce/1.0 (catalogue de jeu; contact via le dépôt)';

/**
 * Découpe un carré dans l'image d'origine.
 * `zoom` est la taille du côté rapportée au plus petit côté de la photo,
 * `x` / `y` le centre visé en fraction de largeur / hauteur.
 */
function square({ width, height }, crop) {
  const side = Math.max(16, Math.min(Math.round(Math.min(width, height) * crop.zoom), Math.min(width, height)));
  const clamp = (v, max) => Math.max(0, Math.min(Math.round(v), max - side));
  return {
    left: clamp(crop.x * width - side / 2, width),
    top: clamp(crop.y * height - side / 2, height),
    width: side,
    height: side,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Commons rend des 429 dès qu'on enchaîne les téléchargements : on espace les
// requêtes et on recule longuement à chaque refus.
const THROTTLE_MS = 2000;

async function fetchImage(url, attempt = 1) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (attempt >= 8) throw error;
    await sleep(5000 * attempt);
    return fetchImage(url, attempt + 1);
  }
}

/** Ligne de manifeste : c'est elle qui porte les crédits obligatoires. */
function entry(character, fileName, slug) {
  return {
    file: fileName,
    name: character.name,
    storagePath: `catalog/${slug}/${fileName}`,
    attribution: {
      author: character.source.author,
      license: character.source.license,
      licenseUrl: character.source.licenseUrl,
      sourceFile: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(character.source.file)}`,
    },
  };
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/catalog/download-photo-catalog.js <slug>');
    process.exit(1);
  }

  const rosterPath = path.join(__dirname, `${slug}.roster.json`);
  if (!fs.existsSync(rosterPath)) {
    console.error(`❌ Roster introuvable: ${rosterPath}`);
    process.exit(1);
  }

  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const outDir = path.join(__dirname, '..', '..', 'assets', 'catalog', slug);
  const cacheDir = path.join(__dirname, '..', '..', 'assets', 'catalog', '.cache', slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const { size, quality } = roster.render;
  console.log(`📦 Catégorie "${roster.slug}" — ${roster.characters.length} personnages`);
  console.log(`📁 Destination: ${outDir}\n`);

  const manifest = [];

  // `--force` refait tout ; sinon on reprend là où un run précédent s'est
  // arrêté, ce qui évite de retélécharger après un 429.
  const force = process.argv.includes('--force');
  const only = new Set(process.argv.filter((a) => a.startsWith('--only=')).flatMap((a) => a.slice(7).split(',')));

  for (const [index, character] of roster.characters.entries()) {
    const fileName = `${character.file}.jpg`;
    const filePath = path.join(outDir, fileName);
    const targeted = only.size === 0 || only.has(character.file);
    const skip = !force && !only.size && fs.existsSync(filePath);

    if (skip || !targeted) {
      manifest.push(entry(character, fileName, slug));
      console.log(`  ⏭  ${String(index + 1).padStart(2)}/${roster.characters.length}  ${fileName.padEnd(24)} déjà présent`);
      continue;
    }

    // L'original est mis en cache : ajuster un cadrage ne doit pas relancer un
    // téléchargement, Commons coupe vite le robinet.
    const cachePath = path.join(cacheDir, `${character.file}.orig`);
    let original;
    if (fs.existsSync(cachePath)) {
      original = fs.readFileSync(cachePath);
    } else {
      original = await fetchImage(character.source.url);
      fs.writeFileSync(cachePath, original);
      await sleep(THROTTLE_MS);
    }

    const metadata = await sharp(original).metadata();
    const region = square(metadata, character.crop);

    const buffer = await sharp(original)
      .extract(region)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(filePath, buffer);
    await sleep(THROTTLE_MS);

    manifest.push(entry(character, fileName, slug));

    const kb = String(Math.round(buffer.length / 1024)).padStart(3);
    console.log(
      `  ✅ ${String(index + 1).padStart(2)}/${roster.characters.length}  ${fileName.padEnd(24)} ${kb} Ko  ` +
      `${character.name.padEnd(18)} ${character.source.license}`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify({ slug: roster.slug, label: roster.label, attribution: roster.attribution, images: manifest }, null, 2),
  );

  const credits = [
    `# Crédits — catégorie « ${roster.label} »`,
    '',
    roster.attribution.note,
    '',
    'Ces mentions doivent apparaître dans l\'application, par exemple sur un écran « Crédits images ».',
    '',
    '| Personnage | Auteur | Licence | Fichier source |',
    '| --- | --- | --- | --- |',
    ...manifest.map((m) => {
      const a = m.attribution;
      const license = a.licenseUrl ? `[${a.license}](${a.licenseUrl})` : a.license;
      return `| ${m.name} | ${a.author || 'Auteur inconnu'} | ${license} | [Commons](${a.sourceFile}) |`;
    }),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'CREDITS.md'), credits);

  console.log(`\n📝 Manifeste + CREDITS.md écrits dans ${outDir}`);
  console.log(`✅ ${manifest.length} images`);
}

main().catch((error) => {
  console.error('❌ Échec:', error.message);
  process.exit(1);
});
