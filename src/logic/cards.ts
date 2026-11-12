// Karar kartları mantığı: değer okuma (ayar), kart çekme, seçim.
// Ekonomi kartların etkilediği değerleri doğrudan BALANCE / BUILDINGS'ten değil ayar() ile okur.
import { BALANCE, BUILDINGS } from '../data/buildings';
import { KART_SECENEK, KARTLAR, type AyarAnahtari, type KararKarti } from '../data/cards';
import { makeRng } from '../data/map';
import type { BuildingType, GameState, Good } from './types';

/** Kartsız (taban) değer. */
export function tabanDeger(a: AyarAnahtari): number {
  const [tur, t, g] = a.split('.') as [string, BuildingType | undefined, Good | undefined];
  switch (tur) {
    case 'uretim': return BUILDINGS[t!].uretim?.cikti[g!] ?? 0;
    case 'mutluluk': return BUILDINGS[t!].mutluluk;
    case 'gider': return BUILDINGS[t!].gider;
    case 'depo': return BUILDINGS[t!].depo ?? 0;
    case 'odunKisiBasi': return BALANCE.odunKisiBasi;
    case 'evMutluluk': return 0;
    case 'vergiCarpani': return 1;
    case 'seviyeAtlamaGun': return BALANCE.seviyeGunEsigi;
    case 'yukseltmeTasCarpani': return 1;
    case 'agacMutlulukSinir': return BALANCE.agacMutlulukSinir;
    case 'oduncuCarpani': return 1;
    case 'ticaretKota': return BALANCE.ticaret.kota;
  }
  throw new Error(`Bilinmeyen ayar: ${a}`);
}

const KART_BY_ID = new Map(KARTLAR.map((k) => [k.id, k]));

export function kartBul(id: string): KararKarti | undefined {
  return KART_BY_ID.get(id);
}

/** Taban değer + seçilmiş kartların etkileri (seçim sırasıyla). */
export function ayar(s: GameState, a: AyarAnahtari): number {
  let v = tabanDeger(a);
  for (const id of s.kararlar ?? []) {
    const k = KART_BY_ID.get(id);
    if (!k) continue;
    for (const e of k.etkiler) {
      if (e.anahtar !== a) continue;
      v = e.islem === 'ekle' ? v + e.deger : v * e.deger;
    }
  }
  return v;
}

/**
 * `hedef` numaralı hedef için gösterilecek üç kart: tohum ve hedeften deterministik,
 * daha önce seçilmiş kartlar hariç.
 */
export function kartCek(s: GameState, hedef: number): KararKarti[] {
  const secilen = new Set(s.kararlar ?? []);
  const havuz = KARTLAR.filter((k) => !secilen.has(k.id));
  const rng = makeRng(((s.haritaTohum ?? 0) ^ Math.imul(hedef + 1, 0x85ebca6b)) >>> 0);
  // Fisher–Yates, sonra ilk üçü.
  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [havuz[i], havuz[j]] = [havuz[j], havuz[i]];
  }
  return havuz.slice(0, KART_SECENEK);
}

/** Seçim bekleyen ilk hedef (yoksa null). */
export function bekleyenSecim(s: GameState): number | null {
  return s.bekleyenKararlar?.[0] ?? null;
}

/** Bekleyen ilk seçimde kartı seç. Kart gösterilenlerden değilse false. */
export function kartSec(s: GameState, id: string): boolean {
  const hedef = bekleyenSecim(s);
  if (hedef === null) return false;
  if (!kartCek(s, hedef).some((k) => k.id === id)) return false;
  s.kararlar = [...(s.kararlar ?? []), id];
  s.bekleyenKararlar = s.bekleyenKararlar!.slice(1);
  if (s.bekleyenKararlar.length === 0) delete s.bekleyenKararlar;
  return true;
}
