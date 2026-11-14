import { describe, expect, it } from 'vitest';
import { endDay, getBuildingInfo, housesInRange } from '../src/logic/game';
import { BALANCE } from '../src/data/buildings';
import {
  emptyGoods, evaluateNeeds, houseHappiness, housePopulation, houseTax, runProduction, workerRatio,
} from '../src/logic/economy';
import type { GameState, Need, NeedStatus } from '../src/logic/types';
import { add, addRoad, blank } from './helpers';

function produce(s: GameState) {
  const u = emptyGoods();
  const t = emptyGoods();
  runProduction(s, u, t);
  return { u, t };
}

function met(st: NeedStatus[], n: Need): boolean | undefined {
  return st.find((x) => x.ihtiyac === n)?.karsilandi;
}

describe('işçi oranı', () => {
  it('işçi yeterse 1, değilse nüfus / ihtiyaç', () => {
    const s = blank();
    expect(workerRatio(s)).toBe(1);
    add(s, 'tarla', 0, 0);
    add(s, 'degirmen', 6, 0);
    s.nufus = 4;
    expect(workerRatio(s)).toBe(1);
    s.nufus = 2;
    expect(workerRatio(s)).toBe(0.5);
  });

  it('eksik işçi üretimi düşürür', () => {
    const s = blank();
    add(s, 'tarla', 0, 0);
    s.nufus = 1;
    expect(produce(s).u.bugday).toBe(3);
  });
});

describe('üretim', () => {
  it('zincir sırayla: tarla → değirmen → fırın', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'firin', 20, 0); // sıra id'ye değil türe göre; değirmenden uzak (taze un bonusu yok)
    add(s, 'degirmen', 5, 0);
    add(s, 'tarla', 0, 0);
    const { u, t } = produce(s);
    const yeni = { yun: 0, kumas: 0, bal: 0 };
    expect(u).toEqual({ bugday: 6, un: 6, yemek: 8, odun: 0, tas: 0, mobilya: 0, ...yeni });
    expect(t).toEqual({ bugday: 6, un: 4, yemek: 0, odun: 0, tas: 0, mobilya: 0, ...yeni });
    expect(s.stok).toEqual({ bugday: 0, un: 2, yemek: 8, odun: 0, tas: 0, mobilya: 0, ...yeni });
    expect(s.toplamYemek).toBe(8);
  });

  it('girdi yetmezse orantılı üretir', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'degirmen', 0, 0);
    s.stok.bugday = 3;
    const { u } = produce(s);
    expect(u.un).toBe(3);
    expect(s.stok.bugday).toBe(0);
  });

  it('girdi yoksa üretmez', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'firin', 0, 0);
    expect(produce(s).u.yemek).toBe(0);
  });

  it('stok 200 ile sınırlı', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'tarla', 0, 0);
    s.stok.bugday = 198;
    expect(produce(s).u.bugday).toBe(2);
    expect(s.stok.bugday).toBe(200);
  });

  it('oduncu etki alanındaki ağaç başına odun üretir', () => {
    const s = blank();
    s.nufus = 100;
    const o = add(s, 'oduncu', 0, 0);
    add(s, 'agac', 3, 0);
    add(s, 'agac', 0, 5);
    add(s, 'agac', -4, -4);
    add(s, 'agac', 10, 0); // dışarıda
    expect(produce(s).u.odun).toBe(3);
    expect(getBuildingInfo(s, o.id)!.agacSayisi).toBe(3);
  });
});

describe('ihtiyaçlar', () => {
  it('su: ev merkezi çeşmenin etki yarıçapında', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    add(s, 'cesme', 6.9, 0);
    expect(met(evaluateNeeds(s, h), 'su')).toBe(true);
    s.binalar[1].x = 7.1;
    expect(met(evaluateNeeds(s, h), 'su')).toBe(false);
  });

  it('pazar ve okul kapsama', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 3);
    add(s, 'pazar', 8, 0);
    add(s, 'okul', 0, 9.5);
    const st = evaluateNeeds(s, h);
    expect(met(st, 'pazar')).toBe(true);
    expect(met(st, 'okul')).toBe(false);
  });

  it('ihtiyaç listesi: mevcut + üst seviye, tekrarsız', () => {
    const s = blank();
    const h1 = add(s, 'ev', 0, 0, 1);
    const h2 = add(s, 'ev', 5, 0, 2);
    const h3 = add(s, 'ev', 10, 0, 3);
    const h4 = add(s, 'ev', 15, 0, 4);
    const h5 = add(s, 'ev', 20, 0, 5);
    const ust = ['su', 'yemek', 'odun', 'pazar', 'okul', 'mobilya', 'saglik'];
    expect(evaluateNeeds(s, h1).map((x) => x.ihtiyac)).toEqual(['su', 'yemek']);
    expect(evaluateNeeds(s, h2).map((x) => x.ihtiyac)).toEqual(ust);
    expect(evaluateNeeds(s, h3).map((x) => x.ihtiyac)).toEqual([...ust, 'kumas', 'hamam']);
    expect(evaluateNeeds(s, h4).map((x) => x.ihtiyac)).toEqual([...ust, 'kumas', 'hamam', 'bal', 'kultur']);
    expect(evaluateNeeds(s, h5).map((x) => x.ihtiyac)).toEqual([...ust, 'kumas', 'hamam', 'bal', 'kultur']);
  });

  it('yemek: id küçük ev önce beslenir, yetmeyen karşılanmaz', () => {
    const s = blank();
    add(s, 'cesme', 0, 3);
    add(s, 'pazar', 1.5, -3); // yemek satış yeri
    add(s, 'ev', 0, 0, 2);
    add(s, 'ev', 3, 0, 2);
    s.stok.yemek = 2; // 6 × 0.25 = 1.5 ev başına
    const r = endDay(s);
    expect(r.tuketilen.yemek).toBe(1.5);
    expect(s.stok.yemek).toBe(0.5);
    const [a, b] = s.binalar.filter((x) => x.type === 'ev');
    expect(a.kotuGun).toBe(0);
    expect(b.kotuGun).toBe(1);
  });

  it('seviye 1 ev yemeğe bakar ama tüketmez', () => {
    const s = blank();
    add(s, 'ev', 0, 0, 1);
    s.stok.yemek = 5;
    const r = endDay(s);
    expect(r.tuketilen.yemek).toBe(0);
    expect(s.stok.yemek).toBe(5);
  });
});

describe('seviye atlama ve düşme', () => {
  it('üst seviye ihtiyaçları 2 gün üst üste karşılanınca atlar', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 1);
    add(s, 'cesme', 3, 0);
    add(s, 'pazar', 0, -3); // yemek satış yeri
    s.stok.yemek = 50;
    let r = endDay(s);
    expect(h.seviye).toBe(1);
    expect(h.iyiGun).toBe(1);
    expect(r.seviyeDegisimleri).toEqual([]);
    r = endDay(s);
    expect(h.seviye).toBe(2);
    expect(r.seviyeDegisimleri).toEqual([{ id: h.id, eski: 1, yeni: 2 }]);
    expect(s.nufus).toBe(6);
  });

  it('araya kötü gün girerse sayaç sıfırlanır', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 1);
    add(s, 'cesme', 3, 0);
    add(s, 'pazar', 0, -3); // yemek satış yeri
    s.stok.yemek = 50;
    endDay(s);
    s.stok.yemek = 0;
    endDay(s);
    expect(h.iyiGun).toBe(0);
    s.stok.yemek = 50;
    endDay(s);
    expect(h.seviye).toBe(1);
  });

  it('mevcut ihtiyaçlar 2 gün üst üste karşılanmazsa düşer', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    s.stok.yemek = 50; // su yok
    endDay(s);
    expect(h.seviye).toBe(2);
    expect(h.kotuGun).toBe(1);
    const r = endDay(s);
    expect(h.seviye).toBe(1);
    expect(r.seviyeDegisimleri).toEqual([{ id: h.id, eski: 2, yeni: 1 }]);
  });

  it('mutluluğu büyüme eşiğinin altındaki ev büyüyemez (küçülmez de); gürültü kalkınca büyür', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 1);
    add(s, 'cesme', 3, 0); // +2
    add(s, 'pazar', 0, -3); // +3, yemek satış yeri
    const gurultu = [add(s, 'degirmen', 2, 2), add(s, 'degirmen', -2, 2), add(s, 'oduncu', 0, 4)]; // −6 −6 −5
    s.stok.yemek = 50;
    const m = houseHappiness(s, h, evaluateNeeds(s, h));
    expect(m).toBe(BALANCE.mutlulukTaban + 2 + 3 - 6 - 6 - 5);
    expect(m).toBeLessThan(BALANCE.buyumeMutluluk);
    for (let i = 0; i < 3; i++) {
      const r = endDay(s);
      expect(r.mutsuzEvler).toEqual([h.id]);
      s.stok.yemek = 50;
    }
    expect(h.seviye).toBe(1);
    expect(h.iyiGun).toBe(0);

    s.binalar = s.binalar.filter((b) => !gurultu.includes(b));
    expect(endDay(s).mutsuzEvler).toEqual([]);
    s.stok.yemek = 50;
    endDay(s);
    expect(h.seviye).toBe(2);
  });

  it('mutsuz ev küçülmez: mevcut seviyesinin ihtiyaçları karşılanıyorsa yerinde kalır', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    add(s, 'cesme', 3, 0);
    add(s, 'pazar', 0, -3);
    add(s, 'degirmen', 2, 2);
    add(s, 'degirmen', -2, 2);
    add(s, 'oduncu', 0, 4);
    for (let i = 0; i < 4; i++) {
      s.stok.yemek = 50;
      endDay(s);
    }
    expect(h.seviye).toBe(2);
    expect(h.kotuGun).toBe(0);
  });

  it('seviye 1 düşmez', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 1);
    endDay(s);
    endDay(s);
    expect(h.seviye).toBe(1);
    expect(h.kotuGun).toBe(0);
  });
});

describe('mutluluk', () => {
  it('sabitler BALANCE içinde: taban 45, ihtiyaç başına 2, ağaç tavanı 9', () => {
    expect(BALANCE.mutlulukTaban).toBe(45);
    expect(BALANCE.ihtiyacMutluluk).toBe(2);
    expect(BALANCE.agacMutlulukSinir).toBe(9);
    expect([BALANCE.mutlulukMin, BALANCE.mutlulukMax]).toEqual([0, 100]);
  });

  it('temel 45, ağaç katkısı en fazla 9', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(45);
    for (let i = 0; i < 2; i++) add(s, 'agac', 2, i - 0.5);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(51);
    for (let i = 0; i < 6; i++) add(s, 'agac', -2, i * 0.5 - 1.25);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(54);
  });

  it('gürültü eksi, karşılanan mevcut ihtiyaç başına +2', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 2);
    add(s, 'degirmen', 3, 0); // −6
    add(s, 'cesme', 0, 3); // +2, su
    add(s, 'firin', 0, -3); // yemek satış yeri, mutluluk 0
    s.stok.yemek = 10;
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(45 - 6 + 2 + 2 * 2);
  });

  // Plandaki beklenen sonuç tablosu.
  describe('yeni ölçek: örnek evler', () => {
    /** Evin etrafına 3 ağaç (toplam +9, tavan). */
    const agaclar = (s: GameState): void => {
      for (const [x, z] of [[2, 1], [-2, 1], [0, -2]]) add(s, 'agac', x, z);
    };
    const olc = (s: GameState, h: ReturnType<typeof add>): [number, number] => {
      const m = houseHappiness(s, h, evaluateNeeds(s, h));
      return [m, houseTax(housePopulation(h), m, h.seviye)];
    };

    /** Tam hizmetli 3. seviye ev: çeşme, pazar (yemek de satar), okul, hastane (auralar +14) + stok + ağaç + asfalt. */
    function tamHizmet(): { s: GameState; h: ReturnType<typeof add> } {
      const s = blank();
      const h = add(s, 'ev', 0, 0, 3);
      add(s, 'cesme', 4, 0); // +2
      add(s, 'pazar', 0, 5); // +3
      add(s, 'okul', 0, -5); // +5
      add(s, 'hastane', 5, 5); // +4
      agaclar(s);
      addRoad(s, 'asfalt', [{ x: -5, z: 2 }, { x: 5, z: 2 }]);
      s.stok.yemek = 100;
      s.stok.odun = 100;
      s.stok.mobilya = 100;
      return { s, h };
    }

    it('1. seviye, çeşme + ağaçlar: 56, vergi 3', () => {
      const s = blank();
      const h = add(s, 'ev', 0, 0, 1);
      add(s, 'cesme', 4, 0);
      agaclar(s);
      expect(olc(s, h)).toEqual([56, 3]);
    });

    it('2. seviye, çeşme + pazar + ağaçlar: 63, vergi 6', () => {
      const s = blank();
      const h = add(s, 'ev', 0, 0, 2);
      add(s, 'cesme', 4, 0);
      add(s, 'pazar', -5, 0);
      agaclar(s);
      s.stok.yemek = 100;
      expect(olc(s, h)).toEqual([63, 6]);
    });

    it('3. seviye, tam hizmet + ağaç + asfalt: 87, vergi 12 (×0.9); Saat Kulesi olmadan 100\'e ulaşmaz', () => {
      const { s, h } = tamHizmet();
      // Mevcut seviyenin bütün ihtiyaçları karşılanır (üst seviyenin kumaşı ve hamamı hariç).
      expect(evaluateNeeds(s, h).every((n) => n.karsilandi || n.ihtiyac === 'kumas' || n.ihtiyac === 'hamam')).toBe(true);
      expect(olc(s, h)).toEqual([87, 12]); // floor(10 × 1.37 × 0.9)
      expect(olc(s, h)[0]).toBeLessThan(100);
    });

    it('aynı ev Saat Kulesi alanında: 99, vergi 13 (×0.9)', () => {
      const { s, h } = tamHizmet();
      add(s, 'saatKulesi', -6, -6);
      expect(olc(s, h)).toEqual([99, 13]); // floor(10 × 1.49 × 0.9)
    });
  });

  it('0–100 arasında sınırlı', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    for (let i = 0; i < 6; i++) add(s, 'saatKulesi', 5, i);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(100);
    s.binalar = [h];
    for (let i = 0; i < 10; i++) add(s, 'degirmen', 2, i * 0.3);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(0);
  });

  it('ortalama mutluluk nüfus ağırlıklı, ev yoksa taban (45)', () => {
    const s = blank();
    s.mutluluk = 10;
    endDay(s);
    expect(s.mutluluk).toBe(45);
    add(s, 'ev', 0, 0, 1); // 3 kişi, 45
    add(s, 'ev', 20, 0, 3); // 10 kişi
    add(s, 'agac', 20, 2); // +3 (sadece ikinci eve)
    endDay(s);
    expect(s.nufus).toBe(13);
    expect(s.mutluluk).toBeCloseTo((3 * 45 + 10 * 48) / 13);
  });
});

describe('vergi ve gider', () => {
  it('floor(nüfus × (0.5 + mutluluk/100))', () => {
    expect(houseTax(3, 50)).toBe(3);
    expect(houseTax(6, 59)).toBe(6);
    expect(houseTax(10, 100)).toBe(15);
    expect(houseTax(10, 0)).toBe(5);
  });

  it('vergi çarpanı: 1. ve 2. seviyede 1, 3. seviyede 0.9, konak ve köşkte 0.85', () => {
    expect(BALANCE.vergiSeviyeCarpani).toEqual([1, 1, 0.9, 0.85, 0.85]);
    expect(houseTax(14, 100, 4)).toBe(17); // floor(14 × 1.5 × 0.85)
    expect(houseTax(18, 100, 5)).toBe(22); // floor(18 × 1.5 × 0.85)
    expect(houseTax(6, 50, 2)).toBe(6);
    expect(houseTax(10, 50, 3)).toBe(9); // 8.999… değil, 9
    expect(houseTax(10, 100, 3)).toBe(13); // floor(13.5)
    expect(houseTax(10, 89, 3)).toBe(12); // floor(12.51)
  });

  it('gün sonunda vergi eklenir, gider düşülür', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0); // mutluluk 45 → floor(3 × 0.95) = 2
    add(s, 'tarla', 10, 0); // gider 1
    const r = endDay(s);
    expect(r.vergi).toBe(2);
    expect(r.gider).toBe(1);
    expect(r.binaVergileri).toEqual([{ id: h.id, miktar: 2 }]);
    expect(s.para).toBe(151);
    expect(r.gun).toBe(1);
    expect(s.gun).toBe(2);
  });

  it('gün raporu dökümü: bina gideri, yol gideri, net', () => {
    const s = blank();
    add(s, 'ev', 0, 0, 1);
    add(s, 'tarla', 10, 0); // 1
    add(s, 'cesme', 3, 0); // 1
    addRoad(s, 'asfalt', [{ x: 0, z: 20 }, { x: 35, z: 20 }]); // 3.5 → 3
    const once = s.para;
    const r = endDay(s);
    expect(r.binaGider).toBe(2);
    expect(r.yolGider).toBe(3);
    expect(r.gider).toBe(r.binaGider + r.yolGider);
    expect(r.net).toBe(r.vergi - r.gider);
    expect(s.para - once).toBe(r.net);
  });
});

describe('borç ve oyun sonu', () => {
  it('para 3 gün üst üste −50 altında biterse oyun biter', () => {
    const s = blank();
    s.para = -100;
    expect(endDay(s).oyunBitti).toBe(false);
    expect(endDay(s).oyunBitti).toBe(false);
    expect(s.borcGunu).toBe(2);
    const r = endDay(s);
    expect(r.oyunBitti).toBe(true);
    expect(s.bitti).toBe(true);
  });

  it('araya iyi gün girerse sayaç sıfırlanır', () => {
    const s = blank();
    s.para = -100;
    endDay(s);
    endDay(s);
    s.para = 0;
    endDay(s);
    expect(s.borcGunu).toBe(0);
    expect(s.bitti).toBe(false);
  });
});

describe('açılan binalar', () => {
  it('nüfus eşiği geçilince yeni açılanlar raporlanır', () => {
    const s = blank();
    for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 0);
    const r = endDay(s);
    expect(s.nufus).toBe(12);
    expect(r.yeniAcilanlar).toEqual(['degirmen', 'firin', 'balikci', 'cit']);
    expect(endDay(s).yeniAcilanlar).toEqual([]);
  });
});

describe('bilgi', () => {
  it('ev, üretim binası ve yıkım iadesi', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 1);
    const t = add(s, 'tarla', 10, 0);
    add(s, 'cesme', 3, 0);
    s.nufus = 1;
    const hi = getBuildingInfo(s, h.id)!;
    expect(hi.nufus).toBe(3);
    expect(hi.mutluluk).toBe(47);
    expect(hi.tahminiVergi).toBe(houseTax(3, 47));
    expect(hi.ihtiyaclar).toEqual([
      { ihtiyac: 'su', karsilandi: true },
      { ihtiyac: 'yemek', karsilandi: false },
    ]);
    expect(hi.yikimIadesi).toBe(10);
    expect(hi.isciOrani).toBeUndefined();
    const ti = getBuildingInfo(s, t.id)!;
    expect(ti.isciOrani).toBe(0.5);
    expect(ti.gider).toBe(1);
    expect(ti.yikimIadesi).toBe(12);
    expect(getBuildingInfo(s, 999)).toBeNull();
  });

  it('housesInRange', () => {
    const s = blank();
    const c = add(s, 'cesme', 0, 0);
    const a = add(s, 'ev', 3, 0);
    add(s, 'ev', 10, 0);
    add(s, 'agac', 1, 1);
    expect(housesInRange(s, c.id)).toEqual([a.id]);
    expect(housesInRange(s, a.id)).toEqual([]);
  });
});

describe('yollar ve ekonomi', () => {
  it('asfalt yol kenarındaki eve +5, yalnızca en iyi yol sayılır', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    addRoad(s, 'toprak', [{ x: -5, z: 2 }, { x: 5, z: 2 }]);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(45);
    expect(getBuildingInfo(s, h.id)!.yol).toBe('toprak');
    addRoad(s, 'asfalt', [{ x: -5, z: -2.2 }, { x: 5, z: -2.2 }]);
    addRoad(s, 'asfalt', [{ x: 2.2, z: -5 }, { x: 2.2, z: 5 }]);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(50);
    expect(getBuildingInfo(s, h.id)!.yol).toBe('asfalt');
  });

  it('uzaktaki yol bonus vermez, yol yoksa yol alanı null', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0);
    expect(getBuildingInfo(s, h.id)!.yol).toBeNull();
    addRoad(s, 'asfalt', [{ x: -5, z: 3 }, { x: 5, z: 3 }]); // kenar boşluğu 3 − 1.1 − 0.7 = 1.2 > 1
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(45);
  });

  it('yol gideri: floor(uzunluk × birimGider) gün sonunda düşülür', () => {
    const s = blank();
    addRoad(s, 'asfalt', [{ x: 0, z: 0 }, { x: 25, z: 0 }]); // 2.5 → 2
    addRoad(s, 'toprak', [{ x: 0, z: 5 }, { x: 25, z: 5 }]); // 0
    expect(endDay(s).gider).toBe(2);
    expect(s.para).toBe(148);
  });

  it('oduncu doğal ağaçları da sayar', () => {
    const s = blank();
    s.nufus = 100;
    add(s, 'oduncu', 0, 0);
    add(s, 'agac', 2, 0).dogal = true;
    add(s, 'agac', -2, 0);
    expect(produce(s).u.odun).toBe(2);
  });
});
