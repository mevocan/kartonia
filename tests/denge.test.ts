// Denge ölçümü: elle kurulmuş referans kasabaların bir günlük vergi, gider ve net gelirini hesaplayıp yazdırır;
// ayrıca ev seviyesi başına mahalle neti ve açılıştaki bekleme denetlenir.
// Çıktıyı görmek için: npx vitest run tests/denge.test.ts
import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS } from '../src/data/buildings';
import { endDay, isUnlocked, stockLimit } from '../src/logic/game';
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

// ---- Evi büyütmek kârlı olmalı ----

/** Ev seviyesine göre bütün ihtiyaçları karşılayan mahallenin hizmetleri (yemek satış yeri dahil). */
const SEVIYE_HIZMET: Record<number, BuildingType[]> = {
  2: ['cesme', 'firin'],
  3: ['cesme', 'pazar', 'okul', 'hastane'],
  4: ['cesme', 'pazar', 'okul', 'hastane', 'hamam'],
  5: ['cesme', 'pazar', 'okul', 'hastane', 'hamam', 'tiyatro'],
};

/** 12 evlik tam mahalle (stoklar dolu, her evin yanında bir ağaç, toprak çevre yolu): bir günün neti. */
function mahalleNeti(seviye: number): { vergi: number; gider: number; net: number } {
  const s = blank();
  SEVIYE_HIZMET[seviye].forEach((t, i) => add(s, t, Math.cos(i), Math.sin(i)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(s, 'ev', Math.cos(a) * EV_HALKA, Math.sin(a) * EV_HALKA, seviye);
    add(s, 'agac', Math.cos(a + 0.2) * (EV_HALKA + 1.6), Math.sin(a + 0.2) * (EV_HALKA + 1.6));
  }
  addRoad(s, 'toprak', Array.from({ length: 49 }, (_, i) => ({
    x: Math.cos((i / 48) * Math.PI * 2) * YOL_HALKA, z: Math.sin((i / 48) * Math.PI * 2) * YOL_HALKA,
  })));
  s.nufus = 999; // işçi oranı 1
  for (const g of Object.keys(s.stok) as Good[]) s.stok[g] = stockLimit(s);
  const r = endDay(s);
  return { vergi: r.vergi, gider: r.gider, net: r.net };
}

describe('denge: ev seviyesi', () => {
  it('tam bir mahallede her ev seviyesi bir öncekinden en az %25 daha fazla net bırakır', () => {
    const netler = [2, 3, 4, 5].map((sev) => ({ sev, ...mahalleNeti(sev) }));
    console.log(['', '12 evlik tam mahalle (1 gün, üretim gideri hariç):',
      ...netler.map((n) => `seviye ${n.sev}: vergi ${n.vergi} · hizmet gideri ${n.gider} · net ${n.net}`), ''].join('\n'));
    for (let i = 1; i < netler.length; i++) expect(netler[i].net).toBeGreaterThanOrEqual(netler[i - 1].net * 1.25);
  });
});

// ---- Açılış temposu ----

/**
 * Hedefleri izleyen sade bir açılış: 5 kulübe + Çeşme, sonra sırayla Balıkçı, Fırın, evler, Tarla, Değirmen ve
 * yeni evler. Her gün parası yeten ve açılmış olan sıradaki iş alınır. "Bekleme": sıradaki iş varken hiçbir şey
 * alınamayan gün. Kabul: ilk 40 günde 4 günden uzun bekleme serisi yok.
 */
describe('denge: açılış', () => {
  it('ilk 40 günde 4 günden uzun "alacak bir şey yok" dönemi olmaz', () => {
    const s = blank();
    s.para = BALANCE.baslangicPara;
    let evNo = 0;
    const evKoy = (): void => {
      // Halka üzerinde: çeşme (7) ve fırın (6) alanında.
      const a = (evNo++ / 14) * Math.PI * 2;
      add(s, 'ev', Math.cos(a) * 4.5, Math.sin(a) * 4.5);
    };
    const al = (t: BuildingType): boolean => {
      if (!isUnlocked(s, t) || s.para < BUILDINGS[t].maliyet) return false;
      s.para -= BUILDINGS[t].maliyet;
      if (t === 'ev') evKoy();
      else if (t === 'cesme' || t === 'firin') add(s, t, t === 'cesme' ? 1 : -1, 0);
      else add(s, t, 30 + s.binalar.length * 4, 30); // üretim mahalleden uzakta (gürültü)
      return true;
    };
    const sira: BuildingType[] = [
      'ev', 'ev', 'ev', 'ev', 'ev', 'cesme', 'balikci', 'firin', 'ev', 'ev', 'ev', 'tarla', 'degirmen',
      'ev', 'ev', 'ev', 'ev', 'ev', 'ev', 'tarla',
    ];
    let seri = 0;
    let enUzun = 0;
    const gunluk: string[] = [];
    for (let gun = 1; gun <= 40 && sira.length; gun++) {
      const alinan: BuildingType[] = [];
      while (sira.length && al(sira[0])) alinan.push(sira.shift()!);
      if (alinan.length === 0 && sira.length) enUzun = Math.max(enUzun, ++seri);
      else seri = 0;
      const r = endDay(s);
      gunluk.push(`g${r.gun} ${alinan.join(',') || '—'} | para ${Math.round(s.para)} net ${r.net}` +
        `${r.hedefOdulu ? ` ödül +${r.hedefOdulu}` : ''} nüfus ${s.nufus}${sira.length ? ` sıradaki ${sira[0]}` : ''}`);
    }
    console.log(['', 'Açılış (en uzun bekleme ' + enUzun + ' gün):', ...gunluk, ''].join('\n'));
    expect(sira).toEqual([]);
    expect(enUzun).toBeLessThanOrEqual(4);
  });
});
