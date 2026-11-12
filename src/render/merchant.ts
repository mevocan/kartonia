import * as THREE from 'three';
import { heightAt } from '../logic/terrain';
import { PALETTE } from './palette';
import { paperTexture, paperEdges } from './paper';
import { ease } from './anim';
import { mergeParts, humanGeometries, poly, slab, type Part } from './life';

// Gezgin tüccar arabası: yoldaki el arabasının (life.ts) büyük, iki tekerlekli "dükkân" hâli.
// Çizgili kağıt tente, sandıklar, çuvallar, kumaş topları ve yanında duran kağıt tüccar.
// Geliş: kağıt gibi açılır ve kenardan yuvarlanarak gelir, tente açılır, tüccar iner.
// Gidiş: tente katlanır, araba geri döner, uzaklaşırken katlanıp kaybolur. Yalnızca çizim.

export interface MerchantSpot {
  x: number;
  z: number;
  yon: number;
}

const M = {
  /** Yol ortasından sağa (yerel +x) kayma: araba yol kenarında durur. */
  yan: 0.6,
  /** Gelişte / gidişte yuvarlanılan mesafe. */
  yuvarlanma: 4,
  /** Geliş süresi ve alt evreleri (sn). */
  gelis: 2.6,
  gelisYuvarlan: 2.0,
  gelisAcil: 0.45,
  tenteAc: [1.85, 2.45] as const,
  figurIn: [2.1, 2.6] as const,
  /** Gidiş süresi ve alt evreleri (sn). */
  gidis: 2.6,
  tenteKapa: 0.45,
  donus: [0.45, 1.0] as const,
  katlan: 0.45,
  tekerR: 0.24,
  figurOlcek: 1.25,
  /** Tüccar figürünün arabaya göre yeri (yerel). */
  figur: { x: -0.42, z: 1.42 },
  /** Figür bakış yönleri (yerel yaw) ve bekleme aralığı (sn). */
  bakislar: [0, 1.1, -0.9, 2.7],
  bakisAralik: [2.5, 6] as const,
};

// ---------- Geometri ----------

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rx = 0, ry = 0): Part {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return { geo: g, color };
}

/** mergeParts çıktılarını (zaten renkli, indekssiz) tek geometride birleştirir. */
function concat(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'normal', 'uv', 'color'] as const;
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const arr: number[] = [];
    let size = 3;
    for (const g of geos) {
      const a = g.getAttribute(n);
      size = a.itemSize;
      for (let i = 0; i < a.count * a.itemSize; i++) arr.push((a.array as ArrayLike<number>)[i]);
    }
    out.setAttribute(n, new THREE.Float32BufferAttribute(arr, size));
  }
  for (const g of geos) g.dispose();
  return out;
}

/** Kasa, şaftlar, direkler ve yük. Ön +z, tabanı y=0 (tekerlek altı). */
function bodyGeometry(): THREE.BufferGeometry {
  const K = PALETTE.tuccarKasa;
  const KK = PALETTE.tuccarKasaKoyu;
  const A = PALETTE.ahsap;
  const parts: Part[] = [
    box(0.7, 0.08, 1.0, 0, 0.36, 0, PALETTE.ahsapAcik), // taban
    box(0.86, 0.05, 0.05, 0, M.tekerR, -0.08, A), // dingil
    box(0.06, 0.1, 0.9, 0, 0.29, 0, A), // alt kiriş
    box(0.7, 0.2, 0.04, 0, 0.5, -0.48, K), // arka tahta
    box(0.7, 0.1, 0.04, 0, 0.45, 0.48, K), // ön tahta
    box(0.74, 0.03, 0.06, 0, 0.61, -0.48, KK),
    box(0.74, 0.03, 0.06, 0, 0.51, 0.48, KK),
  ];
  for (const s of [-1, 1]) {
    parts.push(
      box(0.04, 0.2, 1.0, s * 0.33, 0.5, 0, K), // yan tahta
      box(0.06, 0.03, 1.02, s * 0.33, 0.61, 0, KK), // üst kenar
      box(0.012, 0.045, 0.86, s * 0.356, 0.49, 0, PALETTE.tuccarKusak), // boyalı şerit
      box(0.035, 0.035, 0.64, s * 0.2, 0.3, 0.78, A, 0.22), // şaft
      box(0.03, 0.62, 0.03, s * 0.31, 0.71, -0.44, A), // tente direkleri
      box(0.03, 0.62, 0.03, s * 0.31, 0.71, 0.44, A),
    );
  }
  parts.push(
    box(0.44, 0.03, 0.03, 0, 0.23, 1.07, A), // şaft çubuğu
    box(0.03, 0.23, 0.03, 0, 0.115, 1.05, A), // ön dayanak
  );
  // Yük: sandıklar, çuvallar, kumaş topları.
  parts.push(
    box(0.26, 0.22, 0.26, -0.15, 0.51, -0.27, PALETTE.ahsapAcik, 0, 0.15),
    box(0.22, 0.2, 0.22, 0.13, 0.5, -0.28, PALETTE.kutuk, 0, -0.2),
    box(0.16, 0.14, 0.16, -0.13, 0.69, -0.25, PALETTE.ahsap, 0, 0.5),
  );
  for (const [x, z, r, c] of [[0.14, 0.04, 0.13, PALETTE.bugday], [0.17, 0.27, 0.105, PALETTE.bugdayKoyu]] as [number, number, number, string][]) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, 0.85, 1);
    g.translate(x, 0.4 + r * 0.8, z);
    parts.push({ geo: g, color: c });
  }
  for (const [y, z, c] of [[0.46, 0.1, PALETTE.kumasMor], [0.46, 0.24, PALETTE.kumasTuruncu], [0.565, 0.17, PALETTE.kumasMavi]] as [number, number, string][]) {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 8);
    g.rotateZ(Math.PI / 2);
    g.translate(-0.1, y, z);
    parts.push({ geo: g, color: c });
  }
  return mergeParts(parts);
}

/** Tekerlek: lastik halkası, parmaklar, göbek. Ekseni x, merkezi orijinde. */
function wheelGeometry(): THREE.BufferGeometry {
  const tire = new THREE.TorusGeometry(M.tekerR - 0.03, 0.03, 5, 14);
  tire.rotateY(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.055, 0.055, 0.08, 8);
  hub.rotateZ(Math.PI / 2);
  const parts: Part[] = [{ geo: tire, color: PALETTE.ahsap }, { geo: hub, color: PALETTE.tuccarKusak }];
  for (let i = 0; i < 3; i++) parts.push(box(0.025, (M.tekerR - 0.03) * 2, 0.03, 0, 0, 0, PALETTE.ahsapAcik, (i * Math.PI) / 3));
  return mergeParts(parts);
}

/** Çizgili beşik tente + fistolu saçak. Orijin direk tepesi hizasında (y=0), sırt +0.3. */
function awningGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  const ex = 0.47; // saçak x
  const ey = -0.04;
  const ry = 0.28; // sırt
  const n = 7;
  const L = 1.14;
  const w = L / n;
  const ang = Math.atan2(ry - ey, ex);
  const len = Math.hypot(ex, ry - ey) + 0.03;
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + w * (i + 0.5);
    const c = i % 2 === 0 ? PALETTE.tuccarTente : PALETTE.tuccarTenteAcik;
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(len, 0.022, w);
      g.rotateZ(-s * ang);
      g.translate((s * ex) / 2, (ey + ry) / 2, z);
      parts.push({ geo: g, color: c });
      // Saçak fistosu: yarım daire kağıt.
      const sh = new THREE.Shape();
      sh.absarc(0, 0, w / 2, Math.PI, Math.PI * 2, false);
      sh.closePath();
      const f = slab(sh, 0.014);
      f.rotateY(Math.PI / 2);
      f.translate(s * (ex + 0.012), ey - 0.004, z);
      parts.push({ geo: f, color: c });
    }
  }
  // Ön ve arka alınlık üçgenleri.
  for (const zz of [-L / 2 + 0.01, L / 2 - 0.01]) {
    const tri = slab(poly([-ex + 0.04, ey + 0.02, ex - 0.04, ey + 0.02, 0, ry - 0.02]), 0.016);
    tri.translate(0, 0, zz);
    parts.push({ geo: tri, color: PALETTE.tuccarTente });
  }
  // Sırtta küçük bayrakçık direği.
  parts.push(box(0.02, 0.2, 0.02, 0, ry + 0.1, L / 2 - 0.05, PALETTE.ahsap));
  const fl = slab(poly([0, 0, 0, 0.09, 0.15, 0.045]), 0.01);
  fl.rotateY(-Math.PI / 2);
  fl.translate(0, ry + 0.11, L / 2 - 0.05);
  parts.push({ geo: fl, color: PALETTE.tuccarKusak });
  return mergeParts(parts);
}

/** Tüccar: life.ts insanı, mor kıyafet, kuşak, şapka. Ayak tabanı y=0, ön +z. */
function figureGeometry(): THREE.BufferGeometry {
  const hg = humanGeometries();
  const col = hg.cloth.getAttribute('color');
  const c = new THREE.Color(PALETTE.tuccarKiyafet);
  for (let i = 0; i < col.count; i++) col.setXYZ(i, c.r, c.g, c.b);
  const brim = new THREE.CylinderGeometry(0.1, 0.1, 0.014, 10);
  brim.translate(0, 0.41, 0);
  const crown = new THREE.CylinderGeometry(0.05, 0.058, 0.075, 8);
  crown.translate(0, 0.452, 0);
  const extra = mergeParts([
    { geo: brim, color: PALETTE.tuccarSapka },
    { geo: crown, color: PALETTE.tuccarSapka },
    box(0.19, 0.03, 0.085, 0, 0.2, 0, PALETTE.tuccarKusak),
    box(0.07, 0.08, 0.04, 0.1, 0.17, 0.02, PALETTE.ahsap), // kese
  ]);
  const g = concat([hg.cloth, hg.rest, extra]);
  g.scale(M.figurOlcek, M.figurOlcek, M.figurOlcek);
  return g;
}

// ---------- Araba ----------

type Phase = 'yok' | 'gelis' | 'dur' | 'gidis';

const same = (a: MerchantSpot | null, b: MerchantSpot | null): boolean =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.z - b.z) < 1e-4 && Math.abs(a.yon - b.yon) < 1e-4);

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const span = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

export class MerchantCart {
  readonly root = new THREE.Group();
  private readonly cart = new THREE.Group();
  private readonly awning = new THREE.Group();
  private readonly figure = new THREE.Group();
  private readonly wheels: THREE.Group[] = [];
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly geos: THREE.BufferGeometry[] = [];

  private target: MerchantSpot | null = null;
  private cur: MerchantSpot | null = null;
  private pending: MerchantSpot | null = null;
  private phase: Phase = 'yok';
  private t = 0;
  private time = 0;
  // Canlı poz (gidiş bu anlık pozdan başlar).
  private px = 0;
  private pz = 0;
  private pyaw = 0;
  private bodyS = 0;
  private awnS = 0;
  private figS = 0;
  private start = { x: 0, z: 0, yaw: 0, awn: 0, fig: 0, body: 1 };
  private spin = 0;
  private figYaw = 0;
  private figTarget = 0;
  private figTimer = 3;

  constructor(parent: THREE.Object3D) {
    this.root.name = 'tuccar';
    this.root.visible = false;
    this.root.rotation.order = 'YXZ';
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: paperTexture(), roughness: 0.93, metalness: 0, flatShading: true });
    const add = (g: THREE.BufferGeometry, into: THREE.Object3D, edges: boolean): void => {
      this.geos.push(g);
      const m = new THREE.Mesh(g, this.mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => {};
      into.add(m);
      if (edges) {
        const e = paperEdges(g);
        this.geos.push(e.geometry);
        into.add(e);
      }
    };
    add(bodyGeometry(), this.cart, true);
    const wg = wheelGeometry();
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.4, M.tekerR, -0.08);
      const m = new THREE.Mesh(wg, this.mat);
      m.castShadow = true;
      m.raycast = () => {};
      w.add(m);
      this.cart.add(w);
      this.wheels.push(w);
    }
    this.geos.push(wg);
    add(awningGeometry(), this.awning, true);
    this.awning.position.y = 1.02;
    this.cart.add(this.awning);
    add(figureGeometry(), this.figure, false);
    this.figure.position.set(M.figur.x, 0, M.figur.z);
    this.root.add(this.cart, this.figure);
    parent.add(this.root);
  }

  set(k: MerchantSpot | null, anlik = false): void {
    if (same(this.target, k)) return;
    this.target = k ? { x: k.x, z: k.z, yon: k.yon } : null;
    if (anlik) {
      this.pending = null;
      if (this.target) {
        this.cur = this.target;
        this.phase = 'dur';
        this.pose(this.stopX(), this.stopZ(), this.cur.yon, 1, 1, 1);
      } else {
        this.phase = 'yok';
        this.root.visible = false;
      }
      return;
    }
    if (!this.target) {
      this.pending = null;
      if (this.phase === 'gelis' || this.phase === 'dur') this.startGidis();
      return;
    }
    if (this.phase === 'yok') {
      this.cur = this.target;
      this.startGelis();
    } else if (this.phase === 'gidis') {
      this.pending = this.target;
    } else {
      this.pending = this.target;
      this.startGidis();
    }
  }

  private stopX(): number {
    const c = this.cur!;
    return c.x + Math.cos(c.yon) * M.yan;
  }

  private stopZ(): number {
    const c = this.cur!;
    return c.z - Math.sin(c.yon) * M.yan;
  }

  private startGelis(): void {
    this.phase = 'gelis';
    this.t = 0;
    this.figYaw = this.figTarget = 0;
  }

  private startGidis(): void {
    this.phase = 'gidis';
    this.t = 0;
    this.start = { x: this.px, z: this.pz, yaw: this.pyaw, awn: this.awnS, fig: this.figS, body: this.bodyS };
  }

  /** Pozu uygular: konum arazi yüksekliğine oturur, eğime göre öne/arkaya yatar; tekerlekler yürünen yola göre döner. */
  private pose(x: number, z: number, yaw: number, body: number, awn: number, fig: number): void {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if (this.root.visible) {
      const fwd = (x - this.px) * fx + (z - this.pz) * fz;
      this.spin += fwd / M.tekerR;
    }
    this.px = x;
    this.pz = z;
    this.pyaw = yaw;
    this.bodyS = body;
    this.awnS = awn;
    this.figS = fig;
    const hf = heightAt(x + fx * 0.5, z + fz * 0.5);
    const hb = heightAt(x - fx * 0.5, z - fz * 0.5);
    this.root.position.set(x, (hf + hb) / 2 + 0.02, z);
    this.root.rotation.set(-Math.atan2(hf - hb, 1.0), yaw, 0);
    const vis = body > 0.001;
    this.root.visible = vis;
    // Kağıt gibi açılma: önce yükseklik, en/boy biraz geriden.
    this.cart.scale.set(0.7 + 0.3 * Math.min(1, body), Math.max(body, 0.001), 0.7 + 0.3 * Math.min(1, body));
    for (const w of this.wheels) w.rotation.x = this.spin;
    const a = Math.max(awn, 0.001);
    this.awning.visible = awn > 0.001;
    this.awning.scale.set(0.35 + 0.65 * Math.min(1, a), a, 1);
    this.figure.visible = fig > 0.001;
    this.figure.scale.setScalar(Math.max(fig, 0.001));
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'yok' || !this.cur) return;
    this.t += dt;
    const fx = Math.sin(this.cur.yon);
    const fz = Math.cos(this.cur.yon);
    if (this.phase === 'gelis') {
      const t = this.t;
      const back = M.yuvarlanma * (1 - ease.outCubic(clamp01(t / M.gelisYuvarlan)));
      const body = ease.outBack(clamp01(t / M.gelisAcil));
      const awn = t < M.tenteAc[0] ? 0 : ease.outBack(span(t, M.tenteAc[0], M.tenteAc[1]));
      const fig = t < M.figurIn[0] ? 0 : ease.outBack(span(t, M.figurIn[0], M.figurIn[1]));
      this.pose(this.stopX() - fx * back, this.stopZ() - fz * back, this.cur.yon, body, awn, fig);
      if (t >= M.gelis) this.phase = 'dur';
    } else if (this.phase === 'dur') {
      this.idle(dt);
    } else {
      const t = this.t;
      const s = this.start;
      const awn = s.awn * (1 - ease.outCubic(clamp01(t / M.tenteKapa)));
      const fig = s.fig * (1 - ease.outCubic(clamp01(t / (M.tenteKapa * 0.8))));
      const yaw = s.yaw + Math.PI * ease.inOutSine(span(t, M.donus[0], M.donus[1]));
      const rollT = span(t, M.donus[1], M.gidis);
      const dist = M.yuvarlanma * ease.inCubic(rollT);
      const katlan = span(t, M.gidis - M.katlan, M.gidis);
      const body = s.body * (1 - ease.inCubic(katlan));
      this.pose(s.x + Math.sin(yaw) * dist, s.z + Math.cos(yaw) * dist, yaw, body, awn, fig);
      if (t >= M.gidis) {
        this.phase = 'yok';
        this.root.visible = false;
        if (this.pending) {
          this.cur = this.pending;
          this.pending = null;
          this.startGelis();
        }
      }
    }
    this.figure.rotation.y = this.figYaw;
  }

  /** Dururken: tente hafifçe dalgalanır, tüccar ara sıra başka yöne döner. */
  private idle(dt: number): void {
    const tm = this.time;
    this.awning.rotation.z = Math.sin(tm * 1.7) * 0.012;
    this.awning.scale.y = 1 + Math.sin(tm * 2.3) * 0.02;
    this.awning.scale.x = 1 + Math.sin(tm * 1.9 + 1) * 0.008;
    this.figTimer -= dt;
    if (this.figTimer <= 0) {
      this.figTimer = M.bakisAralik[0] + Math.random() * (M.bakisAralik[1] - M.bakisAralik[0]);
      const opts = M.bakislar.filter((b) => b !== this.figTarget);
      this.figTarget = opts[Math.floor(Math.random() * opts.length)];
    }
    this.figYaw += (this.figTarget - this.figYaw) * Math.min(1, dt * 3);
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}
