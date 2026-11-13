import * as THREE from 'three';
import type { BuildingType, RoadType, Vec2 } from '../logic/types';
import { HARITA } from '../data/map';
import { heightAt, isLake, SU_SEVIYESI } from '../logic/terrain';
import { PALETTE } from './palette';
import { paperTexture } from './paper';
import { kisW } from './season';

// Canlılık: yürüyen kağıt insanlar, çiftçi, pazar kalabalığı, okul çocukları, baca dumanı,
// göl ördekleri, kuş sürüleri, el arabaları. Yalnızca çizim; mantığa etkisi yok.
// Her figür türü tek bir InstancedMesh ile çizilir; görünür örnekler her kare baştan paketlenir.

export interface LifeRoad {
  id: number;
  tur: RoadType;
  noktalar: Vec2[];
}

export interface LifeBuilding {
  id: number;
  type: BuildingType;
  x: number;
  z: number;
  rot: number;
  seviye: number;
  /** kapının önündeki nokta (patikanın bina ucu), dünya koordinatı */
  kapi: Vec2;
  /** patikanın yol ucu (yoksa null) */
  baglanti: Vec2 | null;
}

// ---------- Ayarlar (hepsi burada) ----------

export const LIFE = {
  /** Yürüyen kişi sayısı = min(ceil(nüfus × oran), max). */
  kisiOrani: 0.6,
  kisiMax: 120,
  /** Yürüme hızı aralığı (birim/sn). */
  yuruHiz: [0.85, 1.25] as const,
  /** Sağ şerit yanal ofseti. */
  serit: 0.25,
  /** Farklı yolların noktaları bu mesafedeyse bağlı sayılır. */
  yolBaglanti: 1.0,
  /** Yol uçları (kenetlenme) için daha geniş bağlantı mesafesi. */
  ucBaglanti: 1.6,
  /** Binada kalma süresi (sn). */
  icerdeSure: [4, 14] as const,
  /** Bir kişinin evden hedefe (ev dışı) gitme olasılığı. */
  isOlasilik: 0.7,
  /** Gidilebilecek ev dışı hedefler. */
  hedefTurleri: [
    'firin', 'pazar', 'okul', 'degirmen', 'tarla', 'oduncu', 'saatKulesi', 'cesme',
    'hastane', 'ambar', 'balikci', 'tasOcagi', 'marangoz', 'agil', 'dokumaci', 'arilik',
  ] as BuildingType[],
  /** Figürlerin zeminden yüksekliği (yol şeridi kalınlığı). */
  zeminPay: 0.07,
  /** Belirme / kaybolma süresi (sn). */
  belirme: 0.4,
  /** Kamera hedefinden bu kadar uzak kişiler seyrek güncellenir. */
  uzakMesafe: 60,
  /** camDist bundan büyükse gölge diskleri çizilmez. */
  golgeKamSinir: 85,

  /** Baca tepeleri, bina yerel koordinatında (ön yüz +z). Modellerden ölçüldü. */
  baca: {
    ev2: { x: 0.36, z: -0.2, y: 1.62 },
    ev3: { x: -0.4, z: -0.22, y: 2.48 },
    ev4: { x: -0.5, z: -0.22, y: 2.54 },
    ev5: { x: -0.58, z: -0.22, y: 2.54 },
    firin: { x: -0.42, z: -0.18, y: 2.05 },
  },
  dumanAralik: [0.55, 0.9] as const,
  dumanOmur: 3.4,
  dumanYukselis: 0.45,
  dumanRuzgar: { x: 0.14, z: 0.05 },
  dumanMax: 260,

  /** Göl yarıçapına göre ördek sayısı (2–4). */
  ordekHiz: [0.18, 0.42] as const,
  ordekBakis: 1.3,

  kusAralik: [15, 30] as const,
  kusIlk: [5, 10] as const,
  kusYukseklik: [10, 14] as const,
  kusHiz: [6, 8] as const,
  kusOlcek: 1.7,

  arabaNufus: 20,
  arabaMax: 2,
  arabaAralik: [8, 22] as const,
  arabaHiz: 0.75,

  pazarMax: 4,
  okulMax: 3,
  tarlaMax: 8,
  cocukGorunur: [16, 28] as const,
  cocukGizli: [12, 26] as const,
};

const KIYAFET = [
  PALETTE.gul, PALETTE.gok, PALETTE.hardal, PALETTE.adacayi, PALETTE.lavanta,
  PALETTE.terrakota, PALETTE.teal, PALETTE.arduvaz, PALETTE.kiremit, PALETTE.yesil, PALETTE.pembe,
] as const;
const KIYAFET_RENK = KIYAFET.map((c) => new THREE.Color(c));
const CIFTCI_RENK = new THREE.Color(PALETTE.arduvaz);

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (n: number) => Math.floor(Math.random() * n);
function pick<T>(arr: readonly T[]): T {
  return arr[randi(arr.length)];
}

function angleLerp(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** Bina yerel (lx, lz) noktası → dünya. Model kökü rotation.y = rot. */
function toWorld(b: LifeBuilding, lx: number, lz: number): Vec2 {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

// ---------- Geometri yardımcıları ----------

export interface Part {
  geo: THREE.BufferGeometry;
  color: string;
}

/** Parçaları tek geometride birleştirir; her parçaya tepe rengi yazar. */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    const ua = g.getAttribute('uv');
    c.set(p.color);
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
      if (ua) uv.push(ua.getX(i) * 3, ua.getY(i) * 3);
      else uv.push(0, 0);
      col.push(c.r, c.g, c.b);
    }
    if (g !== p.geo) g.dispose();
    p.geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export function poly(pts: number[]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
  s.closePath();
  return s;
}

/** Şekli z ekseninde ortalanmış ince kağıt levha olarak ekstrüde eder. */
export function slab(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 7 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Ön siluet + daraltılmış yan siluet (çapraz iki levha): her açıdan okunur. */
export function crossed(shape: THREE.Shape, depth: number, profile = 0.55): THREE.BufferGeometry[] {
  const a = slab(shape, depth);
  const b = slab(shape, depth);
  b.scale(profile, 1, 1);
  b.rotateY(Math.PI / 2);
  return [a, b];
}

/** İnsan: kıyafet (örnek rengiyle boyanır) ve sabit renkli kısım (bacak, baş, saç). Boy ~0.42. */
export function humanGeometries(): { cloth: THREE.BufferGeometry; rest: THREE.BufferGeometry } {
  const torso = poly([
    -0.09, 0.12, 0.09, 0.12, 0.075, 0.24, 0.1, 0.165, 0.12, 0.178, 0.092, 0.29,
    0.05, 0.312, -0.05, 0.312, -0.092, 0.29, -0.12, 0.178, -0.1, 0.165, -0.075, 0.24,
  ]);
  const cloth = mergeParts(crossed(torso, 0.075).map((geo) => ({ geo, color: PALETTE.beyaz })));

  const legL = poly([-0.062, 0, -0.014, 0, -0.016, 0.135, -0.06, 0.135]);
  const legR = poly([0.014, 0, 0.062, 0, 0.06, 0.135, 0.016, 0.135]);
  const head = new THREE.Shape();
  head.absarc(0, 0.36, 0.062, 0, Math.PI * 2, false);
  const hair = new THREE.Shape();
  hair.absarc(0, 0.364, 0.069, -0.15, Math.PI + 0.15, false);
  hair.closePath();
  const parts: Part[] = [];
  for (const g of crossed(legL, 0.05)) parts.push({ geo: g, color: PALETTE.murekkep });
  for (const g of crossed(legR, 0.05)) parts.push({ geo: g, color: PALETTE.murekkep });
  for (const g of crossed(head, 0.07, 0.8)) parts.push({ geo: g, color: PALETTE.seftali });
  for (const g of crossed(hair, 0.084, 0.8)) parts.push({ geo: g, color: PALETTE.ahsap });
  return { cloth, rest: mergeParts(parts) };
}

/** Çiftçi aksesuarı: hasır şapka + tırmık. */
function farmerAccessory(): THREE.BufferGeometry {
  const brim = new THREE.CylinderGeometry(0.115, 0.115, 0.016, 10);
  brim.translate(0, 0.408, 0);
  const crown = new THREE.CylinderGeometry(0.052, 0.064, 0.06, 8);
  crown.translate(0, 0.445, 0);
  const handle = new THREE.BoxGeometry(0.018, 0.52, 0.018);
  handle.translate(0.135, 0.26, 0.05);
  const head = new THREE.BoxGeometry(0.02, 0.022, 0.15);
  head.translate(0.135, 0.02, 0.05);
  const parts: Part[] = [
    { geo: brim, color: PALETTE.bugday },
    { geo: crown, color: PALETTE.bugdayKoyu },
    { geo: handle, color: PALETTE.ahsap },
    { geo: head, color: PALETTE.tasKoyu },
  ];
  for (let i = 0; i < 4; i++) {
    const t = new THREE.BoxGeometry(0.012, 0.05, 0.012);
    t.translate(0.135, -0.005, 0.0 + i * 0.033);
    parts.push({ geo: t, color: PALETTE.tasKoyu });
  }
  return mergeParts(parts);
}

/** Ördek: yandan siluet (gövde + baş + gaga + kanat). Ön +z. */
function duckGeometry(): THREE.BufferGeometry {
  const body = poly([-0.25, 0.14, -0.2, 0.06, -0.12, -0.02, 0.12, -0.02, 0.2, 0.06, 0.19, 0.13, 0.08, 0.14, -0.06, 0.12]);
  const head = new THREE.Shape();
  head.absarc(0.15, 0.24, 0.065, 0, Math.PI * 2, false);
  const neck = poly([0.1, 0.12, 0.19, 0.12, 0.18, 0.22, 0.11, 0.22]);
  const beak = poly([0.2, 0.22, 0.3, 0.215, 0.2, 0.25]);
  const wing = poly([-0.15, 0.1, 0.08, 0.1, 0.02, 0.16, -0.1, 0.16]);
  const eye = new THREE.Shape();
  eye.absarc(0.17, 0.255, 0.013, 0, Math.PI * 2, false);
  const parts: Part[] = [
    { geo: slab(body, 0.17), color: PALETTE.kagit },
    { geo: slab(head, 0.1), color: PALETTE.kagit },
    { geo: slab(neck, 0.08), color: PALETTE.kagit },
    { geo: slab(beak, 0.05), color: PALETTE.hardal },
    { geo: slab(wing, 0.19), color: PALETTE.krem },
    { geo: slab(eye, 0.104), color: PALETTE.murekkep },
  ];
  const g = mergeParts(parts);
  g.rotateY(-Math.PI / 2); // yerel +x (burun) → +z
  return g;
}

/** El arabası: kasa, yük, tek teker, ayaklar, kollar. Ön +z. */
function cartGeometry(): THREE.BufferGeometry {
  const bed = new THREE.BoxGeometry(0.26, 0.1, 0.34);
  bed.translate(0, 0.17, 0.02);
  const rim = new THREE.BoxGeometry(0.28, 0.025, 0.36);
  rim.translate(0, 0.225, 0.02);
  const wheel = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 9);
  wheel.rotateZ(Math.PI / 2);
  wheel.translate(0, 0.08, 0.22);
  const parts: Part[] = [
    { geo: bed, color: PALETTE.ahsapAcik },
    { geo: rim, color: PALETTE.ahsap },
    { geo: wheel, color: PALETTE.ahsap },
  ];
  for (const s of [-1, 1]) {
    const leg = new THREE.BoxGeometry(0.025, 0.12, 0.025);
    leg.translate(s * 0.09, 0.06, -0.1);
    const handle = new THREE.BoxGeometry(0.022, 0.022, 0.32);
    handle.rotateX(-0.25);
    handle.translate(s * 0.1, 0.22, -0.27);
    parts.push({ geo: leg, color: PALETTE.ahsap }, { geo: handle, color: PALETTE.ahsap });
  }
  const loads: [number, number, string][] = [[-0.06, 0.06, PALETTE.bugday], [0.06, -0.02, PALETTE.bugdayKoyu], [-0.02, -0.08, PALETTE.kutuk], [0.05, 0.1, PALETTE.bugday]];
  for (const [x, z, c] of loads) {
    const l = new THREE.IcosahedronGeometry(0.075, 0);
    l.translate(x, 0.26, z);
    parts.push({ geo: l, color: c });
  }
  return mergeParts(parts);
}

/** Kuş gövdesi ve kanat (kanat kökü x=0, uç +x). Ön +z. */
function birdGeometries(): { body: THREE.BufferGeometry; wing: THREE.BufferGeometry } {
  const cone = new THREE.ConeGeometry(0.06, 0.34, 4);
  cone.rotateX(Math.PI / 2);
  const tail = new THREE.ConeGeometry(0.05, 0.12, 3);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0, -0.2);
  const body = mergeParts([
    { geo: cone, color: PALETTE.kagit },
    { geo: tail, color: PALETTE.krem },
  ]);
  const ws = poly([0, 0.08, 0.42, -0.1, 0.3, -0.06, 0, -0.07]);
  const w = new THREE.ShapeGeometry(ws);
  w.rotateX(Math.PI / 2); // şekil XY → XZ (y → -z yerine +z: rotateX(π/2) y→z)
  const wing = mergeParts([{ geo: w, color: PALETTE.beyaz }]);
  return { body, wing };
}

// ---------- Yol grafı ----------

class RoadGraph {
  xs: number[] = [];
  zs: number[] = [];
  adj: number[][] = [];
  w: number[][] = [];
  comp: number[] = [];
  private grid = new Map<number, number[]>();
  private cache = new Map<number, { dist: Float64Array; prev: Int32Array }>();
  private static CELL = 2;

  get size(): number {
    return this.xs.length;
  }

  private key(ix: number, iz: number): number {
    return (ix + 2000) * 8192 + (iz + 2000);
  }

  build(roads: LifeRoad[]): void {
    this.xs = [];
    this.zs = [];
    this.adj = [];
    this.w = [];
    this.grid.clear();
    this.cache.clear();
    const roadOf: number[] = [];
    const isEnd: boolean[] = [];
    roads.forEach((r, ri) => {
      const n = r.noktalar.length;
      for (let i = 0; i < n; i++) {
        const id = this.xs.length;
        const p = r.noktalar[i];
        this.xs.push(p.x);
        this.zs.push(p.z);
        this.adj.push([]);
        this.w.push([]);
        roadOf.push(ri);
        isEnd.push(i === 0 || i === n - 1);
        const k = this.key(Math.floor(p.x / RoadGraph.CELL), Math.floor(p.z / RoadGraph.CELL));
        let cell = this.grid.get(k);
        if (!cell) this.grid.set(k, (cell = []));
        cell.push(id);
        if (i > 0) this.link(id - 1, id);
      }
    });
    // Farklı yolların yakın noktaları: her nokta için her komşu yolun en yakın noktasına bağlan.
    const best = new Map<number, { j: number; d: number }>();
    for (let i = 0; i < this.xs.length; i++) {
      const thr = isEnd[i] ? LIFE.ucBaglanti : LIFE.yolBaglanti;
      best.clear();
      const ix = Math.floor(this.xs[i] / RoadGraph.CELL);
      const iz = Math.floor(this.zs[i] / RoadGraph.CELL);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const cell = this.grid.get(this.key(ix + a, iz + b));
          if (!cell) continue;
          for (const j of cell) {
            if (roadOf[j] === roadOf[i] || j < i) continue;
            const d = Math.hypot(this.xs[i] - this.xs[j], this.zs[i] - this.zs[j]);
            const t = Math.max(thr, isEnd[j] ? LIFE.ucBaglanti : LIFE.yolBaglanti);
            if (d > t) continue;
            const cur = best.get(roadOf[j]);
            if (!cur || d < cur.d) best.set(roadOf[j], { j, d });
          }
        }
      }
      for (const { j } of best.values()) this.link(i, j);
    }
    // Bileşenler
    this.comp = new Array(this.xs.length).fill(-1);
    let c = 0;
    for (let s = 0; s < this.xs.length; s++) {
      if (this.comp[s] >= 0) continue;
      const stack = [s];
      this.comp[s] = c;
      while (stack.length) {
        const u = stack.pop() as number;
        for (const v of this.adj[u]) {
          if (this.comp[v] < 0) {
            this.comp[v] = c;
            stack.push(v);
          }
        }
      }
      c++;
    }
  }

  private link(a: number, b: number): void {
    if (a === b || this.adj[a].includes(b)) return;
    const d = Math.max(0.05, Math.hypot(this.xs[a] - this.xs[b], this.zs[a] - this.zs[b]));
    this.adj[a].push(b);
    this.w[a].push(d);
    this.adj[b].push(a);
    this.w[b].push(d);
  }

  nearest(x: number, z: number): number {
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < this.xs.length; i++) {
      const dx = this.xs[i] - x;
      const dz = this.zs[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  /** Dijkstra (ikili yığın); kaynak başına önbellekli. */
  private tree(src: number): { dist: Float64Array; prev: Int32Array } {
    const hit = this.cache.get(src);
    if (hit) return hit;
    const n = this.xs.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const heapN: number[] = [];
    const heapD: number[] = [];
    const push = (v: number, d: number) => {
      let i = heapN.length;
      heapN.push(v);
      heapD.push(d);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapD[p] <= heapD[i]) break;
        [heapN[p], heapN[i]] = [heapN[i], heapN[p]];
        [heapD[p], heapD[i]] = [heapD[i], heapD[p]];
        i = p;
      }
    };
    const pop = (): [number, number] => {
      const v = heapN[0];
      const d = heapD[0];
      const lv = heapN.pop() as number;
      const ld = heapD.pop() as number;
      if (heapN.length) {
        heapN[0] = lv;
        heapD[0] = ld;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heapN.length && heapD[l] < heapD[m]) m = l;
          if (r < heapN.length && heapD[r] < heapD[m]) m = r;
          if (m === i) break;
          [heapN[m], heapN[i]] = [heapN[i], heapN[m]];
          [heapD[m], heapD[i]] = [heapD[i], heapD[m]];
          i = m;
        }
      }
      return [v, d];
    };
    dist[src] = 0;
    push(src, 0);
    while (heapN.length) {
      const [u, d] = pop();
      if (d > dist[u]) continue;
      const au = this.adj[u];
      const wu = this.w[u];
      for (let k = 0; k < au.length; k++) {
        const v = au[k];
        const nd = d + wu[k];
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
          push(v, nd);
        }
      }
    }
    if (this.cache.size > 48) {
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    const t = { dist, prev };
    this.cache.set(src, t);
    return t;
  }

  /** src → dst düğüm listesi; ulaşılamazsa null. */
  path(src: number, dst: number): number[] | null {
    if (src < 0 || dst < 0 || this.comp[src] !== this.comp[dst]) return null;
    if (src === dst) return [src];
    const { prev } = this.tree(src);
    const out: number[] = [];
    for (let v = dst; v >= 0; v = prev[v]) {
      out.push(v);
      if (v === src) break;
    }
    if (out[out.length - 1] !== src) return null;
    return out.reverse();
  }

  /** src'den rastgele komşular boyunca kısa bir gezinti. */
  randomWalk(src: number, steps: number): number[] {
    const out = [src];
    let prev = -1;
    let u = src;
    for (let i = 0; i < steps; i++) {
      const opts = this.adj[u].filter((v) => v !== prev);
      if (!opts.length) break;
      prev = u;
      u = pick(opts);
      out.push(u);
    }
    return out;
  }
}

// ---------- Yol izi (yay uzunluğuyla parametrik) ----------

interface Pt {
  x: number;
  z: number;
  /** 0 = patika (ortadan), 1 = yol (sağ şerit). */
  lane: number;
}

class Track {
  xs: number[] = [];
  zs: number[] = [];
  cum: number[] = [];
  length = 0;
  private seg = 0;

  /** Noktaları, şerit ağırlığına göre sağa kaydırarak kurar. */
  constructor(pts: Pt[]) {
    // Ardışık çok yakın noktaları ele.
    const p: Pt[] = [];
    for (const q of pts) {
      const l = p[p.length - 1];
      if (l && Math.hypot(l.x - q.x, l.z - q.z) < 0.05) {
        l.lane = Math.max(l.lane, q.lane);
        continue;
      }
      p.push({ ...q });
    }
    const n = p.length;
    for (let i = 0; i < n; i++) {
      let nx = 0;
      let nz = 0;
      if (p[i].lane > 0 && n > 1) {
        for (const [a, b] of [[i - 1, i], [i, i + 1]]) {
          if (a < 0 || b >= n) continue;
          const dx = p[b].x - p[a].x;
          const dz = p[b].z - p[a].z;
          const l = Math.hypot(dx, dz) || 1;
          nx += -dz / l;
          nz += dx / l;
        }
        const l = Math.hypot(nx, nz);
        if (l > 0.3) {
          nx /= l;
          nz /= l;
        } else {
          nx = nz = 0;
        }
      }
      const off = LIFE.serit * p[i].lane;
      this.xs.push(p[i].x + nx * off);
      this.zs.push(p[i].z + nz * off);
    }
    this.cum.push(0);
    for (let i = 1; i < this.xs.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(this.xs[i] - this.xs[i - 1], this.zs[i] - this.zs[i - 1]));
    }
    this.length = this.cum[this.cum.length - 1] ?? 0;
  }

  /** s konumundaki nokta ve yön (out'a yazar). */
  at(s: number, out: { x: number; z: number; dx: number; dz: number }): void {
    const n = this.xs.length;
    if (n === 1) {
      out.x = this.xs[0];
      out.z = this.zs[0];
      return;
    }
    s = Math.max(0, Math.min(this.length, s));
    let i = Math.min(this.seg, n - 2);
    while (i > 0 && this.cum[i] > s) i--;
    while (i < n - 2 && this.cum[i + 1] < s) i++;
    this.seg = i;
    const l = this.cum[i + 1] - this.cum[i] || 1;
    const k = (s - this.cum[i]) / l;
    const dx = this.xs[i + 1] - this.xs[i];
    const dz = this.zs[i + 1] - this.zs[i];
    out.x = this.xs[i] + dx * k;
    out.z = this.zs[i] + dz * k;
    if (dx * dx + dz * dz > 1e-6) {
      out.dx = dx;
      out.dz = dz;
    }
  }
}

// ---------- Figür havuzu ----------

class Pool {
  readonly mesh: THREE.InstancedMesh;
  n = 0;
  readonly cap: number;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, tint: boolean) {
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (tint) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.raycast = () => {};
  }

  push(m: THREE.Matrix4, c?: THREE.Color): void {
    if (this.n >= this.cap) return;
    this.mesh.setMatrixAt(this.n, m);
    if (c && this.mesh.instanceColor) this.mesh.setColorAt(this.n, c);
    this.n++;
  }

  begin(): void {
    this.n = 0;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

// ---------- Varlıklar ----------

type WalkerState = 'icerde' | 'yuruyor';

interface Walker {
  state: WalkerState;
  /** Bulunduğu bina (içerdeyse) ya da gittiği bina. */
  at: number;
  home: number;
  timer: number;
  track: Track | null;
  s: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  color: THREE.Color;
  size: number;
  /** Nüfus azaldı: küçülüp yok olur. */
  leaving: number;
  acc: number;
  visible: boolean;
}

interface Cart {
  track: Track;
  s: number;
  x: number;
  z: number;
  yaw: number;
  px: number;
  pz: number;
  pyaw: number;
  color: THREE.Color;
  phase: number;
}

interface Duck {
  lake: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  targetSpeed: number;
  turn: number;
  timer: number;
  phase: number;
}

interface Bird {
  ox: number;
  oz: number;
  oy: number;
  phase: number;
}

interface Flock {
  x: number;
  z: number;
  y: number;
  dx: number;
  dz: number;
  speed: number;
  travelled: number;
  length: number;
  birds: Bird[];
}

interface Puff {
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  vx: number;
  vz: number;
}

interface Chimney {
  x: number;
  y: number;
  z: number;
  timer: number;
}

interface Stander {
  lx: number;
  lz: number;
  ox: number;
  oz: number;
  tx: number;
  tz: number;
  yaw: number;
  timer: number;
  phase: number;
  color: THREE.Color;
  size: number;
}

interface Market {
  b: LifeBuilding;
  people: Stander[];
}

interface School {
  b: LifeBuilding;
  kids: Stander[];
  visible: boolean;
  timer: number;
  fade: number;
}

interface Farmer {
  b: LifeBuilding;
  row: number;
  rowDir: number;
  lx: number;
  lz: number;
  dir: number;
  mode: 'yuru' | 'gec' | 'dur';
  timer: number;
  phase: number;
  yaw: number;
}

interface BInfo {
  b: LifeBuilding;
  node: number;
}

// ---------- Ana sınıf ----------

export class TownLife {
  private root: THREE.Object3D;
  private group = new THREE.Group();
  private matVC: THREE.MeshStandardMaterial;
  private matTint: THREE.MeshStandardMaterial;
  private matBird: THREE.MeshStandardMaterial;
  private matShadow: THREE.MeshBasicMaterial;

  private cloth: Pool;
  private rest: Pool;
  private shadow: Pool;
  private acc: Pool;
  private ducks: Pool;
  private carts: Pool;
  private birdBody: Pool;
  private birdWing: Pool;
  private smoke: Pool;

  private graph = new RoadGraph();
  private buildings = new Map<number, BInfo>();
  private homes: BInfo[] = [];
  private dests: BInfo[] = [];

  private walkers: Walker[] = [];
  private population = 0;
  private cartList: Cart[] = [];
  private cartTimer = rand(4, 10);
  private duckList: Duck[] = [];
  private flocks: Flock[] = [];
  private flockTimer = rand(LIFE.kusIlk[0], LIFE.kusIlk[1]);
  private puffs: Puff[] = [];
  private chimneys: Chimney[] = [];
  private markets: Market[] = [];
  private schools: School[] = [];
  private farmers: Farmer[] = [];

  private time = 0;
  private frame = 0;

  // Geçici nesneler
  private m4 = new THREE.Matrix4();
  private m4b = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private tmp = { x: 0, z: 0, dx: 0, dz: 1 };
  private puffCol = new THREE.Color();
  private puffA = new THREE.Color(PALETTE.krem);
  private puffB = new THREE.Color(PALETTE.beyaz);

  constructor(root: THREE.Object3D) {
    this.root = root;
    this.group.name = 'canlilik';
    root.add(this.group);
    const tex = paperTexture();
    this.matVC = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.93, metalness: 0, flatShading: true });
    this.matTint = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.93, metalness: 0, flatShading: true });
    this.matBird = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.93, metalness: 0, flatShading: true, side: THREE.DoubleSide });
    this.matShadow = new THREE.MeshBasicMaterial({
      color: PALETTE.kenar, transparent: true, opacity: 0.2, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });

    const hg = humanGeometries();
    const HCAP = LIFE.kisiMax + 60;
    this.cloth = new Pool(hg.cloth, this.matTint, HCAP, true);
    this.rest = new Pool(hg.rest, this.matVC, HCAP, false);
    this.cloth.mesh.receiveShadow = true;
    this.rest.mesh.receiveShadow = true;
    const sg = new THREE.CircleGeometry(0.12, 10);
    sg.rotateX(-Math.PI / 2);
    this.shadow = new Pool(sg, this.matShadow, HCAP + LIFE.arabaMax, false);
    this.shadow.mesh.renderOrder = 1;
    this.acc = new Pool(farmerAccessory(), this.matVC, LIFE.tarlaMax, false);
    this.ducks = new Pool(duckGeometry(), this.matVC, 20, false);
    this.carts = new Pool(cartGeometry(), this.matVC, LIFE.arabaMax, false);
    const bg = birdGeometries();
    this.birdBody = new Pool(bg.body, this.matBird, 24, false);
    this.birdWing = new Pool(bg.wing, this.matBird, 48, false);
    this.smoke = new Pool(new THREE.IcosahedronGeometry(0.13, 0), this.matTint, LIFE.dumanMax, true);
    for (const p of [this.shadow, this.cloth, this.rest, this.acc, this.ducks, this.carts, this.birdBody, this.birdWing, this.smoke]) {
      this.group.add(p.mesh);
    }
    this.spawnDucks();
  }

  // ---------- Dış arayüz ----------

  setRoads(roads: LifeRoad[]): void {
    this.graph.build(roads);
    this.relinkBuildings();
  }

  setBuildings(list: LifeBuilding[]): void {
    this.buildings.clear();
    for (const b of list) this.buildings.set(b.id, { b, node: -1 });
    this.relinkBuildings();
    // Yok olan binaların içindekiler başka bir eve taşınır.
    for (const w of this.walkers) {
      if (w.state === 'icerde' && !this.buildings.has(w.at)) {
        const h = this.homes.length ? pick(this.homes).b.id : -1;
        w.at = h;
        w.home = h;
      }
    }
    this.rebuildChimneys();
    this.rebuildSpots();
  }

  setPopulation(n: number): void {
    this.population = Math.max(0, n);
  }

  update(dt: number, camTarget: THREE.Vector3, camDist: number): void {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.frame++;
    this.syncWalkerCount();

    this.cloth.begin();
    this.rest.begin();
    this.shadow.begin();
    this.acc.begin();
    const shadows = camDist < LIFE.golgeKamSinir;

    this.updateWalkers(dt, camTarget, shadows);
    this.updateCarts(dt, shadows);
    this.updateMarkets(dt, shadows);
    this.updateSchools(dt, shadows);
    this.updateFarmers(dt, shadows);
    this.updateDucks(dt);
    this.updateBirds(dt, camTarget, camDist);
    this.updateSmoke(dt, camTarget, camDist);

    this.cloth.end();
    this.rest.end();
    this.shadow.end();
    this.acc.end();
  }

  dispose(): void {
    for (const p of [this.shadow, this.cloth, this.rest, this.acc, this.ducks, this.carts, this.birdBody, this.birdWing, this.smoke]) p.dispose();
    this.matVC.dispose();
    this.matTint.dispose();
    this.matBird.dispose();
    this.matShadow.dispose();
    this.root.remove(this.group);
    this.walkers = [];
    this.cartList = [];
    this.puffs = [];
    this.flocks = [];
  }

  // ---------- Bina / graf eşleme ----------

  private relinkBuildings(): void {
    this.homes = [];
    this.dests = [];
    for (const info of this.buildings.values()) {
      const p = info.b.baglanti ?? info.b.kapi;
      info.node = this.graph.size ? this.graph.nearest(p.x, p.z) : -1;
      if (info.b.type === 'ev') this.homes.push(info);
      else if (LIFE.hedefTurleri.includes(info.b.type)) this.dests.push(info);
    }
  }

  private rebuildChimneys(): void {
    const old = this.chimneys;
    this.chimneys = [];
    for (const { b } of this.buildings.values()) {
      let c: { x: number; z: number; y: number } | null = null;
      if (b.type === 'ev' && b.seviye === 2) c = LIFE.baca.ev2;
      else if (b.type === 'ev' && b.seviye === 3) c = LIFE.baca.ev3;
      else if (b.type === 'ev' && b.seviye === 4) c = LIFE.baca.ev4;
      else if (b.type === 'ev' && b.seviye >= 5) c = LIFE.baca.ev5;
      else if (b.type === 'firin') c = LIFE.baca.firin;
      if (!c) continue;
      const w = toWorld(b, c.x, c.z);
      const prev = old.find((o) => Math.abs(o.x - w.x) < 0.01 && Math.abs(o.z - w.z) < 0.01);
      this.chimneys.push({ x: w.x, z: w.z, y: heightAt(b.x, b.z) + c.y, timer: prev ? prev.timer : rand(0, 1.5) });
    }
  }

  private rebuildSpots(): void {
    const keepM = new Map(this.markets.map((m) => [m.b.id, m]));
    const keepS = new Map(this.schools.map((s) => [s.b.id, s]));
    const keepF = new Map(this.farmers.map((f) => [f.b.id, f]));
    this.markets = [];
    this.schools = [];
    this.farmers = [];
    for (const { b } of this.buildings.values()) {
      if (b.type === 'pazar' && this.markets.length < LIFE.pazarMax) {
        const m = keepM.get(b.id);
        if (m) {
          m.b = b;
          this.markets.push(m);
          continue;
        }
        const n = 3 + randi(3);
        const people: Stander[] = [];
        for (let i = 0; i < n; i++) {
          // Üç tezgah (açı π/6 + k·2π/3, yarıçap 0.72) önünde, tezgaha bakarak.
          const ang = Math.PI / 6 + (i % 3) * ((Math.PI * 2) / 3) + rand(-0.35, 0.35);
          const r = i < 3 ? rand(1.2, 1.35) : rand(0.0, 0.25);
          const lx = Math.sin(ang) * r;
          const lz = Math.cos(ang) * r;
          people.push({
            lx, lz, ox: 0, oz: 0, tx: 0, tz: 0, yaw: Math.atan2(-lx, -lz) + (i < 3 ? 0 : rand(-3, 3)),
            timer: rand(1, 4), phase: rand(0, 10), color: pick(KIYAFET_RENK), size: rand(0.92, 1.05),
          });
        }
        this.markets.push({ b, people });
      } else if (b.type === 'okul' && this.schools.length < LIFE.okulMax) {
        const s = keepS.get(b.id);
        if (s) {
          s.b = b;
          this.schools.push(s);
          continue;
        }
        const kids: Stander[] = [];
        const n = 2 + randi(2);
        for (let i = 0; i < n; i++) {
          const lx = rand(-1, 1);
          const lz = rand(0.9, 1.4);
          kids.push({ lx, lz, ox: 0, oz: 0, tx: lx, tz: lz, yaw: 0, timer: 0, phase: rand(0, 10), color: pick(KIYAFET_RENK), size: rand(0.62, 0.72) });
        }
        this.schools.push({ b, kids, visible: false, timer: rand(2, 8), fade: 0 });
      } else if (b.type === 'tarla' && this.farmers.length < LIFE.tarlaMax) {
        const f = keepF.get(b.id);
        if (f) {
          f.b = b;
          this.farmers.push(f);
          continue;
        }
        const row = randi(5);
        this.farmers.push({ b, row, rowDir: 1, lx: rand(-0.9, 0.9), lz: this.farmRowZ(row), dir: Math.random() < 0.5 ? 1 : -1, mode: 'yuru', timer: 0, phase: rand(0, 10), yaw: 0 });
      }
    }
  }

  // ---------- İnsan çizimi ----------

  private pushHuman(x: number, y: number, z: number, yaw: number, size: number, color: THREE.Color, bob: number, roll: number, lean: number, shadow: boolean, acc = false): void {
    if (size <= 0.01) return;
    this.e.set(lean, yaw, roll);
    this.q.setFromEuler(this.e);
    this.v.set(x, y + bob, z);
    this.sc.setScalar(size);
    this.m4.compose(this.v, this.q, this.sc);
    this.cloth.push(this.m4, color);
    this.rest.push(this.m4);
    if (acc) this.acc.push(this.m4);
    if (shadow) {
      this.v.set(x, y + 0.012, z);
      this.q.identity();
      this.sc.set(size, 1, size);
      this.m4.compose(this.v, this.q, this.sc);
      this.shadow.push(this.m4);
    }
  }

  /** Yürüme salınımı: adım başına küçük zıplama + yana sallanma. */
  private walkPose(phase: number, size: number): { bob: number; roll: number } {
    const step = phase * 9;
    return { bob: Math.abs(Math.sin(step)) * 0.035 * size, roll: Math.sin(step) * 0.09 };
  }

  // ---------- Yürüyenler ----------

  private targetCount(): number {
    return Math.min(Math.ceil(this.population * LIFE.kisiOrani), LIFE.kisiMax);
  }

  private syncWalkerCount(): void {
    const target = this.homes.length ? this.targetCount() : 0;
    let alive = 0;
    for (const w of this.walkers) if (w.leaving === 0) alive++;
    if (alive < target) {
      for (let i = alive; i < target; i++) {
        const h = pick(this.homes).b.id;
        this.walkers.push({
          state: 'icerde', at: h, home: h, timer: rand(0.3, 5), track: null, s: 0,
          speed: rand(LIFE.yuruHiz[0], LIFE.yuruHiz[1]), x: 0, z: 0, yaw: 0, phase: rand(0, 10),
          color: pick(KIYAFET_RENK), size: rand(0.9, 1.07), leaving: 0, acc: 0, visible: false,
        });
      }
    } else if (alive > target) {
      let extra = alive - target;
      // Önce içerdekiler, sonra dışarıdakiler (küçülerek).
      for (let pass = 0; pass < 2 && extra > 0; pass++) {
        for (const w of this.walkers) {
          if (extra <= 0) break;
          if (w.leaving > 0) continue;
          if (pass === 0 && w.state !== 'icerde') continue;
          w.leaving = 1;
          extra--;
        }
      }
    }
    this.walkers = this.walkers.filter((w) => !(w.leaving > 0 && (w.state === 'icerde' || w.leaving <= 0.001)));
  }

  private pathPts(from: BInfo, nodes: number[], to: BInfo | null): Pt[] {
    const pts: Pt[] = [{ x: from.b.kapi.x, z: from.b.kapi.z, lane: 0 }];
    if (from.b.baglanti) pts.push({ x: from.b.baglanti.x, z: from.b.baglanti.z, lane: 0 });
    for (const n of nodes) pts.push({ x: this.graph.xs[n], z: this.graph.zs[n], lane: 1 });
    const end = to ?? from;
    if (end.b.baglanti) pts.push({ x: end.b.baglanti.x, z: end.b.baglanti.z, lane: 0 });
    pts.push({ x: end.b.kapi.x, z: end.b.kapi.z, lane: 0 });
    return pts;
  }

  private chooseDest(from: BInfo, w: Walker): BInfo | null {
    const comp = this.graph.comp[from.node];
    const ok = (c: BInfo) => c !== from && c.node >= 0 && this.graph.comp[c.node] === comp;
    let pool: BInfo[];
    if (from.b.type === 'ev') {
      const work = this.dests.filter(ok);
      pool = work.length && Math.random() < LIFE.isOlasilik ? work : this.homes.filter(ok);
    } else {
      const home = this.buildings.get(w.home);
      if (home && ok(home) && Math.random() < 0.8) return home;
      pool = this.homes.filter(ok);
    }
    if (!pool.length) return null;
    // Birkaç rastgele aday arasından en yakını: kısa yolculuklar daha sık.
    let best: BInfo | null = null;
    let bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const c = pick(pool);
      const d = Math.hypot(c.b.x - from.b.x, c.b.z - from.b.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  private startTrip(w: Walker): void {
    let from = this.buildings.get(w.at);
    if (!from) {
      if (!this.homes.length) {
        w.timer = 2;
        return;
      }
      from = pick(this.homes);
      w.at = w.home = from.b.id;
    }
    let pts: Pt[];
    let dest = from;
    const to = from.node >= 0 ? this.chooseDest(from, w) : null;
    const nodes = to ? this.graph.path(from.node, to.node) : null;
    if (to && nodes) {
      pts = this.pathPts(from, nodes, to);
      dest = to;
    } else if (from.node >= 0) {
      // Hedef yok: yakın yolda kısa gezinti ve geri dönüş.
      const walk = this.graph.randomWalk(from.node, 3 + randi(6));
      const back = walk.slice(0, -1).reverse();
      pts = this.pathPts(from, walk.concat(back), null);
    } else {
      // Yol yok: kapı önünde birkaç adım.
      const a = from.b.rot + rand(-1, 1);
      const d = rand(1.2, 2.5);
      const k = from.b.kapi;
      const px = k.x + Math.sin(a) * d;
      const pz = k.z + Math.cos(a) * d;
      pts = [{ x: k.x, z: k.z, lane: 0 }];
      if (!isLake(px, pz)) pts.push({ x: px, z: pz, lane: 0 });
      pts.push({ x: k.x + 0.01, z: k.z, lane: 0 });
    }
    const tr = new Track(pts);
    if (tr.length < 0.3) {
      w.timer = rand(3, 8);
      return;
    }
    w.track = tr;
    w.s = 0;
    w.state = 'yuruyor';
    w.at = dest.b.id;
    tr.at(0, this.tmp);
    w.x = this.tmp.x;
    w.z = this.tmp.z;
    w.yaw = Math.atan2(this.tmp.dx, this.tmp.dz);
  }

  private updateWalkers(dt: number, cam: THREE.Vector3, shadows: boolean): void {
    const far2 = LIFE.uzakMesafe * LIFE.uzakMesafe;
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (w.leaving > 0) w.leaving = Math.max(0.0005, w.leaving - dt / 0.5);
      w.acc += dt;
      const dxc = w.x - cam.x;
      const dzc = w.z - cam.z;
      const far = dxc * dxc + dzc * dzc > far2;
      if (!far || (this.frame + i) % 4 === 0) {
        const step = w.acc;
        w.acc = 0;
        this.stepWalker(w, step);
      }
      if (w.state !== 'yuruyor' || !w.track) continue;
      const tr = w.track;
      const k = LIFE.belirme * w.speed;
      let vis = Math.min(1, w.s / k, (tr.length - w.s) / k);
      if (w.leaving > 0) vis = Math.min(vis, w.leaving);
      vis = Math.max(0, vis);
      const size = w.size * vis;
      if (far && !shadows) {
        // Uzakta: basit çizim.
        this.pushHuman(w.x, heightAt(w.x, w.z) + LIFE.zeminPay, w.z, w.yaw, size, w.color, 0, 0, 0, false);
        continue;
      }
      const pose = this.walkPose(w.phase, w.size);
      this.pushHuman(w.x, heightAt(w.x, w.z) + LIFE.zeminPay, w.z, w.yaw, size, w.color, pose.bob, pose.roll, 0.06, shadows && !far);
    }
    // Biten ayrılanları temizle.
    if (this.frame % 30 === 0) this.walkers = this.walkers.filter((w) => !(w.leaving > 0 && w.leaving <= 0.001));
  }

  private stepWalker(w: Walker, dt: number): void {
    if (w.state === 'icerde') {
      if (w.leaving > 0) return;
      w.timer -= dt;
      if (w.timer <= 0) this.startTrip(w);
      return;
    }
    const tr = w.track;
    if (!tr) {
      w.state = 'icerde';
      return;
    }
    w.s += w.speed * dt;
    w.phase += dt * w.speed;
    if (w.s >= tr.length) {
      w.state = 'icerde';
      w.track = null;
      w.timer = rand(LIFE.icerdeSure[0], LIFE.icerdeSure[1]);
      if (w.leaving > 0) w.leaving = 0.0005;
      return;
    }
    tr.at(w.s, this.tmp);
    w.x = this.tmp.x;
    w.z = this.tmp.z;
    w.yaw = angleLerp(w.yaw, Math.atan2(this.tmp.dx, this.tmp.dz), Math.min(1, dt * 10));
  }

  // ---------- El arabaları ----------

  private updateCarts(dt: number, shadows: boolean): void {
    this.carts.begin();
    const max = this.population >= LIFE.arabaNufus ? (this.population >= LIFE.arabaNufus * 3 ? LIFE.arabaMax : 1) : 0;
    this.cartTimer -= dt;
    if (this.cartTimer <= 0) {
      this.cartTimer = rand(LIFE.arabaAralik[0], LIFE.arabaAralik[1]);
      if (this.cartList.length < max && this.graph.size > 4) this.spawnCart();
    }
    const keep: Cart[] = [];
    for (const c of this.cartList) {
      c.s += LIFE.arabaHiz * dt;
      c.phase += dt * LIFE.arabaHiz;
      const tr = c.track;
      if (c.s >= tr.length) continue;
      keep.push(c);
      tr.at(c.s, this.tmp);
      c.x = this.tmp.x;
      c.z = this.tmp.z;
      c.yaw = angleLerp(c.yaw, Math.atan2(this.tmp.dx, this.tmp.dz), Math.min(1, dt * 6));
      // İten kişi arabanın arkasında.
      c.px = c.x - Math.sin(c.yaw) * 0.52;
      c.pz = c.z - Math.cos(c.yaw) * 0.52;
      const vis = Math.max(0, Math.min(1, c.s / 0.6, (tr.length - c.s) / 0.6));
      const cs = 1.15 * vis;
      if (cs > 0.01) {
        const bump = Math.abs(Math.sin(c.phase * 11)) * 0.015;
        this.e.set(Math.sin(c.phase * 11) * 0.03, c.yaw, Math.sin(c.phase * 7) * 0.03);
        this.q.setFromEuler(this.e);
        this.v.set(c.x, heightAt(c.x, c.z) + LIFE.zeminPay + bump, c.z);
        this.sc.setScalar(cs);
        this.m4.compose(this.v, this.q, this.sc);
        this.carts.push(this.m4);
        if (shadows) {
          this.v.set(c.x, heightAt(c.x, c.z) + LIFE.zeminPay + 0.012, c.z);
          this.q.identity();
          this.sc.set(cs * 1.5, 1, cs * 2);
          this.m4.compose(this.v, this.q, this.sc);
          this.shadow.push(this.m4);
        }
      }
      const pose = this.walkPose(c.phase, 1);
      this.pushHuman(c.px, heightAt(c.px, c.pz) + LIFE.zeminPay, c.pz, c.yaw, vis, c.color, pose.bob, pose.roll * 0.6, 0.18, shadows);
    }
    this.cartList = keep;
    this.carts.end();
  }

  private spawnCart(): void {
    const g = this.graph;
    let src = -1;
    let dst = -1;
    const all = this.dests.concat(this.homes).filter((b) => b.node >= 0);
    if (all.length >= 2) {
      const a = pick(all);
      const cands = all.filter((b) => b !== a && b.node !== a.node && g.comp[b.node] === g.comp[a.node]);
      if (cands.length) {
        src = a.node;
        dst = pick(cands).node;
      }
    }
    if (src < 0) {
      src = randi(g.size);
      dst = randi(g.size);
    }
    const nodes = g.path(src, dst);
    if (!nodes || nodes.length < 4) return;
    const tr = new Track(nodes.map((n) => ({ x: g.xs[n], z: g.zs[n], lane: 1 })));
    if (tr.length < 4) return;
    tr.at(0, this.tmp);
    const yaw = Math.atan2(this.tmp.dx, this.tmp.dz);
    this.cartList.push({ track: tr, s: 0, x: this.tmp.x, z: this.tmp.z, yaw, px: this.tmp.x, pz: this.tmp.z, pyaw: yaw, color: pick(KIYAFET_RENK), phase: 0 });
  }

  // ---------- Pazar ----------

  private updateMarkets(dt: number, shadows: boolean): void {
    for (const m of this.markets) {
      const hc = heightAt(m.b.x, m.b.z) + 0.045;
      for (const p of m.people) {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.timer = rand(1.5, 5);
          p.tx = rand(-0.14, 0.14);
          p.tz = rand(-0.14, 0.14);
        }
        const k = Math.min(1, dt * 1.5);
        const mx = (p.tx - p.ox) * k;
        const mz = (p.tz - p.oz) * k;
        p.ox += mx;
        p.oz += mz;
        p.phase += dt;
        const moving = Math.hypot(p.tx - p.ox, p.tz - p.oz) > 0.03;
        const wp = toWorld(m.b, p.lx + p.ox, p.lz + p.oz);
        const y = Math.max(hc, heightAt(wp.x, wp.z) + 0.02);
        const yaw = m.b.rot + p.yaw + Math.sin(p.phase * 0.7) * 0.25;
        const pose = moving ? this.walkPose(p.phase, p.size) : { bob: Math.max(0, Math.sin(p.phase * 2.2)) * 0.012, roll: Math.sin(p.phase * 1.3) * 0.05 };
        this.pushHuman(wp.x, y, wp.z, yaw, p.size, p.color, pose.bob, pose.roll, 0.04, shadows);
      }
    }
  }

  // ---------- Okul çocukları ----------

  private updateSchools(dt: number, shadows: boolean): void {
    for (const s of this.schools) {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.visible = !s.visible;
        s.timer = s.visible ? rand(LIFE.cocukGorunur[0], LIFE.cocukGorunur[1]) : rand(LIFE.cocukGizli[0], LIFE.cocukGizli[1]);
        if (s.visible) {
          // Kapıdan çıkar.
          for (const k of s.kids) {
            k.lx = rand(-0.2, 0.2);
            k.lz = 0.75;
            k.tx = rand(-1, 1);
            k.tz = rand(0.9, 1.4);
          }
        }
      }
      s.fade = Math.max(0, Math.min(1, s.fade + (s.visible ? dt : -dt) / 0.5));
      if (s.fade <= 0) continue;
      const hc = heightAt(s.b.x, s.b.z) + 0.03;
      for (const k of s.kids) {
        const dx = k.tx - k.lx;
        const dz = k.tz - k.lz;
        const d = Math.hypot(dx, dz);
        k.phase += dt;
        if (d < 0.05) {
          k.timer -= dt;
          if (k.timer <= 0) {
            k.timer = rand(0.3, 1.8);
            k.tx = rand(-1.1, 1.1);
            k.tz = rand(0.9, 1.45);
          }
        } else {
          const sp = Math.min(d, 0.7 * dt);
          k.lx += (dx / d) * sp;
          k.lz += (dz / d) * sp;
          k.yaw = angleLerp(k.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
          k.phase += dt * 0.6;
        }
        const wp = toWorld(s.b, k.lx, k.lz);
        const y = Math.max(hc, heightAt(wp.x, wp.z) + 0.03);
        const moving = d >= 0.05;
        const bob = moving ? Math.abs(Math.sin(k.phase * 11)) * 0.05 * k.size : Math.max(0, Math.sin(k.phase * 6)) * 0.03;
        const roll = moving ? Math.sin(k.phase * 11) * 0.12 : 0;
        this.pushHuman(wp.x, y, wp.z, s.b.rot + k.yaw, k.size * s.fade, k.color, bob, roll, 0.05, shadows);
      }
    }
  }

  // ---------- Çiftçi ----------

  private farmRowZ(row: number): number {
    // Tarla 2.7×2.7; 6 sırt z = −1.03 … 1.03; çiftçi sırtların arasındaki 5 olukta yürür.
    return -1.03 + 0.205 + row * 0.412;
  }

  private updateFarmers(dt: number, shadows: boolean): void {
    for (const f of this.farmers) {
      f.phase += dt;
      let dirx = 0;
      let dirz = 0;
      if (f.mode === 'yuru') {
        f.lx += f.dir * 0.3 * dt;
        dirx = f.dir;
        if (Math.abs(f.lx) > 0.95) {
          f.lx = Math.sign(f.lx) * 0.95;
          f.mode = 'dur';
          f.timer = rand(0.8, 2);
        } else if (Math.random() < dt * 0.08) {
          f.mode = 'dur';
          f.timer = rand(1, 2.5);
        }
      } else if (f.mode === 'dur') {
        f.timer -= dt;
        if (f.timer <= 0) {
          if (Math.abs(f.lx) >= 0.94) {
            if (f.row + f.rowDir > 4 || f.row + f.rowDir < 0) f.rowDir = -f.rowDir;
            f.row += f.rowDir;
            f.mode = 'gec';
          } else f.mode = 'yuru';
        }
      } else {
        const tz = this.farmRowZ(f.row);
        const d = tz - f.lz;
        dirz = Math.sign(d);
        f.lz += Math.sign(d) * Math.min(Math.abs(d), 0.3 * dt);
        if (Math.abs(d) < 0.01) {
          f.lz = tz;
          f.dir = -Math.sign(f.lx) || 1;
          f.mode = 'yuru';
        }
      }
      if (dirx || dirz) f.yaw = angleLerp(f.yaw, Math.atan2(dirx, dirz), Math.min(1, dt * 6));
      const wp = toWorld(f.b, f.lx, f.lz);
      const y = Math.max(heightAt(f.b.x, f.b.z) + 0.09, heightAt(wp.x, wp.z) + 0.02);
      const moving = f.mode !== 'dur';
      // Dururken tırmıkla toprağı eşeler: öne eğilip doğrulur.
      const lean = moving ? 0.05 : 0.12 + Math.max(0, Math.sin(f.phase * 3)) * 0.18;
      const pose = moving ? this.walkPose(f.phase * 0.5, 1) : { bob: 0, roll: 0 };
      this.pushHuman(wp.x, y, wp.z, f.b.rot + f.yaw, 0.95, CIFTCI_RENK, pose.bob, pose.roll, lean, shadows, true);
    }
  }

  // ---------- Ördekler ----------

  /** Etkin harita değişti: ördekler yeni göllere dağıtılır. */
  resetLakes(): void {
    this.duckList.length = 0;
    this.spawnDucks();
  }

  private spawnDucks(): void {
    HARITA.goller.forEach((g, li) => {
      const n = Math.max(2, Math.min(4, Math.round(g.r / 2)));
      for (let i = 0; i < n; i++) {
        let x = g.x;
        let z = g.z;
        for (let t = 0; t < 30; t++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * g.r * 0.6;
          const px = g.x + Math.cos(a) * r;
          const pz = g.z + Math.sin(a) * r;
          if (this.inWater(px, pz, 0.8)) {
            x = px;
            z = pz;
            break;
          }
        }
        this.duckList.push({ lake: li, x, z, yaw: rand(0, Math.PI * 2), speed: 0.3, targetSpeed: 0.3, turn: 0, timer: rand(1, 4), phase: rand(0, 10) });
      }
    });
  }

  private inWater(x: number, z: number, margin: number): boolean {
    if (!isLake(x, z)) return false;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      if (!isLake(x + Math.cos(a) * margin, z + Math.sin(a) * margin)) return false;
    }
    return true;
  }

  private updateDucks(dt: number): void {
    this.ducks.begin();
    for (const d of this.duckList) {
      d.timer -= dt;
      d.phase += dt;
      if (d.timer <= 0) {
        d.timer = rand(2, 6);
        d.turn = rand(-0.5, 0.5);
        d.targetSpeed = Math.random() < 0.2 ? 0.02 : rand(LIFE.ordekHiz[0], LIFE.ordekHiz[1]);
      }
      const hx = Math.sin(d.yaw);
      const hz = Math.cos(d.yaw);
      const ax = d.x + hx * LIFE.ordekBakis;
      const az = d.z + hz * LIFE.ordekBakis;
      if (!isLake(ax, az)) {
        // Kıyıya yaklaştı: göl merkezine doğru dön.
        const g = HARITA.goller[d.lake];
        const want = Math.atan2(g.x - d.x, g.z - d.z);
        d.yaw = angleLerp(d.yaw, want, Math.min(1, dt * 1.6));
        d.speed = Math.max(0.06, d.speed - dt * 0.4);
      } else {
        d.yaw += d.turn * dt;
        d.speed += (d.targetSpeed - d.speed) * Math.min(1, dt);
      }
      const nx = d.x + Math.sin(d.yaw) * d.speed * dt;
      const nz = d.z + Math.cos(d.yaw) * d.speed * dt;
      if (isLake(nx, nz)) {
        d.x = nx;
        d.z = nz;
      }
      const bob = Math.sin(d.phase * 2.1) * 0.012;
      this.e.set(Math.sin(d.phase * 1.7) * 0.05, d.yaw, Math.sin(d.phase * 2.3) * 0.06);
      this.q.setFromEuler(this.e);
      this.v.set(d.x, SU_SEVIYESI - 0.01 + bob, d.z);
      // Kışın göl buz tutar: ördekler mevsim geçişiyle küçülerek gider, ilkbaharda döner.
      const k = 1 - kisW();
      if (k < 0.02) continue;
      this.sc.setScalar(1.25 * k);
      this.m4.compose(this.v, this.q, this.sc);
      this.ducks.push(this.m4);
    }
    this.ducks.end();
  }

  // ---------- Kuşlar ----------

  private spawnFlock(cam: THREE.Vector3, camDist: number): void {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const L = 40 + camDist * 0.8;
    const side = rand(-10, 10);
    const n = 4 + randi(4);
    const birds: Bird[] = [];
    for (let i = 0; i < n; i++) {
      const rank = Math.ceil(i / 2);
      const s = i === 0 ? 0 : i % 2 ? 1 : -1;
      birds.push({ ox: s * rank * 0.9 + rand(-0.15, 0.15), oz: -rank * 1.0 + rand(-0.2, 0.2), oy: rand(-0.3, 0.3), phase: rand(0, 6) });
    }
    this.flocks.push({
      x: cam.x - dx * L - dz * side,
      z: cam.z - dz * L + dx * side,
      y: rand(LIFE.kusYukseklik[0], LIFE.kusYukseklik[1]),
      dx, dz, speed: rand(LIFE.kusHiz[0], LIFE.kusHiz[1]), travelled: 0, length: L * 2, birds,
    });
  }

  private updateBirds(dt: number, cam: THREE.Vector3, camDist: number): void {
    this.flockTimer -= dt;
    if (this.flockTimer <= 0) {
      this.flockTimer = rand(LIFE.kusAralik[0], LIFE.kusAralik[1]);
      if (this.flocks.length < 2) this.spawnFlock(cam, camDist);
    }
    this.birdBody.begin();
    this.birdWing.begin();
    const keep: Flock[] = [];
    for (const f of this.flocks) {
      const mv = f.speed * dt;
      f.x += f.dx * mv;
      f.z += f.dz * mv;
      f.travelled += mv;
      if (f.travelled > f.length) continue;
      keep.push(f);
      const yaw = Math.atan2(f.dx, f.dz);
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const S = LIFE.kusOlcek;
      const k = f.travelled / f.length;
      const vis = Math.min(1, k * 8, (1 - k) * 8);
      for (const b of f.birds) {
        b.phase += dt;
        const wx = f.x + (b.ox * c + b.oz * s) * S;
        const wz = f.z + (-b.ox * s + b.oz * c) * S;
        const wy = f.y + b.oy + Math.sin(this.time * 1.3 + b.phase) * 0.25;
        this.e.set(Math.sin(b.phase * 0.8) * 0.06, yaw + Math.sin(b.phase * 0.5) * 0.08, Math.sin(b.phase * 0.9) * 0.1);
        this.q.setFromEuler(this.e);
        this.v.set(wx, wy, wz);
        this.sc.setScalar(S * vis);
        this.m4.compose(this.v, this.q, this.sc);
        this.birdBody.push(this.m4);
        // Kanat çırpma: ara sıra süzülme.
        const glide = 0.5 + 0.5 * Math.sin(b.phase * 0.6);
        const flap = Math.sin(b.phase * 10) * (0.25 + 0.6 * (1 - glide)) + 0.1;
        for (const side of [1, -1]) {
          this.e.set(0, 0, side * flap);
          this.q.setFromEuler(this.e);
          this.v.set(side * 0.03, 0.01, 0);
          this.sc.set(side, 1, 1);
          this.m4b.compose(this.v, this.q, this.sc);
          this.birdWing.push(this.m4b.premultiply(this.m4));
        }
      }
    }
    this.flocks = keep;
    this.birdBody.end();
    this.birdWing.end();
  }

  // ---------- Duman ----------

  private updateSmoke(dt: number, cam: THREE.Vector3, camDist: number): void {
    const range = Math.max(45, camDist * 1.6);
    const r2 = range * range;
    for (const c of this.chimneys) {
      c.timer -= dt;
      if (c.timer > 0) continue;
      c.timer = rand(LIFE.dumanAralik[0], LIFE.dumanAralik[1]);
      const dx = c.x - cam.x;
      const dz = c.z - cam.z;
      if (dx * dx + dz * dz > r2 || this.puffs.length >= LIFE.dumanMax) continue;
      this.puffs.push({
        x: c.x + rand(-0.04, 0.04), y: c.y, z: c.z + rand(-0.04, 0.04), age: 0, life: LIFE.dumanOmur * rand(0.8, 1.2),
        size: rand(0.7, 1.05), spin: rand(-1, 1), vx: LIFE.dumanRuzgar.x + rand(-0.05, 0.05), vz: LIFE.dumanRuzgar.z + rand(-0.05, 0.05),
      });
    }
    this.smoke.begin();
    const keep: Puff[] = [];
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      keep.push(p);
      const k = p.age / p.life;
      p.y += LIFE.dumanYukselis * dt * (1 - k * 0.5);
      p.x += p.vx * dt * (0.3 + k);
      p.z += p.vz * dt * (0.3 + k);
      // Büyür, sonra küçülerek söner.
      const grow = 0.35 + 1.1 * (1 - Math.pow(1 - k, 2));
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const sz = p.size * grow * fade;
      this.e.set(p.spin * p.age * 0.5, p.spin * p.age, 0);
      this.q.setFromEuler(this.e);
      this.v.set(p.x, p.y, p.z);
      this.sc.set(sz, sz * 0.85, sz);
      this.m4.compose(this.v, this.q, this.sc);
      this.puffCol.copy(this.puffA).lerp(this.puffB, k);
      this.smoke.push(this.m4, this.puffCol);
    }
    this.puffs = keep;
    this.smoke.end();
  }

  /** Şu an görünen yürüyen sayısı (hata ayıklama). */
  get walkerCount(): number {
    return this.walkers.length;
  }
}
