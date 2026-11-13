import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, hashStr } from '../paper';

// Prosedürel kağıt model kurucu.
// Parçalar "parça grubu" (piece) olarak toplanır; her grubun bir rolü ve isteğe bağlı menteşesi vardır.
// Kurulma animasyonunda gruplar ayrı mesh olarak oynatılır; bitince hepsi tek birleştirilmiş mesh'e geçer.

export type Role = 'taban' | 'duvar' | 'govde' | 'cati' | 'detay';

export interface Hinge {
  /** Menteşe noktası (Place koordinatlarında; çerçeve uygulanır). */
  o: [number, number, number];
  axis: [number, number, number];
  /** Açık (kurulmamış) konumdaki dönüş açısı; kurulunca 0. */
  angle: number;
}

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Elle kesilmiş eğiklik (radyan, deterministik). */
  wob?: number;
  edges?: boolean;
  edgeDeg?: number;
  /** Gece ışık yanar (pencere camı): `isik` tepe niteliği 1 olur, model malzemesi geceleyin parlatır. */
  isik?: boolean;
}

export interface Baked {
  geo: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
}

export interface PieceBaked extends Baked {
  role: Role;
  /** Parça grubu etiketi (ModelBuilder.grup; ör. anıt aşaması). Varsayılan 0. */
  grup: number;
  hinge?: { o: THREE.Vector3; axis: THREE.Vector3; angle: number };
  center: THREE.Vector3;
  bottom: number;
}

export interface BakedModel extends Baked {
  pieces: PieceBaked[];
}

interface PieceAcc {
  role: Role;
  grup: number;
  hinge?: { o: THREE.Vector3; axis: THREE.Vector3; angle: number };
  geos: THREE.BufferGeometry[];
  edges: THREE.BufferGeometry[];
}

const tmpColor = new THREE.Color();
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

export class ModelBuilder {
  private pieces: PieceAcc[] = [];
  private cur: PieceAcc | null = null;
  private role: Role = 'detay';
  private r: () => number;
  defaultWob = 0.012;
  private frame: THREE.Matrix4 | null = null;
  /** Bundan sonra açılan parça gruplarının etiketi (anıt aşamaları gibi). */
  grup = 0;
  /**
   * bake() yalnızca bunu geçen grupları tutar. Atılan parçalar da üretilir (rastgele sıra kaymasın,
   * böylece kalan parçalar tam modeldekiyle birebir aynı olur).
   */
  keep: ((grup: number) => boolean) | null = null;

  constructor(key: string) {
    this.r = rng(hashStr(key));
  }

  rand(): number {
    return this.r();
  }

  /** fn içinde eklenen parçalar (x, z, ry) çerçevesine göre konumlanır. */
  withFrame(x: number, z: number, ry: number, fn: () => void, y = 0): void {
    const prev = this.frame;
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.frame = prev ? prev.clone().multiply(m) : m;
    fn();
    this.frame = prev;
  }

  /** fn içindeki bütün parçalar tek bir grup olur (birlikte hareket eder). */
  piece(role: Role, fn: () => void, hinge?: Hinge): void {
    if (this.cur) {
      fn();
      return;
    }
    const acc: PieceAcc = { role, grup: this.grup, geos: [], edges: [] };
    if (hinge) {
      const o = new THREE.Vector3(...hinge.o);
      const axis = new THREE.Vector3(...hinge.axis);
      if (this.frame) {
        o.applyMatrix4(this.frame);
        axis.transformDirection(this.frame);
      }
      acc.hinge = { o, axis: axis.normalize(), angle: hinge.angle };
    }
    this.cur = acc;
    fn();
    this.cur = null;
    if (acc.geos.length) this.pieces.push(acc);
  }

  /** fn içinde tek tek eklenen parçaların varsayılan rolü. */
  as(role: Role, fn: () => void): void {
    const prev = this.role;
    this.role = role;
    fn();
    this.role = prev;
  }

  private matrix(p: Place, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
    const w = p.wob ?? this.defaultWob;
    const e = new THREE.Euler(
      (p.rx ?? 0) + (this.r() - 0.5) * w,
      (p.ry ?? 0) + (this.r() - 0.5) * w * 2,
      (p.rz ?? 0) + (this.r() - 0.5) * w,
      'YXZ',
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0),
      new THREE.Quaternion().setFromEuler(e),
      new THREE.Vector3(sx, sy, sz),
    );
  }

  add(src: THREE.BufferGeometry, color: string, p: Place = {}, sx = 1, sy = 1, sz = 1): void {
    const g = src.index ? src.toNonIndexed() : src.clone();
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.applyMatrix4(this.matrix(p, sx, sy, sz));
    if (this.frame) g.applyMatrix4(this.frame);
    tmpColor.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmpColor.r;
      col[i * 3 + 1] = tmpColor.g;
      col[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // Bütün parçalarda aynı nitelik kümesi olsun (birleştirme için): ışıksız parçada 0.
    g.setAttribute('isik', new THREE.BufferAttribute(new Float32Array(n).fill(p.isik ? 1 : 0), 1));
    const eg = p.edges !== false ? new THREE.EdgesGeometry(g, p.edgeDeg ?? 25) : null;
    let acc = this.cur;
    if (!acc) {
      acc = { role: this.role, grup: this.grup, geos: [], edges: [] };
      this.pieces.push(acc);
    }
    acc.geos.push(g);
    if (eg) acc.edges.push(eg);
  }

  box(w: number, h: number, d: number, color: string, p: Place = {}): void {
    this.add(unitBox, color, p, w, h, d);
  }

  plate(w: number, h: number, color: string, p: Place = {}, t = 0.03): void {
    this.add(unitBox, color, { edgeDeg: 25, ...p }, w, h, t);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: string, p: Place = {}): void {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg).translate(0, h / 2, 0);
    this.add(g, color, { edgeDeg: seg > 10 ? 40 : 25, ...p });
    g.dispose();
  }

  cone(r: number, h: number, seg: number, color: string, p: Place = {}): void {
    const g = new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
    if (seg === 4) g.rotateY(Math.PI / 4);
    this.add(g, color, { edgeDeg: seg > 10 ? 40 : 25, ...p });
    g.dispose();
  }

  /**
   * Beşik çatı: mahya X boyunca. İki eğimli plaka; dışarıda çağrılırsa her yarı ayrı 'cati'
   * grubu olur ve mahya ekseni etrafında açık konumdan katlanarak kapanır.
   */
  roof(len: number, span: number, h: number, color: string, p: Place = {}, thick = 0.06): void {
    const slope = Math.hypot(span / 2, h);
    const ang = Math.atan2(h, span / 2);
    const g = new THREE.BoxGeometry(len, thick, slope);
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(0, h / 2, (s * span) / 4),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(s * ang, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      const part = g.clone().applyMatrix4(m);
      const ry = p.ry ?? 0;
      this.piece(
        'cati',
        () => this.add(part, color, { ...p }),
        { o: [p.x ?? 0, (p.y ?? 0) + h, p.z ?? 0], axis: [Math.cos(ry), 0, -Math.sin(ry)], angle: -s * 1.35 },
      );
      part.dispose();
    }
    g.dispose();
  }

  /** Üçgen alın: genişlik span (Z), yükseklik h, kalınlık len (X). */
  gable(len: number, span: number, h: number, color: string, p: Place = {}): void {
    const s = new THREE.Shape();
    s.moveTo(-span / 2, 0);
    s.lineTo(span / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    g.rotateY(Math.PI / 2);
    this.add(g, color, p);
    g.dispose();
  }

  extrude(shape: THREE.Shape, depth: number, color: string, p: Place = {}): void {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -depth / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    this.add(g, color, { edgeDeg: 35, ...p });
    g.dispose();
  }

  ball(r: number, color: string, p: Place = {}): void {
    const g = new THREE.IcosahedronGeometry(r, 0);
    this.add(g, color, { edges: false, ...p });
    g.dispose();
  }

  bake(): BakedModel {
    const allG: THREE.BufferGeometry[] = [];
    const allE: THREE.BufferGeometry[] = [];
    const pieces: PieceBaked[] = [];
    const drop: THREE.BufferGeometry[] = [];
    for (const acc of this.pieces) {
      if (this.keep && !this.keep(acc.grup)) {
        drop.push(...acc.geos, ...acc.edges);
        continue;
      }
      allG.push(...acc.geos);
      allE.push(...acc.edges);
      const geo = mergeGeometries(acc.geos, false);
      if (!geo) continue;
      const edges = acc.edges.length ? (mergeGeometries(acc.edges, false) ?? new THREE.BufferGeometry()) : new THREE.BufferGeometry();
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const bb = geo.boundingBox ?? new THREE.Box3();
      pieces.push({ geo, edges, role: acc.role, grup: acc.grup, hinge: acc.hinge, center: bb.getCenter(new THREE.Vector3()), bottom: bb.min.y });
    }
    const geo = mergeGeometries(allG, false);
    const edges = allE.length ? mergeGeometries(allE, false) : new THREE.BufferGeometry();
    for (const g of allG) g.dispose();
    for (const g of allE) g.dispose();
    for (const g of drop) g.dispose();
    this.pieces = [];
    if (!geo) throw new Error('boş model');
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return { geo, edges: edges ?? new THREE.BufferGeometry(), pieces };
  }
}

/** Ön yüzde pencere: çerçeve + cam + haç (tek detay grubu). */
export function windowAt(b: ModelBuilder, x: number, y: number, z: number, w: number, h: number, frame: string, glass: string, ry = 0): void {
  const dz = 0.016;
  const off = (d: number) => ({ x: x + Math.sin(ry) * d, z: z + Math.cos(ry) * d });
  b.piece('detay', () => {
    b.plate(w + 0.08, h + 0.08, frame, { ...off(dz), y: y - 0.04, ry, wob: 0.02 });
    b.plate(w, h, glass, { ...off(dz * 2.6), y, ry, wob: 0.0, edges: false, isik: true });
    b.plate(0.025, h, frame, { ...off(dz * 3.6), y, ry, wob: 0, edges: false }, 0.02);
    b.plate(w, 0.025, frame, { ...off(dz * 3.6), y: y + h / 2 - 0.012, ry, wob: 0, edges: false }, 0.02);
  });
}

export function doorAt(b: ModelBuilder, x: number, z: number, w: number, h: number, color: string, knob: string, ry = 0): void {
  const off = (d: number) => ({ x: x + Math.sin(ry) * d, z: z + Math.cos(ry) * d });
  b.piece('detay', () => {
    b.plate(w, h, color, { ...off(0.016), y: 0, ry, wob: 0.025 });
    b.ball(0.025, knob, { ...off(0.05), x: x + Math.cos(ry) * w * 0.3 + Math.sin(ry) * 0.05, y: h * 0.48, ry });
  });
}

export interface PanelOpts {
  w: number;
  h: number;
  d: number;
  color: string;
  x?: number;
  y?: number;
  z?: number;
  t?: number;
  /** Yan panellerin üstüne alın üçgeni (beşik çatılı yapılar). */
  gable?: number;
}

/** Dört duvar paneli; her biri alt dış kenarındaki menteşeden dışa yatık konumdan kalkar. */
export function panelBox(b: ModelBuilder, o: PanelOpts): void {
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const z = o.z ?? 0;
  const t = o.t ?? 0.04;
  const A = Math.PI / 2;
  b.piece('duvar', () => b.box(o.w, o.h, t, o.color, { x, y, z: z + o.d / 2 - t / 2, wob: 0 }), { o: [x, y, z + o.d / 2], axis: [1, 0, 0], angle: A });
  for (const s of [-1, 1]) {
    b.piece(
      'duvar',
      () => {
        b.box(t, o.h, o.d - 2 * t, o.color, { x: x + s * (o.w / 2 - t / 2), y, z, wob: 0 });
        if (o.gable) b.gable(t, o.d, o.gable, o.color, { x: x + s * (o.w / 2 - t / 2), y: y + o.h, z, wob: 0 });
      },
      { o: [x + (s * o.w) / 2, y, z], axis: [0, 0, -s], angle: A },
    );
  }
  b.piece('duvar', () => b.box(o.w, o.h, t, o.color, { x, y, z: z - o.d / 2 + t / 2, wob: 0 }), { o: [x, y, z - o.d / 2], axis: [-1, 0, 0], angle: A });
}

export interface ShellOpts {
  w: number;
  d: number;
  wallH: number;
  rh: number;
  wall: string;
  roof: string;
  over?: number;
  x?: number;
  z?: number;
  base?: string;
}

/** Taban + dört duvar paneli (yanlarda alın) + taşan beşik çatı. Mahya X boyunca. Mahya y'sini döndürür. */
export function houseShell(b: ModelBuilder, o: ShellOpts): number {
  const over = o.over ?? 0.12;
  const x = o.x ?? 0;
  const z = o.z ?? 0;
  b.as('taban', () => b.box(o.w + 0.08, 0.06, o.d + 0.08, o.base ?? o.wall, { x, z, wob: 0 }));
  panelBox(b, { w: o.w, h: o.wallH, d: o.d, color: o.wall, x, z, gable: o.rh });
  const span = o.d + over * 2;
  const h = (o.rh * span) / o.d;
  const thick = 0.06;
  const lift = thick / 2 / Math.cos(Math.atan2(o.rh, o.d / 2));
  b.roof(o.w + over * 2, span, h, o.roof, { x, z, y: o.wallH + o.rh - h + lift, wob: 0.006 }, thick);
  return o.wallH + o.rh + lift;
}
