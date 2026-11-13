// Harita iğneleri: oyuncunun panel açmadan görmesi gereken sorunlar.
import type { BinaIgnesi, GameState, UretimSorunu } from './types';
import { evaluateNeeds, houseLevel } from './economy';

/**
 * Evler anlık değerlendirilir: mevcut seviyenin karşılanmayan ilk ihtiyacı (ihtiyaç sırası `HOUSE_LEVELS`).
 * Üretim binaları son gün sonunun sorunlarından gelir (gün içinde stok, aynı gün üretilecek girdiyi henüz
 * içermediği için anlık bakmak yanıltır). O günden beri yıkılan binalar atlanır.
 */
export function buildingPins(s: GameState, uretimSorunlari: readonly UretimSorunu[] = []): BinaIgnesi[] {
  const out: BinaIgnesi[] = [];
  for (const b of s.binalar) {
    if (b.type !== 'ev') continue;
    const cur = houseLevel(b.seviye).ihtiyaclar;
    if (!cur.length) continue;
    const st = evaluateNeeds(s, b);
    const eksik = cur.find((n) => !st.some((x) => x.ihtiyac === n && x.karsilandi));
    if (eksik) out.push({ id: b.id, tur: 'ihtiyac', neden: eksik });
  }
  const var_ = new Set(s.binalar.map((b) => b.id));
  for (const p of uretimSorunlari) if (var_.has(p.id)) out.push({ id: p.id, tur: 'uretim', neden: p.neden });
  return out;
}
