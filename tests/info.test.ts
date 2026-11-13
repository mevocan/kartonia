import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/buildings';
import { getBuildingInfo } from '../src/logic/game';
import { add, blank } from './helpers';

// Bilgi paneli için türetilen alanlar: üretim tahmini, kapsanan evler, ev gün sayaçları.

describe('üretim tahmini', () => {
  it('işçi oranı ve komşuluk bonusuyla; girdi stoğu yanında', () => {
    const s = blank();
    s.nufus = 1; // değirmen 2 işçi ister → oran 0.5
    s.stok.bugday = 2;
    const d = add(s, 'degirmen', 0, 0);
    const u = getBuildingInfo(s, d.id)!.uretimTahmini!;
    expect(u.girdi).toEqual([{ mal: 'bugday', miktar: 3, stok: 2 }]);
    expect(u.cikti).toEqual([{ mal: 'un', miktar: 3 }]);
  });

  it('bonus çıktıyı artırır, girdiyi değil', () => {
    const s = blank();
    s.nufus = 100;
    const a = add(s, 'arilik', 20, 20);
    add(s, 'cicek', 22, 20);
    expect(getBuildingInfo(s, a.id)!.uretimTahmini!.cikti[0].miktar).toBeCloseTo(3.75);
  });

  it('kışın üretmeyen bina kışta 0; oduncu ağaç sayısından', () => {
    const s = blank();
    s.nufus = 100;
    s.gun = 16; // kış
    const tarla = add(s, 'tarla', 20, 20);
    expect(getBuildingInfo(s, tarla.id)!.uretimTahmini!.cikti[0].miktar).toBe(0);
    const o = add(s, 'oduncu', -20, -20);
    add(s, 'agac', -18, -20);
    add(s, 'agac', -22, -20);
    expect(getBuildingInfo(s, o.id)!.uretimTahmini).toEqual({ girdi: [], cikti: [{ mal: 'odun', miktar: 2 }] });
  });
});

describe('kapsanan evler ve ev sayaçları', () => {
  it('çeşme alanındaki evleri sayar; evde ve ağaçta alan yok', () => {
    const s = blank();
    const c = add(s, 'cesme', 0, 0);
    const h = add(s, 'ev', 3, 0);
    add(s, 'ev', 30, 0);
    const a = add(s, 'agac', -3, 0);
    expect(getBuildingInfo(s, c.id)!.kapsananEv).toBe(1);
    expect(getBuildingInfo(s, h.id)!.kapsananEv).toBeUndefined();
    expect(getBuildingInfo(s, a.id)!.kapsananEv).toBeUndefined();
  });

  it('ev: iyi/kötü gün ve eşikler', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    h.kotuGun = 1;
    expect(getBuildingInfo(s, h.id)!.evGun).toEqual({ iyi: 0, kotu: 1, buyumeEsik: BALANCE.seviyeGunEsigi, kuculmeEsik: BALANCE.seviyeGunEsigi });
  });
});
