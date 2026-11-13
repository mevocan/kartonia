import { describe, expect, it } from 'vitest';
import { BALANCE, HOUSE_LEVELS } from '../src/data/buildings';
import { deserialize, endDay, serialize } from '../src/logic/game';
import { emptyGoods, evaluateNeeds, runProduction } from '../src/logic/economy';
import { GOALS } from '../src/logic/goals';
import { adjacencyBonus } from '../src/logic/adjacency';
import type { Building, GameState } from '../src/logic/types';
import { add, blank } from './helpers';

// Hayvancılık (Ağıl → yün → Dokumacı → kumaş), arıcılık (Arılık → bal), 4. ve 5. ev seviyeleri.
// blank() klasik haritayı kullanır; binalar gölden (-22, 14) uzağa konur.

function uret(s: GameState): Record<string, number> {
  const u = emptyGoods();
  runProduction(s, u, emptyGoods());
  return u;
}

describe('hayvancılık zinciri', () => {
  it('ağıl buğdayı yüne, dokumacı yünü kumaşa çevirir', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 3;
    add(s, 'agil', 20, -20);
    add(s, 'dokumaci', 30, -30); // ağıla uzak: bonus yok
    const u = uret(s);
    expect(u.yun).toBeCloseTo(4);
    expect(u.kumas).toBeCloseTo(4);
    expect(s.stok.bugday).toBeCloseTo(0);
    expect(s.stok.yun).toBeCloseTo(0);
    expect(s.stok.kumas).toBeCloseTo(4);
  });

  it('buğday yetmezse ağıl orantılı üretir; değirmen buğdayı önce alır', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 7.5;
    add(s, 'degirmen', 0, -20); // 6 buğday
    add(s, 'agil', 20, -20); // kalan 1.5 buğday → yarım üretim
    const u = uret(s);
    expect(u.un).toBeCloseTo(6);
    expect(u.yun).toBeCloseTo(2);
  });

  it('komşuluk: tarla yanında ağıl, ağıl yanında dokumacı +%25', () => {
    const s = blank();
    s.nufus = 100;
    s.stok.bugday = 100;
    add(s, 'tarla', 20, -26);
    const agil = add(s, 'agil', 20, -20);
    add(s, 'dokumaci', 24, -20);
    expect(adjacencyBonus(s, 'agil', agil.x, agil.z, agil.id).oran).toBeCloseTo(0.25);
    const u = uret(s);
    expect(u.yun).toBeCloseTo(5); // 4 × 1.25
    expect(u.kumas).toBeCloseTo(5); // girdi 4 yün, çıktı 4 × 1.25
  });
});

describe('arılık', () => {
  it('bal üretir; çiçek yakınındaysa +%25 (ağaç saymaz); kışın üretmez', () => {
    const s = blank();
    s.nufus = 100;
    const a = add(s, 'arilik', 20, 20);
    expect(uret(s).bal).toBeCloseTo(3);
    add(s, 'agac', 22, 20);
    expect(uret(s).bal).toBeCloseTo(3);
    add(s, 'cicek', 20, 23);
    expect(adjacencyBonus(s, 'arilik', a.x, a.z, a.id).oran).toBeCloseTo(0.25);
    expect(uret(s).bal).toBeCloseTo(3.75);
    s.gun = 16; // kış
    expect(uret(s).bal).toBe(0);
  });
});

/** Ev (0, 0) ve bütün hizmetler: su, yemek satışı, pazar, okul, sağlık, hamam, tiyatro. */
function hizmetliEv(seviye: number): { s: GameState; h: Building } {
  const s = blank();
  s.nufus = 200;
  const h = add(s, 'ev', 0, 0, seviye);
  add(s, 'cesme', 3, 0);
  add(s, 'pazar', -4, 0);
  add(s, 'okul', 0, 5);
  add(s, 'hastane', 0, -5);
  add(s, 'hamam', -4, 4.5);
  add(s, 'tiyatro', 4, -4.5);
  s.stok.yemek = 100;
  s.stok.odun = 100;
  s.stok.mobilya = 100;
  return { s, h };
}

describe('4. ve 5. ev seviyesi', () => {
  it('seviye tanımları: konak 14 kişi + kumaş + hamam, köşk 18 kişi + bal + tiyatro; hepsi bir alt seviyenin ihtiyaçlarını içerir', () => {
    expect(HOUSE_LEVELS.map((l) => l.nufus)).toEqual([3, 6, 10, 14, 18]);
    expect(HOUSE_LEVELS[3].ihtiyaclar).toContain('kumas');
    expect(HOUSE_LEVELS[3].ihtiyaclar).toContain('hamam');
    expect(HOUSE_LEVELS[4].ihtiyaclar).toContain('bal');
    expect(HOUSE_LEVELS[4].ihtiyaclar).toContain('kultur');
    for (let i = 1; i < HOUSE_LEVELS.length; i++) {
      for (const n of HOUSE_LEVELS[i - 1].ihtiyaclar) expect(HOUSE_LEVELS[i].ihtiyaclar).toContain(n);
    }
  });

  it('3. seviye ev kumaşla iki günde konak olur, konak balla köşk olur', () => {
    const { s, h } = hizmetliEv(3);
    s.stok.kumas = 100;
    endDay(s);
    expect(h.seviye).toBe(3);
    endDay(s);
    expect(h.seviye).toBe(4);
    s.stok.bal = 100;
    endDay(s);
    endDay(s);
    expect(h.seviye).toBe(5);
    expect(s.nufus).toBe(18);
  });

  it('konak kumaş tüketir (kişi başı 0.1), kumaş bitince iki günde küçülür', () => {
    const { s, h } = hizmetliEv(4);
    s.stok.kumas = 1.4;
    const r = endDay(s);
    expect(r.tuketilen.kumas).toBeCloseTo(14 * BALANCE.kumasKisiBasi);
    expect(s.stok.kumas).toBeCloseTo(0);
    expect(h.seviye).toBe(4);
    endDay(s);
    endDay(s);
    expect(h.seviye).toBe(3);
  });

  it('köşk bal ve kumaş tüketir; konak balı yalnızca yokmuş gibi bakar, tüketmez', () => {
    const { s } = hizmetliEv(5);
    const konak = add(s, 'ev', 1.5, 1.5, 4);
    s.stok.kumas = 100;
    s.stok.bal = 100;
    const r = endDay(s);
    expect(r.tuketilen.bal).toBeCloseTo(18 * BALANCE.balKisiBasi);
    expect(r.tuketilen.kumas).toBeCloseTo((18 + 14) * BALANCE.kumasKisiBasi);
    expect(evaluateNeeds(s, konak).find((n) => n.ihtiyac === 'bal')?.karsilandi).toBe(true);
  });
});

describe('kayıt göçü', () => {
  function eskiKayit(hedef: number): string {
    const s = blank();
    s.hedef = hedef;
    const stok = s.stok as Partial<Record<string, number>>;
    delete stok.yun;
    delete stok.kumas;
    delete stok.bal;
    return serialize(s);
  }

  it('yeni mallar 0 ile başlar', () => {
    const s = deserialize(eskiKayit(3));
    expect(s.stok.yun).toBe(0);
    expect(s.stok.kumas).toBe(0);
    expect(s.stok.bal).toBe(0);
    expect(s.hedef).toBe(3);
  });

  it('eski kayıtta efsane bitmişse yeni hedefler de bitmiş sayılır; efsane sürüyorsa Konaklar sıradadır', () => {
    expect(deserialize(eskiKayit(13)).hedef).toBe(GOALS.length);
    expect(deserialize(eskiKayit(12)).hedef).toBe(12);
  });
});
