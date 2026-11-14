// Eğlence planı Faz 5: süsler, büyük projeler (Kervansaray, Botanik Bahçesi), kasaba unvanı.
import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS, yolsuz } from '../src/data/buildings';
import {
  advanceMonument, anitAsamalari, ayar, canAdvanceMonument, canPlace, endDay, isUnlocked, kasabaUnvani, placeBuilding,
} from '../src/logic/game';
import { evaluateNeeds, houseHappiness } from '../src/logic/economy';
import { add, blank } from './helpers';

describe('süsler', () => {
  it('yol istemez, patikası olmaz', () => {
    for (const t of ['cit', 'bank', 'ciceklik', 'lamba', 'heykel'] as const) {
      expect(BUILDINGS[t].sus).toBe(true);
      expect(yolsuz(t)).toBe(true);
    }
    const s = blank();
    s.para = 1000;
    s.nufus = 200;
    expect(canPlace(s, 'bank', 10, 10).ok).toBe(true);
    const b = placeBuilding(s, 'bank', 10, 10, 0)!;
    expect(b.baglanti).toBeUndefined();
    expect(canPlace(s, 'firin', 20, 20).sebep).toBe('yolYok');
  });

  it('bir evi kapsayan süslerin mutluluğu en fazla +6 sayılır, ağaç tavanından ayrı', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    const taban = houseHappiness(s, h, evaluateNeeds(s, h));
    for (let i = 0; i < 5; i++) add(s, 'ciceklik', Math.cos(i) * 1.5, Math.sin(i) * 1.5); // 5 × 2 = 10
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(taban + BALANCE.susMutlulukSinir);
    for (let i = 0; i < 4; i++) add(s, 'agac', Math.cos(i + 0.5) * 2.5, Math.sin(i + 0.5) * 2.5); // ağaç: +9 tavan
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(taban + BALANCE.susMutlulukSinir + BALANCE.agacMutlulukSinir);
  });
});

describe('büyük projeler', () => {
  it('Saat Kulesi bitmeden açılmaz; kasabada yalnızca bir tane', () => {
    const s = blank();
    s.nufus = 300;
    s.para = 5000;
    expect(isUnlocked(s, 'kervansaray')).toBe(false);
    const k = add(s, 'saatKulesi', 30, 30);
    k.insaat = 2;
    expect(isUnlocked(s, 'kervansaray')).toBe(false);
    delete k.insaat;
    expect(isUnlocked(s, 'kervansaray')).toBe(true);
    add(s, 'kervansaray', -30, 30);
    expect(canPlace(s, 'kervansaray', 0, -30).sebep).toBe('tek');
  });

  it('kendi aşamaları: kumaş ve bal ister; bitince kalıcı etkiler ayar()a girer', () => {
    const s = blank();
    s.para = 5000;
    const kv = add(s, 'kervansaray', 0, 0);
    kv.insaat = anitAsamalari('kervansaray').length;
    expect(ayar(s, 'ticaretKota')).toBe(BALANCE.ticaret.kota);
    s.stok.tas = 100;
    expect(advanceMonument(s, kv.id)).toBe(150);
    expect(canAdvanceMonument(s, kv.id).sebep).toBe('kumas');
    s.stok.kumas = 100;
    s.stok.mobilya = 100;
    for (let i = 0; i < 3; i++) expect(advanceMonument(s, kv.id)).not.toBeNull();
    expect(kv.insaat).toBeUndefined();
    expect(ayar(s, 'ticaretKota')).toBe(BALANCE.ticaret.kota + 30);
    expect(ayar(s, 'ticaretSatisCarpani')).toBeCloseTo(1.2);
    expect(s.gunluk?.some((g) => g.tur === 'projeTamam' && g.veri === 'kervansaray')).toBe(true);

    const bt = add(s, 'botanik', 40, 0);
    bt.insaat = 1;
    s.stok.bal = 5;
    expect(canAdvanceMonument(s, bt.id).sebep).toBe('bal');
    s.stok.bal = 100;
    advanceMonument(s, bt.id);
    expect(ayar(s, 'agacMutlulukSinir')).toBe(BALANCE.agacMutlulukSinir + 6);
  });
});

describe('kasaba unvanı', () => {
  it('nüfus, mutluluk ve anıtlardan türetilir; yükselince günlüğe yazılır', () => {
    const s = blank();
    s.gunluk = [];
    expect(kasabaUnvani(s)).toBe(0);
    s.nufus = 30;
    expect(kasabaUnvani(s)).toBe(1);
    s.nufus = 260;
    s.mutluluk = 75;
    expect(kasabaUnvani(s)).toBe(2);
    add(s, 'saatKulesi', 30, 30);
    expect(kasabaUnvani(s)).toBe(3);
    s.nufus = 400;
    add(s, 'kervansaray', -30, 30);
    add(s, 'botanik', 0, -30);
    expect(kasabaUnvani(s)).toBe(4);
    // Gün sonu: ev olmadan nüfus 0'a döner; elle kurulmuş durumda unvan günlüğü yazılmaz, eşik yeniden sağlanınca yazılır.
    for (let i = 0; i < 4; i++) add(s, 'ev', 10 + i * 3, 10);
    endDay(s);
    expect(s.gunluk!.filter((k) => k.tur === 'unvan').map((k) => k.veri)).toEqual([kasabaUnvani(s)].filter((u) => u > 0));
  });
});
