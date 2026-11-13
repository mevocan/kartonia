import * as THREE from 'three';
import { PALETTE as P } from '../palette';
import { ModelBuilder, houseShell, panelBox, windowAt, doorAt } from './builder';

// Park (1.3), Hamam (1.6), Tiyatro (1.8). Parçalar taban yarıçapının içinde kalır; önü +z (yola bakar).
// Hamam ve tiyatro yükseltilebilir: ekler (seviye 2, 3) yine taban içinde.

/** Yarım küre kubbe (kağıt dilimli görünüm için az parçalı). */
function dome(b: ModelBuilder, r: number, color: string, p: { x?: number; y?: number; z?: number }): void {
  const g = new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(g, color, { edgeDeg: 30, wob: 0.01, ...p });
  g.dispose();
}

/** Kağıt bank: oturak + arkalık + iki ayak. */
function bench(b: ModelBuilder, x: number, z: number, ry: number): void {
  b.withFrame(x, z, ry, () => {
    b.box(0.42, 0.035, 0.12, P.ahsap, { y: 0.13, wob: 0.01 });
    b.box(0.42, 0.12, 0.025, P.ahsap, { y: 0.17, z: -0.06, wob: 0.01 });
    for (const s of [-1, 1]) b.box(0.035, 0.13, 0.1, P.ahsapAcik, { x: s * 0.17, wob: 0, edges: false });
  });
}

/** Yuvarlak taçlı fidan. */
function sapling(b: ModelBuilder, x: number, z: number, s = 1): void {
  b.cyl(0.03 * s, 0.04 * s, 0.32 * s, 5, P.ahsap, { x, z });
  b.ball(0.2 * s, P.yesil, { x, y: 0.42 * s, z });
  b.ball(0.13 * s, P.koyuYesil, { x: x + 0.08 * s, y: 0.5 * s, z: z + 0.05 * s });
}

/** Park: yuvarlak çimen, ortada havuz, çevresinde banklar, fidanlar, çiçek tarhları ve fener. */
export function buildPark(): ModelBuilder {
  const b = new ModelBuilder('park');
  b.as('taban', () => {
    b.cyl(1.22, 1.25, 0.04, 12, P.cimenAcik, { wob: 0.03 });
  });
  // Ortada taş kenarlı havuz
  b.as('govde', () => {
    b.cyl(0.42, 0.44, 0.08, 10, P.tas, { y: 0.04 });
    b.cyl(0.36, 0.36, 0.012, 14, P.su, { y: 0.12, wob: 0, edges: false });
  });
  // Önden havuza toprak patika
  b.as('detay', () => {
    b.box(0.3, 0.012, 0.75, P.patika, { y: 0.04, z: 0.82, wob: 0.02, edges: false });
  });
  b.piece('detay', () => {
    bench(b, -0.55, 0.45, 0.6);
    bench(b, 0.55, 0.45, -0.6);
    bench(b, 0, -0.7, Math.PI);
  });
  b.piece('detay', () => {
    sapling(b, -0.8, -0.45, 1.1);
    sapling(b, 0.82, -0.35, 0.95);
    sapling(b, -0.15, -1.0, 0.8);
  });
  // Çiçek tarhları
  b.as('detay', () => {
    const renk = [P.gul, P.hardal, P.lavanta, P.pembe];
    for (let i = 0; i < 10; i++) {
      const a = 0.4 + i * 0.55;
      const r = 0.95;
      if (Math.abs(Math.sin(a)) > 0.92 && Math.sin(a) > 0) continue; // patikanın önü boş
      b.ball(0.05, renk[i % renk.length], { x: Math.cos(a) * r, y: 0.08, z: Math.sin(a) * r });
    }
  });
  // Fener
  b.piece('detay', () => {
    b.cyl(0.02, 0.025, 0.6, 5, P.murekkep, { x: 0.32, z: 0.95 });
    b.box(0.08, 0.1, 0.08, P.hardal, { x: 0.32, y: 0.6, z: 0.95, wob: 0, isik: true });
    b.cone(0.07, 0.06, 4, P.murekkep, { x: 0.32, y: 0.7, z: 0.95 });
  });
  return b;
}

/** Hamam: taş gövde, büyük kurşun kubbe, köşelerde küçük kubbeler, kemerli kapı ve ocak bacası. */
export function buildBathhouse(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'hamam' : `hamam-${level}`);
  const w = 1.7;
  const d = 1.3;
  const h = 0.7;
  b.as('taban', () => b.box(w + 0.1, 0.06, d + 0.1, P.tasKoyu, { wob: 0 }));
  panelBox(b, { w, h, d, color: P.tas });
  // Düz dam + saçak kuşağı
  b.piece('cati', () => {
    b.box(w + 0.06, 0.05, d + 0.06, P.tasKoyu, { y: h, wob: 0 });
  });
  // Büyük kubbe + kasnağı + alem
  b.piece('cati', () => {
    b.cyl(0.5, 0.52, 0.1, 10, P.tas, { y: h + 0.05 });
    dome(b, 0.5, P.arduvaz, { y: h + 0.15 });
    b.cyl(0.015, 0.015, 0.16, 4, P.hardal, { y: h + 0.62, edges: false });
    b.ball(0.035, P.hardal, { y: h + 0.8 });
  });
  // Köşelerde küçük kubbeler (ışık delikleri)
  b.piece('cati', () => {
    for (const [x, z] of [[-0.62, 0.42], [0.62, 0.42]]) {
      dome(b, 0.16, P.arduvaz, { x, y: h + 0.05, z });
    }
  });
  const fz = d / 2;
  // Kemerli kapı: kapı + üstünde yarım daire alınlık
  doorAt(b, 0, fz, 0.34, 0.44, P.teal, P.hardal);
  b.piece('detay', () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.22, 0, Math.PI, false);
    s.closePath();
    b.extrude(s, 0.03, P.kagit, { y: 0.44, z: fz + 0.02, wob: 0 });
  });
  for (const x of [-0.55, 0.55]) windowAt(b, x, 0.3, fz, 0.16, 0.2, P.kagit, P.gokAcik);
  windowAt(b, -w / 2, 0.3, 0, 0.18, 0.2, P.kagit, P.gokAcik, -Math.PI / 2);
  // Arkada ocak bacası
  b.piece('detay', () => {
    b.box(0.18, 0.55, 0.18, P.tasKoyu, { x: 0.55, y: h, z: -0.45, wob: 0.02 });
    b.box(0.22, 0.04, 0.22, P.tas, { x: 0.55, y: h + 0.55, z: -0.45, wob: 0 });
  });
  if (level >= 2) {
    // Yanda soğukluk: alçak ek bina ve küçük kubbesi
    b.as('govde', () => b.box(0.5, 0.45, 0.7, P.krem, { x: -1.08, z: -0.2, wob: 0.01 }));
    b.piece('cati', () => dome(b, 0.2, P.arduvaz, { x: -1.08, y: 0.45, z: -0.2 }));
    windowAt(b, -1.33, 0.2, -0.2, 0.14, 0.16, P.kagit, P.gokAcik, -Math.PI / 2);
  }
  if (level >= 3) {
    // Önde mermer kurna (küçük çeşme) ve havlu askısı
    b.piece('detay', () => {
      b.cyl(0.16, 0.18, 0.14, 8, P.beyaz, { x: 0.75, z: fz + 0.42 });
      b.cyl(0.13, 0.13, 0.01, 10, P.su, { x: 0.75, y: 0.14, z: fz + 0.42, wob: 0, edges: false });
      for (const s of [-1, 1]) b.box(0.03, 0.4, 0.03, P.ahsap, { x: -0.7 + s * 0.22, z: fz + 0.4 });
      b.box(0.48, 0.02, 0.02, P.ahsap, { x: -0.7, y: 0.38, z: fz + 0.4, wob: 0 });
      b.box(0.14, 0.24, 0.01, P.gul, { x: -0.8, y: 0.15, z: fz + 0.4, wob: 0.03 });
      b.box(0.14, 0.2, 0.01, P.gokAcik, { x: -0.6, y: 0.19, z: fz + 0.4, wob: 0.03 });
    });
  }
  return b;
}

/** Tiyatro: sütunlu, alınlıklı cephe, kırmızı perde kapı, afişler ve bayraklar. */
export function buildTheater(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'tiyatro' : `tiyatro-${level}`);
  const w = 1.9;
  const d = 1.3;
  const cz = -0.15;
  houseShell(b, { w, d, wallH: 1.0, rh: 0.4, wall: P.seftali, roof: P.kiremit, base: P.tas, z: cz, over: 0.1 });
  const fz = cz + d / 2;
  // Ön revak: basamak, dört sütun, saçak ve üçgen alınlık
  const rz = fz + 0.28;
  b.as('taban', () => {
    b.box(w * 0.86, 0.08, 0.5, P.tas, { z: fz + 0.2, wob: 0 });
  });
  b.as('govde', () => {
    for (const x of [-0.6, -0.2, 0.2, 0.6]) b.cyl(0.055, 0.065, 0.86, 8, P.beyaz, { x, y: 0.08, z: rz });
  });
  b.piece('cati', () => {
    b.box(w * 0.86, 0.08, 0.36, P.krem, { y: 0.94, z: rz - 0.08, wob: 0 });
    const s = new THREE.Shape();
    s.moveTo(-0.82, 0);
    s.lineTo(0.82, 0);
    s.lineTo(0, 0.32);
    s.closePath();
    b.extrude(s, 0.06, P.krem, { y: 1.02, z: rz + 0.05, wob: 0 });
    // Alınlıkta maske rozeti
    b.cyl(0.08, 0.08, 0.02, 10, P.hardal, { y: 1.14, z: rz + 0.09, rx: Math.PI / 2, wob: 0 });
  });
  // Kırmızı perde kapı
  doorAt(b, 0, fz, 0.44, 0.6, P.kiremit, P.hardal);
  b.piece('detay', () => {
    b.box(0.5, 0.06, 0.02, P.hardal, { y: 0.62, z: fz + 0.02, wob: 0 });
  });
  for (const x of [-0.65, 0.65]) windowAt(b, x, 0.55, fz, 0.2, 0.3, P.kagit, P.hardal);
  // Afiş panoları
  b.piece('detay', () => {
    b.box(0.22, 0.3, 0.02, P.lavanta, { x: -0.42, y: 0.18, z: fz + 0.02, wob: 0.03 });
    b.box(0.22, 0.3, 0.02, P.gul, { x: 0.42, y: 0.18, z: fz + 0.02, wob: 0.03 });
  });
  // Mahyada iki bayrak
  b.piece('detay', () => {
    for (const s of [-1, 1]) {
      const x = s * 0.75;
      b.cyl(0.012, 0.012, 0.4, 4, P.murekkep, { x, y: 1.35, z: cz, edges: false });
      b.box(0.18, 0.1, 0.01, s < 0 ? P.gul : P.teal, { x: x + 0.09, y: 1.65, z: cz, wob: 0.05 });
    }
  });
  if (level >= 2) {
    // Önde afiş direkleri ve fenerler
    b.piece('detay', () => {
      for (const s of [-1, 1]) {
        const x = s * 0.95;
        b.cyl(0.07, 0.08, 0.5, 8, P.krem, { x, z: fz + 0.5 });
        b.cyl(0.085, 0.085, 0.03, 8, P.kiremit, { x, y: 0.5, z: fz + 0.5 });
        b.box(0.08, 0.1, 0.08, P.hardal, { x, y: 0.53, z: fz + 0.5, wob: 0, isik: true });
      }
    });
  }
  if (level >= 3) {
    // Arkada sahne kulesi
    b.as('govde', () => b.box(1.1, 0.5, 0.55, P.seftali, { y: 1.0, z: cz - 0.3, wob: 0.01 }));
    b.roof(1.2, 0.65, 0.22, P.kiremit, { y: 1.5, z: cz - 0.3, wob: 0.01 }, 0.05);
  }
  return b;
}
