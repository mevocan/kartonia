// Düzlem (X-Z) geometri yardımcıları.
import type { Vec2 } from './types';

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/** İki daire, aralarında en az `bosluk` kalmıyorsa çakışır. */
export function circlesOverlap(
  ax: number, az: number, ar: number,
  bx: number, bz: number, br: number,
  bosluk = 0,
): boolean {
  return dist(ax, az, bx, bz) < ar + br + bosluk;
}

/** Daire örnekleri: merkez + çember üzerinde `n` nokta. */
export function circleSamples(x: number, z: number, r: number, n = 8): Vec2[] {
  const out: Vec2[] = [{ x, z }];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push({ x: x + r * Math.cos(t), z: z + r * Math.sin(t) });
  }
  return out;
}

/** (x,z) noktasına a–b doğru parçası üzerindeki en yakın nokta. */
export function closestOnSegment(x: number, z: number, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  if (l2 === 0) return { x: a.x, z: a.z };
  const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / l2));
  return { x: a.x + dx * t, z: a.z + dz * t };
}

/** Çoklu çizgi üzerindeki en yakın nokta ve mesafesi. Boş çizgide null. */
export function closestOnPolyline(x: number, z: number, pts: Vec2[]): { x: number; z: number; mesafe: number } | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) return { x: pts[0].x, z: pts[0].z, mesafe: dist(x, z, pts[0].x, pts[0].z) };
  let best: { x: number; z: number; mesafe: number } | null = null;
  for (let i = 1; i < pts.length; i++) {
    const p = closestOnSegment(x, z, pts[i - 1], pts[i]);
    const d = dist(x, z, p.x, p.z);
    if (!best || d < best.mesafe) best = { x: p.x, z: p.z, mesafe: d };
  }
  return best;
}

export function polylineLength(pts: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z);
  return l;
}

/** Yay uzunluğu boyunca `step` aralıkla yeniden örnekler. İlk ve son nokta korunur. */
export function resample(pts: Vec2[], step: number): Vec2[] {
  if (pts.length === 0) return [];
  const out: Vec2[] = [{ x: pts[0].x, z: pts[0].z }];
  let carry = 0; // son örnekten bu yana gidilen mesafe
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = dist(a.x, a.z, b.x, b.z);
    if (seg === 0) continue;
    let t = step - carry;
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, z: a.z + ((b.z - a.z) * t) / seg });
      t += step;
    }
    carry = seg - (t - step);
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  const d = dist(prev.x, prev.z, last.x, last.z);
  if (d > 1e-6) {
    // Son örnek uca çok yakınsa onu uca taşı, değilse ucu ekle.
    if (d < step * 0.5 && out.length > 1) out[out.length - 1] = { x: last.x, z: last.z };
    else out.push({ x: last.x, z: last.z });
  }
  return out;
}
