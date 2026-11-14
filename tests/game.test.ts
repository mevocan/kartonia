import { describe, expect, it } from 'vitest';
import {
  BOSLUK, GOALS, GUN_SURESI, STOK_SINIR, ZEMIN_YARICAP, createGame, deserialize, endDay, placeBuilding, placeRoad,
  serialize, tick, goalProgress, goalReward, KASABA_TAMAM_HEDEFI, EFSANE_HEDEFI, ZENGIN_KASABA,
} from '../src/logic/game';
import { add } from './helpers';
import { checkGoals } from '../src/logic/goals';

describe('başlangıç', () => {
  it('createGame ve sabitler', () => {
    const s = createGame();
    expect(s.para).toBe(150);
    expect(s.gun).toBe(1);
    expect(s.mutluluk).toBe(45); // ev yokken taban mutluluk
    expect(s.stok).toEqual({ bugday: 0, un: 0, yemek: 0, odun: 0, tas: 0, mobilya: 0, yun: 0, kumas: 0, bal: 0 });
    expect([GUN_SURESI, ZEMIN_YARICAP, BOSLUK, STOK_SINIR]).toEqual([15, 48, 0.1, 200]);
  });
});

describe('tick', () => {
  it('gün dolunca rapor döner ve ilerleme sıfırlanır', () => {
    const s = createGame();
    expect(tick(s, 7.5)).toBeNull();
    expect(s.gunIlerleme).toBeCloseTo(0.5);
    const r = tick(s, 7.5);
    expect(r).not.toBeNull();
    expect(r!.gun).toBe(1);
    expect(s.gun).toBe(2);
    expect(s.gunIlerleme).toBe(0);
  });

  it('bir tick en fazla bir gün geçirir', () => {
    const s = createGame();
    expect(tick(s, 100)).not.toBeNull();
    expect(s.gun).toBe(2);
    expect(s.gunIlerleme).toBe(0);
  });

  it('oyun bittiyse null', () => {
    const s = createGame();
    s.bitti = true;
    expect(tick(s, 100)).toBeNull();
    expect(s.gun).toBe(1);
  });
});

describe('hedefler', () => {
  it('18 hedef, 5. hedef "Kasaba tamamlandı", 15. "Kasaba efsanesi", sonuncusu "Masal kasabası"', () => {
    expect(GOALS).toHaveLength(18);
    expect(GOALS[EFSANE_HEDEFI].ad).toBe('Kasaba efsanesi');
    expect(GOALS[GOALS.length - 1].ad).toBe('Masal kasabası');
    expect(GOALS[KASABA_TAMAM_HEDEFI].ad).toBe('Kasaba tamamlandı');
  });

  it('150 nüfus sonrası hedefler sırayla tamamlanır', () => {
    const s = createGame();
    s.hedef = 5;
    const cesme = add(s, 'cesme', 0, 0);
    expect(checkGoals(s)).toEqual([]);
    expect(goalProgress(s)).toEqual({ mevcut: 1, hedef: 3 });
    cesme.seviye = 3;
    expect(checkGoals(s)).toEqual([5]);

    s.nufus = 200;
    s.mutluluk = 69;
    expect(checkGoals(s)).toEqual([]);
    s.mutluluk = 70;
    expect(checkGoals(s)).toEqual([6]);

    for (let i = 0; i < 9; i++) add(s, 'ev', 10 + i * 3, 0, 3);
    expect(checkGoals(s)).toEqual([]);
    expect(goalProgress(s)).toEqual({ mevcut: 9, hedef: 10 });
    add(s, 'ev', 40, 0, 3);
    expect(checkGoals(s)).toEqual([7]);

    add(s, 'pazar', 0, 10, 3);
    expect(checkGoals(s)).toEqual([]);
    expect(goalProgress(s)).toBeNull();
    add(s, 'okul', 0, -10, 3);
    expect(checkGoals(s)).toEqual([8]);

    s.stok.yemek = 150;
    s.stok.odun = 99;
    expect(checkGoals(s)).toEqual([]);
    s.stok.odun = 100;
    expect(checkGoals(s)).toEqual([9]);

    s.para = ZENGIN_KASABA - 1;
    expect(checkGoals(s)).toEqual([]);
    s.para = ZENGIN_KASABA;
    expect(checkGoals(s)).toEqual([10]);
    s.nufus = 300;
    expect(checkGoals(s)).toEqual([11]);
    s.nufus = 400;
    s.mutluluk = 74;
    expect(checkGoals(s)).toEqual([]);
    s.mutluluk = 75;
    expect(checkGoals(s)).toEqual([]); // önce Konaklar ve Köşk
    expect(goalProgress(s)).toEqual({ mevcut: 0, hedef: 3 });
    const konaklar = [add(s, 'ev', 20, 20, 4), add(s, 'ev', 23, 20, 4)];
    expect(checkGoals(s)).toEqual([]);
    konaklar.push(add(s, 'ev', 26, 20, 4));
    expect(checkGoals(s)).toEqual([12]);
    konaklar[0].seviye = 5;
    expect(checkGoals(s)).toEqual([13, 14]);
    expect(s.hedef).toBe(EFSANE_HEDEFI + 1);
    // Büyük projeler: Kervansaray, Botanik Bahçesi, 500 nüfus ve mutluluk ≥ 80.
    expect(goalProgress(s)).toBeNull();
    const kerv = add(s, 'kervansaray', 40, 40);
    kerv.insaat = 1;
    expect(checkGoals(s)).toEqual([]);
    delete kerv.insaat;
    expect(checkGoals(s)).toEqual([15]);
    add(s, 'botanik', -40, 40);
    expect(checkGoals(s)).toEqual([16]);
    s.nufus = 500;
    s.mutluluk = 80;
    expect(checkGoals(s)).toEqual([17]);
    expect(s.hedef).toBe(GOALS.length);
    expect(goalProgress(s)).toBeNull();
  });

  it('ilerleme hedefi aşmaz, eksiye düşmez', () => {
    const s = createGame();
    s.hedef = 10; // Zengin kasaba
    s.para = -40;
    expect(goalProgress(s)).toEqual({ mevcut: 0, hedef: ZENGIN_KASABA });
  });

  it('tamamlanan hedef ödülünü kasaya ekler; gün raporu ödülü ayrıca taşır, net onu içermez', () => {
    const s = createGame();
    s.binalar = [];
    s.para = 0;
    s.nufus = 10;
    expect(checkGoals(s)).toEqual([0]);
    expect(s.para).toBe(GOALS[0].odul);
    expect(goalReward([0, 1])).toBe(GOALS[0].odul + GOALS[1].odul);

    // Aynı turda biten iki hedefin ödülü toplanır; gün raporunda hedefOdulu ayrı satırdır.
    const t = createGame();
    t.binalar = [];
    t.yollar = [];
    t.para = 100;
    for (let i = 0; i < 4; i++) add(t, 'ev', i * 3, 0); // 12 kişi
    t.toplamYemek = 1;
    const r = endDay(t);
    expect(r.yeniHedefler).toEqual([0, 1]);
    expect(r.hedefOdulu).toBe(GOALS[0].odul + GOALS[1].odul);
    expect(t.para).toBe(100 + r.net + r.hedefOdulu);
  });

  it('bütün hedeflerin ödülü var ve kasabanın ilerleyişiyle büyür', () => {
    expect(GOALS.every((g) => g.odul > 0)).toBe(true);
    expect(GOALS[0].odul).toBeLessThanOrEqual(GOALS[GOALS.length - 1].odul);
  });

  it('sırayla tamamlanır', () => {
    const s = createGame();
    s.toplamYemek = 5; // 2. hedef hazır ama 1. değil
    expect(endDay(s).yeniHedefler).toEqual([]);
    for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 0);
    expect(endDay(s).yeniHedefler).toEqual([0, 1]);
    expect(s.hedef).toBe(2);
  });

  it('3. seviye ev ve Saat Kulesi hedefleri', () => {
    const s = createGame();
    s.hedef = 3;
    add(s, 'ev', 0, 0, 3);
    expect(endDay(s).yeniHedefler).toEqual([3]);
    for (let i = 0; i < 15; i++) add(s, 'ev', -20 + (i % 5) * 3, -9 + Math.floor(i / 5) * 3, 3);
    expect(endDay(s).yeniHedefler).toEqual([]);
    for (const b of s.binalar) b.kotuGun = 0; // ihtiyaçsız 3. seviye evler düşmesin
    add(s, 'saatKulesi', 15, 0);
    expect(endDay(s).yeniHedefler).toEqual([4]);
    expect(s.hedef).toBe(5);
    expect(endDay(s).yeniHedefler).toEqual([]);
  });
});

describe('kayıt', () => {
  it('gidiş-dönüş', () => {
    const s = createGame();
    expect(placeRoad(s, 'toprak', [{ x: 0.5, z: 10 }, { x: 6, z: 10 }])).not.toBeNull();
    expect(placeBuilding(s, 'ev', -1.5, 12, 0.3)).not.toBeNull();
    expect(placeBuilding(s, 'tarla', 4.5, 7.2, 1)).not.toBeNull();
    endDay(s);
    const t = deserialize(serialize(s));
    expect(t).toEqual(s);
    expect(t).not.toBe(s);
  });

  it('bozuk ya da uyumsuz kayıtta hata', () => {
    expect(() => deserialize('{bozuk')).toThrow();
    expect(() => deserialize('null')).toThrow();
    expect(() => deserialize(JSON.stringify({ surum: 99, durum: createGame() }))).toThrow();
    expect(() => deserialize(JSON.stringify({ surum: 2, durum: { gun: 1 } }))).toThrow();
  });

  it('sürüm 1 kayıtları reddedilir', () => {
    const eski = { ...createGame() } as Partial<ReturnType<typeof createGame>>;
    delete eski.yollar;
    expect(() => deserialize(JSON.stringify({ surum: 1, durum: eski }))).toThrow(/sürüm/);
  });
});
