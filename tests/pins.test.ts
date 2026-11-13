import { describe, expect, it } from 'vitest';
import { emptyGoods, endDay, runProduction } from '../src/logic/economy';
import { buildingPins, townAlerts } from '../src/logic/pins';
import { stockLimit } from '../src/logic/placement';
import type { UretimSorunu } from '../src/logic/types';
import { add, blank } from './helpers';

// Harita iğneleri: ev ihtiyaçları anlık, üretim sorunları gün sonu raporundan.

function sorunlar(s: ReturnType<typeof blank>): UretimSorunu[] {
  const out: UretimSorunu[] = [];
  runProduction(s, emptyGoods(), emptyGoods(), out);
  return out;
}

describe('ev iğneleri', () => {
  it('1. seviye evde iğne yok; 2. seviyede ilk eksik ihtiyaç', () => {
    const s = blank();
    add(s, 'ev', 0, 0, 1);
    const h2 = add(s, 'ev', 10, 0, 2);
    expect(buildingPins(s)).toEqual([{ id: h2.id, tur: 'ihtiyac', neden: 'su' }]);
    add(s, 'cesme', 12, 0);
    expect(buildingPins(s)).toEqual([{ id: h2.id, tur: 'ihtiyac', neden: 'yemek' }]);
    add(s, 'pazar', 8, -3);
    s.stok.yemek = 100;
    expect(buildingPins(s)).toEqual([]);
  });

  it('dengeli kasaba: gün sonu stoğu tüketip sıfırlasa da, herkes beslendiyse yemek iğnesi çıkmaz', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    add(s, 'cesme', 3, 0);
    add(s, 'pazar', -4, 0);
    s.stok.yemek = 6 * 0.25; // tam bir günlük
    const r = endDay(s);
    expect(s.stok.yemek).toBeCloseTo(0);
    expect(r.evStokEksikleri).toEqual([]);
    expect(buildingPins(s, r)).toEqual([]);
    expect(h.kotuGun).toBe(0);
  });

  it('ortak stok yetmezse yalnızca beslenemeyen ev iğne alır (id sırası); uyarıyla tutarlı', () => {
    const s = blank();
    const a = add(s, 'ev', 0, 0, 2);
    const b = add(s, 'ev', 2.5, 0, 2);
    add(s, 'cesme', 1, 3);
    add(s, 'pazar', 1, -4);
    s.stok.yemek = 6 * 0.25; // yalnızca bir eve yeter
    const r = endDay(s);
    expect(buildingPins(s, r)).toEqual([{ id: b.id, tur: 'ihtiyac', neden: 'yemek' }]);
    expect(townAlerts(s)).toContainEqual({ tur: 'kuculen', evler: [b.id] });
    expect(a.kotuGun).toBe(0);
  });

  it('üst seviyenin ihtiyacı iğne çıkarmaz (ev küçülmez, yalnızca büyümez)', () => {
    const s = blank();
    add(s, 'ev', 0, 0, 1);
    expect(buildingPins(s)).toEqual([]);
  });
});

describe('üretim sorunları', () => {
  it('girdisi olmayan değirmen buğday, işleyen değirmen sorun yazmaz', () => {
    const s = blank();
    s.nufus = 100;
    const d = add(s, 'degirmen', 0, 0);
    expect(sorunlar(s)).toEqual([{ id: d.id, neden: 'bugday' }]);
    s.stok.bugday = 100;
    expect(sorunlar(s)).toEqual([]);
  });

  it('aynı gün tarlanın ürettiği buğday değirmene yeter: sorun yok', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'tarla', 10, 0);
    add(s, 'degirmen', 0, 0);
    expect(sorunlar(s)).toEqual([]);
  });

  it('dolu depo ve ağaçsız oduncu', () => {
    const s = blank();
    s.nufus = 100;
    const t = add(s, 'tarla', 10, 0);
    s.stok.bugday = stockLimit(s);
    const o = add(s, 'oduncu', -10, 0);
    expect(sorunlar(s)).toEqual([{ id: t.id, neden: 'depo' }, { id: o.id, neden: 'agac' }]);
  });

  it('neredeyse dolu depoda oduncu da diğer üreticiler gibi işaretlenir (yarıdan az üretim)', () => {
    const s = blank();
    s.nufus = 100;
    const o = add(s, 'oduncu', 0, 0);
    for (let i = 0; i < 6; i++) add(s, 'agac', Math.cos(i) * 3, Math.sin(i) * 3);
    s.stok.odun = stockLimit(s) - 0.5;
    expect(sorunlar(s)).toEqual([{ id: o.id, neden: 'depo' }]);
  });

  it('gün sonu raporu sorunları taşır; yıkılan binanın iğnesi çıkmaz', () => {
    const s = blank();
    s.nufus = 100;
    const d = add(s, 'degirmen', 0, 0);
    const r = endDay(s);
    expect(r.uretimSorunlari).toEqual([{ id: d.id, neden: 'bugday' }]);
    expect(buildingPins(s, r)).toEqual([{ id: d.id, tur: 'uretim', neden: 'bugday' }]);
    s.binalar = s.binalar.filter((b) => b.id !== d.id);
    expect(buildingPins(s, r)).toEqual([]);
  });

  it('işçi eksikliği bina sorunu sayılmaz', () => {
    const s = blank();
    s.nufus = 0;
    s.stok.bugday = 100;
    add(s, 'degirmen', 0, 0);
    expect(sorunlar(s)).toEqual([]);
  });
});

describe('kasaba uyarıları', () => {
  it('sorun yoksa boş; borç, küçülen evler ve işçi eksikliği önem sırasıyla', () => {
    const s = blank();
    s.nufus = 100;
    expect(townAlerts(s)).toEqual([]);
    const h = add(s, 'ev', 0, 0, 2);
    h.kotuGun = 1;
    s.borcGunu = 2;
    s.nufus = 1;
    add(s, 'degirmen', 10, 0); // 2 işçi ister
    expect(townAlerts(s)).toEqual([
      { tur: 'borc', gun: 2 },
      { tur: 'kuculen', evler: [h.id] },
      { tur: 'isci', oran: 0.5 },
    ]);
  });
});
