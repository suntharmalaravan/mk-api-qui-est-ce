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
export const RECIPE_SLOTS = [...LEGACY_SLOTS, ...EXTRA_SLOTS] as const;
export type Slot = (typeof RECIPE_SLOTS)[number];
export type Recipe = Record<(typeof LEGACY_SLOTS)[number], string> &
  Partial<Record<(typeof EXTRA_SLOTS)[number], string>> & {
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
export const ITEMS_V2: Record<Slot, readonly string[]> = {
  ...LEGACY_ITEMS,
  hair: [...LEGACY_ITEMS.hair, 'hair-bob', 'hair-curls'],
  glasses: [...LEGACY_ITEMS.glasses, 'glasses-y2k'],
  outfit: [...LEGACY_ITEMS.outfit, 'outfit-hoodie'],
  face: ['face-original', 'face-feminine'],
  hairColor: Object.keys(HAIR_COLORS),
  accessory: ['accessory-none', 'accessory-headphones'],
};
export function recipeSlots(r: Recipe): readonly Slot[] {
  return r.catalogVersion === 1 ? LEGACY_SLOTS : RECIPE_SLOTS;
}
export function canonicalRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const r = value as Recipe;
  if (r.catalogVersion !== 1 && r.catalogVersion !== 2) {
    return null;
  }
  const slots = recipeSlots(r);
  const items: Partial<Record<Slot, readonly string[]>> =
    r.catalogVersion === 1 ? LEGACY_ITEMS : ITEMS_V2;
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
export function upgradeRecipe(r: Recipe): Recipe {
  return { ...V2_DEFAULTS, ...r, catalogVersion: 2 };
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
  return face === V2_DEFAULTS.face &&
    accessory === V2_DEFAULTS.accessory &&
    color === V2_DEFAULTS.hairColor
    ? legacy
    : `${legacy}|${face}|${color}|${accessory}`;
}
export const ANCHORS = {
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
  headphones: { scale: 0.64, y: -0.04 },
  y2k: { scale: 0.44, y: -0.012 },
};
export type ArtKey = keyof typeof ANCHORS;
export const ASSET_FILES: Record<ArtKey, string> = {
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
};
export interface RenderLayer {
  art: ArtKey;
  tint?: string;
  opacity?: number;
}
/** Native source-in tint + translucent original shading. No blend-mode dependency. */
export function renderLayers(r: Recipe): RenderLayer[] {
  const v2 = r.catalogVersion === 2;
  const layers: RenderLayer[] = [
    { art: v2 && r.face === 'face-feminine' ? 'feminine' : 'base' },
  ];
  if (r.outfit === 'outfit-jacket') {
    layers.push({ art: 'jacket' });
  }
  if (v2 && r.outfit === 'outfit-hoodie') {
    layers.push({ art: 'hoodie' });
  }
  if (r.hat === 'hat-none' && r.hair !== 'hair-none') {
    if (
      !v2 ||
      (r.hair === 'hair-quiff' && r.hairColor === 'hairColor-original')
    ) {
      layers.push({ art: 'hair' });
    } else {
      const art: ArtKey =
        r.hair === 'hair-bob'
          ? 'bob'
          : r.hair === 'hair-curls'
          ? 'curls'
          : 'quiffTint';
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
  if (r.hat === 'hat-cap') {
    layers.push({ art: 'cap' });
  }
  if (v2 && r.accessory === 'accessory-headphones') {
    layers.push({ art: 'headphones' });
  }
  return layers;
}
