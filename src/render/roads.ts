import * as THREE from 'three';
import type { RoadType, Vec2 } from '../logic/types';
import { ROADS } from '../data/buildings';
import { heightAt } from '../logic/terrain';
import { PALETTE } from './palette';

// Yol şeridi: arazi yüksekliğini izleyen kağıt şerit. Katmanlar segment segment sıralanır,
// böylece drawRange ile baştan sona "açılarak" serilebilir.

export interface RoadGeo {
  geo: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
  /** i. segment bittiğinde üçgen tepe sayısı / çizgi tepe sayısı (drawRange için). */
  triEnd: number[];
  lineEnd: number[];
  /** Merkez hattı (toz için) ve toplam uzunluk. */
  path: THREE.Vector3[];
  length: number;
}

interface Layer {
  /** Normal yönünde merkez kayması. */
  off: number;
  /** Sol / sağ yarı genişlik (s: yay uzunluğu). */
  left: (s: number) => number;
  right: (s: number) => number;
  y: number;
  color: THREE.Color;
  cap: boolean;
}

const MAX_SEG = 0.4;

function resample(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (out.length && Math.hypot(p.x - out[out.length - 1].x, p.z - out[out.length - 1].z) < 1e-3) continue;
    if (out.length) {
      const a = out[out.length - 1];
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      const n = Math.ceil(d / MAX_SEG);
      for (let k = 1; k < n; k++) out.push({ x: a.x + ((p.x - a.x) * k) / n, z: a.z + ((p.z - a.z) * k) / n });
    }
    out.push({ x: p.x, z: p.z });
  }
  return out;
}

/** patika: binanın kapısından yola giden dar kağıt şerit (yolların altında kalır). */
export function buildRoad(tur: RoadType | 'patika', noktalar: Vec2[], id: number, lift = 0): RoadGeo | null {
  const P = resample(noktalar);
  if (P.length < 2) return null;
  const n = P.length;
  const w = tur === 'patika' ? 0.5 : ROADS[tur].genislik;
  // Asfalt her zaman toprağın üstünde; aynı türde id'ye göre katman kaydırması (kesişimde z-fighting olmasın).
  const base = tur === 'patika' ? 0.022 + lift : tur === 'asfalt' ? 0.065 + (Math.abs(id) % 3) * 0.014 + lift : 0.035 + (Math.abs(id) % 3) * 0.008 + lift;

  // Yay uzunluğu, normaller, miter ölçeği
  const s: number[] = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const nx: number[] = [];
  const nz: number[] = [];
  const mit: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const L = Math.hypot(tx, tz) || 1;
    tx /= L;
    tz /= L;
    nx.push(-tz);
    nz.push(tx);
    // Miter: önceki segment normaline göre
    const j = Math.max(1, i);
    const sx = P[j].x - P[j - 1].x;
    const sz = P[j].z - P[j - 1].z;
    const sl = Math.hypot(sx, sz) || 1;
    const dot = (-tz * -sz + tx * sx) / sl;
    mit.push(1 / Math.max(0.6, dot));
  }

  const col = (c: string) => new THREE.Color(c);
  const seed = id * 1.618;
  const layers: Layer[] = [];
  const dashes: { a: number; b: number; color: THREE.Color; y: number; hw: number }[] = [];
  if (tur === 'patika') {
    layers.push({
      off: 0,
      left: (u) => (w / 2) * (1 + 0.1 * Math.sin(u * 4.1 + seed)),
      right: (u) => (w / 2) * (1 + 0.1 * Math.sin(u * 3.7 + seed * 1.3)),
      y: 0,
      color: col(PALETTE.patika),
      cap: true,
    });
  } else if (tur === 'toprak') {
    layers.push({
      off: 0,
      left: (u) => (w / 2) * (1 + 0.07 * Math.sin(u * 2.3 + seed) + 0.035 * Math.sin(u * 6.1 + seed * 2)),
      right: (u) => (w / 2) * (1 + 0.07 * Math.sin(u * 2.9 + seed * 1.7) + 0.035 * Math.sin(u * 5.3 + seed)),
      y: 0,
      color: col(PALETTE.toprak),
      cap: true,
    });
    for (const o of [-0.22 * w, 0.22 * w]) {
      layers.push({ off: o, left: () => 0.045, right: () => 0.045, y: 0.006, color: col(PALETTE.toprakIz), cap: false });
    }
  } else {
    layers.push({ off: 0, left: () => w / 2 + 0.08, right: () => w / 2 + 0.08, y: 0, color: col(PALETTE.kaldirim), cap: true });
    layers.push({ off: 0, left: () => w / 2 - 0.02, right: () => w / 2 - 0.02, y: 0.006, color: col(PALETTE.asfalt), cap: true });
    const total = s[n - 1];
    for (let a = 0.35; a + 0.45 < total - 0.2; a += 1.0) {
      dashes.push({ a, b: a + 0.45, color: col(PALETTE.yolCizgi), y: 0.012, hw: 0.035 });
    }
  }

  const pos: number[] = [];
  const cols: number[] = [];
  const uvs: number[] = [];
  const lpos: number[] = [];
  const triEnd: number[] = [];
  const lineEnd: number[] = [];

  const vtx = (x: number, z: number, y: number, c: THREE.Color) => {
    pos.push(x, heightAt(x, z) + base + y, z);
    cols.push(c.r, c.g, c.b);
    uvs.push(x * 0.35, z * 0.35);
  };
  const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, y: number, c: THREE.Color) => {
    vtx(ax, az, y, c);
    vtx(bx, bz, y, c);
    vtx(cx, cz, y, c);
  };
  const edgeY = (x: number, z: number) => heightAt(x, z) + base + 0.014;
  const lineSeg = (ax: number, az: number, bx: number, bz: number) => {
    lpos.push(ax, edgeY(ax, az), az, bx, edgeY(bx, bz), bz);
  };
  // Noktanın sol/sağ kenarı
  const side = (L: Layer, i: number, sgn: 1 | -1): [number, number] => {
    const hw = sgn > 0 ? L.left(s[i]) : L.right(s[i]);
    const d = (L.off + sgn * hw) * mit[i];
    return [P[i].x + nx[i] * d, P[i].z + nz[i] * d];
  };
  const cap = (L: Layer, i: number, dir: 1 | -1, lines: boolean) => {
    // Yarım daire: i noktasında, dir yönünde dışa (−teğet başta, +teğet sonda)
    const tx = nz[i] * dir;
    const tz = -nx[i] * dir;
    const cx = P[i].x + nx[i] * L.off;
    const cz = P[i].z + nz[i] * L.off;
    const segs = 7;
    const hw = (L.left(s[i]) + L.right(s[i])) / 2;
    let px = 0;
    let pz = 0;
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * Math.PI;
      // nx,nz'den başla, teğet yönünden geçerek −n'ye var
      const ux = Math.cos(a) * nx[i] + Math.sin(a) * tx;
      const uz = Math.cos(a) * nz[i] + Math.sin(a) * tz;
      const qx = cx + ux * hw;
      const qz = cz + uz * hw;
      if (k > 0) {
        tri(cx, cz, px, pz, qx, qz, L.y, L.color);
        if (lines) lineSeg(px, pz, qx, qz);
      }
      px = qx;
      pz = qz;
    }
  };

  // Baş kapak
  for (const L of layers) if (L.cap) cap(L, 0, -1, L === layers[0]);
  let di = 0;
  for (let i = 0; i < n - 1; i++) {
    for (const L of layers) {
      const [alx, alz] = side(L, i, 1);
      const [arx, arz] = side(L, i, -1);
      const [blx, blz] = side(L, i + 1, 1);
      const [brx, brz] = side(L, i + 1, -1);
      tri(alx, alz, arx, arz, brx, brz, L.y, L.color);
      tri(alx, alz, brx, brz, blx, blz, L.y, L.color);
      if (L === layers[0]) {
        lineSeg(alx, alz, blx, blz);
        lineSeg(arx, arz, brx, brz);
      }
    }
    // Bu segmentte başlayan kesikli çizgiler
    while (di < dashes.length && dashes[di].a < s[i + 1]) {
      const d = dashes[di++];
      const at = (u: number): [number, number, number, number] => {
        let j = 0;
        while (j < n - 2 && s[j + 1] < u) j++;
        const f = (u - s[j]) / Math.max(1e-6, s[j + 1] - s[j]);
        const x = P[j].x + (P[j + 1].x - P[j].x) * f;
        const z = P[j].z + (P[j + 1].z - P[j].z) * f;
        return [x, z, nx[j], nz[j]];
      };
      const [ax, az, anx, anz] = at(d.a);
      const [bx, bz, bnx, bnz] = at(Math.min(d.b, s[n - 1]));
      tri(ax + anx * d.hw, az + anz * d.hw, ax - anx * d.hw, az - anz * d.hw, bx - bnx * d.hw, bz - bnz * d.hw, d.y, d.color);
      tri(ax + anx * d.hw, az + anz * d.hw, bx - bnx * d.hw, bz - bnz * d.hw, bx + bnx * d.hw, bz + bnz * d.hw, d.y, d.color);
    }
    triEnd.push(pos.length / 3);
    lineEnd.push(lpos.length / 3);
  }
  // Son kapak (son segmente dahil)
  for (const L of layers) if (L.cap) cap(L, n - 1, 1, L === layers[0]);
  triEnd[triEnd.length - 1] = pos.length / 3;
  lineEnd[lineEnd.length - 1] = lpos.length / 3;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  const path = P.map((p) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + base, p.z));
  return { geo, edges, triEnd, lineEnd, path, length: s[n - 1] };
}

/** k ∈ [0,1] kadarını göster (segment bazında). */
export function revealRoad(r: RoadGeo, mesh: THREE.Mesh, lines: THREE.LineSegments, k: number): void {
  const segs = r.triEnd.length;
  if (k >= 1) {
    mesh.geometry.setDrawRange(0, Infinity);
    lines.geometry.setDrawRange(0, Infinity);
    return;
  }
  const i = Math.floor(k * segs) - 1;
  mesh.geometry.setDrawRange(0, i < 0 ? 0 : r.triEnd[i]);
  lines.geometry.setDrawRange(0, i < 0 ? 0 : r.lineEnd[i]);
}

/** Yol üzerindeki u ∈ [0,1] noktası (toz için). */
export function roadPointAt(r: RoadGeo, k: number, out: THREE.Vector3): THREE.Vector3 {
  const f = Math.min(1, Math.max(0, k)) * (r.path.length - 1);
  const i = Math.min(r.path.length - 2, Math.floor(f));
  return out.copy(r.path[i]).lerp(r.path[i + 1], f - i);
}
