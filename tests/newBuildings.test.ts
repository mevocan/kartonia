import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS } from '../src/data/buildings';
import { haritaUret, inTaslik, polylineDist } from '../src/data/map';
import {
  canPlace, canUpgrade, deserialize, endDay, serialize, stockLimit, upgradeBuilding,
} from '../src/logic/game';
import { emptyGoods, evaluateNeeds, runProduction } from '../src/logic/economy';
import { add, addRoad, blank } from './helpers';

// blank() klasik haritayı kullanır: göl (-22, 14) r≈7, taşlık (22, 2) r 4.5.

describe('ambar', () => {
  it('her ambar stok sınırını 100 artırır, üretim yeni sınıra kadar sürer', () => {
    const s = blank();
    expect(stockLimit(s)).toBe(200);
    add(s, 'ambar', 30, 30);
    add(s, 'ambar', 34, 30);
    expect(stockLimit(s)).toBe(400);
    s.nufus = 100;
    s.stok.bugday = 395;
    add(s, 'tarla', 0, 0);
    const u = emptyGoods();
    runProduction(s, u, emptyGoods());
    expect(s.stok.bugday).toBe(400);
    expect(u.bugday).toBeCloseTo(5);
  });
});

describe('balıkçı', () => {
  it('yalnızca göl kıyısına kurulur', () => {
    const s = blank();
    s.nufus = 100;
    s.para = 1000;
    addRoad(s, 'toprak', [{ x: -10.8, z: 10 }, { x: -10.8, z: 18 }]);
    expect(canPlace(s, 'balikci', -12.6, 14)).toEqual({ ok: true });
    addRoad(s, 'toprak', [{ x: 1.8, z: -2 }, { x: 1.8, z: 6 }]);
    expect(canPlace(s, 'balikci', 0, 2).sebep).toBe('golYok');
  });

  it('ortak yemek stoğuna üretir', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'balikci', 0, 0);
    endDay(s);
    expect(s.stok.yemek).toBeCloseTo(BUILDINGS.balikci.uretim!.cikti.yemek!);
  });
});

describe('yemek', () => {
  const yemekDurumu = (st: { ihtiyac: string; karsilandi: boolean }[]) => st.find((n) => n.ihtiyac === 'yemek')?.karsilandi;

  it('fırın ve balıkçı aynı stoğa farklı miktarda yemek üretir', () => {
    const firin = BUILDINGS.firin.uretim!.cikti.yemek!;
    const balikci = BUILDINGS.balikci.uretim!.cikti.yemek!;
    expect(firin).toBeGreaterThan(balikci);
    const s = blank();
    s.nufus = 100;
    s.stok.un = 4;
    add(s, 'firin', 0, 0);
    add(s, 'balikci', 6, 0);
    const u = emptyGoods();
    runProduction(s, u, emptyGoods());
    expect(u.yemek).toBeCloseTo(firin + balikci);
    expect(s.stok.yemek).toBeCloseTo(firin + balikci);
  });

  it('yemek yalnızca fırın ya da pazarın etki alanında alınır', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    s.stok.yemek = 100;
    expect(yemekDurumu(evaluateNeeds(s, h))).toBe(false); // stok var ama satış yeri yok
    const pazar = add(s, 'pazar', 20, 0);
    expect(yemekDurumu(evaluateNeeds(s, h))).toBe(false); // pazar uzakta
    pazar.x = 6;
    expect(yemekDurumu(evaluateNeeds(s, h))).toBe(true);

    const t = blank();
    const h2 = add(t, 'ev', 0, 0, 2);
    t.stok.yemek = 100;
    add(t, 'firin', 4, 0);
    expect(yemekDurumu(evaluateNeeds(t, h2))).toBe(true);
  });

  it('stok yetmezse karşılanmaz; yetiyorsa ev kişi başına yer', () => {
    const s = blank();
    add(s, 'pazar', 4, 0);
    const h = add(s, 'ev', 0, 0, 2); // 6 kişi × 0.25 = 1.5
    s.stok.yemek = 1.2;
    expect(yemekDurumu(evaluateNeeds(s, h))).toBe(false);
    s.stok.yemek = 1.8;
    const tuketim = emptyGoods();
    expect(yemekDurumu(evaluateNeeds(s, h, tuketim))).toBe(true);
    expect(tuketim.yemek).toBeCloseTo(6 * BALANCE.yemekKisiBasi);
    expect(s.stok.yemek).toBeCloseTo(0.3);
  });
});

describe('taş ocağı', () => {
  it('yalnızca taşlık alana kurulur', () => {
    const s = blank();
    s.nufus = 100;
    s.para = 1000;
    expect(inTaslik(22, 2)).toBe(true);
    addRoad(s, 'toprak', [{ x: 24.1, z: -2 }, { x: 24.1, z: 6 }]);
    expect(canPlace(s, 'tasOcagi', 22, 2)).toEqual({ ok: true });
    addRoad(s, 'toprak', [{ x: 1.8, z: -2 }, { x: 1.8, z: 6 }]);
    expect(canPlace(s, 'tasOcagi', -0.3, 2).sebep).toBe('taslikYok');
  });

  it('her rastgele haritada taşlık var ve taşlıklar göle/yola değmez', () => {
    for (let i = 0; i < 100; i++) {
      const h = haritaUret((i * 2654435761) >>> 0);
      expect(h.tasliklar.length).toBeGreaterThanOrEqual(1);
      for (const t of h.tasliklar) {
        expect(polylineDist(t.x, t.z, h.baslangicYolu)).toBeGreaterThan(t.r + 2);
        for (const g of h.goller) expect(Math.hypot(t.x - g.x, t.z - g.z)).toBeGreaterThan(t.r + g.r);
      }
    }
  });

  it('hizmet yükseltmeleri taş ister ve taşı harcar', () => {
    const s = blank();
    s.para = 1000;
    const o = add(s, 'okul', 0, 0);
    expect(canUpgrade(s, o.id).sebep).toBe('tas');
    s.stok.tas = 12;
    expect(upgradeBuilding(s, o.id)).not.toBeNull();
    expect(s.stok.tas).toBeCloseTo(12 - BALANCE.yukseltme.tas[1]);
    expect(canUpgrade(s, o.id).sebep).toBe('tas'); // 3. seviye 25 taş ister
  });
});

describe('marangoz, mobilya ve hastane', () => {
  it('marangoz odunu mobilyaya çevirir', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.odun = 10;
    add(s, 'marangoz', 0, 0);
    endDay(s);
    expect(s.stok.mobilya).toBeCloseTo(4);
    expect(s.stok.odun).toBeCloseTo(6);
  });

  it('3. seviye ev mobilya ve sağlık ister', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 3);
    const durum = (n: string) => evaluateNeeds(s, h).find((x) => x.ihtiyac === n)?.karsilandi;
    expect(durum('mobilya')).toBe(false);
    expect(durum('saglik')).toBe(false);
    s.stok.mobilya = 1;
    add(s, 'hastane', 5, 0);
    expect(durum('mobilya')).toBe(true);
    expect(durum('saglik')).toBe(true);
    const tuketim = emptyGoods();
    evaluateNeeds(s, h, tuketim);
    expect(tuketim.mobilya).toBeCloseTo(10 * BALANCE.mobilyaKisiBasi);
  });
});

describe('kayıt uyumu', () => {
  it('Hal kaldırıldı: eski kayıttaki Hal aynı yerde, aynı seviyede Pazar olur ve yemek satar', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    const eski = add(s, 'pazar', 5, 0, 2);
    (eski as { type: string }).type = 'hal';
    const y = deserialize(serialize(s));
    const p = y.binalar.find((b) => b.id === eski.id)!;
    expect(p).toMatchObject({ type: 'pazar', x: 5, z: 0, seviye: 2 });
    y.stok.yemek = 100;
    expect(evaluateNeeds(y, y.binalar.find((b) => b.id === h.id)!).find((n) => n.ihtiyac === 'yemek')?.karsilandi).toBe(true);
  });

  it('eski kayıt: ekmek + balık ortak yemeğe aktarılır, yeni mallar 0 olur', () => {
    const s = blank();
    const eski = JSON.parse(serialize(s)) as { durum: Record<string, unknown> & { stok: Record<string, number> } };
    eski.durum.stok = { bugday: 1, un: 2, ekmek: 30, odun: 4, balik: 12 };
    delete eski.durum.toplamYemek;
    eski.durum.toplamEkmek = 77;
    const y = deserialize(JSON.stringify(eski));
    expect(y.stok).toEqual({ bugday: 1, un: 2, yemek: 42, odun: 4, tas: 0, mobilya: 0, yun: 0, kumas: 0, bal: 0 });
    expect(y.toplamYemek).toBe(77);
    expect('toplamEkmek' in y).toBe(false);
  });
});
