import { PALETTE as P } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt } from './builder';

// Değirmen (1.4), Fırın (1.2), Oduncu (1.2).

export interface MillParts {
  body: ModelBuilder;
  blades: ModelBuilder;
  /** Kanat göbeğinin model içindeki konumu. */
  hub: { x: number; y: number; z: number };
}

export function buildMill(): MillParts {
  const b = new ModelBuilder('degirmen');
  const rBot = 0.88;
  const rTop = 0.6;
  const H = 2.1;
  const slope = Math.atan2(rBot - rTop, H);
  const rAt = (y: number) => rBot - ((rBot - rTop) * y) / H;
  const o8 = Math.PI / 8; // düz yüzlerden biri +z'ye baksın
  b.as('taban', () => {
  b.cyl(0.95, 0.98, 0.22, 8, P.tasKoyu, { ry: o8, wob: 0 });
  });
  b.as('govde', () => {
  b.cyl(rTop, rBot, H, 8, P.krem, { y: 0.2, ry: o8, wob: 0 });
  });
  b.cyl(rAt(1.1) + 0.03, rAt(1.0) + 0.03, 0.08, 8, P.terrakota, { y: 1.2, ry: o8, wob: 0 });
  b.cyl(rTop + 0.06, rTop + 0.06, 0.08, 8, P.ahsap, { y: H + 0.2, ry: o8, wob: 0 });
  b.piece('cati', () => {
  b.cone(0.76, 0.75, 8, P.terrakota, { y: H + 0.28, ry: o8, wob: 0.01 });
  });
  b.ball(0.08, P.hardal, { y: H + 1.05 });
  // Kapı ve pencereler (eğik duvara yapışık). Sekizgenin düz yüzü cos(π/8) içeride.
  const k = Math.cos(Math.PI / 8);
  const face = (y: number) => rAt(y - 0.2) * k;
  const fa = 0;
  b.withFrame(0, 0, fa, () => {
    b.plate(0.32, 0.6, P.ahsap, { z: face(0.22) + 0.02, y: 0.22, rx: -slope, wob: 0.02 });
    b.plate(0.36, 0.06, P.kiremit, { z: face(0.82) + 0.02, y: 0.82, rx: -slope, wob: 0.02 });
    windowAt(b, 0, 1.45, face(1.57) + 0.01, 0.2, 0.24, P.beyaz, P.gok);
  });
  b.withFrame(0, 0, fa + Math.PI * 0.75, () => {
    windowAt(b, 0, 0.75, face(0.8) + 0.01, 0.18, 0.22, P.beyaz, P.gok);
  });
  b.withFrame(0, 0, fa - Math.PI * 0.75, () => {
    windowAt(b, 0, 1.0, face(1.05) + 0.01, 0.18, 0.22, P.beyaz, P.gok);
  });
  // Un çuvalları
  b.box(0.22, 0.26, 0.16, P.kagit, { x: 0.62, z: 0.62, ry: 0.4, wob: 0.1 });
  b.box(0.2, 0.22, 0.15, P.krem, { x: 0.82, z: 0.38, ry: -0.3, wob: 0.1 });

  // Kanatlar: göbek orijinde, kanatlar XY düzleminde, Z eksenine dik.
  const bl = new ModelBuilder('degirmen-kanat');
  bl.cyl(0.1, 0.1, 0.42, 8, P.ahsap, { rx: Math.PI / 2, z: -0.34, wob: 0 });
  bl.ball(0.07, P.hardal, { z: 0.14 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = (x: number, y: number) => ({ x: x * c - y * s, y: x * s + y * c });
    bl.box(0.06, 1.38, 0.04, P.ahsap, { ...rot(0, 0), z: 0.06, rz: a, wob: 0 });
    // Yelken çerçevesi + yelken kağıdı
    bl.box(0.34, 1.0, 0.02, i % 2 === 0 ? P.kagit : P.pembe, { ...rot(0.2, 0.36), z: 0.04, rz: a, wob: 0.02 });
    for (let j = 0; j < 4; j++) {
      bl.box(0.36, 0.025, 0.03, P.ahsapAcik, { ...rot(0.2, 0.42 + j * 0.27), z: 0.07, rz: a, wob: 0, edges: false });
    }
  }
  return { body: b, blades: bl, hub: { x: 0, y: 1.98, z: rAt(1.78) + 0.24 } };
}

export function buildBakery(): ModelBuilder {
  const b = new ModelBuilder('firin');
  const w = 1.4;
  const d = 1.05;
  const wallH = 0.85;
  const top = houseShell(b, { w, d, wallH, rh: 0.48, wall: P.seftali, roof: P.kiremit, base: P.tas });
  const fz = d / 2;
  // Tuğla baca (büyük)
  b.piece('detay', () => {
  b.box(0.3, top - wallH + 0.55, 0.3, P.terrakota, { x: -0.42, z: -0.18, y: wallH, wob: 0.02 });
  b.box(0.36, 0.07, 0.36, P.tasKoyu, { x: -0.42, z: -0.18, y: top + 0.55, wob: 0.02 });
  });
  // Vitrin + kapı
  doorAt(b, 0.38, fz, 0.26, 0.52, P.teal, P.hardal);
  windowAt(b, -0.18, 0.22, fz, 0.52, 0.32, P.beyaz, P.gokAcik);
  // Vitrindeki ekmekler
  b.ball(0.06, P.bugdayKoyu, { x: -0.3, y: 0.26, z: fz + 0.06 });
  b.ball(0.06, P.ahsapAcik, { x: -0.12, y: 0.26, z: fz + 0.06 });
  b.ball(0.06, P.bugdayKoyu, { x: 0.04, y: 0.26, z: fz + 0.06 });
  // Çizgili tente: öne eğik şeritler + dalgalı ön kenar
  const stripes = 6;
  const aw = 1.2;
  const sw = aw / stripes;
  b.piece('detay', () => {
  for (let i = 0; i < stripes; i++) {
    const x = -aw / 2 + sw / 2 + i * sw;
    const col = i % 2 === 0 ? P.gul : P.kagit;
    b.box(sw + 0.002, 0.025, 0.42, col, { x, y: 0.7, z: fz + 0.2, rx: 0.5, wob: 0, edges: i === 0 || i === stripes - 1 });
    b.cone(sw / 2, 0.08, 6, col, { x, y: 0.43, z: fz + 0.4, rx: Math.PI, wob: 0, edges: false });
  }
  b.box(aw, 0.025, 0.025, P.gul, { y: 0.79, z: fz + 0.02, wob: 0 });
  });
  // Asılı tabela
  b.piece('detay', () => {
  b.box(0.04, 0.04, 0.28, P.murekkep, { x: w / 2 + 0.02, y: 0.66, z: fz - 0.12, wob: 0 });
  b.cyl(0.14, 0.14, 0.03, 12, P.hardal, { x: w / 2 + 0.02, y: 0.48, z: fz + 0.05, rz: Math.PI / 2, ry: 0, wob: 0.05 });
  });
  // Yan pencere
  windowAt(b, -w / 2, 0.3, 0, 0.22, 0.22, P.beyaz, P.gok, -Math.PI / 2);
  return b;
}

export function buildWoodcutter(): ModelBuilder {
  const b = new ModelBuilder('oduncu');
  const cx = -0.35;
  const cz = -0.15;
  const w = 1.0;
  const d = 0.82;
  const wallH = 0.66;
  houseShell(b, { w, d, wallH, rh: 0.42, wall: P.ahsapAcik, roof: P.koyuYesil, x: cx, z: cz, base: P.tas, over: 0.1 });
  const fz = cz + d / 2;
  // Tahta kaplama çizgileri
  b.piece('detay', () => {
  for (let i = 1; i <= 3; i++) {
    b.box(w + 0.01, 0.025, d + 0.01, P.ahsap, { x: cx, z: cz, y: (wallH / 4) * i, wob: 0, edges: false });
  }
  });
  doorAt(b, cx - 0.18, fz + 0.01, 0.24, 0.46, P.ahsap, P.hardal);
  windowAt(b, cx + 0.2, 0.26, fz + 0.01, 0.2, 0.2, P.kagit, P.gok);
  // Kütük yığını: 3-2-1, eksen Z boyunca
  const lx = 0.5;
  const lz = 0.3;
  const len = 0.66;
  const r = 0.1;
  const rows = [3, 2, 1];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const x = lx + (i - (n - 1) / 2) * r * 2.05;
      const y = r + row * r * 1.75;
      b.piece('detay', () => {
      b.cyl(r, r, len, 8, P.ahsap, { x, y: y, z: lz - len / 2, rx: Math.PI / 2, wob: 0.03, edgeDeg: 50 });
      b.cyl(r * 0.8, r * 0.8, 0.012, 8, P.kutuk, { x, y, z: lz + len / 2, rx: Math.PI / 2, wob: 0, edges: false });
      b.cyl(r * 0.8, r * 0.8, 0.012, 8, P.kutuk, { x, y, z: lz - len / 2 - 0.012, rx: Math.PI / 2, wob: 0, edges: false });
      });
    }
  });
  // Kesme kütüğü + balta
  b.piece('detay', () => {
  b.cyl(0.16, 0.18, 0.24, 8, P.ahsap, { x: 0.42, z: -0.55 });
  b.cyl(0.14, 0.14, 0.012, 10, P.kutuk, { x: 0.42, z: -0.55, y: 0.24, wob: 0, edges: false });
  b.box(0.035, 0.36, 0.035, P.ahsapAcik, { x: 0.42, y: 0.24, z: -0.55, rz: 0.5, wob: 0 });
  b.box(0.14, 0.1, 0.025, P.tasKoyu, { x: 0.27, y: 0.48, z: -0.55, rz: 0.5, wob: 0 });
  });
  // Talaş
  b.box(0.06, 0.012, 0.04, P.kutuk, { x: 0.6, z: -0.4, ry: 0.7, wob: 0, edges: false });
  b.box(0.05, 0.012, 0.03, P.kutuk, { x: 0.25, z: -0.35, ry: 1.9, wob: 0, edges: false });
  return b;
}
