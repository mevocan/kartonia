import { describe, expect, it } from 'vitest';
import {
  BOSLUK, GOALS, GUN_SURESI, STOK_SINIR, ZEMIN_YARICAP, createGame, deserialize, endDay, placeBuilding, placeRoad,
  serialize, tick, goalProgress, KASABA_TAMAM_HEDEFI,
} from '../src/logic/game';
import { add } from './helpers';
import { checkGoals } from '../src/logic/goals';

describe('başlangıç', () => {
  it('createGame ve sabitler', () => {
    const s = createGame();
    expect(s.para).toBe(150);
    expect(s.gun).toBe(1);
    expect(s.mutluluk).toBe(45); // ev yokken taban mutluluk
    expect(s.stok).toEqual({ bugday: 0, un: 0, yemek: 0, odun: 0, tas: 0, mobilya: 0 });
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
  it('13 hedef, 5. hedef "Kasaba tamamlandı"', () => {
    expect(GOALS).toHaveLength(13);
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

    s.para = 1000;
    expect(checkGoals(s)).toEqual([10]);
    s.nufus = 300;
    expect(checkGoals(s)).toEqual([11]);
    s.nufus = 400;
    s.mutluluk = 74;
    expect(checkGoals(s)).toEqual([]);
    s.mutluluk = 75;
    expect(checkGoals(s)).toEqual([12]);
    expect(s.hedef).toBe(GOALS.length);
    expect(goalProgress(s)).toBeNull();
  });

  it('ilerleme hedefi aşmaz, eksiye düşmez', () => {
    const s = createGame();
    s.hedef = 10; // Zengin kasaba
    s.para = -40;
    expect(goalProgress(s)).toEqual({ mevcut: 0, hedef: 1000 });
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
