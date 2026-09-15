/** Portable renderer contract. Mirrored verbatim in mk-api/src/atelier.
 * Published versions are immutable: new art/anchors require a new version. */
export const LEGACY_SLOTS = [
  'hair',
  'glasses',
  'hat',
  'beard',
  'outfit',
  'backdrop',
] as const;
export const EXTRA_SLOTS = ['face', 'hairColor', 'accessory'] as const;
export const V2_SLOTS = [...LEGACY_SLOTS, ...EXTRA_SLOTS] as const;
export const V3_SLOTS = ['neckwear'] as const;
export const RECIPE_SLOTS = [...V2_SLOTS, ...V3_SLOTS] as const;
export type Slot = (typeof RECIPE_SLOTS)[number];
export type Recipe = Record<(typeof LEGACY_SLOTS)[number], string> &
  Partial<
    Record<(typeof EXTRA_SLOTS)[number] | (typeof V3_SLOTS)[number], string>
  > & {
    catalogVersion: number;
  };
export const LEGACY_ITEMS = {
  hair: ['hair-none', 'hair-quiff'],
  glasses: ['glasses-none', 'glasses-round'],
  hat: ['hat-none', 'hat-cap'],
  beard: ['beard-none', 'beard-goatee'],
  outfit: ['outfit-tee', 'outfit-jacket'],
  backdrop: [
    'backdrop-ice',
    'backdrop-lilac',
    'backdrop-peach',
    'backdrop-mint',
    'backdrop-gold',
  ],
};
export const HAIR_COLORS: Record<string, string> = {
  'hairColor-original': '#724A32',
  'hairColor-black': '#15121B',
  'hairColor-brown': '#653820',
  'hairColor-blonde': '#F1C56A',
  'hairColor-ginger': '#D86A28',
  'hairColor-red': '#AB263C',
  'hairColor-pink': '#EF76B3',
  'hairColor-lavender': '#AA7DE0',
  'hairColor-blue': '#458DDA',
  'hairColor-mint': '#62CCAD',
  'hairColor-silver': '#9CA7B4',
  'hairColor-white': '#F4EEE4',
};
export const V2_DEFAULTS = {
  face: 'face-original',
  hairColor: 'hairColor-original',
  accessory: 'accessory-none',
};
export const ITEMS_V2: Record<(typeof V2_SLOTS)[number], readonly string[]> = {
  ...LEGACY_ITEMS,
  hair: [...LEGACY_ITEMS.hair, 'hair-bob', 'hair-curls', 'hair-swoop'],
  glasses: [...LEGACY_ITEMS.glasses, 'glasses-y2k'],
  outfit: [...LEGACY_ITEMS.outfit, 'outfit-hoodie'],
  face: ['face-original', 'face-feminine'],
  hairColor: Object.keys(HAIR_COLORS),
  accessory: ['accessory-none', 'accessory-headphones'],
};
export const V3_DEFAULTS = { ...V2_DEFAULTS, neckwear: 'neckwear-none' };
export const ITEMS_V3: Record<Slot, readonly string[]> = {
  ...ITEMS_V2,
  face: [...ITEMS_V2.face, 'face-umber', 'face-rose'],
  glasses: [...ITEMS_V2.glasses, 'glasses-aviators'],
  hat: [...ITEMS_V2.hat, 'hat-beanie'],
  outfit: [...ITEMS_V2.outfit, 'outfit-varsity'],
  neckwear: ['neckwear-none', 'neckwear-scarf'],
};
/** New creations exclude the retired hoodie; v1-v3 remain readable. */
export const ITEMS_V4: Record<Slot, readonly string[]> = {
  ...ITEMS_V3,
  hair: [...ITEMS_V3.hair, 'hair-pixie', 'hair-braids'],
  glasses: [...ITEMS_V3.glasses, 'glasses-rectangular'],
  hat: [...ITEMS_V3.hat, 'hat-beret', 'hat-bucket'],
  outfit: [
    ...ITEMS_V3.outfit.filter(id => id !== 'outfit-hoodie'),
    'outfit-denim',
    'outfit-mariniere',
  ],
  neckwear: [...ITEMS_V3.neckwear, 'neckwear-bowtie'],
};
export function recipeSlots(r: Recipe): readonly Slot[] {
  return r.catalogVersion === 1
    ? LEGACY_SLOTS
    : r.catalogVersion === 2
    ? V2_SLOTS
    : RECIPE_SLOTS;
}
export function canonicalRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const r = value as Recipe;
  if (
    r.catalogVersion !== 1 &&
    r.catalogVersion !== 2 &&
    r.catalogVersion !== 3 &&
    r.catalogVersion !== 4
  ) {
    return null;
  }
  const slots = recipeSlots(r);
  const items: Partial<Record<Slot, readonly string[]>> =
    r.catalogVersion === 1
      ? LEGACY_ITEMS
      : r.catalogVersion === 2
      ? ITEMS_V2
      : r.catalogVersion === 3
      ? ITEMS_V3
      : ITEMS_V4;
  if (
    Object.keys(r).length !== slots.length + 1 ||
    !slots.every(
      slot => typeof r[slot] === 'string' && items[slot]?.includes(r[slot]!),
    )
  ) {
    return null;
  }
  return Object.fromEntries([
    ['catalogVersion', r.catalogVersion],
    ...slots.map(slot => [slot, r[slot]]),
  ]) as Recipe;
}
export function upgradeRecipe(r: Recipe, version: 2 | 3 | 4 = 2): Recipe {
  const target = Math.max(r.catalogVersion, version);
  return {
    ...(target >= 3 ? V3_DEFAULTS : V2_DEFAULTS),
    ...r,
    catalogVersion: target,
    ...(target === 4 && r.outfit === 'outfit-hoodie'
      ? { outfit: 'outfit-tee' }
      : {}),
  };
}
/** Keep the old visible keys, including across v1/v2, when the pixels are unchanged. */
export function visibleKey(r: Recipe): string {
  const hairVisible = r.hat === 'hat-none' && r.hair !== 'hair-none';
  const legacy = LEGACY_SLOTS.filter(s => s !== 'backdrop')
    .map(s => (s === 'hair' && !hairVisible ? 'hair-none' : r[s]))
    .join('|');
  const face = r.face ?? V2_DEFAULTS.face;
  const accessory = r.accessory ?? V2_DEFAULTS.accessory;
  const color = hairVisible
    ? r.hairColor ?? V2_DEFAULTS.hairColor
    : V2_DEFAULTS.hairColor;
  const key =
    face === V2_DEFAULTS.face &&
    accessory === V2_DEFAULTS.accessory &&
    color === V2_DEFAULTS.hairColor
      ? legacy
      : `${legacy}|${face}|${color}|${accessory}`;
  return r.catalogVersion >= 3 && r.neckwear !== V3_DEFAULTS.neckwear
    ? `${key}|${r.neckwear}`
    : key;
}
export const ANCHORS = {
  pixie: { scale: 0.8, y: -0.12 },
  braids: { scale: 0.8, y: 0.02 },
  beret: { scale: 0.59, y: -0.17 },
  bucket: { scale: 0.58, y: -0.232 },
  rectangular: { scale: 0.7, y: -0.014 },
  denim: { scale: 1, y: 0 },
  mariniere: { scale: 1.1, y: -0.028 },
  bowtie: { scale: 0.55, y: 0.14 },
  base: { scale: 1, y: 0 },
  hair: { scale: 0.72, y: -0.088 },
  glasses: { scale: 0.7, y: -0.014 },
  cap: { scale: 0.77, y: -0.104 },
  jacket: { scale: 1, y: 0 },
  beard: { scale: 1, y: -0.02 },
  feminine: { scale: 1, y: 0 },
  quiffTint: { scale: 0.6, y: -0.12 },
  bob: { scale: 0.85, y: -0.075 },
  curls: { scale: 0.72, y: -0.09 },
  hoodie: { scale: 1, y: 0.075 },
  headphones: { scale: 0.82, y: -0.045 },
  y2k: { scale: 0.44, y: -0.012 },
  umber: { scale: 1, y: 0 },
  rose: { scale: 1, y: 0 },
  beanie: { scale: 0.63, y: -0.17 },
  aviators: { scale: 0.54, y: -0.018 },
  scarf: { scale: 0.31, y: 0.31 },
  varsity: { scale: 1, y: 0.13 },
};
export type ArtKey = keyof typeof ANCHORS;
export const ASSET_FILES: Record<ArtKey, string> = {
  pixie: 'v4/pixie.png',
  braids: 'v4/braids.png',
  beret: 'v4/beret.png',
  bucket: 'v4/bucket.png',
  rectangular: 'v4/rectangular.png',
  denim: 'v4/denim.png',
  mariniere: 'v4/mariniere.png',
  bowtie: 'v4/bowtie.png',

  base: 'base.png',
  hair: 'hair.png',
  glasses: 'glasses.png',
  cap: 'cap.png',
  jacket: 'jacket.png',
  beard: 'beard.png',
  feminine: 'v2/feminine.png',
  quiffTint: 'v2/quiff-tint.png',
  bob: 'v2/bob.png',
  curls: 'v2/curls.png',
  hoodie: 'v2/hoodie.png',
  headphones: 'v2/headphones.png',
  y2k: 'v2/y2k.png',
  umber: 'v3/face-umber.png',
  rose: 'v3/face-rose.png',
  beanie: 'v3/beanie.png',
  aviators: 'v3/aviators.png',
  scarf: 'v3/scarf.png',
  varsity: 'v3/varsity.png',
};
export interface RenderLayer {
  art: ArtKey;
  tint?: string;
  opacity?: number;
}
/** Native source-in tint + translucent original shading. No blend-mode dependency. */
export function renderLayers(r: Recipe): RenderLayer[] {
  const v2 = r.catalogVersion >= 2;
  const v3 = r.catalogVersion >= 3;
  const v4 = r.catalogVersion === 4;
  const layers: RenderLayer[] = [
    {
      art:
        v3 && r.face === 'face-umber'
          ? 'umber'
          : v3 && r.face === 'face-rose'
          ? 'rose'
          : v2 && r.face === 'face-feminine'
          ? 'feminine'
          : 'base',
    },
  ];
  if (r.outfit === 'outfit-jacket') {
    layers.push({ art: 'jacket' });
  }
  if (v2 && r.outfit === 'outfit-hoodie') {
    layers.push({ art: 'hoodie' });
  }
  if (v3 && r.outfit === 'outfit-varsity') {
    layers.push({ art: 'varsity' });
  }
  if (v4 && r.outfit === 'outfit-denim') layers.push({ art: 'denim' });
  if (v4 && r.outfit === 'outfit-mariniere') layers.push({ art: 'mariniere' });
  if (v4 && r.neckwear === 'neckwear-bowtie') layers.push({ art: 'bowtie' });
  if (v3 && r.neckwear === 'neckwear-scarf') {
    layers.push({ art: 'scarf' });
  }
  if (r.hat === 'hat-none' && r.hair !== 'hair-none') {
    if (
      !v2 ||
      (r.hair === 'hair-quiff' && r.hairColor === 'hairColor-original')
    ) {
      layers.push({ art: 'hair' });
    } else {
      const art: ArtKey =
        v4 && r.hair === 'hair-pixie'
          ? 'pixie'
          : v4 && r.hair === 'hair-braids'
          ? 'braids'
          : r.hair === 'hair-bob'
          ? 'bob'
          : r.hair === 'hair-curls'
          ? 'curls'
          : r.hair === 'hair-swoop'
          ? 'quiffTint'
          : 'hair';
      layers.push(
        { art, tint: HAIR_COLORS[r.hairColor!] },
        { art, opacity: 0.35 },
      );
    }
  }
  if (r.beard === 'beard-goatee') {
    layers.push({ art: 'beard' });
  }
  if (r.glasses === 'glasses-round') {
    layers.push({ art: 'glasses' });
  }
  if (v2 && r.glasses === 'glasses-y2k') {
    layers.push({ art: 'y2k' });
  }
  if (v3 && r.glasses === 'glasses-aviators') {
    layers.push({ art: 'aviators' });
  }
  if (v4 && r.glasses === 'glasses-rectangular')
    layers.push({ art: 'rectangular' });
  if (v4 && r.hat === 'hat-beret') layers.push({ art: 'beret' });
  if (v4 && r.hat === 'hat-bucket') layers.push({ art: 'bucket' });
  if (v3 && r.hat === 'hat-beanie') {
    layers.push({ art: 'beanie' });
  }
  if (r.hat === 'hat-cap') {
    layers.push({ art: 'cap' });
  }
  if (v2 && r.accessory === 'accessory-headphones') {
    layers.push({ art: 'headphones' });
  }
  return layers;
}
