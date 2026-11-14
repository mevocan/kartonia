// Arayüzün ortak simgeleri: mallar, ihtiyaçlar ve harita iğnesi nedenleri.
import type { BinaIgnesi, Good, Need } from '../logic/types';

export const MAL_IKON: Record<Good, string> = {
  bugday: '🌾', un: '🥣', yemek: '🍽️', odun: '🪵', tas: '🪨', mobilya: '🪑', yun: '🧶', kumas: '🧵', bal: '🍯',
};

export const IHTIYAC_IKON: Record<Need, string> = {
  su: '💧', yemek: '🍽️', odun: '🪵', pazar: '🧺', okul: '📚', mobilya: '🪑', saglik: '⚕️', kumas: '🧵', bal: '🍯',
  hamam: '♨️', kultur: '🎭',
};

/** İğnenin simgesi ve rengi: ev ihtiyacı ve mutsuz ev uyarı, üretim sorunu bilgi rengindedir. */
export function igneGorunumu(p: BinaIgnesi): { ikon: string; tur: 'uyari' | 'bilgi' } {
  if (p.tur === 'ihtiyac') return { ikon: IHTIYAC_IKON[p.neden], tur: 'uyari' };
  if (p.tur === 'mutsuz') return { ikon: '😟', tur: 'uyari' };
  if (p.neden === 'depo') return { ikon: '📦', tur: 'bilgi' };
  if (p.neden === 'agac') return { ikon: '🌳', tur: 'bilgi' };
  return { ikon: MAL_IKON[p.neden], tur: 'bilgi' };
}
