// Eğlence planı Faz 6: Meydan ve mahalle karakteri (Çarşı, Bahçeli, Zanaat).
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/data/buildings';
import { canPlace, endDay, getBuildingInfo, gorselSeviye, karakterDurumu, karakterSec } from '../src/logic/game';
import { emptyGoods, evaluateNeeds, houseHappiness, runProduction } from '../src/logic/economy';
import { add, addRoad, blank } from './helpers';

describe('Meydan', () => {
  it('ilk karakter seçimi bedava, değiştirmek 100 para; seçilmemiş meydan etkisiz', () => {
    const s = blank();
    s.para = 150;
    const m = add(s, 'meydan', 0, 0);
    const h = add(s, 'ev', 3, 0);
    const taban = houseHappiness(s, h, evaluateNeeds(s, h));
    expect(gorselSeviye(m)).toBe(1);
    expect(karakterDurumu(s, m.id, 'carsi')).toEqual({ ok: true, bedel: 0 });
    expect(karakterSec(s, m.id, 'carsi')).toBe(true);
    expect(s.para).toBe(150);
    expect(gorselSeviye(m)).toBe(2);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(taban - 2);
    expect(karakterDurumu(s, m.id, 'carsi').sebep).toBe('ayni');
    expect(karakterSec(s, m.id, 'zanaat')).toBe(true);
    expect(s.para).toBe(50);
    expect(karakterDurumu(s, m.id, 'bahceli').sebep).toBe('para');
  });

  it('Çarşı vergiyi %15 artırır (alandaki evler)', () => {
    const s = blank();
    for (let i = 0; i < 4; i++) add(s, 'ev', 3 + i * 0.5, i * 2);
    const once = endDay(s).vergi;
    const t = blank();
    const m = add(t, 'meydan', 0, 0);
    for (let i = 0; i < 4; i++) add(t, 'ev', 3 + i * 0.5, i * 2);
    karakterSec(t, m.id, 'carsi');
    const sonra = endDay(t).vergi;
    expect(sonra).toBeGreaterThan(once);
    expect(getBuildingInfo(t, t.binalar[1].id)?.mahalle).toBe('carsi');
  });

  it('Zanaat alandaki üretimi %15 artırır; Bahçeli alana üretim binası kondurmaz', () => {
    const s = blank();
    s.nufus = 100;
    s.para = 1000;
    const m = add(s, 'meydan', 0, 0);
    add(s, 'tarla', 4, 0);
    karakterSec(s, m.id, 'zanaat');
    const u = emptyGoods();
    s.gun = 11; // sonbahar: tarlanın mevsim etkisi yok
    runProduction(s, u, emptyGoods());
    expect(u.bugday).toBeCloseTo(6 * 1.15);
    // Alanda üretim binası varken Bahçeli seçilemez.
    expect(karakterDurumu(s, m.id, 'bahceli').sebep).toBe('uretimVar');

    const t = blank();
    t.para = 1000;
    t.nufus = 200;
    const b = add(t, 'meydan', 0, 0);
    karakterSec(t, b.id, 'bahceli');
    addRoad(t, 'toprak', [{ x: -6, z: 5 }, { x: 6, z: 5 }]);
    expect(canPlace(t, 'firin', 0, 3.6).sebep).toBe('bahceli');
    expect(canPlace(t, 'cesme', 0, 3.6).ok).toBe(true);
  });

  it('Meydan alanları çakışamaz', () => {
    const s = blank();
    s.para = 1000;
    s.nufus = 100;
    add(s, 'meydan', 0, 0);
    addRoad(s, 'toprak', [{ x: 0, z: 2 }, { x: 30, z: 2 }]);
    expect(canPlace(s, 'meydan', 10, 0).sebep).toBe('meydanCakisiyor');
    expect(canPlace(s, 'meydan', 2 * BUILDINGS.meydan.etki + 1, 0).ok).toBe(true);
  });
});
