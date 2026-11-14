// Mahalle karakteri: Meydan binası kurulunca oyuncu bir karakter seçer; Meydan'ın etki alanındaki binalara uygulanır.
//   Çarşı   — evlerin vergisi +%15, ama kalabalık: evlere −2 mutluluk.
//   Bahçeli — evlerde ağaç/çiçek mutluluk tavanı +4; alana üretim binası konamaz.
//   Zanaat  — üretim binaları +%15 çıktı, ama tezgâh gürültüsü: evlere −3 mutluluk.
// İlk seçim bedavadır, sonradan değiştirmek BALANCE.meydan.degisim para. Meydan alanları çakışamaz.
// Bu modül economy / placement'a bağımlı değildir (döngü olmasın).
import { BALANCE, BUILDINGS } from '../data/buildings';
import type { Building, BuildingType, GameState } from './types';
import { dist } from './geometry';

export type Karakter = 'carsi' | 'bahceli' | 'zanaat';
export const KARAKTERLER: Karakter[] = ['carsi', 'bahceli', 'zanaat'];

/** Karakterin sayısal etkileri (BALANCE.meydan.karakter). */
export interface KarakterEtkisi {
  vergi: number;
  mutluluk: number;
  agacSinir: number;
  uretim: number;
}

const BOS: KarakterEtkisi = { vergi: 1, mutluluk: 0, agacSinir: 0, uretim: 1 };

/** Üretim binası mı (çıktısı ya da ağaç başına odunu olan). */
function uretici(t: BuildingType): boolean {
  const d = BUILDINGS[t];
  return d.uretim !== undefined || d.agacBasinaOdun !== undefined;
}

const yaricap = (): number => BUILDINGS.meydan.etki;

/** (x, z) noktasını kapsayan karakteri seçilmiş Meydan (alanlar çakışmadığı için en fazla bir tane). */
export function kapsayanMeydan(s: GameState, x: number, z: number): Building | undefined {
  const r = yaricap();
  return s.binalar.find((b) => b.type === 'meydan' && b.karakter && dist(b.x, b.z, x, z) <= r);
}

/** Noktadaki karakter etkisi (Meydan yoksa etkisiz). */
export function karakterEtkisi(s: GameState, x: number, z: number): KarakterEtkisi {
  const m = kapsayanMeydan(s, x, z);
  return m?.karakter ? BALANCE.meydan.karakter[m.karakter] : BOS;
}

/** Yerleştirme engeli: Meydan alanları çakışamaz; Bahçeli Meydan'ın alanına üretim binası konamaz. */
export function meydanEngeli(s: GameState, t: BuildingType, x: number, z: number): 'meydanCakisiyor' | 'bahceli' | null {
  const r = yaricap();
  if (t === 'meydan' && s.binalar.some((b) => b.type === 'meydan' && dist(b.x, b.z, x, z) < 2 * r)) return 'meydanCakisiyor';
  if (uretici(t)) {
    const m = kapsayanMeydan(s, x, z);
    if (m?.karakter === 'bahceli') return 'bahceli';
  }
  return null;
}

export type KarakterSebep = 'yok' | 'ayni' | 'para' | 'uretimVar' | 'bitti';

/** Karakter seçilebilir/değiştirilebilir mi; bedeli (ilk seçim 0). */
export function karakterDurumu(s: GameState, id: number, k: Karakter): { ok: boolean; bedel: number; sebep?: KarakterSebep } {
  const m = s.binalar.find((b) => b.id === id && b.type === 'meydan');
  const bedel = m?.karakter ? BALANCE.meydan.degisim : 0;
  if (s.bitti) return { ok: false, bedel, sebep: 'bitti' };
  if (!m) return { ok: false, bedel, sebep: 'yok' };
  if (m.karakter === k) return { ok: false, bedel, sebep: 'ayni' };
  if (k === 'bahceli') {
    const r = yaricap();
    if (s.binalar.some((b) => uretici(b.type) && dist(b.x, b.z, m.x, m.z) <= r)) return { ok: false, bedel, sebep: 'uretimVar' };
  }
  if (s.para < bedel) return { ok: false, bedel, sebep: 'para' };
  return { ok: true, bedel };
}

/** Karakteri seçer (bedeli düşer). Olmazsa false. */
export function karakterSec(s: GameState, id: number, k: Karakter): boolean {
  const d = karakterDurumu(s, id, k);
  if (!d.ok) return false;
  const m = s.binalar.find((b) => b.id === id)!;
  s.para -= d.bedel;
  m.karakter = k;
  return true;
}

/** Çizimde Meydan'ın görünümü: 1 seçilmemiş, 2 çarşı, 3 bahçeli, 4 zanaat. Diğer binalarda seviyesi. */
export function gorselSeviye(b: Building): number {
  if (b.type !== 'meydan') return b.seviye;
  return b.karakter ? KARAKTERLER.indexOf(b.karakter) + 2 : 1;
}
