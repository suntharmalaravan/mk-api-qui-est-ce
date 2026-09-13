#!/usr/bin/env node
/**
 * Resolve a curated list of Wikipedia people to their current Wikimedia
 * Commons portrait and its license metadata.
 *
 *   node scripts/catalog/discover-wikimedia-category.js actors
 *
 * Input:  scripts/catalog/<slug>.candidates.json
 * Output: scripts/catalog/<slug>.roster.json
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const USER_AGENT =
  'mk-api-quiestce/1.0 (catalogue de jeu; contact via le depot)';
const ALLOWED_LICENSE = /^(CC0|CC BY(?:-SA)?|Public domain|Public Domain|PDM)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (response.status === 429 && attempt < 8) {
    const retryAfter = Number(response.headers.get('retry-after')) || 5;
    await sleep(Math.max(5_000, retryAfter * 1_000) * attempt);
    return getJson(url, attempt + 1);
  }
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  await sleep(750);
  return data;
}

function normalizedTitle(value) {
  return String(value).replace(/_/g, ' ').trim().toLowerCase();
}

async function resolveCandidates(
  candidates,
  wikidataProperty,
  defaultRestrictions,
  defaultCrop,
) {
  const wikipedia = new URL('https://en.wikipedia.org/w/api.php');
  wikipedia.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageprops',
    ppprop: 'wikibase_item',
    titles: candidates.map((candidate) => candidate.wikipedia).join('|'),
  });
  const wikipediaData = await getJson(wikipedia);
  const aliases = new Map();
  for (const item of [
    ...(wikipediaData.query?.normalized || []),
    ...(wikipediaData.query?.redirects || []),
  ]) {
    aliases.set(normalizedTitle(item.from), normalizedTitle(item.to));
  }
  const resolveAlias = (title) => {
    let current = normalizedTitle(title);
    for (let index = 0; index < 4 && aliases.has(current); index += 1) {
      current = aliases.get(current);
    }
    return current;
  };
  const wikipediaPages = new Map(
    (wikipediaData.query?.pages || []).map((page) => [
      normalizedTitle(page.title),
      page,
    ]),
  );
  const candidatesWithIds = candidates.map((candidate) => {
    const page = wikipediaPages.get(resolveAlias(candidate.wikipedia));
    const wikidataId = page?.pageprops?.wikibase_item;
    if (!wikidataId) {
      throw new Error(`Wikidata ID absent pour ${candidate.name}`);
    }
    return { ...candidate, wikidataId };
  });

  const wikidata = new URL('https://www.wikidata.org/w/api.php');
  wikidata.search = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    ids: candidatesWithIds.map((candidate) => candidate.wikidataId).join('|'),
    props: 'claims',
  });
  const wikidataData = await getJson(wikidata);
  const candidatesWithFiles = candidatesWithIds.map((candidate) => {
    const file =
      candidate.sourceFile ||
      wikidataData.entities?.[candidate.wikidataId]?.claims?.[
        wikidataProperty
      ]?.[0]?.mainsnak?.datavalue?.value;
    if (!file) {
      throw new Error(
        `Fichier ${wikidataProperty} absent pour ${candidate.name}`,
      );
    }
    return { ...candidate, sourceFile: file };
  });

  const commons = new URL('https://commons.wikimedia.org/w/api.php');
  commons.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1024',
    titles: candidatesWithFiles
      .map((candidate) => `File:${candidate.sourceFile}`)
      .join('|'),
  });
  const commonsData = await getJson(commons);
  const commonsPages = new Map(
    (commonsData.query?.pages || []).map((page) => [
      normalizedTitle(page.title.replace(/^File:/i, '')),
      page,
    ]),
  );

  return candidatesWithFiles.map((candidate) => {
    const info = commonsPages.get(normalizedTitle(candidate.sourceFile))
      ?.imageinfo?.[0];
    if (!info) {
      throw new Error(
        `Métadonnées Commons absentes pour ${candidate.sourceFile}`,
      );
    }

    const metadata = info.extmetadata || {};
    const license = plainText(metadata.LicenseShortName?.value);
    if (!ALLOWED_LICENSE.test(license)) {
      throw new Error(
        `Licence non compatible pour ${candidate.name}: ${license}`,
      );
    }

    return {
      file: candidate.file,
      name: candidate.name,
      wikipedia: candidate.wikipedia,
      source: {
        file: candidate.sourceFile,
        // Les miniatures officielles passent par le CDN dédié et évitent de
        // télécharger des originaux énormes ou temporairement limités.
        url: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        license,
        licenseUrl: metadata.LicenseUrl?.value || null,
        author:
          plainText(metadata.Artist?.value || metadata.Credit?.value).slice(
            0,
            255,
          ) || 'Auteur inconnu',
        restrictions:
          candidate.restrictions ||
          plainText(metadata.Restrictions?.value) ||
          defaultRestrictions ||
          null,
      },
      crop: candidate.crop || defaultCrop || { zoom: 0.78, x: 0.5, y: 0.32 },
    };
  });
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error(
      'Usage: node scripts/catalog/discover-wikimedia-category.js <slug>',
    );
    process.exit(1);
  }

  const candidatesPath = path.join(__dirname, `${slug}.candidates.json`);
  if (!fs.existsSync(candidatesPath)) {
    throw new Error(`Fichier absent: ${candidatesPath}`);
  }
  const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
  if (
    !Array.isArray(candidates.characters) ||
    candidates.characters.length < 18
  ) {
    throw new Error('La catégorie doit contenir au moins 18 personnages');
  }

  const characters = await resolveCandidates(
    candidates.characters,
    candidates.wikidataProperty || 'P18',
    candidates.defaultRestrictions || null,
    candidates.defaultCrop || null,
  );
  for (const [index, resolved] of characters.entries()) {
    console.log(
      `  ✅ ${String(index + 1).padStart(2)}/${candidates.characters.length} ${
        resolved.name
      } — ${resolved.source.license}`,
    );
  }

  const roster = {
    slug,
    label: candidates.label,
    render: {
      size: 512,
      format: 'jpeg',
      quality: 84,
      ...(candidates.render || {}),
    },
    attribution: {
      required: true,
      note:
        candidates.attributionNote ||
        'Les portraits Wikimedia Commons doivent être crédités selon la licence indiquée pour chaque image.',
    },
    characters,
  };
  const rosterPath = path.join(__dirname, `${slug}.roster.json`);
  fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
  console.log(`\n✅ Roster écrit: ${rosterPath}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
