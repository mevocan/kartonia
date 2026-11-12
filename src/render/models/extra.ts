import { PALETTE as P } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt } from './builder';

// Hastane (1.9), Ambar (1.6), Balıkçı (1.0), Taş Ocağı (1.5), Marangoz (1.3).
// Parçalar taban yarıçapının içinde kalır; önü +z (yola bakar).

/** İki katlı, açık renkli hastane. Seviye 2: bahçe bankları ve fidanlar; seviye 3: arkada ek koğuş. */
export function buildHospital(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'hastane' : `hastane-${level}`);
  const w = 2.4;
  const d = 1.2;
  const wallH = 1.25;
  houseShell(b, { w, d, wallH, rh: 0.42, wall: P.beyaz, roof: P.teal, base: P.tas, over: 0.12 });
  const fz = d / 2;
  // Kat silmesi
  b.as('govde', () => {
    b.box(w + 0.02, 0.05, d + 0.02, P.adacayiAcik, { y: 0.6, wob: 0 });
  });
  doorAt(b, 0, fz, 0.42, 0.52, P.teal, P.hardal);
  // Giriş saçağı
  b.piece('detay', () => {
    b.box(0.7, 0.04, 0.32, P.teal, { y: 0.6, z: fz + 0.16, wob: 0.01 });
  });
  for (const x of [-0.85, -0.5, 0.5, 0.85]) windowAt(b, x, 0.2, fz, 0.22, 0.28, P.kagit, P.gokAcik);
  for (const x of [-0.85, -0.5, 0, 0.5, 0.85]) windowAt(b, x, 0.78, fz, 0.22, 0.28, P.kagit, P.gokAcik);
  for (const x of [-0.7, 0, 0.7]) windowAt(b, x, 0.5, -fz, 0.24, 0.32, P.kagit, P.gokAcik, Math.PI);
  // Cephede yeşil levha üstünde beyaz artı
  b.piece('detay', () => {
    b.box(0.34, 0.34, 0.03, P.yesil, { y: 1.42, z: fz + 0.02, wob: 0 });
    b.box(0.2, 0.06, 0.035, P.beyaz, { y: 1.56, z: fz + 0.035, wob: 0 });
    b.box(0.06, 0.2, 0.035, P.beyaz, { y: 1.49, z: fz + 0.035, wob: 0 });
  });
  if (level >= 2) {
    b.as('detay', () => {
      for (const s of [-1, 1]) {
        const x = s * 0.95;
        b.box(0.42, 0.04, 0.14, P.ahsap, { x, y: 0.16, z: fz + 0.5, wob: 0.02 });
        b.box(0.04, 0.16, 0.12, P.ahsap, { x: x - 0.17, z: fz + 0.5 });
        b.box(0.04, 0.16, 0.12, P.ahsap, { x: x + 0.17, z: fz + 0.5 });
        b.cyl(0.025, 0.025, 0.32, 5, P.ahsap, { x: x + s * 0.35, z: fz + 0.62 });
        b.ball(0.15, P.yesil, { x: x + s * 0.35, z: fz + 0.62, y: 0.42 });
      }
    });
  }
  if (level >= 3) {
    const ez = -fz - 0.35;
    b.as('govde', () => {
      b.box(1.3, 0.75, 0.7, P.krem, { z: ez, wob: 0.01 });
    });
    b.roof(1.4, 0.82, 0.3, P.teal, { y: 0.75, z: ez, wob: 0.01 }, 0.05);
    for (const x of [-0.35, 0.35]) windowAt(b, x, 0.25, ez - 0.35, 0.22, 0.3, P.kagit, P.gokAcik, Math.PI);
  }
  return b;
}

/** Kırmızı ahşap ambar: büyük çapraz kuşaklı kapı, yanında çuvallar ve fıçı. */
export function buildBarn(): ModelBuilder {
  const b = new ModelBuilder('ambar');
  const w = 1.9;
  const d = 1.3;
  const wallH = 0.95;
  const top = houseShell(b, { w, d, wallH, rh: 0.6, wall: P.kiremit, roof: P.arduvaz, base: P.tasKoyu, over: 0.14 });
  const fz = d / 2;
  // Büyük kapı ve çapraz kuşaklar
  b.as('govde', () => {
    b.box(0.8, 0.78, 0.03, P.terrakota, { z: fz + 0.01, wob: 0 });
  });
  b.piece('detay', () => {
    b.box(0.86, 0.05, 0.035, P.kagit, { y: 0.78, z: fz + 0.025, wob: 0 });
    b.box(0.05, 0.78, 0.035, P.kagit, { x: -0.4, z: fz + 0.025, wob: 0 });
    b.box(0.05, 0.78, 0.035, P.kagit, { x: 0.4, z: fz + 0.025, wob: 0 });
    b.box(0.05, 0.78, 0.035, P.kagit, { x: 0, z: fz + 0.025, wob: 0 });
    b.box(1.0, 0.04, 0.03, P.kagit, { y: 0.37, z: fz + 0.03, rz: 0.75, wob: 0 });
    b.box(1.0, 0.04, 0.03, P.kagit, { y: 0.37, z: fz + 0.03, rz: -0.75, wob: 0 });
  });
  // Samanlık penceresi
  windowAt(b, 0, wallH + 0.12, fz, 0.3, 0.26, P.kagit, P.bugday);
  // Mahya üstünde küçük havalandırma kulesi
  b.piece('cati', () => {
    b.box(0.3, 0.2, 0.3, P.kagit, { y: top - 0.05, wob: 0 });
    b.cone(0.28, 0.2, 4, P.arduvaz, { y: top + 0.15, ry: Math.PI / 4 });
  });
  // Yanda çuvallar ve fıçı
  b.as('detay', () => {
    b.ball(0.16, P.kutuk, { x: w / 2 + 0.2, y: 0.12, z: 0.25 });
    b.ball(0.15, P.kutuk, { x: w / 2 + 0.22, y: 0.12, z: -0.05 });
    b.ball(0.13, P.bugday, { x: w / 2 + 0.2, y: 0.33, z: 0.1 });
    b.cyl(0.13, 0.12, 0.3, 8, P.ahsapAcik, { x: -w / 2 - 0.2, z: 0.3 });
  });
  return b;
}

/** Küçük balıkçı kulübesi, balık kurutma sehpası ve ağ fıçısı. */
export function buildFishery(): ModelBuilder {
  const b = new ModelBuilder('balikci');
  const w = 0.9;
  const d = 0.7;
  houseShell(b, { w, d, wallH: 0.6, rh: 0.36, wall: P.gokAcik, roof: P.ahsap, base: P.ahsapAcik, x: -0.12, z: -0.15, over: 0.1 });
  doorAt(b, -0.12, -0.15 + d / 2, 0.22, 0.42, P.ahsap, P.hardal);
  windowAt(b, -0.12 - w / 2, 0.25, -0.15, 0.18, 0.18, P.kagit, P.gok, -Math.PI / 2);
  // Kurutma sehpası: iki direk, bir sırık, asılı balıklar
  const rx = 0.62;
  b.as('govde', () => {
    for (const z of [-0.45, 0.25]) b.box(0.04, 0.62, 0.04, P.ahsap, { x: rx, z, wob: 0.03 });
    b.box(0.03, 0.03, 0.78, P.ahsap, { x: rx, y: 0.6, z: -0.1, wob: 0 });
  });
  b.piece('detay', () => {
    for (let i = 0; i < 4; i++) {
      const z = -0.38 + i * 0.18;
      b.cone(0.05, 0.2, 5, i % 2 === 0 ? P.gok : P.tasKoyu, { x: rx, y: 0.36, z, rx: Math.PI, wob: 0.05 });
    }
  });
  // Ağ fıçısı ve kürek
  b.as('detay', () => {
    b.cyl(0.11, 0.1, 0.22, 8, P.ahsapAcik, { x: 0.32, z: 0.5 });
    b.ball(0.08, P.zeytin, { x: 0.32, y: 0.24, z: 0.5 });
    b.box(0.05, 0.02, 0.6, P.ahsapAcik, { x: -0.55, y: 0.05, z: 0.45, ry: 0.5 });
  });
  return b;
}

/** Taş ocağı: kesme taş yığınları, ahşap vinç ve el arabası. */
export function buildQuarry(): ModelBuilder {
  const b = new ModelBuilder('tasOcagi');
  b.as('taban', () => {
    b.cyl(1.35, 1.4, 0.05, 9, P.tasKoyu, { wob: 0.08 });
  });
  // Kaya yığını (arkada)
  b.as('govde', () => {
    b.box(0.9, 0.55, 0.7, P.tas, { x: -0.25, z: -0.55, ry: 0.3, wob: 0.12 });
    b.box(0.6, 0.8, 0.55, P.tasKoyu, { x: 0.35, z: -0.6, ry: -0.4, wob: 0.12 });
    b.box(0.45, 0.35, 0.4, P.tas, { x: -0.75, z: -0.15, ry: 0.8, wob: 0.12 });
  });
  // Kesme taş blokları (önde, düzgün dizili)
  b.piece('detay', () => {
    for (let i = 0; i < 3; i++) b.box(0.26, 0.18, 0.2, P.krem, { x: -0.3 + i * 0.3, z: 0.55, wob: 0.03 });
    for (let i = 0; i < 2; i++) b.box(0.26, 0.18, 0.2, P.krem, { x: -0.15 + i * 0.3, y: 0.18, z: 0.55, wob: 0.03 });
  });
  // A çerçeveli vinç
  b.as('govde', () => {
    b.box(0.05, 1.3, 0.05, P.ahsap, { x: 0.75, z: 0.05, rz: 0.18, wob: 0 });
    b.box(0.05, 1.3, 0.05, P.ahsap, { x: 1.05, z: 0.05, rz: -0.18, wob: 0 });
  });
  b.piece('detay', () => {
    b.box(0.9, 0.05, 0.05, P.ahsap, { x: 0.6, y: 1.25, z: 0.05, wob: 0 });
    b.box(0.015, 0.6, 0.015, P.murekkep, { x: 0.25, y: 0.65, z: 0.05, wob: 0 });
    b.box(0.2, 0.14, 0.16, P.tas, { x: 0.25, y: 0.5, z: 0.05, wob: 0.05 });
  });
  // El arabası
  b.as('detay', () => {
    b.box(0.34, 0.12, 0.24, P.ahsapAcik, { x: 0.75, y: 0.12, z: 0.75, ry: -0.4, wob: 0.03 });
    b.cyl(0.08, 0.08, 0.04, 8, P.murekkep, { x: 0.9, y: 0.08, z: 0.88, rz: Math.PI / 2, ry: -0.4 });
  });
  return b;
}

/** Marangoz atölyesi: yanında açık sundurma, kalas yığını ve testere sehpası. */
export function buildCarpenter(): ModelBuilder {
  const b = new ModelBuilder('marangoz');
  const w = 1.3;
  const d = 0.95;
  houseShell(b, { w, d, wallH: 0.8, rh: 0.42, wall: P.ahsapAcik, roof: P.kiremit, base: P.tas, x: -0.2, z: -0.1 });
  const fz = -0.1 + d / 2;
  doorAt(b, -0.45, fz, 0.3, 0.5, P.ahsap, P.hardal);
  windowAt(b, 0.05, 0.28, fz, 0.32, 0.26, P.kagit, P.gokAcik);
  // Testere tabelası
  b.piece('detay', () => {
    b.box(0.4, 0.14, 0.03, P.hardal, { x: -0.2, y: 0.88, z: fz + 0.02, wob: 0.03 });
  });
  // Yan sundurma: iki direk + eğik çatı
  b.as('govde', () => {
    for (const z of [-0.45, 0.3]) b.box(0.05, 0.62, 0.05, P.ahsap, { x: 0.85, z, wob: 0.02 });
  });
  b.piece('cati', () => {
    b.box(0.5, 0.04, 0.95, P.kiremit, { x: 0.68, y: 0.66, z: -0.08, rz: -0.25, wob: 0.01 });
  });
  // Kalas yığını
  b.piece('detay', () => {
    for (let i = 0; i < 4; i++) b.box(0.08, 0.05, 0.7, P.kutuk, { x: 0.62 + (i % 2) * 0.1, y: i * 0.05, z: -0.08, wob: 0.01 });
  });
  // Testere sehpası (önde)
  b.as('detay', () => {
    b.box(0.5, 0.04, 0.08, P.ahsap, { x: 0.45, y: 0.26, z: 0.72, wob: 0 });
    for (const x of [0.25, 0.65]) b.box(0.04, 0.26, 0.2, P.ahsap, { x, z: 0.72, wob: 0.02 });
    b.box(0.6, 0.03, 0.12, P.kutuk, { x: 0.45, y: 0.3, z: 0.72, ry: 0.15, wob: 0 });
  });
  return b;
}
