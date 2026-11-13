import * as THREE from 'three';
import { DIS_SINIR, OYUN_YARI_GENISLIK } from '../data/map';
import { PALETTE } from './palette';
import { createTerrain, type Terrain } from './terrain';
import { gece } from './paper';

// Sahne: ekranı dolduran kağıt arazi, güneş + gök ışığı, araziye uyumlu sis.
// Gölge frustumu kamera hedefini izler (texel'e kenetli). Sis uzağı, çizilen arazinin kenarından önce örter.

/** Kamera hedefinin kaydırma sınırı (oynanabilir alan yarı genişliği). */
export const ZEMIN_R = OYUN_YARI_GENISLIK;

const SHADOW_HALF = 45;
const SHADOW_MAP = 2048;
const SIS_UZAK = 190;

export interface World {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  root: THREE.Group;
  terrain: Terrain;
  fog: THREE.Fog;
  /** Etkin harita değişince araziyi yeniden üretir. */
  rebuildTerrain(): void;
  dispose(): void;
}

export function createWorld(): World {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(PALETTE.sis);
  scene.background = fogColor;
  const fog = new THREE.Fog(fogColor, SIS_UZAK * 0.6, SIS_UZAK);
  scene.fog = fog;

  const hemi = new THREE.HemisphereLight(PALETTE.gokIsik, PALETTE.yerIsik, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.gunesOgle, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  const sc = sun.shadow.camera;
  sc.left = -SHADOW_HALF;
  sc.right = SHADOW_HALF;
  sc.top = SHADOW_HALF;
  sc.bottom = -SHADOW_HALF;
  sc.near = 5;
  sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  const terrain = createTerrain();
  scene.add(terrain.group);

  const root = new THREE.Group();
  scene.add(root);

  const world: World = {
    scene,
    sun,
    hemi,
    root,
    terrain,
    fog,
    rebuildTerrain() {
      // Etkin harita (HARITA) değişti: araziyi baştan üret.
      scene.remove(world.terrain.group);
      world.terrain.dispose();
      world.terrain = createTerrain();
      scene.add(world.terrain.group);
    },
    dispose() {
      world.terrain.dispose();
    },
  };
  return world;
}

const cNoon = new THREE.Color(PALETTE.gunesOgle);
const cWarm = new THREE.Color(PALETTE.gunesSicak);
const tmp = new THREE.Color();
const sunDir = new THREE.Vector3(0, 1, 0);

const cAksam = new THREE.Color(PALETTE.gunesAksam);
const cAy = new THREE.Color(PALETTE.ayIsik);
const cGok = new THREE.Color(PALETTE.gokIsik);
const cYer = new THREE.Color(PALETTE.yerIsik);
const cGeceGok = new THREE.Color(PALETTE.geceGok);
const cGeceYer = new THREE.Color(PALETTE.geceYer);

/** Günün aydınlık kısmı: güneş [0, GUN_SONU] boyunca doğudan batıya gider, sonrası gece. */
const GUN_SONU = 0.8;
/** Şafak ve alacakaranlık süresi (gün oranı). */
const GECIS = 0.08;

const yumusak = (x: number): number => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

/**
 * Gece ağırlığı 0..1. Gün 0'da gece biter (şafak), GUN_SONU'na doğru akşam olur, gün sonuna kadar gecedir;
 * böylece gün geçişinde (1 → 0) ışık sıçramaz.
 */
export function geceAgirligi(t: number): number {
  const k = ((t % 1) + 1) % 1;
  if (k < GECIS) return 1 - yumusak(k / GECIS);
  if (k < GUN_SONU - GECIS) return 0;
  if (k < GUN_SONU) return yumusak((k - (GUN_SONU - GECIS)) / GECIS);
  return 1;
}

/**
 * Gün ilerlemesi: gündüz güneş doğudan batıya yay çizer (sabah/akşam sıcak, öğlen nötr); akşam turuncuya
 * döner, gece ay ışığı (soluk mavi) batıdan doğuya geri geçer. Pencereler gece ağırlığıyla yanar (paper.ts gece).
 */
export function applyDayProgress(w: World, t: number): void {
  const k = Math.max(0, Math.min(1, t));
  const g = geceAgirligi(k);
  // Gündüz: 0..GUN_SONU boyunca doğu → batı; gece: batı → doğu (ay). Uçlar birleşir.
  const p = k < GUN_SONU ? k / GUN_SONU : 1 - (k - GUN_SONU) / (1 - GUN_SONU);
  const az = -0.8 + p * 1.6;
  const tepe = Math.sin(p * Math.PI);
  const el = 0.85 + tepe * 0.3;
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  // Akşam: gecenin hemen öncesinde ve şafakta turuncu.
  const aksam = Math.max(0, 1 - Math.abs(g - 0.45) / 0.45) * (k > 0.5 || k < GECIS ? 1 : 0);
  tmp.copy(cNoon).lerp(cWarm, (1 - tepe) * 0.35).lerp(cAksam, aksam * 0.6).lerp(cAy, g);
  w.sun.color.copy(tmp);
  const gunduzGunes = 2.1 + tepe * 0.2;
  w.sun.intensity = gunduzGunes + (0.55 - gunduzGunes) * g;
  w.hemi.intensity = 1.5 + tepe * 0.15 + (0.75 - 1.5) * g;
  w.hemi.color.copy(cGok).lerp(cGeceGok, g);
  w.hemi.groundColor.copy(cYer).lerp(cGeceYer, g);
  gece.value = g;
}

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const upv = new THREE.Vector3();
const center = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Gölge frustumunu hedefin çevresine taşı; ışık uzayında texel'e kenetle (titreme olmasın). */
export function followShadow(w: World, target: THREE.Vector3): void {
  fwd.copy(sunDir).negate();
  right.crossVectors(fwd, WORLD_UP).normalize();
  upv.crossVectors(right, fwd).normalize();
  const texel = (SHADOW_HALF * 2) / SHADOW_MAP;
  center.set(target.x, 0, target.z);
  const cr = center.dot(right);
  const cu = center.dot(upv);
  center.addScaledVector(right, Math.round(cr / texel) * texel - cr);
  center.addScaledVector(upv, Math.round(cu / texel) * texel - cu);
  w.sun.target.position.copy(center);
  w.sun.position.copy(center).addScaledVector(sunDir, 80);
  w.sun.target.updateMatrixWorld();
  w.sun.updateMatrixWorld();
}

const probe = new THREE.Vector3();

/**
 * Sis: çizilen arazinin kenarı (±DIS_SINIR) ekrana girerse, o kenarın en yakın görüş derinliğinden önce
 * tamamen örtülsün; arka plan sis rengi olduğu için boşluk hiç seçilmez.
 */
export function updateFog(w: World, cam: THREE.PerspectiveCamera): void {
  let minDepth = Infinity;
  const L = DIS_SINIR;
  const stepN = 40;
  for (let e = 0; e < 4; e++) {
    for (let i = 0; i <= stepN; i++) {
      const u = -L + (2 * L * i) / stepN;
      const x = e === 0 ? u : e === 1 ? u : e === 2 ? -L : L;
      const z = e === 0 ? -L : e === 1 ? L : u;
      probe.set(x, 0, z).applyMatrix4(cam.matrixWorldInverse);
      const depth = -probe.z;
      if (depth <= 0) continue;
      probe.applyMatrix4(cam.projectionMatrix);
      if (Math.abs(probe.x) > 1.03 || Math.abs(probe.y) > 1.03) continue;
      minDepth = Math.min(minDepth, depth);
    }
  }
  const far = Math.min(SIS_UZAK, minDepth * 0.97);
  w.fog.far = far;
  w.fog.near = far * 0.55;
}
