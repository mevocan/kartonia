import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS } from '../src/data/buildings';
import {
  buildingUpkeep, canUpgrade, demolish, effectRadius, getBuildingInfo, upgradeBuilding, upgradeCost,
} from '../src/logic/game';
import { evaluateNeeds, totalUpkeep } from '../src/logic/economy';
import { add, blank } from './helpers';

describe('hizmet binası yükseltmesi', () => {
  it('yalnızca çeşme, pazar, okul ve hastane yükseltilebilir', () => {
    const s = blank();
    for (const t of ['cesme', 'pazar', 'okul', 'hastane'] as const) expect(upgradeCost(add(s, t, 0, 0))).not.toBeNull();
    for (const t of ['ev', 'agac', 'tarla', 'degirmen', 'firin', 'oduncu', 'saatKulesi', 'ambar', 'balikci', 'tasOcagi', 'marangoz'] as const) {
      expect(upgradeCost(add(s, t, 0, 0))).toBeNull();
    }
  });

  it('maliyet seviyeye göre artar, 3. seviyede durur', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    const c = add(s, 'cesme', 0, 0);
    const m = BUILDINGS.cesme.maliyet;
    expect(upgradeCost(c)).toBe(Math.round(m * BALANCE.yukseltme.maliyet[1]));
    expect(upgradeBuilding(s, c.id)).toBe(Math.round(m * 0.6));
    expect(c.seviye).toBe(2);
    expect(upgradeBuilding(s, c.id)).toBe(m);
    expect(c.seviye).toBe(3);
    expect(upgradeCost(c)).toBeNull();
    expect(upgradeBuilding(s, c.id)).toBeNull();
    expect(s.para).toBe(1000 - Math.round(m * 0.6) - m);
  });

  it('para yetmezse yükseltilmez', () => {
    const s = blank();
    s.para = 5;
    const o = add(s, 'okul', 0, 0);
    expect(canUpgrade(s, o.id)).toEqual({ ok: false, sebep: 'para' });
    expect(upgradeBuilding(s, o.id)).toBeNull();
    expect(o.seviye).toBe(1);
    expect(s.para).toBe(5);
  });

  it('oyun bittiyse yükseltilmez', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    s.bitti = true;
    const o = add(s, 'okul', 0, 0);
    expect(canUpgrade(s, o.id).sebep).toBe('bitti');
  });

  it('etki yarıçapı büyür ve uzak evlere de hizmet ulaşır', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    const c = add(s, 'cesme', 0, 0);
    const uzak = add(s, 'ev', 9, 0, 2); // 7 < 9 ≤ 9.8
    const su = () => evaluateNeeds(s, uzak).find((n) => n.ihtiyac === 'su')!.karsilandi;
    expect(su()).toBe(false);
    upgradeBuilding(s, c.id);
    expect(effectRadius(c)).toBeCloseTo(7 * 1.4);
    expect(su()).toBe(true);
    upgradeBuilding(s, c.id);
    expect(effectRadius(c)).toBeCloseTo(7 * 1.8);
  });

  it('gider seviyeye göre artar', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    const o = add(s, 'okul', 0, 0);
    expect(totalUpkeep(s)).toBe(12);
    upgradeBuilding(s, o.id);
    expect(buildingUpkeep(o)).toBe(18);
    expect(totalUpkeep(s)).toBe(18);
    upgradeBuilding(s, o.id);
    expect(totalUpkeep(s)).toBe(24);
  });

  it('yıkımda yükseltmelere harcanan paranın da yarısı geri gelir', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    const p = add(s, 'pazar', 0, 0);
    upgradeBuilding(s, p.id); // 42
    const once = s.para;
    expect(demolish(s, p.id)).toBe(Math.floor((70 + 42) * 0.5));
    expect(s.para).toBe(once + 56);
  });

  it('bilgi paneli mevcut ve sonraki seviyeyi verir', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 1000;
    const o = add(s, 'okul', 0, 0);
    expect(getBuildingInfo(s, o.id)).toMatchObject({ etki: 9, gider: 12, yukseltme: { maliyet: 54, gider: 18 } });
    upgradeBuilding(s, o.id);
    upgradeBuilding(s, o.id);
    expect(getBuildingInfo(s, o.id)?.yukseltme).toBeNull();
    expect(getBuildingInfo(s, add(s, 'tarla', 20, 0).id)?.yukseltme).toBeUndefined();
  });

  it('eski kayıtlardaki seviye 1 binalar etkilenmez', () => {
    const s = blank();
    const c = add(s, 'cesme', 0, 0);
    expect(effectRadius(c)).toBe(BUILDINGS.cesme.etki);
    expect(buildingUpkeep(c)).toBe(BUILDINGS.cesme.gider);
  });
});
