import * as THREE from 'three';
import type { BuildingType } from '../../logic/types';
import { BUILDINGS, HOUSE_LEVELS } from '../../data/buildings';
import { EV_DUVAR } from '../palette';
import { modelMaterial, lineMaterial } from '../paper';
import type { Baked, BakedModel, ModelBuilder } from './builder';
import { buildHouse } from './house';
import { buildTree, buildField, buildFlower, TREE_VARIANTS, FLOWER_VARIANTS } from './nature';
import { buildPark, buildBathhouse, buildTheater } from './leisure';
import { buildMill, buildBakery, buildWoodcutter } from './production';
import { buildFountain, buildFountainWater, buildMarket, buildSchool, buildClockTower, ANIT_ASAMA } from './civic';
import { buildHospital, buildBarn, buildFishery, buildQuarry, buildCarpenter } from './extra';
import { buildSheepfold, buildWeaver, buildApiary } from './pastoral';

// Model şablonları: her (tür, seviye, çeşit) için bir kez üretilir, örnekler geometriyi paylaşır.

export interface Spinner {
  part: Baked;
  x: number;
  y: number;
  z: number;
  /** rad/sn, Z ekseni etrafında. */
  speed: number;
}

export interface ModelTemplate {
  body: BakedModel;
  /** Modelin en yüksek noktası (rozet, etiket konumu için). */
  height: number;
  spinner?: Spinner;
  /** Titreşen su parçası (çeşme), model orijininde. */
  ripple?: Baked;
}

const cache = new Map<string, ModelTemplate>();

/** id'ye göre deterministik görünüm çeşidi. */
export function variantFor(type: BuildingType, id: number): number {
  const h = Math.imul(id + 1, 2654435761) >>> 0;
  if (type === 'ev') return h % EV_DUVAR.length;
  if (type === 'agac') return h % TREE_VARIANTS;
  if (type === 'cicek') return h % FLOWER_VARIANTS;
  return 0;
}

/** Ağaç boyu çeşitliliği (id'ye göre 0.8–1.3), çiçekte 0.85–1.15. */
export function sizeFor(type: BuildingType, id: number): number {
  if (type !== 'agac' && type !== 'cicek') return 1;
  const h = Math.imul(id + 7, 2246822519) >>> 0;
  const k = ((h >>> 8) % 1000) / 1000;
  return type === 'agac' ? 0.8 + k * 0.5 : 0.85 + k * 0.3;
}

function fromBuilder(b: ModelBuilder): ModelTemplate {
  const body = b.bake();
  const bb = body.geo.boundingBox;
  return { body, height: bb ? bb.max.y : 1 };
}

/**
 * asama: yalnızca anıt (Saat Kulesi) için inşaat aşaması 0..ANIT_ASAMA (varsayılan tam kule). Her aşama ayrı
 * şablondur; parçalar grup etiketini taşır (PieceBaked.grup = aşama, iskele ISKELE_GRUP).
 */
export function getTemplate(type: BuildingType, level: number, variant: number, asama = ANIT_ASAMA): ModelTemplate {
  const maxLv = type === 'ev' ? HOUSE_LEVELS.length : BUILDINGS[type].yukseltilebilir ? 3 : 1;
  const lv = Math.max(1, Math.min(maxLv, level));
  const as = type === 'saatKulesi' ? Math.max(0, Math.min(ANIT_ASAMA, Math.round(asama))) : ANIT_ASAMA;
  const key = as < ANIT_ASAMA ? `${type}-${lv}-${variant}-a${as}` : `${type}-${lv}-${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let tpl: ModelTemplate;
  switch (type) {
    case 'ev':
      tpl = fromBuilder(buildHouse(lv, variant));
      break;
    case 'agac':
      tpl = fromBuilder(buildTree(variant));
      break;
    case 'tarla':
      tpl = fromBuilder(buildField());
      break;
    case 'cesme':
      tpl = fromBuilder(buildFountain(lv));
      tpl.ripple = buildFountainWater().bake();
      break;
    case 'degirmen': {
      const m = buildMill();
      tpl = fromBuilder(m.body);
      const part = m.blades.bake();
      tpl.spinner = { part, ...m.hub, speed: 0.9 };
      tpl.height = Math.max(tpl.height, m.hub.y + 1.4);
      break;
    }
    case 'firin':
      tpl = fromBuilder(buildBakery());
      break;
    case 'oduncu':
      tpl = fromBuilder(buildWoodcutter());
      break;
    case 'pazar':
      tpl = fromBuilder(buildMarket(lv));
      break;
    case 'okul':
      tpl = fromBuilder(buildSchool(lv));
      break;
    case 'saatKulesi':
      tpl = fromBuilder(buildClockTower(as));
      break;
    case 'hastane':
      tpl = fromBuilder(buildHospital(lv));
      break;
    case 'ambar':
      tpl = fromBuilder(buildBarn());
      break;
    case 'balikci':
      tpl = fromBuilder(buildFishery());
      break;
    case 'tasOcagi':
      tpl = fromBuilder(buildQuarry());
      break;
    case 'marangoz':
      tpl = fromBuilder(buildCarpenter());
      break;
    case 'agil':
      tpl = fromBuilder(buildSheepfold());
      break;
    case 'dokumaci':
      tpl = fromBuilder(buildWeaver());
      break;
    case 'arilik':
      tpl = fromBuilder(buildApiary());
      break;
    case 'cicek':
      tpl = fromBuilder(buildFlower(variant));
      break;
    case 'park':
      tpl = fromBuilder(buildPark());
      break;
    case 'hamam':
      tpl = fromBuilder(buildBathhouse(lv));
      break;
    case 'tiyatro':
      tpl = fromBuilder(buildTheater(lv));
      break;
  }
  cache.set(key, tpl);
  return tpl;
}

function bakedObject(b: Baked): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(b.geo, modelMaterial('base'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'govde';
  const lines = new THREE.LineSegments(b.edges, lineMaterial('base'));
  lines.raycast = () => {};
  lines.name = 'kenar';
  g.add(mesh, lines);
  return g;
}

/** Şablondan sahneye konabilir bir model örneği. */
export function instantiate(tpl: ModelTemplate): THREE.Group {
  const g = bakedObject(tpl.body);
  if (tpl.spinner) {
    const s = bakedObject(tpl.spinner.part);
    s.position.set(tpl.spinner.x, tpl.spinner.y, tpl.spinner.z);
    s.name = 'kanat';
    s.userData.speed = tpl.spinner.speed;
    g.add(s);
  }
  if (tpl.ripple) {
    const r = bakedObject(tpl.ripple);
    r.name = 'su';
    g.add(r);
  }
  return g;
}

/** Örnekteki bütün gövde/kenar nesneleri. */
export function forEachPart(root: THREE.Object3D, fn: (o: THREE.Mesh | THREE.LineSegments) => void): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) fn(o);
  });
}

export function disposeTemplates(): void {
  for (const t of cache.values()) {
    t.body.geo.dispose();
    t.body.edges.dispose();
    t.spinner?.part.geo.dispose();
    t.spinner?.part.edges.dispose();
    t.ripple?.geo.dispose();
    t.ripple?.edges.dispose();
  }
  cache.clear();
}
