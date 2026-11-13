import { PALETTE as P } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt } from './builder';

// Hayvancılık ve arıcılık: Ağıl (2.0), Dokumacı (1.3), Arılık (1.0).
// Parçalar taban yarıçapının içinde kalır; önü +z (yola bakar).

/** Kağıt koyun: yün gövde (iki top), koyu baş ve dört ince bacak. */
function sheep(b: ModelBuilder, x: number, z: number, ry: number): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  b.piece('detay', () => {
    for (const [lx, lz] of [[-0.07, -0.05], [-0.07, 0.05], [0.07, -0.05], [0.07, 0.05]]) {
      b.box(0.025, 0.1, 0.025, P.murekkep, { ...at(lx, lz), wob: 0, edges: false });
    }
    b.ball(0.11, P.kagit, { ...at(-0.03, 0), y: 0.17 });
    b.ball(0.1, P.krem, { ...at(0.05, 0), y: 0.18 });
    b.box(0.08, 0.08, 0.07, P.murekkep, { ...at(0.16, 0), y: 0.17, ry, wob: 0.05 });
  });
}

/** Ağıl: alçak çitle çevrili otlak, arkada samanlı ahır, içinde koyunlar ve yemlik. */
export function buildSheepfold(): ModelBuilder {
  const b = new ModelBuilder('agil');
  // Otlak zemini
  b.as('taban', () => {
    b.cyl(1.75, 1.8, 0.04, 10, P.cimenAcik, { wob: 0.04 });
  });
  // Ahır (arkada)
  const az = -0.85;
  houseShell(b, { w: 1.3, d: 0.6, wallH: 0.55, rh: 0.36, wall: P.ahsapAcik, roof: P.bugdayKoyu, base: P.ahsap, z: az, over: 0.12 });
  b.as('govde', () => b.box(0.4, 0.45, 0.03, P.ahsap, { z: az + 0.31, wob: 0 }));
  windowAt(b, 0.45, 0.25, az + 0.3, 0.16, 0.14, P.kagit, P.bugday);
  // Çit: ön ve yanlarda kazık + iki kuşak
  const R = 1.55;
  b.piece('detay', () => {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI * 0.1 + (Math.PI * 1.2 * i) / n; // önde açık yay
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R * 0.75 + 0.05;
      if (i === 7) continue; // kapı aralığı (önde)
      b.box(0.05, 0.32, 0.05, P.ahsap, { x, z, wob: 0.05 });
      if (i < n && i !== 6) {
        const a2 = -Math.PI * 0.1 + (Math.PI * 1.2 * (i + 1)) / n;
        const x2 = Math.cos(a2) * R;
        const z2 = Math.sin(a2) * R * 0.75 + 0.05;
        const len = Math.hypot(x2 - x, z2 - z);
        const ry = Math.atan2(-(z2 - z), x2 - x);
        for (const y of [0.12, 0.25]) b.box(len, 0.03, 0.02, P.ahsapAcik, { x: (x + x2) / 2, y, z: (z + z2) / 2, ry, wob: 0, edges: false });
      }
    }
  });
  // Yemlik ve saman balyası
  b.as('detay', () => {
    b.box(0.5, 0.1, 0.16, P.ahsap, { x: -0.75, z: 0.05, ry: 0.3, wob: 0.02 });
    b.box(0.44, 0.04, 0.12, P.bugday, { x: -0.75, y: 0.1, z: 0.05, ry: 0.3, wob: 0, edges: false });
    b.cyl(0.16, 0.16, 0.26, 8, P.bugday, { x: 0.95, z: -0.35, rx: Math.PI / 2, wob: 0.03 });
  });
  sheep(b, -0.2, 0.3, 0.4);
  sheep(b, 0.35, 0.05, -0.8);
  sheep(b, 0.15, 0.7, 2.6);
  sheep(b, -0.6, 0.6, -2.0);
  return b;
}

/** Dokumacı: lavanta duvarlı atölye, önde dokuma tezgâhı, sırıkta asılı renkli kumaşlar, yün yumakları. */
export function buildWeaver(): ModelBuilder {
  const b = new ModelBuilder('dokumaci');
  const cx = -0.25;
  const cz = -0.15;
  const w = 1.05;
  const d = 0.8;
  houseShell(b, { w, d, wallH: 0.72, rh: 0.42, wall: P.lavanta, roof: P.arduvaz, base: P.tas, x: cx, z: cz, over: 0.1 });
  const fz = cz + d / 2;
  doorAt(b, cx - 0.22, fz, 0.24, 0.46, P.ahsap, P.hardal);
  windowAt(b, cx + 0.2, 0.26, fz, 0.28, 0.24, P.kagit, P.gokAcik);
  windowAt(b, cx - w / 2, 0.28, cz, 0.2, 0.2, P.kagit, P.gokAcik, -Math.PI / 2);
  // Asılı tabela: kumaş topu
  b.piece('detay', () => {
    b.box(0.3, 0.12, 0.03, P.gul, { x: cx + 0.2, y: 0.62, z: fz + 0.02, wob: 0.03 });
  });
  // Kurutma sırığı ve asılı kumaşlar (sağda)
  const rx = 0.62;
  b.as('govde', () => {
    for (const z of [-0.5, 0.3]) b.box(0.04, 0.72, 0.04, P.ahsap, { x: rx, z, wob: 0.02 });
    b.box(0.03, 0.03, 0.86, P.ahsap, { x: rx, y: 0.7, z: -0.1, wob: 0 });
  });
  b.piece('detay', () => {
    const renk = [P.gul, P.hardal, P.teal];
    renk.forEach((c, i) => b.box(0.02, 0.4, 0.2, c, { x: rx, y: 0.3, z: -0.38 + i * 0.25, wob: 0.03 }));
  });
  // Dokuma tezgâhı (önde): çerçeve + gerili iplik
  b.piece('detay', () => {
    const lx = -0.05;
    const lz = 0.6;
    for (const s of [-1, 1]) b.box(0.04, 0.42, 0.24, P.ahsap, { x: lx + s * 0.22, z: lz, wob: 0.01 });
    b.box(0.48, 0.04, 0.04, P.ahsap, { x: lx, y: 0.4, z: lz - 0.08, wob: 0 });
    b.box(0.44, 0.24, 0.01, P.pembe, { x: lx, y: 0.16, z: lz - 0.04, rx: -0.2, wob: 0, edges: false });
    b.box(0.48, 0.04, 0.04, P.ahsap, { x: lx, y: 0.14, z: lz + 0.08, wob: 0 });
  });
  // Yün yumakları sepette
  b.as('detay', () => {
    b.cyl(0.13, 0.11, 0.1, 8, P.ahsapAcik, { x: 0.5, z: 0.62 });
    b.ball(0.07, P.kagit, { x: 0.46, y: 0.14, z: 0.6 });
    b.ball(0.065, P.gul, { x: 0.56, y: 0.13, z: 0.66 });
  });
  return b;
}

/** Arılık: çiçek tarhı içinde üç katlı kovanlar ve küçük bir bal kulübesi. */
export function buildApiary(): ModelBuilder {
  const b = new ModelBuilder('arilik');
  b.as('taban', () => {
    b.cyl(0.92, 0.95, 0.04, 9, P.cimenAcik, { wob: 0.04 });
  });
  // Bal kulübesi (arkada, küçük)
  houseShell(b, { w: 0.6, d: 0.45, wallH: 0.42, rh: 0.26, wall: P.hardal, roof: P.kiremit, base: P.ahsap, x: -0.3, z: -0.45, over: 0.08 });
  doorAt(b, -0.3, -0.45 + 0.225, 0.16, 0.3, P.ahsap, P.kagit);
  // Kovanlar: tabure üstünde katlı kutular + kapak
  const kovanlar: [number, number][] = [[0.45, -0.25], [0.5, 0.3], [-0.15, 0.45]];
  for (const [x, z] of kovanlar) {
    b.piece('detay', () => {
      b.box(0.3, 0.08, 0.26, P.ahsap, { x, z, wob: 0.02 });
      b.box(0.26, 0.12, 0.22, P.kagit, { x, y: 0.08, z, wob: 0.02 });
      b.box(0.26, 0.12, 0.22, P.krem, { x, y: 0.2, z, wob: 0.02 });
      b.box(0.3, 0.04, 0.26, P.arduvaz, { x, y: 0.32, z, wob: 0.02 });
      b.box(0.08, 0.02, 0.01, P.murekkep, { x, y: 0.1, z: z + 0.111, wob: 0, edges: false });
    });
  }
  // Çiçekler ve arılar
  b.as('detay', () => {
    const renk = [P.gul, P.lavanta, P.hardal, P.kagit];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = 0.55 + (i % 3) * 0.1;
      b.cyl(0.01, 0.01, 0.12, 4, P.yesil, { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.9 + 0.05, wob: 0, edges: false });
      b.ball(0.04, renk[i % renk.length], { x: Math.cos(a) * r, y: 0.13, z: Math.sin(a) * r * 0.9 + 0.05 });
    }
    for (const [x, y, z] of [[0.3, 0.55, 0.0], [0.62, 0.48, 0.1], [0.1, 0.5, 0.25]]) b.ball(0.025, P.hardal, { x, y, z });
  });
  return b;
}
