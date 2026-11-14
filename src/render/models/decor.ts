import * as THREE from 'three';
import { PALETTE as P } from '../palette';
import { ModelBuilder, panelBox, windowAt, doorAt } from './builder';
import { ANIT_ASAMA, ISKELE_GRUP } from './civic';

// Süsler (bank, lamba, çit, çiçeklik, heykel) ve büyük projeler (Kervansaray, Botanik Bahçesi).
// Parçalar taban yarıçapının içinde kalır; önü +z. Büyük projeler Saat Kulesi gibi aşamalıdır (grup = aşama,
// iskele ISKELE_GRUP); aşama < ANIT_ASAMA iken yalnızca o aşamaya kadarki gruplar ve iskele tutulur.

/** Kağıt bank: oturak, arkalık, iki ayak. */
export function buildBench(): ModelBuilder {
  const b = new ModelBuilder('bank');
  b.as('govde', () => {
    b.box(0.6, 0.05, 0.18, P.ahsap, { y: 0.2, wob: 0.01 });
    b.box(0.6, 0.18, 0.035, P.ahsap, { y: 0.26, z: -0.08, wob: 0.01 });
  });
  b.as('detay', () => {
    for (const s of [-1, 1]) b.box(0.05, 0.2, 0.16, P.ahsapAcik, { x: s * 0.24, wob: 0 });
  });
  return b;
}

/** Sokak lambası: ince direk, camlı fener (gece yanar), külah şapka. */
export function buildLamp(): ModelBuilder {
  const b = new ModelBuilder('lamba');
  b.as('taban', () => b.cyl(0.09, 0.11, 0.08, 8, P.tasKoyu, { wob: 0.02 }));
  b.as('govde', () => b.cyl(0.03, 0.035, 1.2, 6, P.murekkep, { y: 0.08, wob: 0 }));
  b.as('detay', () => {
    b.box(0.2, 0.025, 0.2, P.murekkep, { y: 1.26, wob: 0 });
    for (let i = 0; i < 4; i++) {
      const ry = (i * Math.PI) / 2;
      b.plate(0.15, 0.2, P.pencereIsik, { x: Math.sin(ry) * 0.075, z: Math.cos(ry) * 0.075, y: 1.285, ry, wob: 0, edges: false, isik: true });
    }
    b.cone(0.15, 0.14, 4, P.murekkep, { y: 1.49, ry: Math.PI / 4, wob: 0 });
    b.ball(0.03, P.hardal, { y: 1.65 });
  });
  return b;
}

/** Kağıt çit: üç kazık ve iki kuşak (yaklaşık 0.8 uzun). */
export function buildFence(): ModelBuilder {
  const b = new ModelBuilder('cit');
  b.as('govde', () => {
    for (let i = -2; i <= 2; i++) {
      b.box(0.06, 0.34, 0.04, P.kagit, { x: i * 0.17, wob: 0.04 });
      const tip = new THREE.Shape();
      tip.moveTo(-0.03, 0);
      tip.lineTo(0.03, 0);
      tip.lineTo(0, 0.06);
      tip.closePath();
      b.extrude(tip, 0.04, P.kagit, { x: i * 0.17, y: 0.34, z: -0.02, wob: 0 });
    }
  });
  b.as('detay', () => {
    for (const y of [0.1, 0.24]) b.box(0.78, 0.04, 0.025, P.krem, { y, z: 0.03, wob: 0.01 });
  });
  return b;
}

/** Çiçeklik: taş saksı, içinde renkli çiçek topları ve yapraklar. */
export function buildPlanter(): ModelBuilder {
  const b = new ModelBuilder('ciceklik');
  b.as('govde', () => {
    b.box(0.5, 0.22, 0.5, P.tas, { wob: 0.01 });
    b.box(0.56, 0.05, 0.56, P.tasKoyu, { y: 0.22, wob: 0 });
    b.box(0.46, 0.03, 0.46, P.toprakIz, { y: 0.24, wob: 0, edges: false });
  });
  b.as('detay', () => {
    const renk = [P.gul, P.hardal, P.lavanta, P.pembe, P.terrakota];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const r = i === 0 ? 0 : 0.14;
      b.ball(0.05, P.yesil, { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.3 });
      b.ball(0.055, renk[i % renk.length], { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.37 });
    }
  });
  return b;
}

/** Heykel: basamaklı kaide, üstünde elinde fener tutan kağıt figür. */
export function buildStatue(): ModelBuilder {
  const b = new ModelBuilder('heykel');
  b.as('taban', () => {
    b.box(1.3, 0.12, 1.3, P.tasKoyu, { wob: 0 });
    b.box(1.0, 0.12, 1.0, P.tas, { y: 0.12, wob: 0 });
  });
  b.as('govde', () => {
    b.box(0.6, 0.7, 0.6, P.tas, { y: 0.24, wob: 0 });
    b.box(0.7, 0.08, 0.7, P.tasKoyu, { y: 0.94, wob: 0 });
  });
  const bronz = P.teal;
  b.as('detay', () => {
    // Figür: pelerinli gövde, baş, kaldırılmış kol ve fener
    b.cyl(0.13, 0.22, 0.7, 8, bronz, { y: 1.02, wob: 0.01 });
    b.ball(0.12, bronz, { y: 1.84 });
    b.cyl(0.04, 0.04, 0.42, 6, bronz, { x: 0.18, y: 1.5, rz: -0.6, wob: 0 });
    b.box(0.1, 0.12, 0.1, P.hardal, { x: 0.36, y: 1.82, wob: 0 });
    // Kaidede altın plaka
    b.plate(0.36, 0.16, P.hardal, { y: 0.5, z: 0.31, wob: 0 });
  });
  return b;
}

/** Aşama grubu yardımcısı. */
function grupla(b: ModelBuilder, g: number, fn: () => void): void {
  const prev = b.grup;
  b.grup = g;
  fn();
  b.grup = prev;
}

/** Alçak kağıt iskele: köşe ve orta dikmeler, iki kat platform kuşağı. w × d taban, h yükseklik. */
function alcakIskele(b: ModelBuilder, w: number, d: number, h: number): void {
  const xs = [-w / 2, 0, w / 2];
  const zs = [-d / 2, d / 2];
  b.piece('govde', () => {
    for (const x of xs) for (const z of zs) b.box(0.06, h, 0.06, P.iskele, { x, z, wob: 0.006 });
  });
  b.piece('detay', () => {
    for (const y of [h * 0.45, h * 0.9]) {
      for (const z of zs) b.box(w + 0.08, 0.04, 0.04, P.iskeleKoyu, { y, z: z + Math.sign(z) * 0.04, wob: 0.01 });
      for (const x of [-w / 2, w / 2]) b.box(0.04, 0.04, d + 0.08, P.iskeleKoyu, { x: x + Math.sign(x) * 0.04, y, wob: 0.01 });
    }
    b.box(w * 0.5, 0.03, 0.22, P.iskeleTahta, { y: h * 0.45, z: d / 2 + 0.1, wob: 0.02 });
  });
}

/**
 * Kervansaray: avlulu taş han. Aşamalar: 0 taban, 1 alt duvarlar, 2 kemerli kapı ve üst duvarlar,
 * 3 çatılar, 4 kubbe, bayraklar ve süs.
 */
export function buildCaravanserai(asama = ANIT_ASAMA): ModelBuilder {
  const b = new ModelBuilder('kervansaray');
  const son = asama >= ANIT_ASAMA;
  b.keep = (g) => (g === ISKELE_GRUP ? !son : g <= asama);
  const W = 2.5;
  const D = 2.2;
  grupla(b, 0, () => {
    b.piece('taban', () => {
      b.box(W + 0.2, 0.14, D + 0.2, P.tasKoyu, { wob: 0 });
      b.box(1.0, 0.02, 1.0, P.kum, { y: 0.14, wob: 0, edges: false }); // avlu
    });
  });
  // Dört kanat: ön kanatta kapı aralığı
  const kanatH = 0.62;
  const kanat = (x: number, z: number, w: number, d: number, y: number, h: number): void =>
    panelBox(b, { w, h, d, color: P.krem, x, z, y });
  grupla(b, 1, () => {
    kanat(0, -D / 2 + 0.3, W, 0.6, 0.14, kanatH);
    kanat(-W / 2 + 0.3, 0, 0.6, D - 1.2, 0.14, kanatH);
    kanat(W / 2 - 0.3, 0, 0.6, D - 1.2, 0.14, kanatH);
    kanat(-W / 2 + 0.45, D / 2 - 0.3, 0.9, 0.6, 0.14, kanatH);
    kanat(W / 2 - 0.45, D / 2 - 0.3, 0.9, 0.6, 0.14, kanatH);
  });
  grupla(b, 2, () => {
    // Kemerli giriş kulesi
    panelBox(b, { w: 0.7, h: 1.05, d: 0.66, color: P.seftali, z: D / 2 - 0.3, y: 0.14 });
    b.piece('detay', () => {
      b.cyl(0.2, 0.2, 0.05, 12, P.ahsap, { y: 0.66, z: D / 2 + 0.035, rx: Math.PI / 2, wob: 0, edges: false });
      b.plate(0.4, 0.5, P.ahsap, { y: 0.14, z: D / 2 + 0.035, wob: 0.01 });
    });
    for (const s of [-1, 1]) {
      windowAt(b, s * 0.85, 0.42, D / 2 + 0.005, 0.16, 0.24, P.kagit, P.gok);
      windowAt(b, s * 0.85, 0.42, -D / 2 - 0.005, 0.16, 0.24, P.kagit, P.gok, Math.PI);
    }
  });
  grupla(b, 3, () => {
    b.roof(W + 0.1, 0.72, 0.28, P.kiremit, { y: 0.14 + kanatH, z: -D / 2 + 0.3 });
    for (const s of [-1, 1]) {
      b.roof(D - 1.1, 0.72, 0.28, P.kiremit, { x: s * (W / 2 - 0.3), y: 0.14 + kanatH, ry: Math.PI / 2 });
      b.roof(1.0, 0.72, 0.28, P.kiremit, { x: s * (W / 2 - 0.45), y: 0.14 + kanatH, z: D / 2 - 0.3 });
    }
    b.piece('cati', () => b.box(0.82, 0.08, 0.78, P.terrakota, { y: 1.19, z: D / 2 - 0.3, wob: 0 }));
  });
  grupla(b, 4, () => {
    b.piece('cati', () => {
      const g = new THREE.SphereGeometry(0.3, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      b.add(g, P.teal, { y: 1.27, z: D / 2 - 0.3, edgeDeg: 30, wob: 0.01 });
      g.dispose();
    });
    b.piece('detay', () => {
      b.cyl(0.015, 0.015, 0.5, 6, P.murekkep, { y: 1.5, z: D / 2 - 0.3, wob: 0 });
      const f = new THREE.Shape();
      f.moveTo(0, 0);
      f.lineTo(0.34, -0.06);
      f.lineTo(0, -0.16);
      f.closePath();
      b.extrude(f, 0.012, P.tuccarTente, { x: 0.01, y: 1.98, z: D / 2 - 0.3, wob: 0.03 });
      // Avluda kumaş tezgâhı
      b.box(0.36, 0.2, 0.22, P.ahsap, { y: 0.15, z: 0.1, wob: 0.01 });
      b.box(0.42, 0.04, 0.3, P.kumasMor, { y: 0.35, z: 0.1, wob: 0.02 });
    });
  });
  grupla(b, ISKELE_GRUP, () => alcakIskele(b, W + 0.3, D + 0.3, 1.4));
  return b;
}

/**
 * Botanik Bahçesi: çimenli bahçe, çiçek tarhları, camlı sera ve kubbeli serası. Aşamalar: 0 taban ve patikalar,
 * 1 tarhlar ve çit, 2 sera iskeleti, 3 camlar (gece yanar), 4 kubbe ve süs.
 */
export function buildBotanic(asama = ANIT_ASAMA): ModelBuilder {
  const b = new ModelBuilder('botanik');
  const son = asama >= ANIT_ASAMA;
  b.keep = (g) => (g === ISKELE_GRUP ? !son : g <= asama);
  const R = 1.85;
  grupla(b, 0, () => {
    b.piece('taban', () => {
      b.cyl(R, R + 0.05, 0.06, 14, P.cimenAcik, { wob: 0.02 });
      b.box(0.34, 0.02, R * 2 - 0.2, P.patika, { y: 0.06, wob: 0, edges: false });
      b.box(R * 2 - 0.2, 0.02, 0.34, P.patika, { y: 0.06, wob: 0, edges: false });
    });
  });
  grupla(b, 1, () => {
    const renk = [P.gul, P.hardal, P.lavanta, P.terrakota];
    b.piece('detay', () => {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const x = Math.cos(a) * 1.15;
        const z = Math.sin(a) * 1.15;
        b.box(0.62, 0.08, 0.62, P.toprakIz, { x, z, y: 0.06, wob: 0.01 });
        for (let k = 0; k < 5; k++) {
          b.ball(0.07, P.yesil, { x: x + ((k % 3) - 1) * 0.17, z: z + (Math.floor(k / 3) - 0.5) * 0.2, y: 0.17 });
          b.ball(0.06, renk[(i + k) % renk.length], { x: x + ((k % 3) - 1) * 0.17, z: z + (Math.floor(k / 3) - 0.5) * 0.2, y: 0.25 });
        }
      }
    });
  });
  // Sera: arkada uzun camlı ev (beşik çatı), önde kubbeli cam köşk
  const sW = 1.5;
  const sD = 0.7;
  const sZ = -0.85;
  const sH = 0.62;
  grupla(b, 2, () => {
    b.piece('govde', () => {
      for (const x of [-sW / 2, 0, sW / 2]) {
        for (const z of [sZ - sD / 2, sZ + sD / 2]) b.box(0.05, sH, 0.05, P.kagit, { x, z, y: 0.06, wob: 0 });
      }
      b.box(sW + 0.05, 0.05, 0.05, P.kagit, { y: 0.06 + sH, z: sZ - sD / 2, wob: 0 });
      b.box(sW + 0.05, 0.05, 0.05, P.kagit, { y: 0.06 + sH, z: sZ + sD / 2, wob: 0 });
      b.box(sW + 0.1, 0.06, sD + 0.1, P.tas, { y: 0.0, z: sZ, wob: 0 });
    });
  });
  grupla(b, 3, () => {
    b.piece('duvar', () => {
      for (const z of [sZ - sD / 2, sZ + sD / 2]) {
        b.plate(sW - 0.04, sH - 0.04, P.gokAcik, { y: 0.08, z, wob: 0, edges: true, isik: true });
      }
      for (const x of [-sW / 2, sW / 2]) {
        b.plate(sD - 0.04, sH - 0.04, P.gokAcik, { x, y: 0.08, z: sZ, ry: Math.PI / 2, wob: 0, edges: true, isik: true });
      }
    });
    b.roof(sW + 0.08, sD + 0.1, 0.32, P.gokAcik, { y: 0.06 + sH, z: sZ }, 0.03);
  });
  grupla(b, 4, () => {
    b.piece('cati', () => {
      b.cyl(0.42, 0.42, 0.4, 10, P.gokAcik, { y: 0.06, z: 0.75, wob: 0 });
      const g = new THREE.SphereGeometry(0.44, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      b.add(g, P.gokAcik, { y: 0.46, z: 0.75, edgeDeg: 20, wob: 0.005 });
      g.dispose();
    });
    b.piece('detay', () => {
      b.ball(0.06, P.hardal, { y: 0.92, z: 0.75 });
      // İçeride palmiye
      b.cyl(0.03, 0.04, 0.4, 5, P.ahsap, { y: 0.06, z: 0.75 });
      b.ball(0.16, P.koyuYesil, { y: 0.5, z: 0.75 });
    });
    doorAt(b, 0, 0.75 + 0.43, 0.22, 0.34, P.kagit, P.hardal);
  });
  grupla(b, ISKELE_GRUP, () => alcakIskele(b, sW + 0.3, 2.6, 1.1));
  return b;
}

/**
 * Meydan: taş döşeli yuvarlak meydan. Görünüm (seviye) karaktere göre: 1 seçilmemiş (ilan panosu),
 * 2 Çarşı (tenteli tezgâhlar), 3 Bahçeli (ortada ağaç, tarhlar, banklar), 4 Zanaat (tezgâh, örs, odun yığını).
 */
export function buildSquare(gorunum = 1): ModelBuilder {
  const b = new ModelBuilder('meydan');
  b.as('taban', () => {
    b.cyl(1.3, 1.34, 0.06, 14, P.tas, { wob: 0.01 });
    b.cyl(0.55, 0.55, 0.02, 12, P.tasKoyu, { y: 0.06, wob: 0, edges: false });
  });
  if (gorunum === 1) {
    b.as('govde', () => {
      b.box(0.05, 0.6, 0.05, P.ahsap, { x: -0.25, y: 0.06, wob: 0 });
      b.box(0.05, 0.6, 0.05, P.ahsap, { x: 0.25, y: 0.06, wob: 0 });
      b.box(0.62, 0.4, 0.04, P.ahsapAcik, { y: 0.34, wob: 0.01 });
    });
    b.as('detay', () => {
      b.plate(0.22, 0.16, P.kagit, { x: -0.12, y: 0.44, z: 0.03, wob: 0.05 });
      b.plate(0.18, 0.22, P.krem, { x: 0.14, y: 0.4, z: 0.03, wob: 0.05 });
    });
  } else if (gorunum === 2) {
    const tente = [P.tuccarTente, P.hardal, P.teal];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      b.withFrame(Math.cos(a) * 0.72, Math.sin(a) * 0.72, -a + Math.PI / 2, () => {
        b.piece('govde', () => {
          b.box(0.5, 0.26, 0.28, P.ahsap, { y: 0.06, wob: 0.01 });
          for (const s of [-1, 1]) b.box(0.035, 0.62, 0.035, P.ahsapAcik, { x: s * 0.23, z: -0.12, y: 0.06, wob: 0 });
        });
        b.piece('cati', () => b.box(0.6, 0.04, 0.42, tente[i], { y: 0.66, z: 0.02, rx: 0.25, wob: 0.02 }));
        b.piece('detay', () => {
          b.ball(0.06, P.hardal, { x: -0.12, y: 0.37 });
          b.ball(0.06, P.gul, { x: 0.02, y: 0.37 });
          b.box(0.12, 0.08, 0.1, P.kumasMavi, { x: 0.15, y: 0.33, wob: 0.05 });
        });
      });
    }
  } else if (gorunum === 3) {
    b.as('govde', () => {
      b.cyl(0.06, 0.08, 0.7, 6, P.ahsap, { y: 0.06 });
      b.ball(0.38, P.yesil, { y: 0.95 });
      b.ball(0.26, P.koyuYesil, { x: 0.18, y: 1.12, z: 0.1 });
    });
    b.as('detay', () => {
      const renk = [P.gul, P.lavanta, P.hardal, P.pembe];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const x = Math.cos(a) * 0.82;
        const z = Math.sin(a) * 0.82;
        b.box(0.36, 0.06, 0.24, P.toprakIz, { x, z, y: 0.06, ry: -a, wob: 0 });
        for (let k = -1; k <= 1; k++) b.ball(0.06, renk[(i + k + 4) % 4], { x: x + Math.cos(a + Math.PI / 2) * k * 0.11, z: z + Math.sin(a + Math.PI / 2) * k * 0.11, y: 0.15 });
      }
      for (const s of [-1, 1]) {
        b.withFrame(s * 0.55, 0, s * Math.PI / 2, () => {
          b.box(0.4, 0.035, 0.12, P.ahsap, { y: 0.19, wob: 0.01 });
          b.box(0.4, 0.12, 0.025, P.ahsap, { y: 0.23, z: -0.055, wob: 0.01 });
        });
      }
    });
  } else {
    b.as('govde', () => {
      b.box(0.62, 0.32, 0.3, P.ahsap, { x: -0.3, y: 0.06, z: 0.2, wob: 0.01 });
      b.box(0.3, 0.16, 0.2, P.murekkep, { x: 0.45, y: 0.06, z: -0.1, wob: 0 });
      b.box(0.36, 0.08, 0.16, P.tasKoyu, { x: 0.45, y: 0.22, z: -0.1, wob: 0 });
      b.cyl(0.2, 0.24, 0.42, 8, P.terrakota, { x: -0.2, y: 0.06, z: -0.55 });
    });
    b.as('detay', () => {
      for (let i = 0; i < 4; i++) b.cyl(0.06, 0.06, 0.5, 6, P.ahsapAcik, { x: 0.55 + (i % 2) * 0.13, y: 0.1 + Math.floor(i / 2) * 0.12, z: 0.45, rx: Math.PI / 2, wob: 0 });
      b.box(0.14, 0.04, 0.1, P.tas, { x: -0.38, y: 0.38, z: 0.2, wob: 0.05 });
      b.box(0.04, 0.16, 0.04, P.ahsapAcik, { x: -0.18, y: 0.38, z: 0.2, rz: 0.4, wob: 0 });
      b.ball(0.08, P.hardal, { x: -0.2, y: 0.5, z: -0.55 }); // ocak ateşi
    });
  }
  return b;
}
