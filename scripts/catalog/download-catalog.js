#!/usr/bin/env node
/**
 * Télécharge en local les images d'une catégorie du catalogue officiel.
 *
 *   node scripts/catalog/download-catalog.js avatars
 *
 * Le casting est décrit dans <slug>.roster.json (versionné, donc régénérable
 * à l'identique). Les PNG produits ne sont PAS versionnés : ils atterrissent
 * dans assets/catalog/<slug>/ puis partent sur Firebase Storage.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.dicebear.com/9.x/avataaars/png';

// Trois jeux d'expressions alternés : assez de vie pour que les cartes ne
// paraissent pas clonées, sans brouiller les attributs qui servent à deviner.
const EXPRESSIONS = [
  { eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile' },
  { eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'twinkle' },
  { eyes: 'squint', eyebrows: 'flatNatural', mouth: 'default' },
];

function buildUrl(character, index, render) {
  const expression = EXPRESSIONS[index % EXPRESSIONS.length];

  const params = new URLSearchParams({
    seed: character.file,
    size: String(render.size),
    backgroundColor: render.backgroundColor,
    top: character.top,
    topProbability: '100',
    hairColor: character.hairColor,
    skinColor: character.skinColor,
    clothing: character.clothing,
    clothesColor: character.clothesColor,
    ...expression,
  });

  // Les probabilités doivent être forcées à 0 ou 100 : sans ça DiceBear
  // ajoute barbe et lunettes au hasard et la répartition des attributs,
  // équilibrée dans le roster, ne serait plus respectée.
  if (character.facialHair) {
    params.set('facialHair', character.facialHair);
    params.set('facialHairProbability', '100');
    params.set('facialHairColor', character.hairColor);
  } else {
    params.set('facialHairProbability', '0');
  }

  if (character.accessories) {
    params.set('accessories', character.accessories);
    params.set('accessoriesProbability', '100');
  } else {
    params.set('accessoriesProbability', '0');
  }

  if (character.hatColor) {
    params.set('hatColor', character.hatColor);
  }

  return `${API}?${params.toString()}`;
}

async function download(url, attempt = 1) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    return download(url, attempt + 1);
  }
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/catalog/download-catalog.js <slug>');
    process.exit(1);
  }

  const rosterPath = path.join(__dirname, `${slug}.roster.json`);
  if (!fs.existsSync(rosterPath)) {
    console.error(`❌ Roster introuvable: ${rosterPath}`);
    process.exit(1);
  }

  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const outDir = path.join(__dirname, '..', '..', 'assets', 'catalog', slug);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`📦 Catégorie "${roster.slug}" — ${roster.characters.length} personnages`);
  console.log(`📁 Destination: ${outDir}\n`);

  const manifest = [];

  for (const [index, character] of roster.characters.entries()) {
    const url = buildUrl(character, index, roster.render);
    const buffer = await download(url);
    const fileName = `${character.file}.png`;

    fs.writeFileSync(path.join(outDir, fileName), buffer);

    manifest.push({
      file: fileName,
      name: character.name,
      // Chemin exact que prendra l'objet dans Firebase Storage.
      storagePath: `catalog/${slug}/${fileName}`,
    });

    const size = String(Math.round(buffer.length / 1024)).padStart(3);
    console.log(
      `  ✅ ${String(index + 1).padStart(2)}/${roster.characters.length}  ${fileName.padEnd(16)} ${size} Ko  ${character.name}`,
    );
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ slug: roster.slug, label: roster.label, source: roster.source, images: manifest }, null, 2),
  );

  console.log(`\n📝 Manifeste: ${manifestPath}`);
  console.log(`✅ ${manifest.length} images téléchargées`);
}

main().catch((error) => {
  console.error('❌ Échec:', error.message);
  process.exit(1);
});
