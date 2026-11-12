import * as THREE from 'three';
import { PALETTE as P } from '../palette';
import { ModelBuilder, houseShell, windowAt, doorAt, panelBox } from './builder';

// Çeşme (0.8), Pazar (1.8), Okul (1.8), Saat Kulesi (1.3).

/** Yükseltme ekleri taban yarıçapının içinde kalır (çakışma hesabı değişmez). */
export function buildFountain(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'cesme' : `cesme-${level}`);
  if (level >= 2) {
    // Orta kat: sütunun ortasında ikinci, geniş çanak.
    b.piece('detay', () => {
      b.cyl(0.46, 0.24, 0.1, 8, P.tas, { y: 0.62, ry: Math.PI / 8 });
      b.cyl(0.41, 0.41, 0.012, 16, P.su, { y: 0.72, wob: 0, edges: false });
    });
  }
  if (level >= 3) {
    // Köşegenlerde dört taş saksı ve tepede altın top.
    b.piece('detay', () => {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const x = Math.sin(a) * 0.7;
        const z = Math.cos(a) * 0.7;
        b.cyl(0.08, 0.06, 0.12, 6, P.terrakota, { x, z, y: 0.34 });
        b.ball(0.08, P.yesil, { x, z, y: 0.5 });
      }
      b.ball(0.06, P.hardal, { y: 1.44 });
    });
  }
  const o8 = Math.PI / 8;
  b.as('taban', () => {
  b.cyl(0.74, 0.77, 0.3, 8, P.tas, { ry: o8, wob: 0 });
  });
  b.cyl(0.64, 0.64, 0.02, 16, P.su, { y: 0.3, wob: 0, edges: false });
  // Sekizgen kenar taşları
  const rr = 0.7;
  const seg = 2 * rr * Math.tan(Math.PI / 8) + 0.02;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const ho = rr + 0.06;
    b.piece('duvar', () => b.box(seg, 0.09, 0.12, P.tasKoyu, { x: Math.sin(a) * rr, z: Math.cos(a) * rr, y: 0.29, ry: a, wob: 0.03 }), { o: [Math.sin(a) * ho, 0.29, Math.cos(a) * ho], axis: [Math.cos(a), 0, -Math.sin(a)], angle: Math.PI / 2 });
  }
  // Orta sütun ve üst çanak
  b.as('govde', () => {
  b.cyl(0.09, 0.13, 0.72, 8, P.tas, { y: 0.3, ry: o8 });
  });
  b.piece('cati', () => {
  b.cyl(0.32, 0.17, 0.14, 8, P.tas, { y: 0.98, ry: o8 });
  });
  b.cyl(0.27, 0.27, 0.015, 16, P.su, { y: 1.12, wob: 0, edges: false });
  b.cone(0.08, 0.22, 6, P.su, { y: 1.12, wob: 0.05 });
  b.ball(0.05, P.gokAcik, { y: 1.36 });
  // Basamak taşları
  b.box(0.3, 0.05, 0.16, P.tasKoyu, { z: 0.82, wob: 0.06 });
  return b;
}

function stall(b: ModelBuilder, a: string, c: string, goods: string[]): void {
  // Yerel: önü +z. Tezgah, direkler, çizgili tente, mallar.
  b.as('govde', () => {
  b.box(0.82, 0.4, 0.4, P.ahsapAcik, { z: 0.12, wob: 0.02 });
  });
  b.box(0.86, 0.04, 0.44, P.ahsap, { z: 0.12, y: 0.4, wob: 0.01 });
  b.as('govde', () => {
  for (const x of [-0.4, 0.4]) {
    for (const z of [-0.14, 0.38]) b.box(0.04, 0.9, 0.04, P.ahsap, { x, z, wob: 0.03 });
  }
  });
  const n = 5;
  const L = 0.98;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + L / n / 2 + (i * L) / n;
    b.roof(L / n + 0.002, 0.72, 0.24, i % 2 === 0 ? a : c, { x, y: 0.88, z: 0.12, wob: 0 }, 0.03);
  }
  // Ön sarkan dalgalı kenar
  b.piece('detay', () => {
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + L / n / 2 + (i * L) / n;
    b.cone(L / n / 2, 0.08, 6, i % 2 === 0 ? a : c, { x, y: 0.79, z: 0.49, rx: Math.PI, wob: 0, edges: false });
  }
  });
  b.piece('detay', () => {
  goods.forEach((g, i) => {
    b.ball(0.07, g, { x: -0.27 + i * 0.18, y: 0.5, z: 0.2 });
    b.ball(0.06, g, { x: -0.2 + i * 0.18, y: 0.5, z: 0.06 });
  });
  });
  // Kasalar
  b.as('detay', () => {
  b.box(0.22, 0.16, 0.18, P.kutuk, { x: 0.25, z: -0.32, ry: 0.2, wob: 0.06 });
  b.box(0.2, 0.14, 0.16, P.kutuk, { x: -0.22, z: -0.3, ry: -0.3, wob: 0.06 });
  });
}

/** Çeşmeden dökülen su şeritleri (ayrı parça: titreşir). */
export function buildFountainWater(): ModelBuilder {
  const b = new ModelBuilder('cesme-su');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    b.withFrame(Math.sin(a) * 0.5, Math.cos(a) * 0.5, a, () => {
      b.box(0.07, 0.82, 0.012, P.su, { y: 0.3, rx: -0.2, wob: 0, edges: false });
    });
  }
  return b;
}

/** Tezgâhların arasındaki çizgili şemsiye. */
function umbrella(b: ModelBuilder, x: number, z: number, a: string, c: string): void {
  b.as('govde', () => {
    b.cyl(0.025, 0.025, 0.95, 6, P.ahsap, { x, z, wob: 0 });
  });
  b.piece('detay', () => {
    for (let i = 0; i < 6; i++) {
      b.cone(0.34, 0.2, 6, i % 2 === 0 ? a : c, { x, z, y: 0.92, ry: (i * Math.PI) / 3, wob: 0, edges: i === 0 });
    }
  });
}

export function buildMarket(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'pazar' : `pazar-${level}`);
  if (level >= 2) {
    const renk: [string, string][] = [[P.teal, P.kagit], [P.terrakota, P.krem], [P.lavanta, P.kagit]];
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + Math.PI / 6 + Math.PI / 3;
      umbrella(b, Math.sin(ang) * 1.05, Math.cos(ang) * 1.05, renk[i][0], renk[i][1]);
    }
  }
  if (level >= 3) {
    // Şemsiyelerin dibinde fıçılar ve direkte ikinci bayrak.
    b.as('detay', () => {
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3 + Math.PI / 6 + Math.PI / 3 + 0.35;
        b.cyl(0.11, 0.1, 0.24, 8, P.ahsapAcik, { x: Math.sin(ang) * 1.2, z: Math.cos(ang) * 1.2 });
      }
    });
    const flag2 = new THREE.Shape();
    flag2.moveTo(0, 0);
    flag2.lineTo(0.34, -0.08);
    flag2.lineTo(0, -0.18);
    flag2.closePath();
    b.piece('detay', () => {
      b.extrude(flag2, 0.015, P.gok, { x: 0.03, y: 1.6, ry: -0.9, wob: 0.03 });
    });
  }
  // Kaldırım taşı zemin
  b.as('taban', () => {
  b.cyl(1.5, 1.55, 0.04, 12, P.krem, { wob: 0 });
  });
  const sets: [string, string, string[]][] = [
    [P.gul, P.kagit, [P.kiremit, P.hardal, P.gul, P.yesil]],
    [P.gok, P.kagit, [P.bugday, P.ahsapAcik, P.bugdayKoyu, P.kutuk]],
    [P.hardal, P.kagit, [P.yesil, P.adacayi, P.terrakota, P.lavanta]],
  ];
  sets.forEach(([a, c, goods], i) => {
    const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
    b.withFrame(Math.sin(ang) * 0.72, Math.cos(ang) * 0.72, ang, () => stall(b, a, c, goods), 0.04);
  });
  // Ortada bayrak direği + fıçı
  b.as('govde', () => {
  b.cyl(0.14, 0.13, 0.3, 8, P.ahsap, { y: 0.04 });
  b.cyl(0.03, 0.03, 1.6, 6, P.kagit, { y: 0.34, wob: 0 });
  });
  const flag = new THREE.Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0.42, -0.1);
  flag.lineTo(0, -0.22);
  flag.closePath();
  b.piece('detay', () => {
  b.extrude(flag, 0.015, P.gul, { x: 0.03, y: 1.92, ry: 0.4, wob: 0.03 });
  });
  return b;
}

export function buildSchool(level = 1): ModelBuilder {
  const b = new ModelBuilder(level === 1 ? 'okul' : `okul-${level}`);
  if (level >= 2) {
    // Yanda bayrak direği.
    b.as('govde', () => {
      b.box(0.14, 0.06, 0.14, P.tas, { x: -1.0, z: 1.0, wob: 0 });
      b.cyl(0.02, 0.02, 1.7, 6, P.kagit, { x: -1.0, z: 1.0, y: 0.06, wob: 0 });
    });
    b.piece('detay', () => {
      b.box(0.4, 0.26, 0.015, P.kiremit, { x: -0.79, z: 1.0, y: 1.48, wob: 0.03 });
      b.ball(0.035, P.hardal, { x: -1.0, z: 1.0, y: 1.78 });
    });
  }
  if (level >= 3) {
    // Arkada tek katlı ek sınıf.
    const ez = -0.575 - 0.3;
    b.as('govde', () => {
      b.box(1.1, 0.7, 0.6, P.seftali, { z: ez, wob: 0.01 });
      for (const sx of [-1, 1]) b.box(0.06, 0.7, 0.06, P.kagit, { x: sx * 0.55, z: ez - 0.3, wob: 0 });
    });
    b.roof(1.2, 0.72, 0.28, P.arduvaz, { y: 0.7, z: ez, wob: 0.01 }, 0.05);
    for (const x of [-0.3, 0.3]) windowAt(b, x, 0.22, ez - 0.3, 0.2, 0.3, P.kagit, P.gok, Math.PI);
  }
  const w = 2.3;
  const d = 1.15;
  const wallH = 0.95;
  const rh = 0.55;
  const top = houseShell(b, { w, d, wallH, rh, wall: P.terrakota, roof: P.arduvaz, base: P.tas, over: 0.13 });
  const fz = d / 2;
  // Beyaz köşe pervazları
  b.as('govde', () => {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(0.07, wallH, 0.07, P.kagit, { x: (sx * w) / 2, z: (sz * d) / 2, wob: 0 });
    }
  }
  });
  doorAt(b, 0, fz, 0.32, 0.56, P.gok, P.hardal);
  // Kapı saçağı
  b.roof(0.56, 0.36, 0.14, P.arduvaz, { y: 0.62, z: fz + 0.15, wob: 0.01 }, 0.04);
  b.as('govde', () => {
  for (const x of [-0.24, 0.24]) b.box(0.04, 0.62, 0.04, P.kagit, { x, z: fz + 0.3, wob: 0.02 });
  });
  for (const x of [-0.85, -0.5, 0.5, 0.85]) windowAt(b, x, 0.32, fz, 0.22, 0.36, P.kagit, P.gok);
  for (const x of [-0.7, 0, 0.7]) windowAt(b, x, 0.32, -fz, 0.22, 0.36, P.kagit, P.gok, Math.PI);
  for (const s of [-1, 1]) windowAt(b, (s * w) / 2, 0.32, 0, 0.24, 0.36, P.kagit, P.gok, (s * Math.PI) / 2);
  // Çan kulesi: mahyanın ortasında
  const by = wallH + rh * 0.4;
  b.as('govde', () => {
  b.box(0.48, top - by + 0.12, 0.48, P.kagit, { y: by, wob: 0 });
  });
  const belfry = top + 0.12;
  b.as('govde', () => {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.box(0.07, 0.42, 0.07, P.kagit, { x: sx * 0.2, z: sz * 0.2, y: belfry, wob: 0 });
  }
  });
  b.as('detay', () => {
  b.cone(0.11, 0.2, 8, P.hardal, { y: belfry + 0.12 });
  });
  b.piece('cati', () => {
  b.box(0.52, 0.05, 0.52, P.arduvaz, { y: belfry + 0.42, wob: 0 });
  b.cone(0.42, 0.5, 4, P.arduvaz, { y: belfry + 0.47 });
  b.ball(0.05, P.hardal, { y: belfry + 0.98 });
  });
  // Önde küçük tabela tahtası
  b.box(0.04, 0.32, 0.04, P.ahsap, { x: 0.75, z: fz + 0.4 });
  b.box(0.36, 0.2, 0.03, P.adacayi, { x: 0.75, z: fz + 0.42, y: 0.24, wob: 0.04 });
  return b;
}

/** Anıt (Saat Kulesi) aşama sayısı; render tarafında sabit (logic'e bağlanmaz). */
export const ANIT_ASAMA = 4;
/** İskele parçalarının grup etiketi: aşama 0'da kurulur, son aşamada kalkar. */
export const ISKELE_GRUP = 9;

/**
 * Saat Kulesi. asama 0: taban + iskele, 1: + gövdenin alt yarısı, 2: + üst yarısı, 3: + saat ve balkon,
 * 4: + çatı ve bayrak, iskele yok (tam kule). Parça grupları `grup` ile aşamasını taşır.
 * Bütün parçalar her aşamada aynı sırayla üretilir, aşamada olmayanlar bake'te atılır: ortak parçalar birebir aynıdır.
 */
export function buildClockTower(asama = ANIT_ASAMA): ModelBuilder {
  const b = new ModelBuilder('saatKulesi');
  const son = asama >= ANIT_ASAMA;
  b.keep = (g) => (g === ISKELE_GRUP ? !son : g <= asama);
  const grup = (g: number, fn: () => void) => {
    const prev = b.grup;
    b.grup = g;
    fn();
    b.grup = prev;
  };
  // --- Aşama 0: taban ---
  grup(0, () => {
    b.piece('taban', () => {
      b.box(1.5, 0.28, 1.5, P.tasKoyu, { wob: 0 });
      b.box(1.22, 0.26, 1.22, P.tas, { y: 0.28, wob: 0 });
    });
  });
  const shaftY = 0.54;
  const shaftH = 3.1;
  const sw = 0.92;
  const alt = 1.5; // alt yarının yüksekliği (ortadaki kuşak bu dikişi örter)
  // --- Aşama 1 / 2: gövdenin alt ve üst yarısı ---
  grup(1, () => panelBox(b, { w: sw, h: alt, d: sw, color: P.krem, y: shaftY }));
  grup(2, () => panelBox(b, { w: sw, h: shaftH - alt, d: sw, color: P.krem, y: shaftY + alt }));
  // Köşe pilastrları
  b.as('govde', () => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (sw / 2);
        const z = sz * (sw / 2);
        grup(1, () => b.box(0.12, alt, 0.12, P.seftali, { x, z, y: shaftY, wob: 0 }));
        grup(2, () => b.box(0.12, shaftH - alt, 0.12, P.seftali, { x, z, y: shaftY + alt, wob: 0 }));
      }
    }
  });
  grup(1, () => b.box(sw + 0.12, 0.08, sw + 0.12, P.terrakota, { y: shaftY + alt, wob: 0 }));
  // Kapı ve dar pencereler
  grup(1, () => {
    b.piece('detay', () => {
      b.withFrame(0, 0, 0, () => {
        b.plate(0.34, 0.6, P.ahsap, { y: shaftY, z: sw / 2 + 0.015, wob: 0.01 });
        b.cyl(0.17, 0.17, 0.03, 12, P.ahsap, { y: shaftY + 0.6, z: sw / 2 + 0.0, rx: Math.PI / 2, wob: 0, edges: false });
      });
    });
  });
  for (let i = 0; i < 4; i++) {
    b.withFrame(0, 0, (i * Math.PI) / 2, () => {
      grup(2, () => windowAt(b, 0, shaftY + 1.9, sw / 2, 0.14, 0.42, P.kagit, P.gok));
      if (i !== 0) grup(1, () => windowAt(b, 0, shaftY + 0.8, sw / 2, 0.14, 0.42, P.kagit, P.gok));
    });
  }
  // --- Aşama 3: saat bölmesi ---
  const cy = shaftY + shaftH;
  const cw = 1.12;
  const ch = 1.0;
  grup(2, () => b.box(cw + 0.08, 0.08, cw + 0.08, P.terrakota, { y: cy, wob: 0 }));
  grup(3, () => {
    b.as('govde', () => {
      b.box(cw, ch, cw, P.kagit, { y: cy + 0.08, wob: 0 });
    });
    b.box(cw + 0.16, 0.1, cw + 0.16, P.terrakota, { y: cy + 0.08 + ch, wob: 0 });
  });
  const fy = cy + 0.08 + ch / 2;
  for (let i = 0; i < 4; i++) {
    b.withFrame(0, 0, (i * Math.PI) / 2, () => {
      grup(3, () => {
        b.piece('detay', () => {
          const z = cw / 2;
          // Halka + kadran (silindir tabanı z'ye bakacak şekilde)
          b.cyl(0.42, 0.42, 0.03, 20, P.hardal, { y: fy, z, rx: Math.PI / 2, wob: 0 });
          b.cyl(0.36, 0.36, 0.03, 20, P.beyaz, { y: fy, z: z + 0.025, rx: Math.PI / 2, wob: 0 });
          // Saat işaretleri
          for (let k = 0; k < 12; k++) {
            const a = (k * Math.PI) / 6;
            const big = k % 3 === 0;
            b.box(0.025, big ? 0.07 : 0.04, 0.012, P.murekkep, {
              x: Math.sin(a) * 0.28,
              y: fy + Math.cos(a) * 0.28 - (big ? 0.035 : 0.02),
              z: z + 0.06,
              rz: -a,
              wob: 0,
              edges: false,
            });
          }
          // Akrep ve yelkovan (10:10)
          b.box(0.035, 0.18, 0.012, P.murekkep, { y: fy, z: z + 0.07, rz: -(Math.PI * 2 * 10) / 12, wob: 0, edges: false });
          b.box(0.025, 0.27, 0.012, P.murekkep, { y: fy, z: z + 0.075, rz: -(Math.PI * 2 * 2) / 12, wob: 0, edges: false });
          b.ball(0.03, P.kiremit, { y: fy, z: z + 0.08 });
        });
      });
    });
  }
  // --- Aşama 4: çatı ---
  const ry = cy + 0.08 + ch + 0.1;
  grup(4, () => {
    b.piece('cati', () => {
      b.cone(0.98, 1.35, 4, P.teal, { y: ry, wob: 0.005 });
    });
    b.piece('detay', () => {
      b.cyl(0.02, 0.02, 0.45, 6, P.murekkep, { y: ry + 1.25, wob: 0 });
      b.ball(0.09, P.hardal, { y: ry + 1.4 });
    });
  });
  // Yeni parçalar sonda: rastgele sıra kaymasın, eski parçalar aynı kalsın.
  // --- Aşama 3: saatin altında balkon ---
  grup(3, () => {
    const by = cy - 0.06;
    const bw = 1.46;
    b.piece('detay', () => {
      b.box(bw, 0.06, bw, P.kagit, { y: by, wob: 0 });
      // Konsollar
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) b.box(0.08, 0.14, 0.08, P.terrakota, { x: sx * 0.6, z: sz * 0.6, y: by - 0.14, wob: 0 });
      }
    });
    for (let i = 0; i < 4; i++) {
      b.withFrame(0, 0, (i * Math.PI) / 2, () => {
        b.piece('detay', () => {
          const z = bw / 2 - 0.03;
          for (let k = 0; k <= 6; k++) b.box(0.03, 0.15, 0.03, P.kagit, { x: -bw / 2 + 0.03 + (k * (bw - 0.06)) / 6, z, y: cy, wob: 0 });
          b.box(bw, 0.03, 0.045, P.terrakota, { z, y: cy + 0.14, wob: 0 });
        });
      });
    }
  });
  // --- Aşama 4: direğin tepesinde kağıt flama ---
  grup(4, () => {
    b.piece('detay', () => {
      b.cyl(0.015, 0.015, 0.14, 6, P.murekkep, { y: ry + 1.68, wob: 0 });
      const f = new THREE.Shape();
      f.moveTo(0, 0);
      f.lineTo(0.44, -0.02);
      f.lineTo(0.33, -0.11);
      f.lineTo(0.44, -0.21);
      f.lineTo(0, -0.21);
      f.closePath();
      b.extrude(f, 0.015, P.bayrak, { x: 0.02, y: ry + 1.8, ry: 0.35, wob: 0.03 });
    });
  });
  // --- İskele (aşama 0–3; tamamlanınca kalkar) ---
  grup(ISKELE_GRUP, () => scaffold(b));
  return b;
}

/** Kağıttan ahşap iskele: dikmeler, kat platformları, yatay kuşaklar ve çapraz çubuklar. */
function scaffold(b: ModelBuilder): void {
  const e = 0.8; // dikmelerin merkezden uzaklığı
  const top = 4.6;
  const kat = [0, 1.4, 2.45, 3.4, 4.55];
  for (let i = 0; i < 4; i++) {
    b.withFrame(0, 0, (i * Math.PI) / 2, () => {
      // Dikmeler: köşe (her yüz bir köşe) + arka/yan yüzlerde orta dikme
      b.piece('govde', () => {
        b.box(0.16, 0.03, 0.16, P.iskeleKoyu, { x: -e, z: e, wob: 0.05 });
        b.box(0.065, top, 0.065, P.iskele, { x: -e, z: e, wob: 0.006 });
        if (i !== 0) {
          b.box(0.16, 0.03, 0.16, P.iskeleKoyu, { x: 0, z: e, wob: 0.05 });
          b.box(0.055, top, 0.055, P.iskele, { x: 0, z: e, wob: 0.006 });
        }
      });
      // Yatay kuşaklar ve çaprazlar
      b.piece('detay', () => {
        for (let k = 1; k < kat.length; k++) {
          b.box(2 * e + 0.08, 0.045, 0.04, P.iskeleKoyu, { y: kat[k], z: e + 0.045, wob: 0.01 });
        }
        for (let k = 0; k < kat.length - 1; k++) {
          if (i === 0 && k === 0) continue; // kapının önü açık
          const y0 = kat[k] + 0.05;
          const dy = kat[k + 1] - y0;
          const L = Math.hypot(2 * e, dy);
          const ang = Math.atan2(2 * e, dy);
          const ters = (k + i) % 2 === 1;
          b.box(0.035, L, 0.03, P.iskeleKoyu, { x: ters ? e : -e, y: y0, z: e + 0.07, rz: ters ? ang : -ang, wob: 0 });
        }
      });
    });
  }
  // Kat platformları (tahta döşeme)
  for (let k = 1; k < kat.length - 1; k++) {
    b.piece('detay', () => {
      for (let i = 0; i < 4; i++) {
        b.withFrame(0, 0, (i * Math.PI) / 2, () => {
          const len = i % 2 === 0 ? 2 * e - 0.04 : 1.08;
          b.box(len, 0.035, 0.26, P.iskeleTahta, { y: kat[k] + 0.045, z: 0.67, wob: 0.015 });
        });
      }
    });
  }
}
