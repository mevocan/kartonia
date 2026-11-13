// Harita iğneleri: oyuncunun panel açmadan görmesi gereken sorunlar.
import type { BinaIgnesi, GameState, UretimSorunu } from './types';
import { evaluateNeeds, hizmetIndeksi, houseLevel, workerRatio } from './economy';

/**
 * Evler anlık değerlendirilir: mevcut seviyenin karşılanmayan ilk ihtiyacı (ihtiyaç sırası `HOUSE_LEVELS`).
 * Üretim binaları son gün sonunun sorunlarından gelir (gün içinde stok, aynı gün üretilecek girdiyi henüz
 * içermediği için anlık bakmak yanıltır). O günden beri yıkılan binalar atlanır.
 */
export function buildingPins(s: GameState, uretimSorunlari: readonly UretimSorunu[] = []): BinaIgnesi[] {
  const out: BinaIgnesi[] = [];
  const ix = hizmetIndeksi(s);
  for (const b of s.binalar) {
    if (b.type !== 'ev') continue;
    const cur = houseLevel(b.seviye).ihtiyaclar;
    if (!cur.length) continue;
    const st = evaluateNeeds(s, b, undefined, ix);
    const eksik = cur.find((n) => !st.some((x) => x.ihtiyac === n && x.karsilandi));
    if (eksik) out.push({ id: b.id, tur: 'ihtiyac', neden: eksik });
  }
  const var_ = new Set(s.binalar.map((b) => b.id));
  for (const p of uretimSorunlari) if (var_.has(p.id)) out.push({ id: p.id, tur: 'uretim', neden: p.neden });
  return out;
}

/**
 * Kasaba geneli uyarılar (sol panel). Sıra önem sırasıdır.
 *   borc:    kasa borç sınırının altında; `gun` üst üste kaçıncı gün.
 *   kuculen: son gün sonunda mevcut seviyesinin ihtiyacı karşılanmayan evler (bir gün daha sürerse küçülür).
 *   isci:    işçi yetmiyor; `oran` bütün üretimin çalıştığı oran (0..1).
 */
export type KasabaUyarisi =
  | { tur: 'borc'; gun: number }
  | { tur: 'kuculen'; evler: number[] }
  | { tur: 'isci'; oran: number };

export function townAlerts(s: GameState): KasabaUyarisi[] {
  const out: KasabaUyarisi[] = [];
  if (s.borcGunu > 0) out.push({ tur: 'borc', gun: s.borcGunu });
  const evler = s.binalar.filter((b) => b.type === 'ev' && b.kotuGun > 0).map((b) => b.id);
  if (evler.length) out.push({ tur: 'kuculen', evler });
  const oran = workerRatio(s);
  if (oran < 1) out.push({ tur: 'isci', oran });
  return out;
}
