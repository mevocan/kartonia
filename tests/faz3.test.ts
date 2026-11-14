// Eğlence planı Faz 3–4: süreli etkiler, mevsim şenlikleri, yeni istekler, tüccar fırsatı ve siparişi, mevsim etkileri.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/buildings';
import { SENLIKLER } from '../src/data/senlikler';
import {
  ayar, birimFiyat, checkRequest, deliverRequest, endDay, gununFirsati, istekOdulu, senlikBaslat, senlikDurumu,
  siparisDurumu, siparisTeslim, suregenEtkiler, ziyaretNo,
} from '../src/logic/game';
import { etkiEkle, etkilerGunSonu } from '../src/logic/cards';
import { emptyGoods, runProduction } from '../src/logic/economy';
import { istekTuruSec } from '../src/logic/requests';
import type { GameState, IstekTuru } from '../src/logic/types';
import { add, addRoad, blank } from './helpers';

function istekKur(s: GameState, tur: IstekTuru, ek: Partial<NonNullable<GameState['istek']>> = {}): void {
  s.istek = { tur, baslangicGun: s.gun, ilerleme: 0, ...ek };
}

describe('süreli etkiler', () => {
  it('ayar() etkiyi bitiş günü dahil uygular; gün sonunda süresi biten kalkar', () => {
    const s = blank();
    s.gun = 5;
    etkiEkle(s, { anahtar: 'vergiCarpani', islem: 'carp', deger: 1.2, kaynak: 'test' }, 2);
    expect(s.etkiler![0].bitisGun).toBe(6);
    expect(ayar(s, 'vergiCarpani')).toBeCloseTo(1.2);
    s.gun = 6;
    expect(ayar(s, 'vergiCarpani')).toBeCloseTo(1.2);
    etkilerGunSonu(s);
    expect(s.etkiler).toBeUndefined();
    expect(ayar(s, 'vergiCarpani')).toBe(1);
  });

  it('ziyafet geçici mutluluğu süreli etkiyle verir', () => {
    const s = blank();
    add(s, 'ev', 0, 0);
    s.stok.yemek = 50;
    istekKur(s, 'senlik');
    expect(deliverRequest(s)).toEqual({ tur: 'senlik', para: 0 });
    expect(suregenEtkiler(s)).toMatchObject([{ anahtar: 'evMutluluk', deger: BALANCE.istek.senlikMutluluk, kaynak: 'ziyafet' }]);
    expect(ayar(s, 'evMutluluk')).toBe(BALANCE.istek.senlikMutluluk);
  });
});

describe('mevsim şenlikleri', () => {
  it('ilkbahar: Çiçek Şenliği 10 dikilmiş çiçek ister; bedel nüfusla büyür; yılda bir kez', () => {
    const s = blank();
    s.gun = 2;
    s.para = 1000;
    let d = senlikDurumu(s);
    expect(d.mevsim).toBe('ilkbahar');
    expect(d.tanim).toBe(SENLIKLER.ilkbahar);
    expect(d.sebep).toBe('sart');
    for (let i = 0; i < 10; i++) add(s, 'cicek', i * 2, 30);
    d = senlikDurumu(s);
    expect(d.ok).toBe(true);
    expect(d.bedel).toEqual({ para: 60 });
    s.nufus = 150;
    expect(senlikDurumu(s).bedel).toEqual({ para: 120 });
    expect(senlikBaslat(s)).toBe(true);
    expect(s.para).toBe(880);
    expect(ayar(s, 'evMutluluk')).toBe(6);
    expect(ayar(s, 'uretim.arilik.bal')).toBeCloseTo(3 * 1.5 * 1.25); // şenlik × ilkbahar
    expect(senlikDurumu(s)).toMatchObject({ yapildi: true, sebep: 'yapildi', bitisGun: 2 + 5 - 1 });
    expect(senlikBaslat(s)).toBe(false);
    expect(s.gunluk?.some((k) => k.tur === 'festival' && k.veri === 'ilkbahar')).toBe(true);
    // Gelecek yılın ilkbaharında yeniden yapılabilir.
    s.gun = 2 + 18;
    expect(senlikDurumu(s).yapildi).toBe(false);
  });

  it('kış: Kış Şöleni fazla odun tüketimini kaldırır; mal yetmezse başlamaz', () => {
    const s = blank();
    s.gun = 16;
    expect(ayar(s, 'kisOdunCarpani')).toBe(2);
    s.stok.odun = 10;
    s.stok.yemek = 100;
    expect(senlikDurumu(s).sebep).toBe('odun');
    s.stok.odun = 100;
    expect(senlikBaslat(s)).toBe(true);
    expect(s.stok).toMatchObject({ odun: 70, yemek: 70 });
    expect(ayar(s, 'kisOdunCarpani')).toBe(1);
  });

  it('Şenlikçi kartı süreyi 2 gün uzatır, bedeli %30 artırır; Panayır fazladan 3 gün', () => {
    const s = blank();
    s.gun = 7; // yaz
    s.kararlar = ['senlikci'];
    add(s, 'pazar', 0, 0);
    const d = senlikDurumu(s);
    expect(d.sure).toBe(5 + 2 + 3);
    expect(d.bedel).toEqual({ para: 65, yemek: 26 });
  });
});

describe('yeni istekler', () => {
  it('ödül nüfusla büyür: taban × (1 + nüfus / 100)', () => {
    const s = blank();
    expect(istekOdulu(s, 'park')).toBe(50);
    s.nufus = 100;
    s.mutluluk = 50;
    expect(istekOdulu(s, 'park')).toBe(100);
    expect(istekOdulu(s, 'senlik')).toBe(0);
  });

  it('park, göl evi ve yükseltme: istek geldiğindeki sayının üstüne çıkılınca tamamlanır', () => {
    const s = blank();
    istekKur(s, 'park', { baz: 0 });
    expect(checkRequest(s)).toBeNull();
    add(s, 'park', 0, 0);
    expect(checkRequest(s)?.tur).toBe('park');

    istekKur(s, 'yukseltme', { baz: 1 });
    const c = add(s, 'cesme', 10, 10);
    expect(checkRequest(s)).toBeNull();
    c.seviye = 2;
    expect(checkRequest(s)?.tur).toBe('yukseltme');
  });

  it('çiçek dikimi sayaçla, mobilya teslimle, erzak stokla tamamlanır', () => {
    const s = blank();
    s.para = 1000;
    istekKur(s, 'cicekDik');
    s.istek!.ilerleme = BALANCE.istek.cicekSayisi;
    expect(checkRequest(s)?.tur).toBe('cicekDik');

    istekKur(s, 'mobilya');
    s.stok.mobilya = 10;
    expect(deliverRequest(s)).toBeNull();
    s.stok.mobilya = 20;
    const para = s.para;
    expect(deliverRequest(s)).toEqual({ tur: 'mobilya', para: 80 });
    expect(s.para).toBe(para + 80);
    expect(s.stok.mobilya).toBe(5);

    istekKur(s, 'erzak');
    s.stok.yemek = BALANCE.istek.erzakYemek;
    expect(checkRequest(s)?.tur).toBe('erzak');
    expect(s.stok.yemek).toBe(BALANCE.istek.erzakYemek); // harcanmaz
  });

  it('gürültü: hedef ev gürültülü binanın alanından çıkınca tamamlanır', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    const d = add(s, 'degirmen', 2, 0);
    istekKur(s, 'gurultu', { hedefBinaId: h.id });
    expect(checkRequest(s)).toBeNull();
    s.binalar = s.binalar.filter((b) => b !== d);
    expect(checkRequest(s)?.tur).toBe('gurultu');
  });

  it('asfalt ev: asfalt yol kenarındaki ev sayısı artınca', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    istekKur(s, 'asfaltEv', { baz: 0 });
    expect(checkRequest(s)).toBeNull();
    addRoad(s, 'asfalt', [{ x: -3, z: 2 }, { x: 3, z: 2 }]);
    expect(h).toBeDefined();
    expect(checkRequest(s)?.tur).toBe('asfaltEv');
  });

  it('aynı tür art arda gelmez; yeni istek isteyen sakini taşır', () => {
    const s = blank();
    for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 0);
    for (let g = 2; g < 60; g++) {
      s.sonIstekTuru = istekTuruSec(s, g);
      expect(istekTuruSec(s, g)).not.toBe(s.sonIstekTuru);
    }
    endDay(s);
    endDay(s);
    expect(s.istek?.sakin).toBeGreaterThanOrEqual(0);
  });
});

describe('tüccar: günün fırsatı ve sipariş', () => {
  it('fırsat ziyaret boyunca aynı; satış fırsatı 2 kat, alış fırsatı %40 ucuz', () => {
    const s = blank();
    s.haritaTohum = 7;
    add(s, 'tarla', 0, 0);
    s.gun = 7;
    expect(gununFirsati(s)).toBeNull();
    s.gun = 8;
    const f = gununFirsati(s)!;
    expect(f.sat).toBe('bugday'); // yalnızca buğday üretiliyor
    expect(f.al).not.toBe(f.sat);
    s.gun = 10;
    expect(gununFirsati(s)).toEqual(f);
    expect(birimFiyat(s, 'bugday').sat).toBe(BALANCE.ticaret.fiyat.bugday.sat * 2);
    expect(birimFiyat(s, f.al).al).toBeCloseTo(BALANCE.ticaret.fiyat[f.al].al * 0.6);
  });

  it('tüccar giderken sipariş bırakır; sonraki ziyarette teslim edilir, kotadan düşmez; edilmezse kalkar', () => {
    const s = blank();
    add(s, 'marangoz', 0, 0);
    s.gun = 10;
    endDay(s); // ziyaretin son günü
    expect(s.tuccarSiparis).toMatchObject({ mal: 'mobilya', ziyaret: 2 });
    const miktar = s.tuccarSiparis!.miktar;
    expect(miktar).toBeGreaterThanOrEqual(BALANCE.ticaret.siparisMin);
    expect(siparisDurumu(s)).toBeNull(); // tüccar yokken
    s.gun = 16;
    expect(ziyaretNo(s.gun)).toBe(2);
    s.stok.mobilya = miktar;
    s.para = 0;
    const d = siparisDurumu(s)!;
    expect(d.ok).toBe(true);
    expect(siparisTeslim(s)).toBe(d.para);
    expect(d.para).toBe(Math.round(miktar * 6 * 1.6));
    expect(s.tuccarKota ?? 0).toBe(0);
    expect(s.tuccarSiparis).toBeUndefined();
  });
});

describe('mevsim etkileri', () => {
  it('yazın tarla +%20, sonbaharda oduncu +%25, ilkbaharda arılık +%25', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'tarla', 0, 0);
    const uret = (): number => {
      const u = emptyGoods();
      runProduction(s, u, emptyGoods());
      return u.bugday;
    };
    s.gun = 2;
    expect(uret()).toBeCloseTo(6);
    s.stok.bugday = 0;
    s.gun = 7;
    expect(uret()).toBeCloseTo(7.2);
    s.gun = 12;
    expect(ayar(s, 'oduncuCarpani')).toBeCloseTo(1.25);
    s.gun = 2;
    expect(ayar(s, 'uretim.arilik.bal')).toBeCloseTo(3.75);
  });
});
