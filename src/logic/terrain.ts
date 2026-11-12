// Arazi sorguları. Saf fonksiyonlar; mantık ve çizim katmanı ortak kullanır.
import { ADA_KENAR, HARITA, type Vec2 } from '../data/map';
import { closestOnPolyline } from './geometry';

export function pointInPolygon(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function isLand(x: number, z: number): boolean {
  return pointInPolygon(x, z, ADA_KENAR);
}

export function isLake(x: number, z: number): boolean {
  return HARITA.golKenarlari.some((g) => pointInPolygon(x, z, g));
}


/** Göl çukuru derinliği (göl yatağı bu kadar aşağıda). */
export const GOL_DERINLIK = 0.45;
/** Su yüzeyi yüksekliği. */
export const SU_SEVIYESI = -0.15;

/** Arazi yüksekliği (her yerde tanımlı; sınır dışı da çizilir). Tepeler Gauss toplamı; göl içinde ve kıyısında yumuşak çukur. */
export function heightAt(x: number, z: number): number {
  let h = 0;
  for (const t of HARITA.tumTepeler) {
    const dx = x - t.x;
    const dz = z - t.z;
    h += t.h * Math.exp(-(dx * dx + dz * dz) / (t.r * t.r));
  }
  for (const g of HARITA.goller) {
    const d = Math.hypot(x - g.x, z - g.z);
    // Göl merkezinden kenarın biraz ötesine kadar yumuşak çukur.
    const k = smoothstep(g.r + 1.2, g.r * 0.6, d);
    h -= (h + GOL_DERINLIK) * k;
  }
  return h;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Noktanın en yakın göle uzaklığı (göl içindeyse 0). Göl kenar çokgenleri üzerinde en yakın nokta;
 * balıkçının kıyı şartı ve komşuluk bonusları bunu kullanır.
 */
export function lakeDistance(x: number, z: number): number {
  if (isLake(x, z)) return 0;
  let best = Infinity;
  for (const g of HARITA.golKenarlari) {
    if (g.length === 0) continue;
    const p = closestOnPolyline(x, z, [...g, g[0]]);
    if (p && p.mesafe < best) best = p.mesafe;
  }
  return best;
}
