import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS } from '../src/data/buildings';
import { KARTLAR } from '../src/data/cards';
import {
  ayar, bekleyenSecim, buildingUpkeep, deserialize, endDay, kalanKota, kartCek, kartSec, serialize, stockLimit,
  upgradeStone, secimGunu, toplamSecim,
} from '../src/logic/game';
import { emptyGoods, evaluateNeeds, houseHappiness, houseTax, runProduction } from '../src/logic/economy';
import { checkGoals } from '../src/logic/goals';
import { kartGunSonu } from '../src/logic/cards';
import type { GameState } from '../src/logic/types';
import { add, blank } from './helpers';

/** Kartı doğrudan seçili yap (çekiliş kuralından bağımsız etki testleri için). */
function kartli(id: string): GameState {
  const s = blank();
  s.kararlar = [id];
  return s;
}

function uret(s: GameState) {
  const u = emptyGoods();
  runProduction(s, u, emptyGoods());
  return u;
}

describe('karar kartları: veri', () => {
  it('16 kartlık havuz, her kartın bir artısı ve bir eksisi var', () => {
    expect(KARTLAR).toHaveLength(16);
    for (const k of KARTLAR) {
      expect(k.arti.length).toBeGreaterThan(0);
      expect(k.eksi.length).toBeGreaterThan(0);
      expect(k.etkiler.length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(KARTLAR.map((k) => k.id)).size).toBe(16);
  });

  it('kart seçimi 30 günde bir, son seçim 240. gün (8 seçim)', () => {
    expect(BALANCE.kartSecimi).toEqual({ aralik: 30, son: 240 });
  });

  it('kartsızken ayar taban değeri verir', () => {
    const s = blank();
    expect(ayar(s, 'odunKisiBasi')).toBe(BALANCE.odunKisiBasi);
    expect(ayar(s, 'uretim.tarla.bugday')).toBe(6);
    expect(ayar(s, 'gider.pazar')).toBe(BUILDINGS.pazar.gider);
    expect(ayar(s, 'vergiCarpani')).toBe(1);
    expect(ayar(s, 'ticaretKota')).toBe(BALANCE.ticaret.kota);
  });
});

describe('karar kartları: etkiler', () => {
  it('Balıkçı kasabası: balıkçı +2 yemek, tarla −1 buğday', () => {
    const s = kartli('balikciKasabasi');
    s.nufus = 100;
    add(s, 'balikci', 0, 20);
    add(s, 'tarla', 0, 0);
    const u = uret(s);
    expect(u.yemek).toBeCloseTo(5);
    expect(u.bugday).toBeCloseTo(5);
  });

  it('Odun tasarrufu: odun tüketimi −%30, bütün evlere −5 mutluluk', () => {
    const s = kartli('odunTasarrufu');
    const h = add(s, 'ev', 0, 0, 3);
    s.stok.odun = 100;
    const t = emptyGoods();
    evaluateNeeds(s, h, t);
    expect(t.odun).toBeCloseTo(10 * BALANCE.odunKisiBasi * 0.7);
    const bos = blank();
    const h2 = add(bos, 'ev', 0, 0, 1);
    const k = kartli('odunTasarrufu');
    const h3 = add(k, 'ev', 0, 0, 1);
    expect(houseHappiness(k, h3, evaluateNeeds(k, h3))).toBe(houseHappiness(bos, h2, evaluateNeeds(bos, h2)) - 5);
  });

  it('Ağır vergi: vergi +%15, evler 3 iyi günde büyür', () => {
    expect(houseTax(10, 50, 2, 1.15)).toBe(Math.floor(10 * 1.0 * 1.15));
    const s = kartli('agirVergi');
    const h = add(s, 'ev', 0, 0, 1);
    add(s, 'cesme', 3, 0);
    add(s, 'firin', 0, -3);
    s.stok.yemek = 100;
    endDay(s);
    endDay(s);
    expect(h.seviye).toBe(1); // kartsız 2 günde büyürdü
    endDay(s);
    expect(h.seviye).toBe(2);
  });

  it('Ağır vergi: gün sonu vergisi %15 artar', () => {
    const vergi = (s: GameState) => endDay(s).vergi;
    const a = blank();
    const b = kartli('agirVergi');
    for (const s of [a, b]) for (let i = 0; i < 5; i++) add(s, 'ev', i * 3, 0, 2);
    expect(vergi(b)).toBe(5 * houseTax(6, 45, 2, 1.15));
    expect(vergi(a)).toBe(5 * houseTax(6, 45, 2));
  });

  it('Taş ustaları: yükseltme taşı −%40, taş ocağı gürültüsü −8', () => {
    const s = kartli('tasUstalari');
    const o = add(s, 'okul', 30, 30);
    expect(upgradeStone(o, s)).toBe(6); // 10 × 0.6
    expect(upgradeStone(o)).toBe(10); // kartsız
    expect(ayar(s, 'mutluluk.tasOcagi')).toBe(-8);
  });

  it('Yeşil kasaba: ağaç tavanı +6, oduncu −%25', () => {
    const s = kartli('yesilKasaba');
    s.nufus = 100;
    expect(ayar(s, 'agacMutlulukSinir')).toBe(BALANCE.agacMutlulukSinir + 6);
    const h = add(s, 'ev', 20, 20);
    for (let i = 0; i < 6; i++) add(s, 'agac', 22, 18 + i);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(BALANCE.mutlulukTaban + 15);
    add(s, 'oduncu', 0, 0);
    for (let i = 0; i < 4; i++) add(s, 'agac', 2, i - 2);
    expect(uret(s).odun).toBeCloseTo(3);
  });

  it('Tüccar dostu: kota 70, pazar gideri 2 katı', () => {
    const s = kartli('tuccarDostu');
    expect(kalanKota(s)).toBe(70);
    const p = add(s, 'pazar', 0, 0);
    expect(buildingUpkeep(p, s)).toBe(BUILDINGS.pazar.gider * 2);
  });

  it('Sessiz değirmen: gürültü 0, değirmen −1 un', () => {
    const s = kartli('sessizDegirmen');
    s.nufus = 100;
    s.stok.bugday = 6;
    const h = add(s, 'ev', 0, 0);
    add(s, 'degirmen', 3, 0);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(BALANCE.mutlulukTaban);
    const u = uret(s);
    expect(u.un).toBeCloseTo(5);
  });

  it('Büyük ambar: ambar +200, gider 3', () => {
    const s = kartli('buyukAmbar');
    const a = add(s, 'ambar', 0, 0);
    expect(stockLimit(s)).toBe(BALANCE.stokSinir + 200);
    expect(buildingUpkeep(a, s)).toBe(3);
  });
});

describe('karar kartları: çekiliş ve seçim', () => {
  it('seçim 30, 60, …, 240. günlerin sonunda kuyruğa girer; toplam 8 seçim', () => {
    const s = blank();
    s.haritaTohum = 3;
    const kuyruk: number[] = [];
    for (let g = 1; g <= 300; g++) {
      s.gun = g;
      kartGunSonu(s);
      const b = bekleyenSecim(s);
      if (b !== null) {
        kuyruk.push(g);
        kartSec(s, kartCek(s, b)[0].id);
      }
    }
    expect(kuyruk).toEqual([30, 60, 90, 120, 150, 180, 210, 240]);
    expect(s.kararlar).toHaveLength(8);
    expect([secimGunu(0), secimGunu(1), secimGunu(7), toplamSecim()]).toEqual([30, 60, 240, 8]);
  });

  it('gün sonu seçim gününde kart seçimini açar; hedefler artık kart açmaz', () => {
    const s = blank();
    s.gun = 30;
    endDay(s);
    expect(bekleyenSecim(s)).toBe(0);
    const t = blank();
    t.nufus = 12;
    expect(checkGoals(t)).toEqual([0]);
    expect(bekleyenSecim(t)).toBeNull();
  });

  it('önceden seçilmiş kartlar toplam 8 sınırına sayılır', () => {
    const s = blank();
    s.kararlar = ['agirVergi', 'buyukAmbar', 'bahcivanlar', 'tasEvler', 'acikPazar', 'ariDostu', 'misafirperver'];
    s.gun = 30;
    kartGunSonu(s);
    expect(bekleyenSecim(s)).toBe(0);
    kartSec(s, kartCek(s, 0)[0].id);
    s.gun = 60;
    kartGunSonu(s);
    expect(bekleyenSecim(s)).toBeNull();
  });

  it('aynı tohum ve seçim numarasında aynı üç kart; seçilen tekrar gelmez', () => {
    const a = blank();
    const b = blank();
    a.haritaTohum = b.haritaTohum = 777;
    const ids = (s: GameState, h: number) => kartCek(s, h).map((k) => k.id);
    expect(ids(a, 0)).toEqual(ids(b, 0));
    expect(ids(a, 0)).toHaveLength(3);
    expect(new Set(ids(a, 0)).size).toBe(3);
    a.bekleyenKararlar = [0];
    const secilen = ids(a, 0)[0];
    expect(kartSec(a, secilen)).toBe(true);
    for (const h of [1, 2]) expect(ids(a, h)).not.toContain(secilen);
  });

  it('yalnızca gösterilen kart seçilebilir; seçimler sırayla tüketilir', () => {
    const s = blank();
    s.haritaTohum = 5;
    s.bekleyenKararlar = [0, 1];
    const gosterilmeyen = KARTLAR.find((k) => !kartCek(s, 0).some((x) => x.id === k.id))!;
    expect(kartSec(s, gosterilmeyen.id)).toBe(false);
    expect(kartSec(s, kartCek(s, 0)[1].id)).toBe(true);
    expect(bekleyenSecim(s)).toBe(1);
    expect(kartSec(s, kartCek(s, 1)[0].id)).toBe(true);
    expect(bekleyenSecim(s)).toBeNull();
    expect(s.kararlar).toHaveLength(2);
    expect(kartSec(s, KARTLAR[0].id)).toBe(false); // bekleyen yok
  });

  it('sekiz seçimin hepsinde üç farklı kart çıkar (havuz 16)', () => {
    const s = blank();
    for (const h of [0, 1, 2, 3, 4, 5, 6, 7]) {
      s.bekleyenKararlar = [h];
      const c = kartCek(s, h);
      expect(c).toHaveLength(3);
      kartSec(s, c[0].id);
    }
    expect(new Set(s.kararlar).size).toBe(8);
  });

  it('kayıt: seçilen kartlar ve bekleyen seçim korunur; eski kayıtta kart yok', () => {
    const s = blank();
    s.kararlar = ['agirVergi'];
    s.bekleyenKararlar = [2];
    const y = deserialize(serialize(s));
    expect(y.kararlar).toEqual(['agirVergi']);
    expect(bekleyenSecim(y)).toBe(2);
    expect(ayar(y, 'vergiCarpani')).toBeCloseTo(1.15);
    const eski = deserialize(serialize(blank()));
    expect(eski.kararlar).toBeUndefined();
    expect(ayar(eski, 'vergiCarpani')).toBe(1);
  });
});
