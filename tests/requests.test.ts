import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/buildings';
import { checkRequest, deliverFeast, deserialize, endDay, istekKalanGun, placeBuilding, serialize } from '../src/logic/game';
import { evaluateNeeds, houseHappiness } from '../src/logic/economy';
import { istekTuruSec } from '../src/logic/requests';
import type { GameState, IstekTuru } from '../src/logic/types';
import { add, blank } from './helpers';

const I = BALANCE.istek;

/** 12 nüfuslu (4 kulübe) kasaba; nüfus gün sonunda hesaplanır. */
function kasaba(): GameState {
  const s = blank();
  for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 0);
  return s;
}

/** Belirli türde etkin istek kur (tür seçiminden bağımsız test için). */
function istekKur(s: GameState, tur: IstekTuru, hedefBinaId?: number): void {
  s.istek = { tur, baslangicGun: s.gun, ilerleme: 0, ...(hedefBinaId !== undefined ? { hedefBinaId } : {}) };
}

describe('istek: geliş kuralları', () => {
  it('nüfus 10\'u geçmeden istek gelmez; geçince ertesi gün gelir', () => {
    const s = blank();
    add(s, 'ev', 0, 0);
    add(s, 'ev', 3, 0);
    add(s, 'ev', 6, 0); // 9 nüfus
    const r = endDay(s);
    expect(r.yeniIstek).toBeUndefined();
    expect(s.istek).toBeUndefined();
    const t = kasaba();
    const r2 = endDay(t);
    expect(t.nufus).toBe(12);
    expect(r2.yeniIstek).toBeDefined();
    expect(t.istek).toMatchObject({ tur: r2.yeniIstek, baslangicGun: 2 });
  });

  it('aynı anda en fazla bir istek; süre 4 gün, dolunca cezasız kalkar', () => {
    const s = kasaba();
    endDay(s); // gün 1 → istek 2. gün başlar
    const ilk = s.istek!;
    istekKur(s, 'agaclandirma'); // tamamlanamayacak bir tür
    s.istek!.baslangicGun = ilk.baslangicGun;
    for (let g = 2; g <= 4; g++) {
      const r = endDay(s);
      expect(r.yeniIstek).toBeUndefined();
      expect(s.istek?.tur).toBe('agaclandirma');
    }
    expect(istekKalanGun(s)).toBe(1); // 5. gün son gün
    const vergiOncesi = s.para;
    const r = endDay(s); // 5. günün sonu
    expect(s.istek).toBeUndefined();
    expect(r.tamamlananIstek).toBeUndefined();
    expect(s.para - vergiOncesi).toBe(r.net); // ceza yok
  });

  it('bittikten 3 gün sonra yenisi gelir', () => {
    const s = kasaba();
    s.gun = 10;
    istekKur(s, 'agaclandirma');
    s.istek!.ilerleme = I.agacSayisi;
    const r = endDay(s); // 10. günün sonunda tamamlanır
    expect(r.tamamlananIstek?.tur).toBe('agaclandirma');
    expect(s.sonrakiIstekGunu).toBe(13);
    expect(endDay(s).yeniIstek).toBeUndefined(); // gün 11 sonu → 12 için yok
    const r3 = endDay(s); // gün 12 sonu → 13. gün başlar
    expect(r3.yeniIstek).toBeDefined();
    expect(s.istek!.baslangicGun).toBe(13);
  });

  it('aynı tohum ve günde aynı istek türü (deterministik)', () => {
    const a = kasaba();
    const b = kasaba();
    a.haritaTohum = b.haritaTohum = 12345;
    const seq = (s: GameState) => Array.from({ length: 20 }, (_, i) => istekTuruSec(s, i + 1));
    expect(seq(a)).toEqual(seq(b));
    b.haritaTohum = 999;
    expect(seq(a)).not.toEqual(seq(b));
  });

  it('kış hazırlığı yalnız sonbaharda; susuz ev yalnız susuz ev varken seçilir', () => {
    const s = kasaba();
    add(s, 'cesme', 4, 0); // bütün evler suya erişir
    for (let g = 1; g <= 40; g++) {
      const t = istekTuruSec(s, g);
      expect(t).not.toBe('susuzEv');
      if (t === 'kisHazirligi') expect([11, 12, 13, 14, 15, 29, 30, 31, 32, 33]).toContain(g);
    }
  });
});

describe('istek türleri', () => {
  it('şenlik: 30 yemek teslim edilir, 3 gün bütün evlere +5 mutluluk', () => {
    const s = kasaba();
    s.gun = 8;
    istekKur(s, 'senlik');
    const h = s.binalar.find((b) => b.type === 'ev')!;
    const m = () => houseHappiness(s, h, evaluateNeeds(s, h));
    const taban = m();
    s.stok.yemek = 29;
    expect(deliverFeast(s)).toBeNull();
    s.stok.yemek = 35;
    expect(deliverFeast(s)).toEqual({ tur: 'senlik', para: 0 });
    expect(s.stok.yemek).toBe(5);
    expect(s.istek).toBeUndefined();
    expect(m()).toBe(taban + 5); // gün 8
    endDay(s);
    expect(m()).toBe(taban + 5); // gün 9
    endDay(s);
    expect(m()).toBe(taban + 5); // gün 10
    endDay(s);
    expect(m()).toBe(taban); // gün 11: bitti
    expect(s.geciciMutluluk).toBeUndefined();
  });

  it('ağaçlandırma: 5 ağaç dikilince 40 para', () => {
    const s = kasaba();
    s.para = 1000;
    istekKur(s, 'agaclandirma');
    for (let i = 0; i < 4; i++) placeBuilding(s, 'agac', 20 + i * 2, 20, 0);
    expect(s.istek!.ilerleme).toBe(4);
    expect(checkRequest(s)).toBeNull();
    placeBuilding(s, 'agac', 30, 20, 0);
    const para = s.para;
    expect(checkRequest(s)).toEqual({ tur: 'agaclandirma', para: 40 });
    expect(s.para).toBe(para + 40);
    expect(s.istek).toBeUndefined();
  });

  it('kış hazırlığı: stokta 40 odun olunca 60 para', () => {
    const s = kasaba();
    istekKur(s, 'kisHazirligi');
    s.stok.odun = 39;
    expect(checkRequest(s)).toBeNull();
    expect(s.istek!.ilerleme).toBe(39);
    s.stok.odun = 40;
    expect(checkRequest(s)?.para).toBe(60);
    expect(s.stok.odun).toBe(40); // odun harcanmaz, yalnızca bulunmalı
  });

  it('susuz ev: hedef ev suya kavuşunca 30 para; ev yıkılırsa cezasız kalkar', () => {
    const s = kasaba();
    const h = s.binalar.find((b) => b.type === 'ev')!;
    istekKur(s, 'susuzEv', h.id);
    expect(checkRequest(s)).toBeNull();
    add(s, 'cesme', h.x + 3, h.z);
    expect(checkRequest(s)).toEqual({ tur: 'susuzEv', para: 30 });

    const t = kasaba();
    const e = t.binalar.find((b) => b.type === 'ev')!;
    istekKur(t, 'susuzEv', e.id);
    const para = t.para;
    t.binalar = t.binalar.filter((b) => b.id !== e.id);
    expect(checkRequest(t)).toBeNull();
    expect(t.istek).toBeUndefined();
    expect(t.para).toBe(para);
  });

  it('istek ve şenlik kayıtta korunur', () => {
    const s = kasaba();
    istekKur(s, 'agaclandirma');
    s.istek!.ilerleme = 3;
    s.geciciMutluluk = { deger: 5, bitisGun: 9 };
    s.sonrakiIstekGunu = 4;
    const y = deserialize(serialize(s));
    expect(y.istek).toEqual(s.istek);
    expect(y.geciciMutluluk).toEqual(s.geciciMutluluk);
    expect(y.sonrakiIstekGunu).toBe(4);
  });
});
