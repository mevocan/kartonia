import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/buildings';
import { HARITA } from '../src/data/map';
import {
  buyGood, canBuy, canSell, deserialize, endDay, kalanKota, sellGood, serialize, stockLimit, tuccaraKalanGun,
  tuccarKonumu, tuccarVarMi,
} from '../src/logic/game';
import { add, blank } from './helpers';

function tuccarGunu() {
  const s = blank();
  s.gun = 6;
  s.para = 1000;
  return s;
}

describe('tüccar: geliş günleri', () => {
  it('her 6 günde bir, ilk geliş 6. gün', () => {
    expect(BALANCE.ticaret.aralik).toBe(6);
    const gunler = Array.from({ length: 30 }, (_, i) => i + 1).filter(tuccarVarMi);
    expect(gunler).toEqual([6, 12, 18, 24, 30]);
  });

  it('sıradaki gelişe kalan gün', () => {
    expect(tuccaraKalanGun(1)).toBe(5);
    expect(tuccaraKalanGun(5)).toBe(1);
    expect(tuccaraKalanGun(6)).toBe(0);
    expect(tuccaraKalanGun(7)).toBe(5);
  });

  it('araba başlangıç yolunun kenar ucunda (sınırdan bir nokta içeride), kasabaya bakar', () => {
    const k = tuccarKonumu()!;
    const [, a, b] = HARITA.baslangicYolu;
    expect([k.x, k.z]).toEqual([a.x, a.z]);
    expect(Math.sin(k.yon)).toBeCloseTo((b.x - a.x) / Math.hypot(b.x - a.x, b.z - a.z));
  });
});

describe('tüccar: fiyatlar', () => {
  it('plandaki sabit fiyatlar; satış hep alıştan düşük', () => {
    expect(BALANCE.ticaret.fiyat).toEqual({
      bugday: { sat: 1, al: 3 }, un: { sat: 2, al: 5 }, yemek: { sat: 2, al: 6 },
      odun: { sat: 2, al: 5 }, tas: { sat: 3, al: 8 }, mobilya: { sat: 6, al: 15 },
    });
    for (const f of Object.values(BALANCE.ticaret.fiyat)) expect(f.sat).toBeLessThan(f.al);
  });

  it('alış parayı düşer, malı ekler; satış tersini yapar', () => {
    const s = tuccarGunu();
    expect(buyGood(s, 'tas', 5)).toBe(40);
    expect(s.para).toBe(960);
    expect(s.stok.tas).toBe(5);
    s.stok.mobilya = 10;
    expect(sellGood(s, 'mobilya', 4)).toBe(24);
    expect(s.para).toBe(984);
    expect(s.stok.mobilya).toBe(6);
  });
});

describe('tüccar: kota ve sınırlar', () => {
  it('ziyaret başına alım + satım toplamı 40 birim', () => {
    const s = tuccarGunu();
    s.stok.bugday = 100;
    expect(sellGood(s, 'bugday', 30)).toBe(30);
    expect(kalanKota(s)).toBe(10);
    expect(canBuy(s, 'odun', 11).sebep).toBe('kota');
    expect(buyGood(s, 'odun', 10)).toBe(50);
    expect(kalanKota(s)).toBe(0);
    expect(canSell(s, 'bugday', 1).sebep).toBe('kota');
  });

  it('kota gün sonunda sıfırlanır; tüccar gidince ticaret yok', () => {
    const s = tuccarGunu();
    s.stok.bugday = 100;
    sellGood(s, 'bugday', 40);
    endDay(s);
    expect(s.gun).toBe(7);
    expect(s.tuccarKota).toBeUndefined();
    expect(canSell(s, 'bugday', 1).sebep).toBe('kilitli');
    s.gun = 12;
    expect(kalanKota(s)).toBe(40);
    expect(sellGood(s, 'bugday', 1)).toBe(1);
  });

  it('para, stok ve depo sınırı', () => {
    const s = tuccarGunu();
    s.para = 10;
    expect(canBuy(s, 'mobilya', 1).sebep).toBe('para');
    expect(canSell(s, 'odun', 1).sebep).toBe('stok');
    s.para = 1000;
    s.stok.un = stockLimit(s) - 3;
    expect(canBuy(s, 'un', 4).sebep).toBe('depo');
    expect(buyGood(s, 'un', 3)).toBe(15);
    add(s, 'ambar', 30, 30);
    expect(canBuy(s, 'un', 4).ok).toBe(true);
  });

  it('olmayan işlem hiçbir şeyi değiştirmez; geçersiz miktar reddedilir', () => {
    const s = tuccarGunu();
    const once = JSON.stringify(s);
    expect(buyGood(s, 'tas', 0)).toBeNull();
    expect(buyGood(s, 'tas', -3)).toBeNull();
    expect(sellGood(s, 'tas', 1)).toBeNull();
    expect(JSON.stringify(s)).toBe(once);
  });

  it('kota sayacı kayıtta korunur', () => {
    const s = tuccarGunu();
    s.stok.odun = 50;
    sellGood(s, 'odun', 15);
    expect(kalanKota(deserialize(serialize(s)))).toBe(25);
  });
});
