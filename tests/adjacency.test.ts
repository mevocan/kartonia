import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { adjacencyBonus, bonusText, demolish, getBuildingInfo } from '../src/logic/game';
import { emptyGoods, evaluateNeeds, houseHappiness, runProduction } from '../src/logic/economy';
import { heightAt, lakeDistance } from '../src/logic/terrain';
import type { GameState } from '../src/logic/types';
import { add, blank } from './helpers';

// blank() klasik haritayı kullanır: göl (-22, 14) r≈7, tepe (14, -8) yükseklik 2.6, merkez düz.

/** z = 14 doğrultusunda gölün doğusunda, göle uzaklığı `d` olan nokta. */
function golaUzak(d: number): number {
  for (let x = -16; x < 20; x += 0.01) if (lakeDistance(x, 14) >= d) return x;
  throw new Error('nokta bulunamadı');
}

function uret(s: GameState) {
  const u = emptyGoods();
  const t = emptyGoods();
  runProduction(s, u, t);
  return { u, t };
}

describe('komşuluk: göl mesafesi', () => {
  it('göl içinde 0, uzaklaştıkça artar', () => {
    expect(lakeDistance(-22, 14)).toBe(0);
    expect(lakeDistance(golaUzak(3), 14)).toBeCloseTo(3, 1);
    expect(lakeDistance(0, 0)).toBeGreaterThan(10);
  });
});

describe('tarla: sulama', () => {
  const taban = BUILDINGS.tarla.taban;

  it('taban kenarı göle ≤ 4 ise buğday +%25', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'tarla', golaUzak(taban + 3.9), 14);
    expect(uret(s).u.bugday).toBeCloseTo(7.5);
  });

  it('kenar göle 4\'ten uzaksa bonus yok', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'tarla', golaUzak(taban + 4.2), 14);
    expect(uret(s).u.bugday).toBeCloseTo(6);
  });

  it('stok sınırı bonuslu çıktıyla denetlenir', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 196;
    add(s, 'tarla', golaUzak(taban + 1), 14);
    expect(uret(s).u.bugday).toBeCloseTo(4);
    expect(s.stok.bugday).toBeCloseTo(200);
  });
});

describe('değirmen: rüzgâr', () => {
  it('tepede (yükseklik ≥ 1) un +%25, girdi fazla tüketilmez', () => {
    expect(heightAt(14, -8)).toBeGreaterThanOrEqual(1);
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 6;
    add(s, 'degirmen', 14, -8);
    const { u, t } = uret(s);
    expect(u.un).toBeCloseTo(7.5);
    expect(t.bugday).toBeCloseTo(6);
    expect(s.stok.bugday).toBeCloseTo(0);
  });

  it('düz arazide bonus yok', () => {
    expect(heightAt(0, 0)).toBeLessThan(1);
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 6;
    add(s, 'degirmen', 0, 0);
    expect(uret(s).u.un).toBeCloseTo(6);
  });

  it('girdi yarımsa bonus da yarım çıktıya uygulanır', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 3;
    add(s, 'degirmen', 14, -8);
    const { u, t } = uret(s);
    expect(t.bugday).toBeCloseTo(3);
    expect(u.un).toBeCloseTo(3.75);
  });
});

describe('fırın: taze un', () => {
  it('6 birim içinde değirmen varsa yemek +%25; değirmen yıkılınca bonus kalkar', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.un = 4;
    const d = add(s, 'degirmen', 5.5, 0);
    add(s, 'firin', 0, 0);
    let r = uret(s);
    expect(r.u.yemek).toBeCloseTo(10);
    expect(r.t.un).toBeCloseTo(4);

    demolish(s, d.id);
    s.stok.un = 4;
    r = uret(s);
    expect(r.u.yemek).toBeCloseTo(8);
  });

  it('6 birimden uzak değirmen sayılmaz', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.un = 4;
    add(s, 'degirmen', 6.5, 0);
    add(s, 'firin', 0, 0);
    expect(uret(s).u.yemek).toBeCloseTo(8);
  });
});

describe('marangoz: yakın odun', () => {
  it('6 birim içinde oduncu varsa mobilya +%25', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.odun = 4;
    add(s, 'oduncu', 4, 0); // ağaç yok: odun üretmez, yalnızca kaynak
    add(s, 'marangoz', 0, 0);
    const { u, t } = uret(s);
    expect(u.mobilya).toBeCloseTo(5);
    expect(t.odun).toBeCloseTo(4);
  });

  it('oduncu yoksa bonus yok', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.odun = 4;
    add(s, 'marangoz', 0, 0);
    expect(uret(s).u.mobilya).toBeCloseTo(4);
  });
});

describe('ev: göl manzarası', () => {
  it('merkezi göle ≤ 5 ise +3 mutluluk', () => {
    const s = blank();
    const yakin = add(s, 'ev', golaUzak(4.9), 14);
    const uzak = add(s, 'ev', golaUzak(5.2), 14);
    const m = (h: typeof yakin) => houseHappiness(s, h, evaluateNeeds(s, h));
    expect(m(yakin)).toBe(45 + 3);
    expect(m(uzak)).toBe(45);
  });
});

describe('komşuluk: bilgi ve önizleme', () => {
  it('bilgi paneli kuralın durumunu verir; kuralı olmayan binada alan yok', () => {
    const s = blank();
    const t = add(s, 'tarla', 0, 0);
    expect(getBuildingInfo(s, t.id)!.komsuluk).toEqual([
      { etiket: 'sulama', sart: BUILDINGS.tarla.komsuluk![0].sart, aktif: false, oran: 0.25, mutluluk: 0 },
    ]);
    t.x = golaUzak(BUILDINGS.tarla.taban + 1);
    t.z = 14;
    expect(getBuildingInfo(s, t.id)!.komsuluk![0].aktif).toBe(true);
    expect(getBuildingInfo(s, add(s, 'cesme', 20, 0).id)!.komsuluk).toBeUndefined();
  });

  it('yerleştirmeden önce konum için hesaplanır ve metne çevrilir', () => {
    const s = blank();
    add(s, 'degirmen', 0, 0);
    const b = adjacencyBonus(s, 'firin', 4, 0);
    expect(b.oran).toBeCloseTo(0.25);
    expect(bonusText(b.durumlar[0])).toBe('+%25 taze un');
    expect(adjacencyBonus(s, 'firin', 30, 0).oran).toBe(0);
    const ev = adjacencyBonus(s, 'ev', golaUzak(2), 14);
    expect(ev.mutluluk).toBe(3);
    expect(bonusText(ev.durumlar[0])).toBe('+3 mutluluk (göl manzarası)');
    expect(adjacencyBonus(s, 'cesme', 0, 0).durumlar).toEqual([]);
  });
});
