import { PALETTE as P, EV_DUVAR, EV_CATI } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt } from './builder';

// Ev: seviye 1 kulübe, 2 bacalı ev, 3 iki katlı ev. Ön yüz +z. taban 1.1.

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
