import { describe, expect, it } from 'vitest';
import {
  createGame, demolishRoad, getBuildingInfo, getRoadInfo, isRoadUnlocked, nearestRoad, placeBuilding, placeRoad,
  planRoad,
} from '../src/logic/game';
import { dist, polylineLength } from '../src/logic/geometry';
import { isLake, isLand } from '../src/logic/terrain';
import { BUILDINGS } from '../src/data/buildings';
import { HARITA } from '../src/data/map';

// Başlangıç yolu x≈0.7 boyunca; (0.5,10) ona ~0.23 uzaklıkta, (5,5) ~4.5 uzaklıkta.
const DOGU = [{ x: 0.5, z: 10 }, { x: 3, z: 10 }, { x: 6, z: 10 }];

describe('createGame', () => {
  it('başlangıç yolu ve ormanlar', () => {
    const s = createGame();
    expect(s.yollar).toHaveLength(1);
    expect(s.yollar[0].tur).toBe('toprak');
    const dogal = s.binalar.filter((b) => b.dogal);
    expect(dogal.filter((b) => b.type === 'agac').length).toBeGreaterThan(200);
    expect(dogal.filter((b) => b.type === 'cicek').length).toBeGreaterThan(30);
    expect(dogal.every((b) => b.type === 'agac' || b.type === 'cicek')).toBe(true);
    expect(s.cayirlar).toBe(true);
    const ids = [...s.binalar.map((b) => b.id), ...s.yollar.map((r) => r.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.sonrakiId).toBe(Math.max(...ids) + 1);
  });

  it('bütün orman ağaçları yerleşir ve createGame hızlıdır', () => {
    createGame(); // klasik harita etkin olsun
    const hedef = HARITA.ormanlar.reduce((a, o) => a + o.agac, 0);
    createGame(); // ısınma
    // Üç denemenin en hızlısı: testler paralel koşarken tek ölçüm işlemci yükünden sapabiliyor.
    let enIyi = Infinity;
    let s = createGame();
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      s = createGame();
      enIyi = Math.min(enIyi, performance.now() - t0);
    }
    expect(enIyi).toBeLessThan(80);
    expect(s.binalar.filter((b) => b.dogal && b.type === 'agac')).toHaveLength(hedef);
  });

  it('deterministik', () => {
    expect(createGame()).toEqual(createGame());
  });

  it('ağaçlar ve çiçekler karada, gölde değil, yolla ve birbiriyle çakışmaz', () => {
    const s = createGame();
    for (const a of s.binalar) {
      const ra = BUILDINGS[a.type].taban;
      expect(isLand(a.x, a.z)).toBe(true);
      expect(isLake(a.x, a.z)).toBe(false);
      expect(nearestRoad(s, a.x, a.z)!.mesafe).toBeGreaterThanOrEqual(ra + 0.5);
      for (const b of s.binalar) if (b !== a) expect(dist(a.x, a.z, b.x, b.z)).toBeGreaterThanOrEqual(ra + BUILDINGS[b.type].taban + 0.1);
    }
  });
});

describe('planRoad', () => {
  it('örnekler, başı mevcut yola kenetler, maliyeti hesaplar', () => {
    const s = createGame();
    const p = planRoad(s, 'toprak', DOGU);
    expect(p.ok).toBe(true);
    const n = nearestRoad(s, 0.5, 10)!;
    expect(p.noktalar[0].x).toBeCloseTo(n.x);
    expect(p.noktalar[0].z).toBeCloseTo(n.z);
    expect(p.noktalar[p.noktalar.length - 1]).toEqual({ x: 6, z: 10 });
    for (let i = 2; i < p.noktalar.length; i++) {
      const a = p.noktalar[i - 1];
      const b = p.noktalar[i];
      expect(dist(a.x, a.z, b.x, b.z)).toBeLessThanOrEqual(0.75 * 1.5 + 1e-9);
    }
    expect(p.uzunluk).toBeCloseTo(polylineLength(p.noktalar));
    expect(p.maliyet).toBe(Math.ceil(p.uzunluk));
  });

  it('asfalt: kilitli, açılınca birim maliyet 3', () => {
    const s = createGame();
    expect(isRoadUnlocked(s, 'asfalt')).toBe(false);
    expect(planRoad(s, 'asfalt', DOGU).sebep).toBe('kilitli');
    s.nufus = 35;
    const p = planRoad(s, 'asfalt', DOGU);
    expect(p.ok).toBe(true);
    expect(p.maliyet).toBe(Math.ceil(p.uzunluk * 3));
  });

  it('kısa', () => {
    const p = planRoad(createGame(), 'toprak', [{ x: 5, z: 5 }, { x: 5.5, z: 5 }]);
    expect(p.sebep).toBe('kisa');
    expect(p.noktalar.length).toBeGreaterThan(0);
    expect(p.uzunluk).toBeCloseTo(0.5);
  });

  it('bağlantısız', () => {
    const p = planRoad(createGame(), 'toprak', [{ x: 5, z: 5 }, { x: 8, z: 5 }]);
    expect(p.sebep).toBe('baglantisiz');
    expect(p.maliyet).toBe(3);
  });

  it('göl', () => {
    expect(planRoad(createGame(), 'toprak', [{ x: 0.5, z: 14 }, { x: -22, z: 14 }]).sebep).toBe('gol');
  });

  it('ada dışı', () => {
    expect(planRoad(createGame(), 'toprak', [{ x: 0.5, z: 20 }, { x: 60, z: 20 }]).sebep).toBe('disarida');
  });

  it('binanın üstünden geçemez', () => {
    const s = createGame();
    expect(placeBuilding(s, 'ev', 2.5, 10, 0)).not.toBeNull();
    expect(planRoad(s, 'toprak', DOGU).sebep).toBe('cakisiyor');
  });

  it('para', () => {
    const s = createGame();
    s.para = 2;
    expect(planRoad(s, 'toprak', DOGU).sebep).toBe('para');
  });

  it('bitti', () => {
    const s = createGame();
    s.bitti = true;
    expect(planRoad(s, 'toprak', DOGU).sebep).toBe('bitti');
  });
});

describe('placeRoad / demolishRoad', () => {
  it('yol konur, para düşer, ortak id sayacı', () => {
    const s = createGame();
    const id = s.sonrakiId;
    const r = placeRoad(s, 'toprak', DOGU)!;
    expect(r.id).toBe(id);
    expect(s.sonrakiId).toBe(id + 1);
    expect(s.para).toBe(150 - planRoad(createGame(), 'toprak', DOGU).maliyet);
    expect(placeRoad(s, 'toprak', [{ x: 5, z: 5 }, { x: 8, z: 5 }])).toBeNull();
  });

  it('bir bina yakınlığını yalnızca bu yoldan alıyorsa yıkılamaz', () => {
    const s = createGame();
    const r = placeRoad(s, 'toprak', DOGU)!;
    const h = placeBuilding(s, 'ev', 4.5, 11.9, 0)!;
    expect(h).not.toBeNull();
    expect(getRoadInfo(s, r.id)!.silinebilir).toBe(false);
    expect(demolishRoad(s, r.id)).toBeNull();
    // Başlangıç yolu: hiçbir bina ona bağlı değil.
    const bas = s.yollar[0];
    expect(getRoadInfo(s, bas.id)!.silinebilir).toBe(true);
  });

  it('ağaçlar yıkımı engellemez; iade floor(maliyet × 0.5)', () => {
    const s = createGame();
    const r = placeRoad(s, 'toprak', DOGU)!;
    s.binalar.push({ id: s.sonrakiId++, type: 'agac', x: 4.5, z: 11.2, rot: 0, seviye: 1, iyiGun: 0, kotuGun: 0 });
    const info = getRoadInfo(s, r.id)!;
    expect(info.silinebilir).toBe(true);
    expect(info.gider).toBe(0);
    const para = s.para;
    expect(demolishRoad(s, r.id)).toBe(Math.floor(Math.ceil(info.uzunluk) * 0.5));
    expect(s.para).toBe(para + info.yikimIadesi);
    expect(s.yollar.some((x) => x.id === r.id)).toBe(false);
  });

  it('bina başka bir yola da yakınsa yıkılabilir', () => {
    const s = createGame();
    const r = placeRoad(s, 'toprak', DOGU)!;
    expect(placeBuilding(s, 'ev', 2.4, 11.8, 0)).not.toBeNull(); // hem başlangıç yoluna hem yeni yola yakın
    expect(getRoadInfo(s, r.id)!.silinebilir).toBe(true);
    expect(getRoadInfo(s, s.yollar[0].id)!.silinebilir).toBe(true);
  });

  it('asfalt kenarındaki ev +5 mutluluk alır', () => {
    const s = createGame();
    s.nufus = 35;
    placeRoad(s, 'asfalt', DOGU);
    const h = placeBuilding(s, 'ev', 4.5, 12.2, 0)!;
    const info = getBuildingInfo(s, h.id)!;
    expect(info.yol).toBe('asfalt');
    expect(info.mutluluk).toBe(50); // taban 45 + asfalt 5
  });

  it('olmayan yol null', () => {
    expect(demolishRoad(createGame(), 99999)).toBeNull();
    expect(getRoadInfo(createGame(), 99999)).toBeNull();
  });
});
