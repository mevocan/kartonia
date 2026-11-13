// Harita iğneleri: oyuncunun panel açmadan görmesi gereken sorunlar.
import type { BinaIgnesi, DayReport, GameState } from './types';
import { hizmetIndeksi, hizmetVar, houseLevel, workerRatio } from './economy';

/** Son gün sonunun iğnelerle ilgili kısmı (yeni oyunda ve kayıt yüklenince yok). */
export type SonGun = Pick<DayReport, 'uretimSorunlari' | 'evStokEksikleri'>;

/**
 * Ev iğnesi: mevcut seviyenin karşılanmayan ilk ihtiyacı.
 *   - Yer şartı (su, okul, sağlık, pazar, hamam, kültür; yemekte satış yerine yakınlık) anlıktır: bina konunca ya da
 *     yıkılınca iğne hemen değişir.
 *   - Stok yeterliliği (yemek, odun, mobilya, kumaş, bal) son gün sonundaki gerçek dağıtımdan gelir. Gün içinde
 *     stoğa bakmak yanıltır: o günün tüketimi düşülmüş, yarının üretimi henüz eklenmemiştir; ortak stok da evler
 *     arasında id sırasıyla paylaşılır.
 * Üretim iğnesi son gün sonunun üretim sorunlarından gelir. O günden beri yıkılan binalar atlanır.
 */
export function buildingPins(s: GameState, son: SonGun | null = null): BinaIgnesi[] {
  const out: BinaIgnesi[] = [];
  const ix = hizmetIndeksi(s);
  const stokEksik = new Map(son?.evStokEksikleri.map((e) => [e.id, e.neden]) ?? []);
  for (const b of s.binalar) {
    if (b.type !== 'ev') continue;
    const cur = houseLevel(b.seviye).ihtiyaclar;
    if (!cur.length) continue;
    let eksik = cur.find((n) => !hizmetVar(ix, b, n));
    if (!eksik) {
      const n = stokEksik.get(b.id);
      if (n && cur.includes(n)) eksik = n; // ev o günden beri küçüldüyse ihtiyaç artık olmayabilir
    }
    if (eksik) out.push({ id: b.id, tur: 'ihtiyac', neden: eksik });
  }
  const var_ = new Set(s.binalar.map((b) => b.id));
  for (const p of son?.uretimSorunlari ?? []) if (var_.has(p.id)) out.push({ id: p.id, tur: 'uretim', neden: p.neden });
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
