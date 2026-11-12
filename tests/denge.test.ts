// Denge ölçümü (GELISTIRME-PLANI.md, Aşama 1b): elle kurulmuş üç referans kasabanın
// bir günlük vergi, gider ve net gelirini hesaplayıp yazdırır. Sayı değiştirmez, yalnızca ölçer.
// Çıktıyı görmek için: npx vitest run tests/denge.test.ts
import { describe, expect, it } from 'vitest';
import { endDay, stockLimit } from '../src/logic/game';
import { evaluateNeeds, houseLevel } from '../src/logic/economy';
import type { BuildingType, GameState, Good } from '../src/logic/types';
import { add, addRoad, blank } from './helpers';

/** Halka üzerindeki evlerin merkeze uzaklığı: çeşme (7), pazar (8), okul ve hastane (9) alanında kalır. */
const EV_HALKA = 5.5;
/** Asfalt çevre yolu yarıçapı: halka evleri bu yolun kenarındadır. */
const YOL_HALKA = 7;

interface Mahalle {
  /** Merkez çevresine kurulan hizmet binaları ve seviyeleri. */
  hizmetler: [BuildingType, number][];
  /** Ev seviyeleri, halka üzerinde eşit aralıkla. */
  evler: number[];
  asfalt: boolean;
  saatKulesi?: boolean;
}

function mahalleKur(s: GameState, cx: number, cz: number, m: Mahalle): void {
  // Hizmetler merkeze 1 birim yakın, çevrede sıralı.
  m.hizmetler.forEach(([t, sev], i) => {
    const a = (i / m.hizmetler.length) * Math.PI * 2;
    add(s, t, cx + Math.cos(a), cz + Math.sin(a), sev);
  });
  if (m.saatKulesi) add(s, 'saatKulesi', cx, cz);
  // Evler halkada; her evin dış yanında bir ağaç (+3).
  m.evler.forEach((sev, i) => {
    const a = (i / m.evler.length) * Math.PI * 2;
    add(s, 'ev', cx + Math.cos(a) * EV_HALKA, cz + Math.sin(a) * EV_HALKA, sev);
    add(s, 'agac', cx + Math.cos(a + 0.2) * (EV_HALKA + 1.6), cz + Math.sin(a + 0.2) * (EV_HALKA + 1.6));
  });
  const n = 48;
  const halka = Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * YOL_HALKA, z: cz + Math.sin(a) * YOL_HALKA };
  });
  addRoad(s, m.asfalt ? 'asfalt' : 'toprak', halka);
}

/** Üretim binaları evlerden uzakta, gürültüleri mahalleye ulaşmaz. */
function uretimKur(s: GameState, liste: [BuildingType, number][]): void {
  let i = 0;
  for (const [t, adet] of liste) {
    for (let k = 0; k < adet; k++) {
      add(s, t, -40 + (i % 12) * 7, 38 + Math.floor(i / 12) * 7);
      i++;
    }
  }
}

const ev = (sev: number, adet: number): number[] => Array(adet).fill(sev);
const tumHizmet: [BuildingType, number][] = [['cesme', 1], ['pazar', 1], ['okul', 1], ['hastane', 1]];

interface Kasaba {
  ad: string;
  kur: (s: GameState) => void;
}

const KASABALAR: Kasaba[] = [
  {
    ad: '≈50 nüfus',
    kur(s) {
      mahalleKur(s, 0, 0, { hizmetler: [['cesme', 1], ['pazar', 1]], evler: [...ev(2, 5), ...ev(1, 7)], asfalt: false });
      uretimKur(s, [['tarla', 2], ['degirmen', 1], ['firin', 1], ['balikci', 1], ['oduncu', 1], ['ambar', 1]]);
    },
  },
  {
    ad: '≈150 nüfus',
    kur(s) {
      mahalleKur(s, 0, 0, { hizmetler: tumHizmet, evler: ev(3, 10), asfalt: true, saatKulesi: true });
      mahalleKur(s, 26, 0, { hizmetler: [['cesme', 1], ['pazar', 1]], evler: [...ev(2, 6), ...ev(1, 5)], asfalt: false });
      uretimKur(s, [
        ['tarla', 3], ['degirmen', 2], ['firin', 2], ['balikci', 1], ['oduncu', 1], ['marangoz', 1], ['tasOcagi', 1], ['ambar', 1],
      ]);
    },
  },
  {
    ad: '≈300 nüfus',
    kur(s) {
      const yukseltilmis: [BuildingType, number][] = [['cesme', 3], ['pazar', 2], ['okul', 2], ['hastane', 1]];
      mahalleKur(s, 0, 0, { hizmetler: yukseltilmis, evler: ev(3, 12), asfalt: true, saatKulesi: true });
      mahalleKur(s, 26, 0, { hizmetler: tumHizmet, evler: ev(3, 12), asfalt: true });
      mahalleKur(s, -26, 0, { hizmetler: [['cesme', 1], ['pazar', 1]], evler: [...ev(2, 8), ...ev(1, 4)], asfalt: false });
      uretimKur(s, [
        ['tarla', 6], ['degirmen', 4], ['firin', 3], ['balikci', 2], ['oduncu', 2], ['marangoz', 2], ['tasOcagi', 2], ['ambar', 2],
      ]);
    },
  },
];

/** Plandaki en pahalı tek harcama (Aşama 4 anıt aşaması). */
const BUYUK_HARCAMA = 200;

function olc(k: Kasaba) {
  const s = blank();
  k.kur(s);
  const evler = s.binalar.filter((b) => b.type === 'ev');
  s.nufus = evler.reduce((t, h) => t + houseLevel(h.seviye).nufus, 0);
  // Stoklar dolu: bütün stok ihtiyaçları karşılanır, ölçüm yalnızca para dengesine bakar.
  for (const g of Object.keys(s.stok) as Good[]) s.stok[g] = stockLimit(s);
  const ihtiyaclariTam = evler.filter((h) => {
    const cur = houseLevel(h.seviye).ihtiyaclar;
    return evaluateNeeds(s, h).every((n) => !cur.includes(n.ihtiyac) || n.karsilandi);
  }).length;
  const r = endDay(s);
  return { s, r, evSayisi: evler.length, ihtiyaclariTam };
}

describe('denge ölçümü (Aşama 1b)', () => {
  it('üç referans kasabanın günlük gelir-gideri', () => {
    const satirlar: string[] = [];
    for (const k of KASABALAR) {
      const { s, r, evSayisi, ihtiyaclariTam } = olc(k);
      // Kurulum doğru mu: bütün evlerin mevcut seviye ihtiyaçları karşılanıyor.
      expect(ihtiyaclariTam).toBe(evSayisi);
      satirlar.push(
        `${k.ad.padEnd(11)} | nüfus ${String(s.nufus).padStart(3)} | mutluluk ${s.mutluluk.toFixed(1).padStart(5)} | ` +
        `vergi ${String(r.vergi).padStart(4)} | bina gideri ${String(r.binaGider).padStart(3)} | ` +
        `yol gideri ${String(r.yolGider).padStart(2)} | net ${String(r.net).padStart(4)} | ` +
        `${BUYUK_HARCAMA} para = ${(BUYUK_HARCAMA / r.net).toFixed(1)} gün`,
      );
    }
    console.log(['', 'Denge ölçümü (1 gün):', ...satirlar, ''].join('\n'));
  });
});
