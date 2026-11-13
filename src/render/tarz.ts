// Çizim tarzı (deneme): 'kagit' bugünkü kağıt maket, 'cizgi' çizgi film (toon gölgeleme + kalın dış hat).
// Adres çubuğunda ?tarz=cizgi ya da ?tarz=kagit; seçim localStorage'da kalır. Varsayılan kağıt.
import * as THREE from 'three';

export type Tarz = 'kagit' | 'cizgi';

const ANAHTAR = 'kagit-kasaba-tarz';

function oku(): Tarz {
  try {
    const q = new URLSearchParams(location.search).get('tarz');
    if (q === 'cizgi' || q === 'kagit') {
      localStorage.setItem(ANAHTAR, q);
      return q;
    }
    if (localStorage.getItem(ANAHTAR) === 'cizgi') return 'cizgi';
  } catch {
    /* tarayıcı dışı (testler) ya da depolama yok */
  }
  return 'kagit';
}

export const TARZ: Tarz = typeof window === 'undefined' ? 'kagit' : oku();
export const CIZGI = TARZ === 'cizgi';

/** Dış hat ve kenar rengi (çizgi film). */
export const HAT_RENGI = '#2a211c';

let gradyan: THREE.DataTexture | null = null;

/** Toon gölgeleme basamakları: gölge, yarı ışık, tam ışık. NearestFilter ile keskin geçiş. */
export function toonGradyan(): THREE.DataTexture {
  if (gradyan) return gradyan;
  const veri = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  gradyan = new THREE.DataTexture(veri, 3, 1, THREE.RGBAFormat);
  gradyan.minFilter = THREE.NearestFilter;
  gradyan.magFilter = THREE.NearestFilter;
  gradyan.generateMipmaps = false;
  gradyan.needsUpdate = true;
  return gradyan;
}

/** Doygunluk artışı (GLSL, color_vertex sonrası): çizgi filmde renkler biraz daha canlı. */
export const DOYGUNLUK_GLSL = [
  '#ifdef USE_COLOR',
  'vColor.rgb = clamp(mix(vec3(dot(vColor.rgb, vec3(0.299, 0.587, 0.114))), vColor.rgb, 1.2), 0.0, 1.0);',
  '#endif',
].join('\n');

const hatMats = new Map<number, THREE.MeshBasicMaterial>();

/** Ters kabuk dış hattı: arka yüzler, tepe normali boyunca `kalinlik` kadar dışa itilir. */
export function hatMalzemesi(kalinlik = 0.05): THREE.MeshBasicMaterial {
  let m = hatMats.get(kalinlik);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: HAT_RENGI, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position) + normalize(normal) * ${kalinlik.toFixed(4)};`,
    );
  };
  m.customProgramCacheKey = () => `hat-${kalinlik}`;
  hatMats.set(kalinlik, m);
  return m;
}
