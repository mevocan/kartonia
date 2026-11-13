import * as THREE from 'three';
import { PALETTE as P } from '../palette';
import { ModelBuilder } from './builder';

// Ağaç (taban 0.5): karton ayak üstünde, çaprazlanmış iki kesik kağıt siluet. 3 çeşit.
// Tarla (taban 2.2): toprak plaka, buğday sırtları, çit.

/** 3 siluet × 2 renk takımı. */
export const TREE_VARIANTS = 6;

function crownRound(): THREE.Shape {
  const s = new THREE.Shape();
  const n = 7;
  const cy = 1.05;
  const R = 0.36;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const px = Math.cos(a) * R;
    const py = cy + Math.sin(a) * R * 1.1;
    if (i === 0) s.moveTo(px, py);
    else s.absarc(px, py, 0.13, a - Math.PI / 2 - 0.4, a + Math.PI / 2 + 0.4, false);
  }
  return s;
}

function crownPine(): THREE.Shape {
  const s = new THREE.Shape();
  const tiers = [
    [0.42, 0.45],
    [0.34, 0.85],
    [0.25, 1.2],
  ];
  s.moveTo(0, 1.75);
  // Sağ taraf aşağı, sol taraf yukarı zikzak
  s.lineTo(tiers[2][0] * 0.55, tiers[2][1] + 0.05);
  s.lineTo(tiers[2][0], tiers[2][1]);
  s.lineTo(tiers[1][0] * 0.6, tiers[1][1] + 0.05);
  s.lineTo(tiers[1][0], tiers[1][1]);
  s.lineTo(tiers[0][0] * 0.6, tiers[0][1] + 0.08);
  s.lineTo(tiers[0][0], tiers[0][1]);
  s.lineTo(-tiers[0][0], tiers[0][1]);
  s.lineTo(-tiers[0][0] * 0.6, tiers[0][1] + 0.08);
  s.lineTo(-tiers[1][0], tiers[1][1]);
  s.lineTo(-tiers[1][0] * 0.6, tiers[1][1] + 0.05);
  s.lineTo(-tiers[2][0], tiers[2][1]);
  s.lineTo(-tiers[2][0] * 0.55, tiers[2][1] + 0.05);
  s.closePath();
  return s;
}

function crownPoplar(): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(0, 1.05, 0.26, 0.62, 0, Math.PI * 2, false, 0);
  return s;
}

function trunk(h: number, w: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0.06);
  s.lineTo(w / 2, 0.06);
  s.lineTo(w * 0.35, h);
  s.lineTo(-w * 0.35, h);
  s.closePath();
  return s;
}

export function buildTree(variant: number): ModelBuilder {
  const b = new ModelBuilder(`agac-${variant}`);
  const v = variant % 3;
  const alt = Math.floor(variant / 3) % 2 === 1;
  // Karton ayak
  b.as('taban', () => b.cyl(0.3, 0.33, 0.06, 10, P.mukavvaAcik, { wob: 0.02 }));
  const crown = v === 0 ? crownRound() : v === 1 ? crownPine() : crownPoplar();
  const greens = alt ? [P.adacayi, P.zeytin, P.yesil] : [P.yesil, P.koyuYesil, P.zeytin];
  const accents = alt ? [P.zeytin, P.adacayi, P.bugdayKoyu] : [P.adacayi, P.yesil, P.adacayi];
  const green = greens[v];
  const accent = accents[v];
  const tr = trunk(v === 1 ? 0.5 : 0.75, 0.14);
  for (let i = 0; i < 2; i++) {
    const ry = (i * Math.PI) / 2 + 0.2;
    b.withFrame(0, 0, ry, () => {
      b.piece(
        'duvar',
        () => {
          b.extrude(tr, 0.04, P.ahsap, { wob: 0.01 });
          b.extrude(crown, 0.05, i === 0 ? green : accent, { wob: 0.015 });
        },
        { o: [0, 0.06, 0], axis: [1, 0, 0], angle: (i === 0 ? 1 : -1) * Math.PI / 2 },
      );
    });
  }
  // Küçük kağıt destek üçgenleri (ayak)
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(0.16, 0);
  tri.lineTo(0, 0.2);
  tri.closePath();
  b.piece('detay', () => {
    for (let i = 0; i < 4; i++) {
      b.withFrame(0, 0, (i * Math.PI) / 2 + 0.2 + Math.PI / 4, () => {
        b.extrude(tri, 0.02, P.mukavva, { y: 0.06, x: 0.05, wob: 0 });
      });
    }
  });
  return b;
}

export function buildField(): ModelBuilder {
  const b = new ModelBuilder('tarla');
  const S = 2.7;
  const half = S / 2;
  b.piece('taban', () => {
    b.box(S, 0.07, S, P.mukavva, { wob: 0.004 });
    b.box(S - 0.2, 0.02, S - 0.2, P.ahsap, { y: 0.07, wob: 0.004, edges: false });
  });
  // Buğday sırtları
  const rows = 6;
  const rowLen = S - 0.45;
  for (let i = 0; i < rows; i++) {
    const z = -half + 0.32 + (i * (S - 0.64)) / (rows - 1);
    const col = i % 2 === 0 ? P.bugday : P.bugdayKoyu;
    b.piece(
      'duvar',
      () => {
        b.gable(rowLen, 0.3, 0.34, col, { y: 0.09, z, wob: 0.03 });
        for (let k = 0; k < 6; k++) {
          const x = -rowLen / 2 + 0.18 + (k * (rowLen - 0.36)) / 5;
          b.cone(0.05, 0.16, 4, P.bugday, { x, y: 0.4, z, wob: 0.2, edges: false });
        }
      },
      { o: [0, 0.09, z], axis: [1, 0, 0], angle: Math.PI / 2 },
    );
  }
  // Çit: köşe ve ara direkler + iki sıra kiriş, önde kapı aralığı.
  const fence = P.kagit;
  const step = S / 5;
  for (let side = 0; side < 4; side++) {
    const ry = (side * Math.PI) / 2;
    b.withFrame(0, 0, ry, () => b.piece('duvar', () => {
      for (let i = 0; i <= 5; i++) {
        const x = -half + i * step;
        if (side === 0 && (i === 2 || i === 3)) {
          b.box(0.08, 0.38, 0.08, fence, { x, z: half, wob: 0.04 });
          continue;
        }
        b.box(0.06, 0.32, 0.06, fence, { x, z: half, wob: 0.06 });
      }
      for (const y of [0.12, 0.24]) {
        if (side === 0) {
          b.box(step * 2, 0.04, 0.03, fence, { x: -half + step, y, z: half + 0.03, wob: 0.02 });
          b.box(step * 2, 0.04, 0.03, fence, { x: half - step, y, z: half + 0.03, wob: 0.02 });
        } else {
          b.box(S, 0.04, 0.03, fence, { y, z: half + 0.03, wob: 0.015 });
        }
      }
    }, { o: [0, 0, half + 0.04], axis: [1, 0, 0], angle: Math.PI / 2 }));
  }
  // Korkuluk
  b.withFrame(0.75, -0.1, 0.3, () => b.piece('detay', () => {
    b.box(0.04, 0.75, 0.04, P.ahsap, { y: 0.08 });
    b.box(0.5, 0.04, 0.04, P.ahsap, { y: 0.6 });
    b.box(0.2, 0.26, 0.1, P.gul, { y: 0.4 });
    b.ball(0.09, P.kutuk, { y: 0.78 });
    b.cone(0.16, 0.12, 6, P.hardal, { y: 0.84 });
  }));
  return b;
}

/** Sınır dışı dekor ağacı: az çokgenli, kenar çizgisiz (instancing için). 0 çam, 1 yuvarlak, 2 kavak. */
export function buildDecorTree(variant: number): ModelBuilder {
  const b = new ModelBuilder(`dekor-${variant}`);
  const v = variant % 3;
  const s = new THREE.Shape();
  if (v === 0) {
    const pts: [number, number][] = [
      [0, 1.8], [0.17, 1.28], [0.3, 1.25], [0.2, 0.9], [0.38, 0.86], [0.26, 0.5], [0.46, 0.45],
      [0.07, 0.45], [0.07, 0.06], [-0.07, 0.06], [-0.07, 0.45],
      [-0.46, 0.45], [-0.26, 0.5], [-0.38, 0.86], [-0.2, 0.9], [-0.3, 1.25], [-0.17, 1.28],
    ];
    s.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  } else {
    const n = 8;
    const ry = v === 1 ? 0.42 : 0.62;
    const rx = v === 1 ? 0.42 : 0.26;
    const cy = v === 1 ? 1.0 : 1.1;
    s.moveTo(0.06, 0.06);
    s.lineTo(0.06, cy - ry * 0.8);
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + 0.35 + (i / n) * (Math.PI * 2 - 0.7);
      s.lineTo(Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    s.lineTo(-0.06, cy - ry * 0.8);
    s.lineTo(-0.06, 0.06);
  }
  s.closePath();
  const col = v === 0 ? P.koyuYesil : v === 1 ? P.yesil : P.zeytin;
  const col2 = v === 0 ? P.yesil : v === 1 ? P.adacayi : P.adacayi;
  b.extrude(s, 0.04, col, { edges: false, wob: 0 });
  b.withFrame(0, 0, Math.PI / 2, () => b.extrude(s, 0.04, col2, { edges: false, wob: 0 }));
  return b;
}

/** Çiçek renk takımları (çeşit başına bir takım). */
export const FLOWER_VARIANTS = 4;

/**
 * Çiçek (taban 0.4): küçük karton ayak üstünde üç saplı kağıt çiçek ve iki yaprak.
 * Taç: yassı silindir (5 dilim, kesik kağıt gibi) + ortada top.
 */
export function buildFlower(variant: number): ModelBuilder {
  const b = new ModelBuilder(`cicek-${variant}`);
  const takim = [
    [P.gul, P.pembe, P.hardal],
    [P.lavanta, P.kagit, P.hardal],
    [P.hardal, P.bugday, P.terrakota],
    [P.kagit, P.gul, P.hardal],
  ][variant % FLOWER_VARIANTS];
  b.as('taban', () => b.cyl(0.2, 0.22, 0.04, 8, P.mukavvaAcik, { wob: 0.02 }));
  const saplar: [number, number, number][] = [[0, 0, 0.42], [0.11, 0.07, 0.3], [-0.09, 0.08, 0.34]];
  saplar.forEach(([x, z, h], i) => {
    b.piece('duvar', () => {
      b.cyl(0.012, 0.014, h, 4, P.yesil, { x, z, y: 0.04, wob: 0, edges: false });
      b.cyl(0.085, 0.07, 0.025, 5, takim[i === 0 ? 0 : i === 1 ? 1 : 0], { x, z, y: 0.04 + h, ry: i, wob: 0.06 });
      b.ball(0.03, takim[2], { x, z, y: 0.07 + h });
    }, { o: [x, 0.04, z], axis: [1, 0, 0], angle: Math.PI / 2 });
  });
  b.piece('detay', () => {
    b.box(0.1, 0.012, 0.05, P.koyuYesil, { x: 0.05, y: 0.12, z: -0.03, rz: 0.5, ry: 0.4, wob: 0, edges: false });
    b.box(0.1, 0.012, 0.05, P.koyuYesil, { x: -0.05, y: 0.16, z: 0.02, rz: -0.5, ry: -0.3, wob: 0, edges: false });
  });
  return b;
}
