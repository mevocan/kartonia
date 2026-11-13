// Yollar: fırçayla çizilen çoklu çizgiler.
import { BALANCE, BUILDINGS, ROADS, dogaTuru } from '../data/buildings';
import type { Building, GameState, Road, RoadInfo, RoadPlan, RoadType, Vec2 } from './types';
import { closestOnPolyline, polylineLength, resample } from './geometry';
import { isLake, isLand } from './terrain';

const MAX_TABAN = Math.max(...Object.values(BUILDINGS).map((d) => d.taban));

export function isRoadUnlocked(s: GameState, tur: RoadType): boolean {
  return s.nufus >= ROADS[tur].acilmaNufus;
}

export function roadLength(r: Road): number {
  return polylineLength(r.noktalar);
}

export function roadCost(tur: RoadType, uzunluk: number): number {
  return Math.ceil(uzunluk * ROADS[tur].birimMaliyet);
}

export function roadUpkeep(r: Road): number {
  return Math.floor(roadLength(r) * ROADS[r.tur].birimGider);
}

export function roadRefund(r: Road): number {
  return Math.floor(roadCost(r.tur, roadLength(r)) * BALANCE.yikimIadeOrani);
}

/** Bina kenarı ile yol kenarı arasındaki boşluk (eksi: üst üste). */
export function roadEdgeGap(r: Road, x: number, z: number, taban: number): number {
  const p = closestOnPolyline(x, z, r.noktalar);
  if (!p) return Infinity;
  return p.mesafe - taban - ROADS[r.tur].genislik / 2;
}

/** Bina bu yolun kenarında mı (yolYakinlik içinde). */
export function isNearRoad(r: Road, b: Building): boolean {
  return roadEdgeGap(r, b.x, b.z, BUILDINGS[b.type].taban) <= BALANCE.yolYakinlik;
}

export function nearestRoad(
  s: GameState, x: number, z: number,
): { id: number; tur: RoadType; x: number; z: number; mesafe: number } | null {
  let best: { id: number; tur: RoadType; x: number; z: number; mesafe: number } | null = null;
  for (const r of s.yollar) {
    const p = closestOnPolyline(x, z, r.noktalar);
    if (p && (!best || p.mesafe < best.mesafe)) best = { id: r.id, tur: r.tur, x: p.x, z: p.z, mesafe: p.mesafe };
  }
  return best;
}

/** Fırça noktalarını örnekler, uçları kenetler ve doğrular. Başarısız planda da noktalar/uzunluk/maliyet doludur. */
export function planRoad(s: GameState, tur: RoadType, ham: Vec2[]): RoadPlan {
  const noktalar = resample(ham, BALANCE.yolOrnekAraligi);
  let kenet = 0;
  if (noktalar.length > 0) {
    const uclar = noktalar.length > 1 ? [0, noktalar.length - 1] : [0];
    for (const i of uclar) {
      const n = nearestRoad(s, noktalar[i].x, noktalar[i].z);
      if (n && n.mesafe <= BALANCE.yolKenetlenme) {
        noktalar[i] = { x: n.x, z: n.z };
        kenet++;
      }
    }
  }
  const uzunluk = polylineLength(noktalar);
  const maliyet = roadCost(tur, uzunluk);
  const plan = (sebep?: RoadPlan['sebep']): RoadPlan =>
    sebep ? { ok: false, sebep, noktalar, uzunluk, maliyet } : { ok: true, noktalar, uzunluk, maliyet };

  if (s.bitti) return plan('bitti');
  if (!isRoadUnlocked(s, tur)) return plan('kilitli');
  if (uzunluk < BALANCE.yolMinUzunluk) return plan('kisa');
  if (noktalar.some((p) => !isLand(p.x, p.z))) return plan('disarida');
  if (noktalar.some((p) => isLake(p.x, p.z))) return plan('gol');
  const yari = ROADS[tur].genislik / 2;
  // Kaba sınır kutusu: çizginin kutusundan (en büyük taban + yarı genişlik) uzaktaki binalar atlanır.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of noktalar) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const pay = MAX_TABAN + yari;
  for (const b of s.binalar) {
    if (b.x < minX - pay || b.x > maxX + pay || b.z < minZ - pay || b.z > maxZ + pay) continue;
    // Segment bazlı: örnekler arasındaki küçük binalar da yakalanır.
    const p = closestOnPolyline(b.x, b.z, noktalar);
    if (p && p.mesafe < BUILDINGS[b.type].taban + yari) return plan('cakisiyor');
  }
  // Karar: hiç yol kalmadıysa (hepsi yıkıldıysa) kenetlenme şartı aranmaz.
  if (kenet === 0 && s.yollar.length > 0) return plan('baglantisiz');
  if (s.para < maliyet) return plan('para');
  return plan();
}

export function placeRoad(s: GameState, tur: RoadType, ham: Vec2[]): Road | null {
  const p = planRoad(s, tur, ham);
  if (!p.ok) return null;
  s.para -= p.maliyet;
  const r: Road = { id: s.sonrakiId++, tur, noktalar: p.noktalar };
  s.yollar.push(r);
  return r;
}

/** Ağaç dışında bir bina yol yakınlığını yalnızca bu yoldan alıyorsa false. */
export function isRoadRemovable(s: GameState, r: Road): boolean {
  for (const b of s.binalar) {
    if (dogaTuru(b.type) || !isNearRoad(r, b)) continue;
    if (!s.yollar.some((o) => o.id !== r.id && isNearRoad(o, b))) return false;
  }
  return true;
}

export function demolishRoad(s: GameState, id: number): number | null {
  if (s.bitti) return null;
  const i = s.yollar.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const r = s.yollar[i];
  if (!isRoadRemovable(s, r)) return null;
  const iade = roadRefund(r);
  s.yollar.splice(i, 1);
  s.para += iade;
  for (const b of s.binalar) {
    if (b.baglanti && b.baglanti.yol === id) {
      const n = nearestRoad(s, b.x, b.z);
      b.baglanti = n ? { x: n.x, z: n.z, yol: n.id } : null;
    }
  }
  return iade;
}

export function getRoadInfo(s: GameState, id: number): RoadInfo | null {
  const r = s.yollar.find((x) => x.id === id);
  if (!r) return null;
  return {
    id: r.id,
    tur: r.tur,
    uzunluk: roadLength(r),
    gider: roadUpkeep(r),
    yikimIadesi: roadRefund(r),
    silinebilir: isRoadRemovable(s, r),
  };
}

/** Evin yakınındaki en iyi (en yüksek mutluluklu) yol. */
export function bestRoadNear(s: GameState, b: Building): Road | null {
  let best: Road | null = null;
  for (const r of s.yollar) {
    if (!isNearRoad(r, b)) continue;
    if (!best || ROADS[r.tur].mutluluk > ROADS[best.tur].mutluluk) best = r;
  }
  return best;
}
