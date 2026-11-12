// Komşuluk bonusları: bir binanın yerine göre üretimi ya da (evde) mutluluğu artar.
// Kurallar BUILDINGS[t].komsuluk içindedir. Bonus saklanmaz, her seferinde konumdan hesaplanır;
// böylece kaynak bina yıkılınca ya da yeni kurulunca bonus kendiliğinden güncellenir.
import { BUILDINGS } from '../data/buildings';
import type { BuildingType, GameState, KomsulukDef, KomsulukDurum } from './types';
import { dist } from './geometry';
import { heightAt, lakeDistance } from './terrain';

export interface AdjacencyResult {
  /** Binanın bütün kuralları, şartı tutsun tutmasın. */
  durumlar: KomsulukDurum[];
  /** Aktif üretim bonuslarının toplamı (0.25 = +%25). */
  oran: number;
  /** Aktif mutluluk bonuslarının toplamı (ev). */
  mutluluk: number;
}

function sartTutuyor(s: GameState, t: BuildingType, k: KomsulukDef, x: number, z: number, haricId?: number): boolean {
  if (k.kaynak === 'gol') {
    const pay = k.kenardan ? BUILDINGS[t].taban : 0;
    return lakeDistance(x, z) - pay <= (k.mesafe ?? 0);
  }
  if (k.kaynak === 'tepe') return heightAt(x, z) >= (k.yukseklik ?? Infinity);
  const r = k.mesafe ?? 0;
  return s.binalar.some((b) => b.type === k.kaynak && b.id !== haricId && dist(b.x, b.z, x, z) <= r);
}

/**
 * `t` türünde bir binanın (x, z) konumundaki komşuluk bonusları.
 * `haricId`: binanın kendisi (yerleşik bir bina için hesaplanırken kendini kaynak saymasın).
 */
export function adjacencyBonus(s: GameState, t: BuildingType, x: number, z: number, haricId?: number): AdjacencyResult {
  const sonuc: AdjacencyResult = { durumlar: [], oran: 0, mutluluk: 0 };
  for (const k of BUILDINGS[t].komsuluk ?? []) {
    const aktif = sartTutuyor(s, t, k, x, z, haricId);
    const oran = k.oran ?? 0;
    const mutluluk = k.mutluluk ?? 0;
    sonuc.durumlar.push({ etiket: k.etiket, sart: k.sart, aktif, oran, mutluluk });
    if (aktif) {
      sonuc.oran += oran;
      sonuc.mutluluk += mutluluk;
    }
  }
  return sonuc;
}

/** Bir kuralın kısa bonus metni: "+%25 sulama" ya da "+3 mutluluk (göl manzarası)". */
export function bonusText(d: KomsulukDurum): string {
  const parca: string[] = [];
  if (d.oran) parca.push(`+%${Math.round(d.oran * 100)} ${d.etiket}`);
  if (d.mutluluk) parca.push(`+${d.mutluluk} mutluluk (${d.etiket})`);
  return parca.join(', ');
}
