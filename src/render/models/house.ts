import { PALETTE as P, EV_DUVAR, EV_CATI } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt } from './builder';

// Ev: seviye 1 kulübe, 2 bacalı ev, 3 iki katlı ev, 4 konak (cumbalı, sütunlu giriş), 5 köşk (yan kanat,
// teras, balkon). Hiçbiri iki kattan yüksek değil. Ön yüz +z. taban 1.1.
// Bacaların tepe noktası render/life.ts LIFE.baca ile aynı olmalı (duman oradan çıkar).

/** Konak: geniş iki katlı gövde, üst katta öne çıkan cumba, iki sütunlu alınlıklı giriş. */
function buildMansion(b: ModelBuilder, wall: string, roof: string, door: string, frame: string, glass: string): void {
  const w = 1.5;
  const d = 1.05;
  const wallH = 1.42;
  const top = houseShell(b, { w, d, wallH, rh: 0.6, wall, roof, base: P.tas });
  const fz = d / 2;
  // Kat bandı ve köşe pilastrları
  b.box(w + 0.05, 0.06, d + 0.05, P.kagit, { y: 0.7, wob: 0 });
  b.as('govde', () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, wallH, 0.08, P.kagit, { x: (sx * w) / 2, z: (sz * d) / 2, wob: 0 });
  });
  // Giriş: kapı, iki sütun, alınlıklı saçak
  doorAt(b, 0, fz, 0.28, 0.52, door, P.hardal);
  b.piece('detay', () => {
    for (const s of [-1, 1]) b.cyl(0.035, 0.035, 0.56, 6, P.beyaz, { x: s * 0.24, z: fz + 0.22, wob: 0 });
    b.box(0.62, 0.05, 0.32, P.kagit, { y: 0.56, z: fz + 0.15, wob: 0 });
  });
  b.roof(0.34, 0.66, 0.16, roof, { y: 0.6, z: fz + 0.15, ry: Math.PI / 2, wob: 0.01 }, 0.04);
  // Cumba: üst katta öne çıkan kutu, altında iki konsol, üstünde küçük saçak
  const cz = fz + 0.13;
  b.piece('detay', () => {
    b.box(0.66, 0.56, 0.26, wall, { y: 0.8, z: cz, wob: 0 });
    for (const s of [-1, 1]) b.box(0.06, 0.12, 0.22, P.kagit, { x: s * 0.26, y: 0.7, z: cz, rx: 0.5, wob: 0 });
    b.box(0.74, 0.04, 0.34, roof, { y: 1.36, z: cz + 0.02, rx: 0.18, wob: 0 });
  });
  windowAt(b, -0.16, 0.96, cz + 0.13, 0.18, 0.26, frame, glass);
  windowAt(b, 0.16, 0.96, cz + 0.13, 0.18, 0.26, frame, glass);
  for (const s of [-1, 1]) windowAt(b, s * 0.33, 0.96, cz, 0.12, 0.26, frame, glass, (s * Math.PI) / 2);
  // Diğer pencereler
  for (const x of [-0.5, 0.5]) {
    windowAt(b, x, 0.28, fz, 0.22, 0.24, frame, glass);
    windowAt(b, x, 0.95, fz, 0.2, 0.26, frame, glass);
  }
  flowerBox(b, -0.5, 0.88, fz, 0.26);
  flowerBox(b, 0.5, 0.88, fz, 0.26);
  for (const s of [-1, 1]) {
    for (const z of [-0.22, 0.22]) {
      windowAt(b, (s * w) / 2, 0.3, z, 0.2, 0.22, frame, glass, (s * Math.PI) / 2);
      windowAt(b, (s * w) / 2, 0.95, z, 0.2, 0.24, frame, glass, (s * Math.PI) / 2);
    }
  }
  for (const x of [-0.45, 0, 0.45]) windowAt(b, x, 0.95, -fz, 0.2, 0.24, frame, glass, Math.PI);
  chimney(b, -0.5, -0.22, wallH + 0.1, top - wallH + 0.25);
  b.box(0.5, 0.05, 0.2, P.tasKoyu, { z: fz + 0.42, wob: 0.04 });
}

/** Köşk: iki katlı ana gövde + tek katlı yan kanat (üstü korkuluklu teras), ön balkon, kapı yanı çalılar. */
function buildManor(b: ModelBuilder, wall: string, roof: string, door: string, frame: string, glass: string): void {
  const mx = -0.22;
  const w = 1.2;
  const d = 1.0;
  const wallH = 1.42;
  const top = houseShell(b, { w, d, wallH, rh: 0.6, wall, roof, base: P.tas, x: mx });
  const fz = d / 2;
  b.box(w + 0.05, 0.06, d + 0.05, P.kagit, { x: mx, y: 0.7, wob: 0 });
  // Mahya süsü
  b.piece('detay', () => {
    b.cyl(0.02, 0.02, 0.18, 5, P.hardal, { x: mx, y: top - 0.02, wob: 0 });
    b.ball(0.06, P.hardal, { x: mx, y: top + 0.18 });
  });
  // Giriş + üstünde balkon (döşeme, korkuluk, iki dikme)
  doorAt(b, mx, fz, 0.3, 0.54, door, P.hardal);
  b.piece('detay', () => {
    b.box(0.7, 0.05, 0.3, P.kagit, { x: mx, y: 0.7, z: fz + 0.15, wob: 0 });
    b.box(0.7, 0.03, 0.03, P.beyaz, { x: mx, y: 0.92, z: fz + 0.29, wob: 0 });
    for (let i = 0; i <= 6; i++) b.box(0.02, 0.2, 0.02, P.beyaz, { x: mx - 0.33 + i * 0.11, y: 0.74, z: fz + 0.29, wob: 0, edges: false });
    for (const s of [-1, 1]) b.cyl(0.03, 0.03, 0.7, 6, P.beyaz, { x: mx + s * 0.33, z: fz + 0.27, wob: 0 });
  });
  windowAt(b, mx, 0.8, fz + 0.01, 0.2, 0.34, frame, glass);
  for (const x of [mx - 0.4, mx + 0.4]) {
    windowAt(b, x, 0.28, fz, 0.2, 0.26, frame, glass);
    windowAt(b, x, 0.95, fz, 0.2, 0.26, frame, glass);
  }
  windowAt(b, mx - w / 2, 0.3, 0, 0.22, 0.24, frame, glass, -Math.PI / 2);
  windowAt(b, mx - w / 2, 0.95, 0, 0.22, 0.26, frame, glass, -Math.PI / 2);
  windowAt(b, mx + w / 2, 0.95, 0, 0.22, 0.26, frame, glass, Math.PI / 2);
  for (const x of [mx - 0.3, mx + 0.3]) windowAt(b, x, 0.95, -fz, 0.2, 0.24, frame, glass, Math.PI);
  chimney(b, mx - 0.36, -0.22, wallH + 0.1, top - wallH + 0.25);

  // Yan kanat: tek kat, düz damlı teras, korkuluk
  const kx = mx + w / 2 + 0.3;
  const kw = 0.6;
  const kd = 0.8;
  const kh = 0.72;
  b.as('govde', () => b.box(kw, kh, kd, wall, { x: kx, wob: 0 }));
  b.piece('cati', () => {
    b.box(kw + 0.08, 0.05, kd + 0.08, P.kagit, { x: kx, y: kh, wob: 0 });
    for (const z of [-kd / 2, kd / 2]) b.box(kw + 0.06, 0.03, 0.03, P.beyaz, { x: kx, y: kh + 0.18, z, wob: 0 });
    b.box(0.03, 0.03, kd + 0.06, P.beyaz, { x: kx + kw / 2, y: kh + 0.18, wob: 0 });
    for (const [x, z] of [[kx + kw / 2, -kd / 2], [kx + kw / 2, kd / 2], [kx - kw / 2 + 0.02, kd / 2], [kx - kw / 2 + 0.02, -kd / 2]]) {
      b.box(0.03, 0.18, 0.03, P.beyaz, { x, y: kh + 0.02, z, wob: 0, edges: false });
    }
    // Terasta saksı
    b.cyl(0.06, 0.05, 0.08, 6, P.terrakota, { x: kx + 0.12, y: kh + 0.05, z: 0.18 });
    b.ball(0.08, P.yesil, { x: kx + 0.12, y: kh + 0.18, z: 0.18 });
  });
  windowAt(b, kx, 0.24, kd / 2, 0.34, 0.3, frame, glass);
  windowAt(b, kx + kw / 2, 0.24, 0, 0.26, 0.28, frame, glass, Math.PI / 2);
  // Kapı yanında yuvarlak çalılar ve taş basamak
  b.as('detay', () => {
    for (const s of [-1, 1]) {
      b.cyl(0.07, 0.06, 0.1, 6, P.terrakota, { x: mx + s * 0.5, z: fz + 0.2 });
      b.ball(0.11, P.koyuYesil, { x: mx + s * 0.5, y: 0.2, z: fz + 0.2 });
    }
    b.box(0.46, 0.05, 0.2, P.tasKoyu, { x: mx, z: fz + 0.42, wob: 0.03 });
  });
}

function chimney(b: ModelBuilder, x: number, z: number, y0: number, h: number): void {
  b.piece('detay', () => {
    b.box(0.2, h, 0.2, P.kiremit, { x, z, y: y0, wob: 0.03 });
    b.box(0.26, 0.06, 0.26, P.tasKoyu, { x, z, y: y0 + h, wob: 0.03 });
  });
}

function flowerBox(b: ModelBuilder, x: number, y: number, z: number, w: number): void {
  b.piece('detay', () => flowerBoxInner(b, x, y, z, w));
}

function flowerBoxInner(b: ModelBuilder, x: number, y: number, z: number, w: number): void {
  b.box(w, 0.07, 0.08, P.ahsap, { x, y, z: z + 0.04 });
  const cols = [P.gul, P.hardal, P.kagit];
  const n = Math.max(2, Math.round(w / 0.09));
  for (let i = 0; i < n; i++) {
    b.ball(0.045, cols[i % 3], { x: x - w / 2 + (w / (n - 1)) * i, y: y + 0.09, z: z + 0.05 });
  }
}

export function buildHouse(level: number, variant: number): ModelBuilder {
  const b = new ModelBuilder(`ev-${level}-${variant}`);
  const wall = EV_DUVAR[variant % EV_DUVAR.length];
  const roof = EV_CATI[(variant * 3 + 1) % EV_CATI.length];
  const door = [P.ahsap, P.teal, P.gul, P.arduvaz][variant % 4];
  const frame = P.beyaz;
  const glass = P.gok;

  if (level <= 1) {
    const w = 0.95;
    const d = 0.78;
    const wallH = 0.58;
    houseShell(b, { w, d, wallH, rh: 0.42, wall, roof, base: P.tas, over: 0.1 });
    const fz = d / 2;
    doorAt(b, -0.18, fz, 0.22, 0.4, door, P.hardal);
    windowAt(b, 0.2, 0.22, fz, 0.2, 0.18, frame, glass);
    windowAt(b, w / 2, 0.24, 0, 0.18, 0.16, frame, glass, Math.PI / 2);
    windowAt(b, -w / 2, 0.24, 0, 0.18, 0.16, frame, glass, -Math.PI / 2);
    // Kapı önü taşı
    b.box(0.3, 0.04, 0.12, P.tasKoyu, { x: -0.18, z: fz + 0.07, wob: 0.05 });
  } else if (level === 2) {
    const w = 1.25;
    const d = 0.92;
    const wallH = 0.78;
    houseShell(b, { w, d, wallH, rh: 0.5, wall, roof, base: P.tas });
    const fz = d / 2;
    doorAt(b, -0.32, fz, 0.24, 0.48, door, P.hardal);
    windowAt(b, 0.08, 0.3, fz, 0.2, 0.22, frame, glass);
    windowAt(b, 0.4, 0.3, fz, 0.2, 0.22, frame, glass);
    flowerBox(b, 0.24, 0.22, fz, 0.58);
    windowAt(b, w / 2, 0.3, 0.05, 0.22, 0.22, frame, glass, Math.PI / 2);
    windowAt(b, -w / 2, 0.3, 0.05, 0.22, 0.22, frame, glass, -Math.PI / 2);
    // Arka cephe penceresi
    windowAt(b, 0, 0.3, -fz, 0.22, 0.22, frame, glass, Math.PI);
    chimney(b, 0.36, -0.2, wallH + 0.1, 0.62);
    b.box(0.34, 0.04, 0.14, P.tasKoyu, { x: -0.32, z: fz + 0.08, wob: 0.05 });
  } else if (level === 4) {
    buildMansion(b, wall, roof, door, frame, glass);
  } else if (level >= 5) {
    buildManor(b, wall, roof, door, frame, glass);
  } else {
    const w = 1.32;
    const d = 1.0;
    const wallH = 1.42;
    const top = houseShell(b, { w, d, wallH, rh: 0.55, wall, roof, base: P.tas });
    const fz = d / 2;
    // Kat bandı
    b.box(w + 0.05, 0.06, d + 0.05, P.kagit, { y: 0.7, wob: 0 });
    doorAt(b, 0, fz, 0.26, 0.5, door, P.hardal);
    b.roof(0.42, 0.26, 0.1, roof, { y: 0.56, z: fz + 0.1, wob: 0.02 }, 0.04);
    windowAt(b, -0.4, 0.3, fz, 0.2, 0.22, frame, glass);
    windowAt(b, 0.4, 0.3, fz, 0.2, 0.22, frame, glass);
    windowAt(b, -0.4, 0.95, fz, 0.2, 0.24, frame, glass);
    windowAt(b, 0, 0.95, fz, 0.2, 0.24, frame, glass);
    windowAt(b, 0.4, 0.95, fz, 0.2, 0.24, frame, glass);
    flowerBox(b, -0.4, 0.88, fz, 0.26);
    flowerBox(b, 0.4, 0.88, fz, 0.26);
    for (const s of [-1, 1]) {
      windowAt(b, (s * w) / 2, 0.3, 0, 0.22, 0.22, frame, glass, (s * Math.PI) / 2);
      windowAt(b, (s * w) / 2, 0.95, 0, 0.22, 0.24, frame, glass, (s * Math.PI) / 2);
    }
    windowAt(b, -0.3, 0.95, -fz, 0.2, 0.24, frame, glass, Math.PI);
    windowAt(b, 0.3, 0.95, -fz, 0.2, 0.24, frame, glass, Math.PI);
    chimney(b, -0.4, -0.22, wallH + 0.1, top - wallH + 0.25);
    b.box(0.4, 0.05, 0.16, P.tasKoyu, { z: fz + 0.09, wob: 0.04 });
  }
  return b;
}
