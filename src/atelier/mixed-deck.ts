import { BadRequestException } from '@nestjs/common';

export type MixedCard = { kind: 'photo'; index: number; name: string } | { kind: 'character'; id: string; revision: number };
export interface MixedManifest { operationId: string; cards: MixedCard[] }
export function parseMixedManifest(raw: string, fileCount: number): MixedManifest {
  const invalid = () => { throw new BadRequestException('Composition de deck invalide.'); };
  let input: MixedManifest;
  try { input = JSON.parse(raw); } catch { return invalid(); }
  if (!input || typeof input.operationId !== 'string' || !/^[a-zA-Z0-9:_-]{1,150}$/.test(input.operationId) ||
      !Array.isArray(input.cards) || input.cards.length < 18 || input.cards.length > 21 ||
      Object.keys(input).some(k => !['operationId', 'cards'].includes(k))) return invalid();
  const photos = new Set<number>();
  const characters = new Set<string>();
  for (const card of input.cards) {
    if (!card || typeof card !== 'object') return invalid();
    if (card.kind === 'photo') {
      if (Object.keys(card).some(k => !['kind', 'index', 'name'].includes(k)) || !Number.isSafeInteger(card.index) || card.index < 0 || card.index >= fileCount || photos.has(card.index) ||
          typeof card.name !== 'string' || card.name.trim().length < 2 || card.name.trim().length > 255) return invalid();
      photos.add(card.index);
    } else if (card.kind === 'character') {
      if (Object.keys(card).some(k => !['kind', 'id', 'revision'].includes(k)) || typeof card.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(card.id) || characters.has(card.id) ||
          !Number.isSafeInteger(card.revision) || card.revision < 1 || card.revision > 2147483646) return invalid();
      characters.add(card.id);
    } else return invalid();
  }
  if (photos.size !== fileCount || !characters.size) return invalid();
  return input;
}
/** These URLs are produced by the server uploader, never accepted from a client. */
export interface MixedPhoto { url: string; name: string; hash: string }
