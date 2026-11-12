import * as THREE from 'three';
import type { Mevsim } from '../logic/season';
import { PALETTE } from './palette';
import { paperTexture } from './paper';

// Mevsim görünümü (yalnızca çizim). İki ağırlık: sonbahar (yapraklar hardal/terrakota, çimen sararır)
// ve kış (zemin kar, yapraklar açık/karlı, göl buz, kar yağar). Ağırlıklar shader uniform'larıdır:
// arazi ve ağaç malzemeleri bunları okur, böylece geçiş her karede tepe renklerini yeniden hesaplamaz.
// Arazi yeniden üretilince (rebuildTerrain) aynı uniform'lar bağlandığı için görünüm korunur.

/** Geçiş süresi (saniye). */
export const MEVSIM_GECIS = 3;

/** Shader'lara bağlanan ortak uniform'lar. */
export const mevsimU = {
  uSonbahar: { value: 0 },
  uKis: { value: 0 },
  uYaprakA: { value: new THREE.Color(PALETTE.yaprakHardal) },
  uYaprakB: { value: new THREE.Color(PALETTE.yaprakTuruncu) },
  uYaprakC: { value: new THREE.Color(PALETTE.yaprakTerrakota) },
  uKarYaprak: { value: new THREE.Color(PALETTE.karYaprak) },
  uCimenSonbahar: { value: new THREE.Color(PALETTE.cimenSonbahar) },
  uKarZemin: { value: new THREE.Color(PALETTE.karZemin) },
};

const HEDEF: Record<Mevsim, [number, number]> = {
  ilkbahar: [0, 0],
  yaz: [0, 0],
  sonbahar: [1, 0],
  kis: [0, 1],
};

let hedef: Mevsim | null = null;

/** Hedef mevsimi ayarla. Aynı mevsim ve anlik değilse hiçbir şey yapmaz. */
export function setMevsim(m: Mevsim, anlik: boolean): void {
  if (m === hedef && !anlik) return;
  hedef = m;
  if (anlik) {
    mevsimU.uSonbahar.value = HEDEF[m][0];
    mevsimU.uKis.value = HEDEF[m][1];
  }
}

/** Ağırlıkları hedefe doğru yumuşakça yürütür. */
export function stepMevsim(dt: number): void {
  if (!hedef) return;
  const [s, k] = HEDEF[hedef];
  const adim = dt / MEVSIM_GECIS;
  const yaklas = (u: { value: number }, t: number) => {
    const d = t - u.value;
    u.value = Math.abs(d) <= adim ? t : u.value + Math.sign(d) * adim;
  };
  yaklas(mevsimU.uSonbahar, s);
  yaklas(mevsimU.uKis, k);
}

/** Yumuşatılmış ağırlıklar (renk karışımı için). */
export function sonbaharW(): number {
  const t = mevsimU.uSonbahar.value;
  return t * t * (3 - 2 * t);
}
export function kisW(): number {
  const t = mevsimU.uKis.value;
  return t * t * (3 - 2 * t);
}

/** GLSL: smoothstep'li ağırlıklar ve yaprak (yeşil tepe rengi) dönüşümü. `seed` 0..1 örnek başına sabit. */
export const MEVSIM_GLSL = /* glsl */ `
uniform float uSonbahar;
uniform float uKis;
uniform vec3 uYaprakA;
uniform vec3 uYaprakB;
uniform vec3 uYaprakC;
uniform vec3 uKarYaprak;
uniform vec3 uCimenSonbahar;
uniform vec3 uKarZemin;
float mvLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 mevsimYaprak(vec3 c, float seed) {
  float yesil = smoothstep(0.0, 0.035, c.g - max(c.r, c.b));
  if (yesil <= 0.0) return c;
  float s = smoothstep(0.0, 1.0, uSonbahar);
  float k = smoothstep(0.0, 1.0, uKis);
  // Parlaklık farkı (iki siluet farklı tonda) korunsun.
  float parl = clamp(0.8 + (mvLum(c) - 0.3) * 1.2, 0.72, 1.15);
  vec3 sb = seed < 0.36 ? uYaprakA : seed < 0.68 ? uYaprakB : seed < 0.9 ? uYaprakC : c;
  vec3 r = mix(c, sb * parl, s * yesil);
  vec3 kar = mix(uKarYaprak, c, 0.14 + seed * 0.12) * clamp(parl * 1.05, 0.85, 1.05);
  return mix(r, kar, k * yesil);
}
vec3 mevsimZemin(vec3 c) {
  float s = smoothstep(0.0, 1.0, uSonbahar);
  float k = smoothstep(0.0, 1.0, uKis);
  vec3 r = mix(c, uCimenSonbahar * (0.82 + mvLum(c) * 0.5), s * 0.42);
  // Kar: hafif renk izi ve tepe parlaklık farkı kalsın (katlanmış kağıt yüzeyleri okunsun).
  vec3 kar = mix(uKarZemin, c, 0.04) * (0.96 + (mvLum(c) - 0.5) * 0.25);
  return mix(r, kar, k * 0.92);
}
`;

/** Malzemeye mevsim uniform'larını bağlar. */
export function bindMevsim(uniforms: Record<string, THREE.IUniform>): void {
  Object.assign(uniforms, mevsimU);
}

// ---------- Kar: düşen beyaz kağıt parçaları (tek InstancedMesh) ----------

const KAR_SAYI = 520;

export class Snow {
  readonly mesh: THREE.InstancedMesh;
  private geo: THREE.PlaneGeometry;
  private mat: THREE.MeshStandardMaterial;
  private px = new Float32Array(KAR_SAYI);
  private py = new Float32Array(KAR_SAYI);
  private pz = new Float32Array(KAR_SAYI);
  private hiz = new Float32Array(KAR_SAYI);
  private faz = new Float32Array(KAR_SAYI);
  private don = new Float32Array(KAR_SAYI);
  private time = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor() {
    this.geo = new THREE.PlaneGeometry(1, 0.78);
    this.mat = new THREE.MeshStandardMaterial({
      color: PALETTE.karTane,
      map: paperTexture(),
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: PALETTE.karTane,
      emissiveIntensity: 0.25,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, KAR_SAYI);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
    let a = 1234567;
    const r = () => {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      return a / 0x7fffffff;
    };
    for (let i = 0; i < KAR_SAYI; i++) {
      // Birim kutuda (-1..1 yatay, 0..1 düşey) konum; dünya ölçeği her karede kameraya göre.
      this.px[i] = r() * 2 - 1;
      this.pz[i] = r() * 2 - 1;
      this.py[i] = r();
      this.hiz[i] = 0.75 + r() * 0.5;
      this.faz[i] = r() * Math.PI * 2;
      this.don[i] = 0.6 + r() * 1.6;
    }
  }

  /** k: kış ağırlığı 0..1. target/dist: kamera hedefi ve uzaklığı. */
  update(dt: number, k: number, target: THREE.Vector3, dist: number): void {
    const n = Math.round(KAR_SAYI * k);
    this.mesh.visible = n > 0;
    this.mesh.count = n;
    if (n === 0) return;
    this.time += dt;
    const t = this.time;
    // Görünen alanı kaplayan kutu: uzaklıkla büyür.
    const R = Math.max(10, dist * 0.75);
    const H = Math.max(8, dist * 0.7);
    const boy = Math.min(2.4, Math.max(0.8, dist / 28)) * 0.16;
    const dusus = (1.3 / H) * dt;
    for (let i = 0; i < n; i++) {
      let y = this.py[i] - dusus * this.hiz[i];
      if (y < 0) {
        y += 1;
        this.px[i] = ((this.px[i] + 1.37) % 2) - 1;
      }
      this.py[i] = y;
      const f = this.faz[i];
      const sal = Math.sin(t * 1.3 * this.don[i] + f) * 0.5;
      this.p.set(
        target.x + this.px[i] * R + sal + t * 0.25,
        target.y - 1 + y * H,
        target.z + this.pz[i] * R + Math.cos(t * 0.9 * this.don[i] + f) * 0.35,
      );
      // Yatay olarak hedefe göre sar (rüzgârla kayma birikmesin).
      const wx = this.p.x - target.x;
      this.p.x = target.x + ((((wx + R) % (2 * R)) + 2 * R) % (2 * R)) - R;
      this.e.set(t * this.don[i] + f, f * 2.0 + t * 0.4, sal * 1.4);
      this.q.setFromEuler(this.e);
      this.s.setScalar(boy * (0.7 + (f / (Math.PI * 2)) * 0.6));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.mesh.dispose();
  }
}
