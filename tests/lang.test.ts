// Dil dosyaları: her dil aynı anahtarlara ve her metin aynı {yer tutuculara} sahip olmalı.
// Yeni bir dil eklerken (ör. de.json) bu test eksik ya da fazla anahtarı gösterir.
import { describe, expect, it } from 'vitest';
import { BUILDING_ORDER, ROADS } from '../src/data/buildings';
import { KARTLAR } from '../src/data/cards';
import { GOALS } from '../src/logic/goals';

// Klasördeki bütün dil dosyaları (Vite/Vitest okur; Node tipleri gerekmez).
const DOSYALAR = import.meta.glob<Record<string, string>>('../src/lang/*.json', { eager: true, import: 'default' });
const ad = (yol: string): string => yol.split('/').pop() ?? yol;
const TR = DOSYALAR['../src/lang/tr.json'];
const DILLER = Object.keys(DOSYALAR).map(ad).filter((f) => f !== 'tr.json');
const oku = (dosya: string): Record<string, string> => DOSYALAR[`../src/lang/${dosya}`];

const yerTutucular = (m: string): string[] => [...m.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();

describe('dil dosyaları', () => {
  it('İngilizce dosyası var', () => {
    expect(DILLER).toContain('en.json');
  });

  for (const dosya of DILLER) {
    const D = oku(dosya);
    it(`${dosya}: tr.json ile aynı anahtarlar`, () => {
      expect(Object.keys(D).filter((k) => !(k in TR))).toEqual([]); // fazla
      expect(Object.keys(TR).filter((k) => !(k in D))).toEqual([]); // eksik
    });
    it(`${dosya}: aynı yer tutucular, boş metin yok`, () => {
      for (const k of Object.keys(TR)) {
        expect(D[k], k).toBeTruthy();
        expect(yerTutucular(D[k]), k).toEqual(yerTutucular(TR[k]));
      }
    });
  }

  it('her bina, yol, kart ve hedef için metin var', () => {
    for (const b of BUILDING_ORDER) {
      expect(TR[`bina.${b}.ad`], b).toBeTruthy();
      expect(TR[`bina.${b}.aciklama`], b).toBeTruthy();
    }
    for (const y of Object.keys(ROADS)) expect(TR[`yol.${y}.ad`], y).toBeTruthy();
    for (const k of KARTLAR) {
      for (const alan of ['ad', 'arti', 'eksi']) expect(TR[`kart.${k.id}.${alan}`], `${k.id}.${alan}`).toBeTruthy();
    }
    GOALS.forEach((_, i) => {
      expect(TR[`hedef.${i}.ad`], `hedef ${i}`).toBeTruthy();
      expect(TR[`hedef.${i}.aciklama`], `hedef ${i}`).toBeTruthy();
    });
  });
});
