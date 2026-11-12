import * as THREE from 'three';
import type { BuildingType, RoadType, Vec2 } from '../logic/types';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings';
import { heightAt } from '../logic/terrain';
import { DIS_SINIR } from '../data/map';
import type { GameRenderer } from './api';
import { PALETTE, EV_DUVAR } from './palette';
import {
  modelMaterial, lineMaterial, paperMaterial, canvasTexture, disposeMaterials, roadMaterial, treeMaterial, treeGhostMaterial, ruzgar,
} from './paper';
import { createWorld, applyDayProgress, followShadow, updateFog, ZEMIN_R } from './scene';
import { rayTerrain } from './terrain';
import { getThumbnail, renderThumbnails } from './thumbnails';
import { OrbitCamera } from './camera';
import { Tweens, Confetti, FloatLabels, ease } from './anim';
import { createFold, type FoldRun, type FoldOpts } from './fold';
import { buildRoad, revealRoad, roadPointAt, type RoadGeo } from './roads';
import { getTemplate, instantiate, variantFor, sizeFor, forEachPart, disposeTemplates, type ModelTemplate } from './models/index';
import { TREE_VARIANTS } from './models/nature';
import { ANIT_ASAMA, ISKELE_GRUP } from './models/civic';
import type { PieceBaked } from './models/builder';
import { TownLife, type LifeBuilding, type LifeRoad } from './life';
import { Snow, setMevsim, stepMevsim, sonbaharW, kisW } from './season';
import { MerchantCart } from './merchant';

type Look = 'base' | 'ghost' | 'ghostBad' | 'secim' | 'yikim';

/** Kurulma animasyonu hız çarpanı (1 = ~1.2 sn). */
export const KURULUM_HIZI = 1;

interface FoldPlay {
  run: FoldRun;
  t: number;
  speed: number;
  reverse: boolean;
  done: () => void;
  /** kur: ilk kurulum, yik: yıkım / seviye değişiminde eski modelin sökümü, asama: anıt aşama geçişi. */
  kind: 'kur' | 'yik' | 'asama';
}

interface Entry {
  id: number;
  type: BuildingType;
  level: number;
  variant: number;
  tpl: ModelTemplate;
  root: THREE.Group;
  holder: THREE.Group;
  model: THREE.Group;
  /** Eğimde alçak tarafı kapatan temel kutusu (duvar renginde). */
  found: THREE.Mesh | null;
  x: number;
  z: number;
  rot: number;
  link: Vec2 | null;
  path: PathEntry | null;
  ripples: THREE.Object3D[];
  warn: THREE.Sprite | null;
  spinners: THREE.Object3D[];
  fold: FoldPlay | null;
  /** Ağaçlar: instanced havuzdaki yeri (kurulum bitince). */
  pooled: boolean;
  /** Anıt (Saat Kulesi) inşaat aşaması 0..ANIT_ASAMA; diğer binalarda ANIT_ASAMA. */
  asama: number;
}

/** Parçanın göründüğü ilk anıt aşaması (iskele aşama 0'da kurulur). */
function parcaAsama(p: PieceBaked): number {
  return p.grup === ISKELE_GRUP ? 0 : p.grup;
}

interface PathEntry {
  rg: RoadGeo;
  mesh: THREE.Mesh;
  lines: THREE.LineSegments;
  anim: { t: number; dur: number; reverse: boolean } | null;
}

interface RoadEntry {
  id: number;
  tur: RoadType;
  rg: RoadGeo;
  mesh: THREE.Mesh;
  lines: THREE.LineSegments;
  anim: { t: number; dur: number; reverse: boolean; dust: number } | null;
}

const KRAFT = [PALETTE.mukavva, PALETTE.mukavvaAcik, PALETTE.kutuk, PALETTE.krem] as const;
const TOZ = [PALETTE.toprak, PALETTE.kum, PALETTE.kutuk] as const;

function applyLook(model: THREE.Object3D, look: Look, agac = false): void {
  const ghost0 = look === 'ghost' || look === 'ghostBad';
  // Hayalet ağaç mevsim yaprak rengini taşır (oyundaki ağaçlarla aynı görünsün).
  const mm = agac && ghost0 ? treeGhostMaterial(look) : modelMaterial(look);
  const lm = lineMaterial(look === 'ghostBad' ? 'ghost' : look);
  const ghost = look === 'ghost' || look === 'ghostBad';
  forEachPart(model, (o) => {
    if (o instanceof THREE.LineSegments) o.material = lm;
    else {
      o.material = mm;
      o.castShadow = !ghost;
      o.receiveShadow = !ghost;
      o.renderOrder = ghost ? 5 : 0;
    }
  });
}

function findSpinners(model: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  model.traverse((o) => {
    if (o.name === 'kanat') out.push(o);
  });
  return out;
}

function warnTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = 'rgba(60,40,20,0.22)';
    ctx.beginPath();
    ctx.arc(68, 70, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.uyari;
    ctx.beginPath();
    ctx.arc(62, 62, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.kagit;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = PALETTE.uyariYazi;
    ctx.font = 'bold 76px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 62, 66);
  });
}

/**
 * Binanın oturacağı yükseklik: taban çemberinde (merkez + 8 nokta) en düşük ile en yüksek arasında,
 * düşüğe yakın. Yüksek taraf araziye gömülür; alçak taraftaki boşluğu temel kutusu kapatır.
 */
function seat(x: number, z: number, r: number): { y: number; depth: number } {
  let lo = heightAt(x, z);
  let hi = lo;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const h = heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  const y = lo + (hi - lo) * 0.35;
  return { y, depth: y - lo + 0.08 };
}

function findRipples(model: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  model.traverse((o) => {
    if (o.name === 'su') out.push(o);
  });
  return out;
}

/** Temel kutusu rengi: binanın duvar rengi. */
function wallColor(type: BuildingType, variant: number): string {
  switch (type) {
    case 'ev':
      return EV_DUVAR[variant % EV_DUVAR.length];
    case 'firin':
      return PALETTE.seftali;
    case 'okul':
      return PALETTE.terrakota;
    case 'oduncu':
      return PALETTE.ahsapAcik;
    case 'degirmen':
    case 'saatKulesi':
      return PALETTE.tasKoyu;
    case 'cesme':
      return PALETTE.tas;
    case 'pazar':
      return PALETTE.krem;
    case 'hastane':
      return PALETTE.beyaz;
    case 'ambar':
      return PALETTE.kiremit;
    case 'balikci':
      return PALETTE.gokAcik;
    case 'tasOcagi':
      return PALETTE.tasKoyu;
    case 'marangoz':
      return PALETTE.ahsapAcik;
    default:
      return PALETTE.mukavva;
  }
}

interface TreePool {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  ids: number[];
  dirty: boolean;
}

const TINT: Record<Look, THREE.Color> = {
  base: new THREE.Color(1, 1, 1),
  ghost: new THREE.Color(1, 1, 1),
  ghostBad: new THREE.Color(1, 0.5, 0.5),
  secim: new THREE.Color(1.5, 1.35, 0.55),
  yikim: new THREE.Color(1.6, 0.55, 0.5),
};

export function createRenderer(container: HTMLElement): GameRenderer {
  const gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;
  const canvas = gl.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const world = createWorld();
  const cam = new OrbitCamera(canvas, { target: ZEMIN_R, view: DIS_SINIR - 3 });
  const tweens = new Tweens();
  const confetti = new Confetti(world.root, heightAt);
  const labels = new FloatLabels(world.root);
  const entries = new Map<number, Entry>();
  const dying = new Set<THREE.Group>();
  const folds = new Set<FoldPlay>();
  // Mevsim: kar (tek InstancedMesh) ve sis rengi. Arazi/ağaç renkleri season.ts uniform'larıyla.
  const snow = new Snow();
  world.scene.add(snow.mesh);
  const cSis = new THREE.Color(PALETTE.sis);
  const cSisKis = new THREE.Color(PALETTE.sisKis);
  const cSisSonbahar = new THREE.Color(PALETTE.sisSonbahar);
  let sisS = -1;
  let sisK = -1;
  const roads = new Map<number, RoadEntry>();
  const dyingRoads = new Set<RoadEntry>();
  let pickMeshes: THREE.Object3D[] = [];
  let pickDirty = true;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  let time = 0;
  let highlighted: { id: number; mode: 'secim' | 'yikim' } | null = null;
  let roadHl: { id: number; mode: 'secim' | 'yikim' } | null = null;
  applyDayProgress(world, 0.3);

  // Bütün şablonları baştan üret (oyun sırasında takılma olmasın).
  for (const t of BUILDING_ORDER) {
    const vars = t === 'ev' ? EV_DUVAR.length : t === 'agac' ? TREE_VARIANTS : 1;
    const levels = t === 'ev' || BUILDINGS[t].yukseltilebilir ? 3 : 1;
    for (let l = 1; l <= levels; l++) for (let v = 0; v < vars; v++) getTemplate(t, l, v);
  }
  for (let a = 0; a < ANIT_ASAMA; a++) getTemplate('saatKulesi', 1, 0, a);

  // ---------- Ağaç havuzları (çeşit başına tek InstancedMesh) ----------
  const pools = new Map<number, TreePool>();
  const slotOf = new Map<number, { pool: TreePool; slot: number }>();
  const mtx = new THREE.Matrix4();

  function poolFor(variant: number, need: number): TreePool {
    let p = pools.get(variant);
    if (p && p.mesh.instanceMatrix.count >= need) return p;
    const geo = getTemplate('agac', 1, variant).body.geo;
    const cap = Math.max(64, need * 2);
    const mesh = new THREE.InstancedMesh(geo, treeMaterial(), cap);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    for (let i = 0; i < cap; i++) mesh.setColorAt(i, TINT.base);
    if (p) {
      mesh.instanceMatrix.array.set(p.mesh.instanceMatrix.array);
      if (p.mesh.instanceColor && mesh.instanceColor) mesh.instanceColor.array.set(p.mesh.instanceColor.array);
      mesh.count = p.mesh.count;
      world.root.remove(p.mesh);
      p.mesh.dispose();
      p.mesh = mesh;
    } else {
      p = { mesh, geo, ids: [], dirty: true };
      pools.set(variant, p);
    }
    mesh.userData.pool = p;
    world.root.add(mesh);
    pickDirty = true;
    return p;
  }

  function poolAdd(e: Entry): void {
    if (e.pooled) return;
    const p = poolFor(e.variant, (pools.get(e.variant)?.ids.length ?? 0) + 1);
    const slot = p.ids.length;
    p.ids.push(e.id);
    e.root.updateMatrixWorld(true);
    p.mesh.setMatrixAt(slot, e.root.matrixWorld);
    p.mesh.setColorAt(slot, TINT[lookFor(e)]);
    p.mesh.count = p.ids.length;
    p.mesh.instanceMatrix.needsUpdate = true;
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    p.dirty = true;
    slotOf.set(e.id, { pool: p, slot });
    e.pooled = true;
  }

  function poolRemove(e: Entry): void {
    const at = slotOf.get(e.id);
    if (!at) return;
    const { pool: p, slot } = at;
    const last = p.ids.length - 1;
    if (slot !== last) {
      const moved = p.ids[last];
      p.mesh.getMatrixAt(last, mtx);
      p.mesh.setMatrixAt(slot, mtx);
      const c = new THREE.Color();
      p.mesh.getColorAt(last, c);
      p.mesh.setColorAt(slot, c);
      p.ids[slot] = moved;
      slotOf.set(moved, { pool: p, slot });
    }
    p.ids.pop();
    p.mesh.count = p.ids.length;
    p.mesh.instanceMatrix.needsUpdate = true;
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    p.dirty = true;
    slotOf.delete(e.id);
    e.pooled = false;
  }

  function poolTint(e: Entry): void {
    const at = slotOf.get(e.id);
    if (!at) return;
    at.pool.mesh.setColorAt(at.slot, TINT[lookFor(e)]);
    if (at.pool.mesh.instanceColor) at.pool.mesh.instanceColor.needsUpdate = true;
  }

  const warnTex = warnTexture();
  const warnMat = new THREE.SpriteMaterial({ map: warnTex, depthWrite: false });
  const foundGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);

  // ---------- Canlılık (yürüyen insanlar vb., src/render/life.ts) ----------
  const life = new TownLife(world.root);
  // Gezgin tüccar arabası (render/merchant.ts).
  const merchant = new MerchantCart(world.root);
  const roadData = new Map<number, LifeRoad>();
  let lifeRoadsDirty = false;
  let lifeBuildingsDirty = false;

  function doorOf(e: { type: BuildingType; x: number; z: number; rot: number }, k = 1): Vec2 {
    const r = BUILDINGS[e.type].taban * k;
    return { x: e.x + Math.sin(e.rot) * r, z: e.z + Math.cos(e.rot) * r };
  }

  function flushLife(): void {
    if (lifeRoadsDirty) {
      life.setRoads([...roadData.values()]);
      lifeRoadsDirty = false;
    }
    if (lifeBuildingsDirty) {
      const list: LifeBuilding[] = [];
      for (const e of entries.values()) {
        if (e.type === 'agac' || (e.fold && e.fold.kind !== 'asama')) continue;
        list.push({ id: e.id, type: e.type, x: e.x, z: e.z, rot: e.rot, seviye: e.level, kapi: doorOf(e), baglanti: e.link });
      }
      life.setBuildings(list);
      lifeBuildingsDirty = false;
    }
  }

  // ---------- Patikalar ----------
  const paths = new Set<PathEntry>();

  /** Kapıdan (ön yüz) bağlantı noktasına hafif kavisli hat: önce kapıdan dışarı, sonra yola. */
  function pathPoints(e: Entry, link: Vec2): Vec2[] {
    const start = doorOf(e, 0.55);
    const fx = Math.sin(e.rot);
    const fz = Math.cos(e.rot);
    const d = Math.hypot(link.x - start.x, link.z - start.z);
    const k = Math.min(1.5, Math.max(0.3, d * 0.45));
    const c = { x: start.x + fx * k, z: start.z + fz * k };
    const out: Vec2[] = [];
    const n = Math.max(4, Math.ceil(d / 0.35));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const cc = t * t;
      out.push({ x: a * start.x + b * c.x + cc * link.x, z: a * start.z + b * c.z + cc * link.z });
    }
    return out;
  }

  function disposePath(p: PathEntry): void {
    world.root.remove(p.mesh, p.lines);
    p.mesh.geometry.dispose();
    p.lines.geometry.dispose();
    paths.delete(p);
  }

  function removePath(e: Entry, animate: boolean): void {
    const p = e.path;
    if (!p) return;
    e.path = null;
    if (!animate) {
      disposePath(p);
      return;
    }
    const k0 = p.anim && !p.anim.reverse ? p.anim.t / p.anim.dur : 1;
    p.anim = { t: (1 - k0) * 0.3, dur: 0.3, reverse: true };
  }

  function makePath(e: Entry, animate: boolean): void {
    removePath(e, false);
    if (!e.link || e.type === 'agac') return;
    const rg = buildRoad('patika', pathPoints(e, e.link), e.id);
    if (!rg) return;
    const mesh = new THREE.Mesh(rg.geo, roadMaterial('base'));
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    const lines = new THREE.LineSegments(rg.edges, lineMaterial('base'));
    lines.raycast = () => {};
    world.root.add(mesh, lines);
    const p: PathEntry = {
      rg,
      mesh,
      lines,
      anim: animate ? { t: 0, dur: Math.min(0.6, Math.max(0.25, rg.length / 6)), reverse: false } : null,
    };
    revealRoad(rg, mesh, lines, animate ? 0 : 1);
    e.path = p;
    paths.add(p);
  }

  function pickList(): THREE.Object3D[] {
    if (!pickDirty) return pickMeshes;
    pickMeshes = [];
    for (const p of pools.values()) pickMeshes.push(p.mesh);
    for (const e of entries.values()) {
      forEachPart(e.model, (o) => {
        if (o instanceof THREE.Mesh) {
          o.userData.buildingId = e.id;
          pickMeshes.push(o);
        }
      });
    }
    pickDirty = false;
    return pickMeshes;
  }

  function setNdc(clientX: number, clientY: number): void {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cam.camera);
  }

  function lookFor(e: Entry): Look {
    if (highlighted && highlighted.id === e.id) return highlighted.mode;
    return 'base';
  }

  function placeWarn(e: Entry): void {
    if (e.warn) e.warn.userData.baseY = e.tpl.height + 0.5;
  }

  function dropEntry(e: Entry): void {
    tweens.kill(e);
    entries.delete(e.id);
    if (highlighted?.id === e.id) highlighted = null;
    pickDirty = true;
  }

  function stopFold(e: Entry): void {
    if (!e.fold) return;
    folds.delete(e.fold);
    e.holder.remove(e.fold.run.obj);
    e.fold = null;
  }

  /** Kağıt maket kurulumu / sökümü oynatır. */
  function playFold(
    e: Entry, tpl: ModelTemplate, reverse: boolean, speed: number, done: () => void, startT = 0,
    kind: FoldPlay['kind'] = reverse ? 'yik' : 'kur', opts?: FoldOpts,
  ): FoldPlay {
    const run = createFold(tpl, e.type === 'agac' ? treeMaterial() : undefined, opts);
    e.holder.add(run.obj);
    const fp: FoldPlay = { run, t: startT, speed, reverse, done, kind };
    run.set(reverse ? run.dur - startT : startT);
    folds.add(fp);
    e.fold = fp;
    return fp;
  }

  function buildIn(e: Entry, onDone?: () => void, startT = 0): void {
    e.model.visible = false;
    playFold(e, e.tpl, false, KURULUM_HIZI, () => {
      stopFold(e);
      // Patika en son, kapıdan yola doğru serilir.
      if (!e.path) makePath(e, true);
      lifeBuildingsDirty = true;
      if (e.type === 'agac') poolAdd(e);
      else e.model.visible = true;
      applyLook(e.model, lookFor(e));
      const p = e.root.position;
      confetti.burst(p.x, p.y + e.tpl.height * 0.7, p.z, Math.round(10 + BUILDINGS[e.type].taban * 8));
      confetti.burst(p.x, p.y + 0.1, p.z, 6, KRAFT, 0.45);
      onDone?.();
    }, startT);
  }

  /** Entry'nin modelini verilen şablonla değiştirir (görünür). */
  function swapModel(e: Entry, tpl: ModelTemplate): void {
    e.tpl = tpl;
    e.holder.remove(e.model);
    e.model = instantiate(tpl);
    e.holder.add(e.model);
    e.spinners = findSpinners(e.model);
    e.ripples = findRipples(e.model);
    applyLook(e.model, lookFor(e));
    placeWarn(e);
    pickDirty = true;
  }

  // ---------- Hayalet ----------
  const ghostRoot = new THREE.Group();
  ghostRoot.visible = false;
  world.root.add(ghostRoot);
  let ghostType: BuildingType | null = null;
  let ghostModel: THREE.Group | null = null;
  let ghostValid = true;
  let ghostSpinners: THREE.Object3D[] = [];

  // ---------- Etki halkası (araziye yapışık) ----------
  const ringMat = paperMaterial(PALETTE.halka).clone();
  ringMat.side = THREE.DoubleSide;
  ringMat.polygonOffset = true;
  ringMat.polygonOffsetFactor = -3;
  ringMat.polygonOffsetUnits = -6;
  const fillMat = new THREE.MeshBasicMaterial({
    color: PALETTE.halka,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const ringDash = new THREE.Mesh(new THREE.BufferGeometry(), ringMat);
  ringDash.receiveShadow = true;
  const ringFill = new THREE.Mesh(new THREE.BufferGeometry(), fillMat);
  ringFill.renderOrder = 2;
  const ring = new THREE.Group();
  ring.add(ringFill, ringDash);
  ring.visible = false;
  world.root.add(ring);
  let ringKey = '';

  function buildRing(x: number, z: number, r: number): void {
    const dash: number[] = [];
    const gy = (px: number, pz: number, lift: number) => heightAt(px, pz) + lift;
    const n = Math.max(12, Math.round((Math.PI * 2 * r) / 0.88));
    const arc = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const wob = Math.sin(i * 12.9898) * 0.03;
      const r0 = r - 0.1 + wob;
      const r1 = r + 0.1 + wob;
      const sub = 3;
      for (let k = 0; k < sub; k++) {
        const a0 = i * arc + (k / sub) * arc * 0.62;
        const a1 = i * arc + ((k + 1) / sub) * arc * 0.62;
        const p = [
          [x + Math.cos(a0) * r0, z + Math.sin(a0) * r0],
          [x + Math.cos(a0) * r1, z + Math.sin(a0) * r1],
          [x + Math.cos(a1) * r1, z + Math.sin(a1) * r1],
          [x + Math.cos(a1) * r0, z + Math.sin(a1) * r0],
        ];
        const q = p.map(([px, pz]) => [px, gy(px, pz, 0.07), pz]);
        dash.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
      }
    }
    const fill: number[] = [];
    const rings = Math.max(3, Math.ceil(r / 1.5));
    const segs = 48;
    for (let j = 0; j < rings; j++) {
      const ra = (j / rings) * r;
      const rb = ((j + 1) / rings) * r;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const pt = (rr: number, a: number) => {
          const px = x + Math.cos(a) * rr;
          const pz = z + Math.sin(a) * rr;
          return [px, gy(px, pz, 0.05), pz];
        };
        const A = pt(ra, a0), B = pt(rb, a0), C = pt(rb, a1), D = pt(ra, a1);
        fill.push(...A, ...C, ...B, ...A, ...D, ...C);
      }
    }
    ringDash.geometry.dispose();
    ringFill.geometry.dispose();
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dash, 3));
    dg.computeVertexNormals();
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fill, 3));
    ringDash.geometry = dg;
    ringFill.geometry = fg;
  }

  // ---------- Yol hayaleti ----------
  const roadGhost = new THREE.Mesh(new THREE.BufferGeometry(), roadMaterial('ghost'));
  const roadGhostLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial('ghost'));
  roadGhost.visible = roadGhostLines.visible = false;
  roadGhost.renderOrder = 4;
  roadGhost.raycast = () => {};
  roadGhostLines.raycast = () => {};
  world.root.add(roadGhost, roadGhostLines);

  function roadLook(r: RoadEntry): void {
    const mode = roadHl && roadHl.id === r.id ? roadHl.mode : 'base';
    r.mesh.material = roadMaterial(mode);
    r.lines.material = lineMaterial(mode);
  }

  function disposeRoad(r: RoadEntry): void {
    world.root.remove(r.mesh, r.lines);
    r.mesh.geometry.dispose();
    r.lines.geometry.dispose();
  }

  // ---------- Boyut ----------
  function resize(): void {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    gl.setSize(w, h, false);
    cam.setAspect(w / h);
  }
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(container);

  const api: GameRenderer = {
    canvas,

    addBuilding(id, type, x, z, rot, seviye, anim = true, baglanti = null) {
      const old = entries.get(id);
      if (old) {
        stopFold(old);
        poolRemove(old);
        removePath(old, false);
        world.root.remove(old.root);
        dropEntry(old);
      }
      const level = type === 'ev' || BUILDINGS[type].yukseltilebilir ? seviye : 1;
      const variant = variantFor(type, id);
      const tpl = getTemplate(type, level, variant);
      const taban = BUILDINGS[type].taban;
      const st = type === 'agac' ? { y: heightAt(x, z), depth: 0 } : seat(x, z, taban * 0.85);
      const y = st.y;
      const root = new THREE.Group();
      root.position.set(x, y, z);
      root.rotation.y = rot;
      root.scale.setScalar(sizeFor(type, id));
      const holder = new THREE.Group();
      // Ağaçlar instanced havuzda çizilir; model boş bir yer tutucudur.
      const model = type === 'agac' ? new THREE.Group() : instantiate(tpl);
      holder.add(model);
      root.add(holder);
      // Temel: ayak izinden biraz küçük, duvar renginde; alçak taraftaki boşluğu kapatır (daire/kaide yok).
      let found: THREE.Mesh | null = null;
      if (type !== 'agac' && st.depth > 0.1) {
        const bb = tpl.body.geo.boundingBox ?? new THREE.Box3(new THREE.Vector3(-taban * 0.6, 0, -taban * 0.6), new THREE.Vector3(taban * 0.6, 1, taban * 0.6));
        found = new THREE.Mesh(foundGeo, paperMaterial(wallColor(type, variant)));
        found.scale.set((bb.max.x - bb.min.x) * 0.9, st.depth, (bb.max.z - bb.min.z) * 0.9);
        found.position.set((bb.max.x + bb.min.x) / 2, 0.02, (bb.max.z + bb.min.z) / 2);
        found.castShadow = true;
        found.receiveShadow = true;
        found.raycast = () => {};
        root.add(found);
      }
      world.root.add(root);
      const e: Entry = {
        id, type, level, variant, tpl, root, holder, model, found, x, z, rot,
        link: baglanti ? { x: baglanti.x, z: baglanti.z } : null,
        path: null,
        ripples: findRipples(model),
        warn: null,
        spinners: findSpinners(model),
        fold: null,
        pooled: false,
        asama: ANIT_ASAMA,
      };
      entries.set(id, e);
      applyLook(model, lookFor(e));
      pickDirty = true;
      if (!anim) {
        if (type === 'agac') poolAdd(e);
        else {
          makePath(e, false);
          lifeBuildingsDirty = true;
        }
        return;
      }
      if (found) {
        const fz = found.scale.clone();
        tweens.add(e, 0.25, ease.outCubic, (k) => found.scale.set(fz.x * Math.max(0.001, k), fz.y, fz.z * Math.max(0.001, k)));
      }
      buildIn(e);
    },

    removeBuilding(id) {
      const e = entries.get(id);
      if (!e) return;
      poolRemove(e);
      removePath(e, true);
      dropEntry(e);
      lifeBuildingsDirty = true;
      if (e.warn) e.warn.visible = false;
      const root = e.root;
      dying.add(root);
      const finish = () => {
        stopFold(e);
        world.root.remove(root);
        dying.delete(root);
      };
      const p = root.position;
      confetti.burst(p.x, p.y + 0.2, p.z, Math.round(6 + BUILDINGS[e.type].taban * 6), KRAFT, 0.6);
      let startT = 0;
      if (e.fold && e.fold.kind === 'kur') {
        // Kurulurken yıkıldı: bulunduğu yerden geri sar.
        startT = Math.max(0, e.fold.run.dur - e.fold.t);
        stopFold(e);
      }
      e.model.visible = false;
      playFold(e, e.tpl, true, KURULUM_HIZI * 1.7, finish, startT);
      if (e.found) {
        const pl = e.found;
        const s0 = pl.scale.clone();
        tweens.add(root, 0.3, ease.inCubic, (k) => pl.scale.set(s0.x * Math.max(0.001, 1 - k), s0.y, s0.z * Math.max(0.001, 1 - k)), undefined, 0.5);
      }
    },

    setBuildingLevel(id, seviye) {
      const e = entries.get(id);
      if (!e || (e.type !== 'ev' && !BUILDINGS[e.type].yukseltilebilir) || e.level === seviye) return;
      const up = seviye > e.level;
      const oldTpl = e.tpl;
      stopFold(e);
      e.level = seviye;
      e.tpl = getTemplate(e.type, seviye, e.variant);
      e.holder.remove(e.model);
      e.model = instantiate(e.tpl);
      e.model.visible = false;
      e.holder.add(e.model);
      e.spinners = findSpinners(e.model);
      e.ripples = findRipples(e.model);
      applyLook(e.model, lookFor(e));
      placeWarn(e);
      lifeBuildingsDirty = true;
      pickDirty = true;
      // Eski model hızla katlanıp yatar, yenisi katlanarak kurulur.
      playFold(e, oldTpl, true, 2.6, () => {
        stopFold(e);
        buildIn(e, () => {
          if (!up) return;
          const p = e.root.position;
          confetti.burst(p.x, p.y + e.tpl.height, p.z, 20, undefined, 1.1);
        });
      });
    },

    setMonumentStage(id, asama, anim = true) {
      const e = entries.get(id);
      if (!e || e.type !== 'saatKulesi') return;
      const yeni = Math.max(0, Math.min(ANIT_ASAMA, Math.round(asama)));
      if (yeni === e.asama) return;
      const eski = e.asama;
      const oldTpl = e.tpl;
      const tpl = getTemplate(e.type, 1, e.variant, yeni);
      e.asama = yeni;
      const f = e.fold;
      if (f && f.kind === 'kur') {
        // İlk kurulum sürüyor (addBuilding'den hemen sonra çağrı): yeni aşamanın modeli aynı yerden katlanmaya devam eder.
        const t = f.t;
        stopFold(e);
        swapModel(e, tpl);
        buildIn(e, undefined, t);
        return;
      }
      // Süren bir aşama geçişi varsa sonucu atlanır; model doğrudan yeni aşamaya geçer.
      stopFold(e);
      swapModel(e, tpl);
      if (!anim || yeni < eski) return;
      e.model.visible = false;
      const p = e.root.position;
      const ileri = () =>
        playFold(e, tpl, false, KURULUM_HIZI, () => {
          stopFold(e);
          e.model.visible = true;
          applyLook(e.model, lookFor(e));
          if (yeni === ANIT_ASAMA) {
            // Tamamlandı: bol konfeti.
            confetti.burst(p.x, p.y + tpl.height, p.z, 44, undefined, 1.3);
            confetti.burst(p.x, p.y + tpl.height * 0.5, p.z, 18, undefined, 0.9);
          } else confetti.burst(p.x, p.y + 0.15, p.z, 8, KRAFT, 0.5);
        }, 0, 'asama', { fixed: (q) => parcaAsama(q) <= eski, menteseYok: yeni < ANIT_ASAMA }); // iskele varken duvarlar yerinde büyür
      if (yeni === ANIT_ASAMA) {
        // Önce iskele sökülür (yalnızca iskele parçaları geri katlanır), sonra çatı ve bayrak kurulur.
        confetti.burst(p.x, p.y + 0.15, p.z, 10, KRAFT, 0.6);
        playFold(e, oldTpl, true, KURULUM_HIZI * 1.7, () => {
          stopFold(e);
          ileri();
        }, 0, 'asama', { fixed: (q) => q.grup !== ISKELE_GRUP });
      } else ileri();
    },

    buildingThumbnail(type) {
      renderThumbnails(BUILDING_ORDER);
      return getThumbnail(type);
    },

    rebuildTerrain() {
      world.rebuildTerrain();
      life.resetLakes();
    },

    clearBuildings() {
      for (const e of entries.values()) {
        tweens.kill(e);
        world.root.remove(e.root);
      }
      for (const r of dying) {
        tweens.kill(r);
        world.root.remove(r);
      }
      folds.clear();
      for (const p of [...paths]) disposePath(p);
      lifeBuildingsDirty = true;
      for (const p of pools.values()) {
        p.ids = [];
        p.mesh.count = 0;
        p.dirty = true;
      }
      slotOf.clear();
      entries.clear();
      dying.clear();
      highlighted = null;
      pickMeshes = [];
      pickDirty = true;
      confetti.clear();
    },

    setGhost(type, x, z, rot, valid) {
      if (!type) {
        ghostRoot.visible = false;
        return;
      }
      if (type !== ghostType || !ghostModel) {
        if (ghostModel) ghostRoot.remove(ghostModel);
        ghostModel = instantiate(getTemplate(type, 1, 0));
        ghostRoot.add(ghostModel);
        ghostSpinners = findSpinners(ghostModel);
        ghostType = type;
        applyLook(ghostModel, valid ? 'ghost' : 'ghostBad', type === 'agac');
        ghostValid = valid;
      } else if (valid !== ghostValid) {
        applyLook(ghostModel, valid ? 'ghost' : 'ghostBad', type === 'agac');
        ghostValid = valid;
      }
      ghostRoot.visible = true;
      ghostRoot.position.set(x, (type === 'agac' ? heightAt(x, z) : seat(x, z, BUILDINGS[type].taban * 0.85).y) + 0.03, z);
      ghostRoot.rotation.y = rot;
    },

    showRange(x, z, r) {
      if (r === null || r <= 0) {
        ring.visible = false;
        return;
      }
      const key = `${x.toFixed(2)},${z.toFixed(2)},${r.toFixed(2)}`;
      if (key !== ringKey) {
        buildRing(x, z, r);
        ringKey = key;
      }
      ring.visible = true;
    },

    highlight(id, mode = 'secim') {
      const prev = highlighted ? entries.get(highlighted.id) : undefined;
      highlighted = id === null ? null : { id, mode };
      if (prev) {
        applyLook(prev.model, lookFor(prev));
        poolTint(prev);
      }
      if (id !== null) {
        const e = entries.get(id);
        if (e) {
          applyLook(e.model, lookFor(e));
          poolTint(e);
        }
      }
    },

    setWarning(id, on) {
      const e = entries.get(id);
      if (!e) return;
      if (on && !e.warn) {
        const s = new THREE.Sprite(warnMat);
        s.scale.set(0.62, 0.62, 1);
        s.raycast = () => {};
        s.userData.phase = (id * 0.731) % 6.28;
        e.warn = s;
        placeWarn(e);
        s.position.y = s.userData.baseY;
        e.root.add(s);
      } else if (!on && e.warn) {
        e.root.remove(e.warn);
        e.warn = null;
      }
    },

    addRoad(id, tur, noktalar, anim = true) {
      const old = roads.get(id);
      if (old) {
        roads.delete(id);
        disposeRoad(old);
      }
      const rg = buildRoad(tur, noktalar, id);
      if (!rg) return;
      const mesh = new THREE.Mesh(rg.geo, roadMaterial('base'));
      mesh.receiveShadow = true;
      mesh.userData.roadId = id;
      const lines = new THREE.LineSegments(rg.edges, lineMaterial('base'));
      lines.raycast = () => {};
      world.root.add(mesh, lines);
      const r: RoadEntry = { id, tur, rg, mesh, lines, anim: anim ? { t: 0, dur: Math.min(1, Math.max(0.4, rg.length / 18)), reverse: false, dust: 0 } : null };
      revealRoad(rg, mesh, lines, anim ? 0 : 1);
      roads.set(id, r);
      roadLook(r);
      roadData.set(id, { id, tur, noktalar: noktalar.map((q) => ({ x: q.x, z: q.z })) });
      lifeRoadsDirty = true;
    },

    removeRoad(id) {
      const r = roads.get(id);
      if (!r) return;
      roads.delete(id);
      roadData.delete(id);
      lifeRoadsDirty = true;
      if (roadHl?.id === id) roadHl = null;
      r.mesh.material = roadMaterial('base');
      r.lines.material = lineMaterial('base');
      r.mesh.raycast = () => {};
      const dur = Math.min(0.7, Math.max(0.3, r.rg.length / 26));
      const k0 = r.anim ? r.anim.t / r.anim.dur : 1;
      r.anim = { t: (1 - k0) * dur, dur, reverse: true, dust: 0 };
      dyingRoads.add(r);
    },

    clearRoads() {
      for (const r of roads.values()) disposeRoad(r);
      for (const r of dyingRoads) disposeRoad(r);
      roads.clear();
      dyingRoads.clear();
      roadData.clear();
      lifeRoadsDirty = true;
      roadHl = null;
    },

    setRoadGhost(tur, noktalar, valid) {
      if (!tur || noktalar.length < 2) {
        roadGhost.visible = roadGhostLines.visible = false;
        return;
      }
      const rg = buildRoad(tur, noktalar, 0, 0.03);
      if (!rg) {
        roadGhost.visible = roadGhostLines.visible = false;
        return;
      }
      roadGhost.geometry.dispose();
      roadGhostLines.geometry.dispose();
      roadGhost.geometry = rg.geo;
      roadGhostLines.geometry = rg.edges;
      roadGhost.material = roadMaterial(valid ? 'ghost' : 'ghostBad');
      roadGhost.visible = roadGhostLines.visible = true;
    },

    highlightRoad(id, mode = 'secim') {
      const prev = roadHl ? roads.get(roadHl.id) : undefined;
      roadHl = id === null ? null : { id, mode };
      if (prev) roadLook(prev);
      if (id !== null) {
        const r = roads.get(id);
        if (r) roadLook(r);
      }
    },

    pickGround(clientX, clientY) {
      setNdc(clientX, clientY);
      const p = rayTerrain(raycaster.ray, hit) ?? raycaster.ray.intersectPlane(groundPlane, hit);
      return p ? { x: p.x, z: p.z } : null;
    },

    pickBuilding(clientX, clientY) {
      const list = pickList();
      if (!list.length) return null;
      setNdc(clientX, clientY);
      const hits = raycaster.intersectObjects(list, false);
      for (const h of hits) {
        const pool = h.object.userData.pool as TreePool | undefined;
        const id = pool ? (h.instanceId !== undefined ? pool.ids[h.instanceId] : undefined) : h.object.userData.buildingId;
        if (typeof id === 'number' && entries.has(id)) return id;
      }
      return null;
    },

    pickRoad(clientX, clientY) {
      if (!roads.size) return null;
      setNdc(clientX, clientY);
      const meshes: THREE.Object3D[] = [];
      for (const r of roads.values()) meshes.push(r.mesh);
      const hits = raycaster.intersectObjects(meshes, false);
      for (const h of hits) {
        const id = h.object.userData.roadId;
        if (typeof id === 'number' && roads.has(id)) return id;
      }
      return null;
    },

    floatText(x, z, text, color) {
      let y = heightAt(x, z) + 1.2;
      for (const e of entries.values()) {
        const dx = e.root.position.x - x;
        const dz = e.root.position.z - z;
        if (dx * dx + dz * dz < 0.5) {
          y = e.root.position.y + e.tpl.height * e.root.scale.y + 0.35;
          break;
        }
      }
      labels.add(x, y, z, text, color);
    },

    setDayProgress(t) {
      applyDayProgress(world, t);
    },

    update(dt) {
      const d = Math.min(Math.max(dt, 0), 0.1);
      time += d;
      cam.update(d);
      tweens.update(d);
      // Kağıt maket katlanmaları
      for (const f of [...folds]) {
        f.t += d * f.speed;
        const done = f.t >= f.run.dur;
        const tt = Math.min(f.t, f.run.dur);
        f.run.set(f.reverse ? f.run.dur - tt : tt);
        if (done) {
          folds.delete(f);
          f.done();
        }
      }
      // Yol serilmesi / sarılması
      const animRoads = [...roads.values(), ...dyingRoads];
      for (const r of animRoads) {
        const a = r.anim;
        if (!a) continue;
        a.t += d;
        const k = Math.min(1, a.t / a.dur);
        const vis = a.reverse ? 1 - k : ease.inOutSine(k);
        revealRoad(r.rg, r.mesh, r.lines, vis);
        a.dust -= d;
        if (a.dust <= 0 && k < 1) {
          a.dust = 0.05;
          roadPointAt(r.rg, vis, tmpV);
          confetti.burst(tmpV.x, tmpV.y + 0.05, tmpV.z, 2, TOZ, 0.35);
        }
        if (k >= 1) {
          r.anim = null;
          if (a.reverse) {
            dyingRoads.delete(r);
            disposeRoad(r);
          }
        }
      }
      // Patikalar: kapıdan yola serilir / yıkımda geri sarılır.
      for (const pth of [...paths]) {
        const a = pth.anim;
        if (!a) continue;
        a.t += d;
        const k = Math.min(1, a.t / a.dur);
        revealRoad(pth.rg, pth.mesh, pth.lines, a.reverse ? 1 - k : ease.outCubic(k));
        if (k >= 1) {
          pth.anim = null;
          if (a.reverse) disposePath(pth);
        }
      }
      confetti.update(d);
      ruzgar.value = time;
      stepMevsim(d);
      {
        const s = sonbaharW();
        const k = kisW();
        if (s !== sisS || k !== sisK) {
          sisS = s;
          sisK = k;
          world.fog.color.copy(cSis).lerp(cSisSonbahar, s * 0.6).lerp(cSisKis, k);
          if (world.scene.background instanceof THREE.Color) world.scene.background.copy(world.fog.color);
        }
        snow.update(d, k, cam.getTarget(), cam.getDistance());
      }
      flushLife();
      life.update(d, cam.getTarget(), cam.getDistance());
      merchant.update(d);
      labels.update(d);
      world.terrain.update(time);
      for (const p of pools.values()) {
        if (p.dirty) {
          p.mesh.computeBoundingSphere();
          p.dirty = false;
        }
      }
      followShadow(world, cam.getTarget());
      updateFog(world, cam.camera);
      for (const e of entries.values()) {
        for (const s of e.spinners) s.rotation.z += (s.userData.speed as number) * d;
        for (const r of e.ripples) {
          // Dökülen su hafifçe titreşir.
          r.scale.y = 1 + Math.sin(time * 14 + e.id) * 0.025;
          r.scale.x = r.scale.z = 1 + Math.sin(time * 9 + e.id * 1.3) * 0.02;
        }
        if (e.warn) {
          const ph = e.warn.userData.phase as number;
          e.warn.position.y = (e.warn.userData.baseY as number) + Math.sin(time * 2.6 + ph) * 0.1;
        }
      }
      if (ghostRoot.visible && ghostModel) {
        for (const s of ghostSpinners) s.rotation.z += 0.9 * d;
        const m = modelMaterial(ghostValid ? 'ghost' : 'ghostBad');
        m.opacity = (ghostValid ? 0.5 : 0.42) + Math.sin(time * 4) * 0.08;
        if (ghostType === 'agac') treeGhostMaterial(ghostValid ? 'ghost' : 'ghostBad').opacity = m.opacity;
      }
      gl.render(world.scene, cam.camera);
    },

    setBuildingLink(id, baglanti) {
      const e = entries.get(id);
      if (!e || e.type === 'agac') return;
      const same = (e.link && baglanti && Math.abs(e.link.x - baglanti.x) < 1e-3 && Math.abs(e.link.z - baglanti.z) < 1e-3) || (!e.link && !baglanti);
      if (same) return;
      e.link = baglanti ? { x: baglanti.x, z: baglanti.z } : null;
      // Kurulum sürüyorsa patika kurulum bitince serilir.
      if (!e.fold || e.fold.kind === 'asama') {
        if (e.link) makePath(e, true);
        else removePath(e, true);
      } else removePath(e, false);
      lifeBuildingsDirty = true;
    },

    setSeason(m, anlik = false) {
      setMevsim(m, anlik);
    },

    setMerchant(konum, anlik = false) {
      merchant.set(konum, anlik);
    },

    setPopulation(nufus) {
      life.setPopulation(nufus);
    },

    setLeftDragPan(on) {
      cam.setLeftDragPan(on);
    },

    focusOn(x, z) {
      cam.focus(x, z);
    },
    getZoom01() {
      return cam.getZoom01();
    },
    isPanning() {
      return cam.isPanning();
    },

    resize,

    dispose() {
      for (const p of pools.values()) {
        world.root.remove(p.mesh);
        p.mesh.dispose();
      }
      pools.clear();
      ro?.disconnect();
      api.clearBuildings();
      api.clearRoads();
      roadGhost.geometry.dispose();
      roadGhostLines.geometry.dispose();
      cam.dispose();
      confetti.dispose();
      labels.dispose();
      ringDash.geometry.dispose();
      ringFill.geometry.dispose();
      ringMat.dispose();
      fillMat.dispose();
      foundGeo.dispose();
      for (const pth of [...paths]) disposePath(pth);
      life.dispose();
      merchant.dispose();
      world.scene.remove(snow.mesh);
      snow.dispose();
      warnTex.dispose();
      warnMat.dispose();
      world.dispose();
      disposeTemplates();
      disposeMaterials();
      gl.dispose();
      canvas.remove();
    },
  };
  return api;
}
