import * as THREE from 'three';
import { PALETTE } from './palette';
import { MEVSIM_GLSL, bindMevsim } from './season';

// Kağıt dokusu (canvas ile üretilir) ve malzeme fabrikası. Bütün malzemeler önbelleklidir.

/** Deterministik sözde rastgele (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context yok');
  return [c, ctx];
}

/** Tekrar eden ince kağıt greni + lifler. Neredeyse beyaz; malzeme rengini çarpar. */
function drawPaper(size: number, seed: number, strength: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const r = rng(seed);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 255 - r() * 14 * strength;
    d[i] = n;
    d[i + 1] = n;
    d[i + 2] = n - 2 * strength;
  }
  ctx.putImageData(img, 0, 0);
  // Lifler: kısa, ince, kıvrık çizgiler; kenarlardan taşanlar karşıdan tekrar çizilir (dikişsiz).
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = 4 + r() * 18;
    const a = r() * Math.PI * 2;
    const dark = r() < 0.6;
    ctx.strokeStyle = dark ? `rgba(120,95,70,${0.05 * strength + r() * 0.05 * strength})` : `rgba(255,255,255,${0.3 + r() * 0.3})`;
    ctx.lineWidth = 0.5 + r() * 0.8;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(
          x + ox + Math.cos(a + 0.6) * len * 0.5,
          y + oy + Math.sin(a + 0.6) * len * 0.5,
          x + ox + Math.cos(a) * len,
          y + oy + Math.sin(a) * len,
        );
        ctx.stroke();
      }
    }
  }
  return c;
}

let paperTex: THREE.CanvasTexture | null = null;
export function paperTexture(): THREE.CanvasTexture {
  if (!paperTex) {
    paperTex = new THREE.CanvasTexture(drawPaper(256, 7, 1));
    paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
    paperTex.colorSpace = THREE.SRGBColorSpace;
    paperTex.anisotropy = 4;
  }
  return paperTex;
}

/** Zemin için daha geniş ölçekli doku (aynı tuval, farklı tekrar). */
export function groundPaperTexture(repeat: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(drawPaper(512, 11, 1.4));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Oluklu mukavva kenarı: dikey oluk şeritleri. */
export function corrugatedTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, PALETTE.olukKoyu);
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  // Üst ve alt astar kağıtları
  ctx.fillStyle = PALETTE.olukAstar;
  ctx.fillRect(0, 0, 64, 6);
  ctx.fillRect(0, 58, 64, 6);
  ctx.fillStyle = 'rgba(90,60,30,0.25)';
  ctx.fillRect(0, 6, 64, 1);
  ctx.fillRect(0, 57, 64, 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ahşap masa: yatay damarlar. */
export function woodTexture(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size, size);
  const r = rng(21);
  ctx.fillStyle = PALETTE.masa;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const y0 = r() * size;
    ctx.strokeStyle = `rgba(140,90,50,${0.06 + r() * 0.12})`;
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const y = y0 + Math.sin((x / size) * Math.PI * 2 * (1 + Math.floor(r() * 2)) + i) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Arka plan: yukarıdan aşağı sıcak gradyan. */
export function backgroundTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, PALETTE.arkaUst);
  g.addColorStop(1, PALETTE.arkaAlt);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Malzemeler ----------

const colorMats = new Map<string, THREE.MeshStandardMaterial>();

/** Tek renkli kağıt malzemesi, renk başına önbellekli. */
export function paperMaterial(color: string, doubleSide = false): THREE.MeshStandardMaterial {
  const key = color + (doubleSide ? '|2' : '');
  let m = colorMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      map: paperTexture(),
      roughness: 0.93,
      metalness: 0,
      flatShading: true,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    colorMats.set(key, m);
  }
  return m;
}

export type ModelMatKind = 'base' | 'ghost' | 'ghostBad' | 'secim' | 'yikim';
const modelMats = new Map<ModelMatKind, THREE.MeshStandardMaterial>();

/** Bina modelleri tepe rengi (vertex color) kullanır; bütün binalar bu birkaç malzemeyi paylaşır. */
export function modelMaterial(kind: ModelMatKind): THREE.MeshStandardMaterial {
  let m = modelMats.get(kind);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: paperTexture(),
    roughness: 0.93,
    metalness: 0,
    flatShading: true,
  });
  switch (kind) {
    case 'ghost':
      m.color.set(PALETTE.hayalet);
      m.transparent = true;
      m.opacity = 0.55;
      m.depthWrite = false;
      m.emissive.set(PALETTE.hayalet);
      m.emissiveIntensity = 0.15;
      break;
    case 'ghostBad':
      m.color.set(PALETTE.hayaletKotu);
      m.transparent = true;
      m.opacity = 0.45;
      m.depthWrite = false;
      m.emissive.set(PALETTE.yikim);
      m.emissiveIntensity = 0.35;
      break;
    case 'secim':
      m.emissive.set(PALETTE.secim);
      m.emissiveIntensity = 0.35;
      break;
    case 'yikim':
      m.color.set(PALETTE.yikimTon);
      m.emissive.set(PALETTE.yikim);
      m.emissiveIntensity = 0.4;
      break;
    default:
      break;
  }
  modelMats.set(kind, m);
  return m;
}

const roadMats = new Map<ModelMatKind, THREE.MeshStandardMaterial>();

/** Yol şeridi malzemesi: tepe rengi + polygonOffset (araziyle z-fighting olmasın). */
export function roadMaterial(kind: ModelMatKind): THREE.MeshStandardMaterial {
  let m = roadMats.get(kind);
  if (m) return m;
  m = modelMaterial(kind).clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -4;
  m.side = THREE.DoubleSide;
  if (kind === 'ghost' || kind === 'ghostBad') m.opacity = 0.6;
  roadMats.set(kind, m);
  return m;
}

/** Rüzgâr zamanı (saniye); ağaç malzemesi bunu okur. */
export const ruzgar = { value: 0 };
let treeMat: THREE.MeshStandardMaterial | null = null;

/** Yaprak tepe renklerine mevsim dönüşümü (ağaç malzemesi ve hayalet ağaç ortak kullanır). */
const MEVSIM_RENK_VERTEX = [
  '#include <color_vertex>',
  '#ifdef USE_COLOR',
  'vec3 mvIc = vec3(1.0);',
  '#ifdef USE_INSTANCING_COLOR',
  'mvIc = instanceColor.rgb;',
  '#endif',
  'vec4 mvW = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);',
  '#ifdef USE_INSTANCING',
  'mvW = modelMatrix * instanceMatrix[3];',
  '#endif',
  'float mvSeed = fract(sin(dot(mvW.xz, vec2(12.9898, 78.233))) * 43758.5453);',
  'vColor.rgb = mevsimYaprak(color.rgb, mvSeed) * mvIc;',
  '#endif',
].join('\n');

const treeGhostMats = new Map<'ghost' | 'ghostBad', THREE.MeshStandardMaterial>();

/**
 * Yerleştirme önizlemesindeki hayalet ağaç: hayalet malzemesi (yarı saydam) + mevsim yaprak rengi,
 * böylece sonbaharda / kışın konacak ağaç oyundaki ağaçlarla aynı renkte görünür. Rüzgâr yok.
 */
export function treeGhostMaterial(kind: 'ghost' | 'ghostBad'): THREE.MeshStandardMaterial {
  let m = treeGhostMats.get(kind);
  if (m) return m;
  m = modelMaterial(kind).clone();
  m.onBeforeCompile = (sh) => {
    bindMevsim(sh.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + MEVSIM_GLSL)
      .replace('#include <color_vertex>', MEVSIM_RENK_VERTEX);
  };
  m.customProgramCacheKey = () => `mevsim-${kind}`;
  treeGhostMats.set(kind, m);
  return m;
}

/**
 * Ağaç malzemesi: taban malzemesi + vertex shader'da çok hafif, zamana bağlı rüzgâr eğimi.
 * Instanced ağaçlarda faz, örneğin konumundan gelir (her ağaç biraz farklı sallanır).
 */
export function treeMaterial(): THREE.MeshStandardMaterial {
  if (treeMat) return treeMat;
  const m = modelMaterial('base').clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRuzgar = ruzgar;
    // Mevsim: yeşil yaprak tepe renkleri sonbaharda hardal/terrakota, kışın karlı açık renge kayar.
    bindMevsim(sh.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uRuzgar;\n' + MEVSIM_GLSL)
      .replace('#include <color_vertex>', MEVSIM_RENK_VERTEX)
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float rzFaz = 0.0;',
          '#ifdef USE_INSTANCING',
          'rzFaz = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;',
          '#endif',
          'float rzK = max(transformed.y - 0.15, 0.0);',
          'transformed.x += sin(uRuzgar * 1.6 + rzFaz) * 0.035 * rzK;',
          'transformed.z += sin(uRuzgar * 1.1 + rzFaz * 1.7) * 0.02 * rzK;',
        ].join('\n'),
      );
  };
  m.customProgramCacheKey = () => 'ruzgar-mevsim';
  treeMat = m;
  return m;
}

export type LineMatKind = 'base' | 'ghost' | 'secim' | 'yikim';
const lineMats = new Map<LineMatKind, THREE.LineBasicMaterial>();

/** Katlanmış kağıt kenarı: koyu, ince, hafif saydam. */
export function lineMaterial(kind: LineMatKind = 'base'): THREE.LineBasicMaterial {
  let m = lineMats.get(kind);
  if (m) return m;
  switch (kind) {
    case 'ghost':
      m = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.25, depthWrite: false });
      break;
    case 'secim':
      m = new THREE.LineBasicMaterial({ color: PALETTE.secimKenar });
      break;
    case 'yikim':
      m = new THREE.LineBasicMaterial({ color: PALETTE.yikimKenar });
      break;
    default:
      m = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.42 });
  }
  lineMats.set(kind, m);
  return m;
}

/** Bir geometri için kağıt kenar çizgileri. */
export function paperEdges(geo: THREE.BufferGeometry, thresholdDeg = 25): THREE.LineSegments {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, thresholdDeg), lineMaterial());
  l.raycast = () => {};
  return l;
}

/** Canvas yazı dokuları için yardımcı (etiketler, rozetler). */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function disposeMaterials(): void {
  for (const m of colorMats.values()) m.dispose();
  for (const m of modelMats.values()) m.dispose();
  for (const m of lineMats.values()) m.dispose();
  colorMats.clear();
  modelMats.clear();
  lineMats.clear();
  for (const m of roadMats.values()) m.dispose();
  treeMat?.dispose();
  treeMat = null;
  for (const m of treeGhostMats.values()) m.dispose();
  treeGhostMats.clear();
  roadMats.clear();
  paperTex?.dispose();
  paperTex = null;
}
