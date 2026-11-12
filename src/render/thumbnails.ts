import * as THREE from 'three';
import type { BuildingType } from '../logic/types';
import { PALETTE } from './palette';
import { getTemplate, instantiate } from './models/index';

// Menü kartları için bina resimleri: oyundaki modelin kendisi, sabit bir açıdan, şeffaf arka planla.
// Ayrı, geçici bir WebGL çizicisiyle bir kez üretilir (data URL) ve önbellekte tutulur.

const cache = new Map<BuildingType, string>();

/** Bütün türlerin resimlerini üretir (önbellekte olanlar atlanır). `size` piksel kenar. */
export function renderThumbnails(types: BuildingType[], size = 128): void {
  const eksik = types.filter((t) => !cache.has(t));
  if (eksik.length === 0) return;

  let gl: THREE.WebGLRenderer;
  try {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return; // WebGL yoksa kartlar resimsiz kalır
  }
  gl.setPixelRatio(1);
  gl.setSize(size, size, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;
  gl.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(PALETTE.gokIsik, PALETTE.yerIsik, 1.9));
  const sun = new THREE.DirectionalLight(PALETTE.gunesOgle, 2.0);
  sun.position.set(-3, 6, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  // Önü (+z) hafif yandan, yukarıdan bakış.
  const yon = new THREE.Vector3(0.55, 0.62, 1).normalize();

  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  for (const t of eksik) {
    const model = instantiate(getTemplate(t, 1, 0));
    scene.add(model);
    box.setFromObject(model);
    box.getBoundingSphere(sphere);
    const uzak = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.74;
    camera.position.copy(sphere.center).addScaledVector(yon, uzak);
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
    cache.set(t, gl.domElement.toDataURL('image/png'));
    scene.remove(model);
  }

  gl.dispose();
  gl.forceContextLoss();
}

/** Üretilmiş resim; yoksa null. */
export function getThumbnail(type: BuildingType): string | null {
  return cache.get(type) ?? null;
}
