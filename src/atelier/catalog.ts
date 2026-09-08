import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { canonicalRecipe, Recipe } from './catalogContract';
export type { Recipe } from './catalogContract';
export { ITEMS_V2, HAIR_COLORS, visibleKey } from './catalogContract';
export const SLOTS = [
  'hair',
  'glasses',
  'hat',
  'beard',
  'outfit',
  'backdrop',
] as const;
export type Slot = typeof SLOTS[number];
export const ITEMS = {
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
export const COLORS = {
  'backdrop-ice': '#DFEDFA',
  'backdrop-lilac': '#E8E1FA',
  'backdrop-peach': '#FFE3D1',
  'backdrop-mint': '#D8F2E6',
  'backdrop-gold': '#F5DC9B',
};
export function fail(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}
export function recipe(value: unknown): Recipe {
  const result = canonicalRecipe(value);
  if (!result) fail('INVALID_RECIPE', 'Version ou équipement inconnu.');
  return result;
}
import { visibleKey } from './catalogContract';
export function portraitHash(r: Recipe): string {
  return hash([`renderer-${r.catalogVersion}`, r]);
}
export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function cleanName(value: string): string {
  if (typeof value !== 'string') fail('INVALID_NAME', 'Nom invalide.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 32)
    fail('INVALID_NAME', 'Choisis un nom de 2 à 32 caractères.');
  return name;
}
export function assertDistinct(recipes: Recipe[], minimum: number) {
  if (recipes.length < minimum || recipes.length > 21)
    fail('DECK_SIZE', `De ${minimum} à 21 personnages sont requis.`);
  if (new Set(recipes.map(visibleKey)).size !== recipes.length)
    fail('DUPLICATE_SUSPECT', 'Deux suspects sont identiques.');
}
