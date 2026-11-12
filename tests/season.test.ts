import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/buildings';
import { deserialize, endDay, getBuildingInfo, serialize } from '../src/logic/game';
import { emptyGoods, evaluateNeeds, runProduction } from '../src/logic/economy';
import { kisaKalanGun, mevsim, mevsimGunu, yilUzunlugu } from '../src/logic/season';
import { add, blank } from './helpers';

// Yıl 18 gün: İlkbahar 1–5, Yaz 6–10, Sonbahar 11–15, Kış 16–18, sonra 19. gün yine İlkbahar.

describe('mevsim takvimi', () => {
  it('yıl 18 gün, mevsimler 5 / 5 / 5 / 3', () => {
    expect(BALANCE.mevsim.gunler).toEqual([5, 5, 5, 3]);
    expect(yilUzunlugu()).toBe(18);
  });

  it('sınır günleri', () => {
    const beklenen: [number, string][] = [
      [1, 'ilkbahar'], [5, 'ilkbahar'], [6, 'yaz'], [10, 'yaz'], [11, 'sonbahar'], [15, 'sonbahar'],
      [16, 'kis'], [18, 'kis'], [19, 'ilkbahar'], [34, 'kis'], [37, 'ilkbahar'],
    ];
    for (const [g, m] of beklenen) expect(mevsim(g), `gün ${g}`).toBe(m);
  });

  it('mevsimin kaçıncı günü', () => {
    expect(mevsimGunu(1)).toBe(1);
    expect(mevsimGunu(11)).toBe(1);
    expect(mevsimGunu(15)).toBe(5);
    expect(mevsimGunu(18)).toBe(3);
    expect(mevsimGunu(19)).toBe(1);
  });

  it('kışa kalan gün; kışta 0', () => {
    expect(kisaKalanGun(1)).toBe(15);
    expect(kisaKalanGun(11)).toBe(5); // sonbaharın ilk günü: "kış 5 gün sonra"
    expect(kisaKalanGun(15)).toBe(1);
    expect(kisaKalanGun(16)).toBe(0);
    expect(kisaKalanGun(18)).toBe(0);
    expect(kisaKalanGun(19)).toBe(15);
  });
});

describe('kış kuralları', () => {
  function uret(gun: number) {
    const s = blank();
    s.gun = gun;
    s.nufus = 100;
    s.stok.bugday = 6;
    s.stok.un = 4;
    add(s, 'tarla', 0, 0);
    add(s, 'degirmen', 20, 0);
    add(s, 'firin', 40, 0);
    add(s, 'balikci', 0, 20);
    const u = emptyGoods();
    runProduction(s, u, emptyGoods());
    return u;
  }

  it('kışın tarla üretmez; değirmen stoktaki buğdayla, fırın ve balıkçı çalışır', () => {
    const k = uret(16);
    expect(k.bugday).toBe(0);
    expect(k.un).toBeCloseTo(6);
    expect(k.yemek).toBeGreaterThan(0);
    const y = uret(15); // sonbaharın son günü: tarla çalışır
    expect(y.bugday).toBeCloseTo(6);
  });

  it('kışın 3. seviye evin odun tüketimi 2 katı, başka tüketim değişmez', () => {
    const tuketim = (gun: number) => {
      const s = blank();
      s.gun = gun;
      const h = add(s, 'ev', 0, 0, 3);
      add(s, 'pazar', 4, 0);
      s.stok.odun = 100;
      s.stok.yemek = 100;
      s.stok.mobilya = 100;
      const t = emptyGoods();
      evaluateNeeds(s, h, t);
      return t;
    };
    const yaz = tuketim(6);
    const kis = tuketim(16);
    expect(yaz.odun).toBeCloseTo(10 * BALANCE.odunKisiBasi);
    expect(kis.odun).toBeCloseTo(2 * yaz.odun);
    expect(kis.yemek).toBeCloseTo(yaz.yemek);
    expect(kis.mobilya).toBeCloseTo(yaz.mobilya);
  });

  it('kışın odun yetmezse 3. seviye evin odun ihtiyacı karşılanmaz', () => {
    const s = blank();
    s.gun = 16;
    const h = add(s, 'ev', 0, 0, 3);
    s.stok.odun = 3; // yazın 2 yeterdi, kışın 4 gerekir
    expect(evaluateNeeds(s, h).find((n) => n.ihtiyac === 'odun')?.karsilandi).toBe(false);
    s.gun = 6;
    expect(evaluateNeeds(s, h).find((n) => n.ihtiyac === 'odun')?.karsilandi).toBe(true);
  });

  it('gün sonu kış gününü kış kurallarıyla işler', () => {
    const s = blank();
    s.gun = 16;
    s.nufus = 100;
    add(s, 'tarla', 0, 0);
    expect(endDay(s).uretilen.bugday).toBe(0);
    expect(s.gun).toBe(17);
  });

  it('bilgi paneli: kışın tarlada "durdu" işareti', () => {
    const s = blank();
    const t = add(s, 'tarla', 0, 0);
    s.gun = 16;
    expect(getBuildingInfo(s, t.id)!.kisinDurdu).toBe(true);
    s.gun = 10;
    expect(getBuildingInfo(s, t.id)!.kisinDurdu).toBeUndefined();
    expect(getBuildingInfo(s, add(s, 'degirmen', 20, 0).id)!.kisinDurdu).toBeUndefined();
  });

  it('kayıt biçimi değişmez: mevsim alanı yok, eski kayıt kışta açılır', () => {
    const s = blank();
    s.gun = 17;
    const json = serialize(s);
    expect(json).not.toContain('mevsim');
    const y = deserialize(json);
    expect(mevsim(y.gun)).toBe('kis');
  });
});
