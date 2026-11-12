import { describe, expect, it } from 'vitest';
import {
  canPlace, createGame, demolish, getBuildingInfo, isUnlocked, placeBuilding,
} from '../src/logic/game';

// Harita notları: başlangıç yolu x≈0.7 boyunca güneyden (z=45) merkeze (z=2) iner.
// (2.5,10) ve (-1.5,12) yol kenarında düz zemin; (-22,14) göl; (-9.6,-20) tepe yamacı; (5,5) yoldan uzak.

describe('yerleştirme', () => {
  it('yol kenarına ev konabilir, para düşer, id artar', () => {
    const s = createGame();
    const id0 = s.sonrakiId;
    expect(canPlace(s, 'ev', 2.5, 10)).toEqual({ ok: true });
    const a = placeBuilding(s, 'ev', 2.5, 10, 0.5)!;
    const b = placeBuilding(s, 'ev', -1.5, 12, 0)!;
    expect(a.id).toBe(id0);
    expect(b.id).toBe(id0 + 1);
    expect(a.rot).toBe(0.5);
    expect(s.para).toBe(150 - 40);
  });

  it('ada dışı', () => {
    const s = createGame();
    expect(canPlace(s, 'ev', 60, 0).sebep).toBe('disarida');
    expect(canPlace(s, 'tarla', 47, 20).sebep).toBe('disarida'); // merkez karada, taban taşıyor
    expect(placeBuilding(s, 'ev', 60, 0, 0)).toBeNull();
    expect(s.para).toBe(150);
  });

  it('göl', () => {
    expect(canPlace(createGame(), 'ev', -22, 14).sebep).toBe('gol');
  });

  it('eğim', () => {
    expect(canPlace(createGame(), 'ev', -9.6, -20).sebep).toBe('egim');
  });

  it('çakışma (0.1 boşluk dahil)', () => {
    const s = createGame();
    placeBuilding(s, 'ev', 2.5, 10, 0);
    expect(canPlace(s, 'ev', 2.5, 12.25).sebep).toBe('cakisiyor'); // 1.1 + 1.1 + 0.1 = 2.3
    expect(canPlace(s, 'ev', 2.5, 12.35).ok).toBe(true);
  });

  it('yolun üstü', () => {
    expect(canPlace(createGame(), 'ev', 0.5, 10).sebep).toBe('yol');
    expect(canPlace(createGame(), 'agac', 0, 15).sebep).toBe('yol');
  });

  it('yol kenarında değil (ağaç hariç)', () => {
    const s = createGame();
    expect(canPlace(s, 'ev', 5, 5).sebep).toBe('yolYok');
    expect(canPlace(s, 'ev', 3.5, 10).sebep).toBe('yolYok');
    expect(canPlace(s, 'agac', 5, 5).ok).toBe(true);
  });

  it('para yetmezse', () => {
    const s = createGame();
    s.para = 19;
    expect(canPlace(s, 'ev', 2.5, 10).sebep).toBe('para');
  });

  it('kilitli bina', () => {
    const s = createGame();
    expect(isUnlocked(s, 'degirmen')).toBe(false);
    expect(canPlace(s, 'degirmen', 3, 10).sebep).toBe('kilitli');
    s.nufus = 12;
    expect(isUnlocked(s, 'degirmen')).toBe(true);
    expect(canPlace(s, 'degirmen', 3, 10).ok).toBe(true);
  });

  it('kontrol sırası: bitti → kilitli → para → disarida → ...', () => {
    const s = createGame();
    s.para = 0;
    s.bitti = true;
    expect(canPlace(s, 'saatKulesi', 99, 0).sebep).toBe('bitti');
    s.bitti = false;
    expect(canPlace(s, 'saatKulesi', 99, 0).sebep).toBe('kilitli');
    expect(canPlace(s, 'ev', 99, 0).sebep).toBe('para');
    s.para = 100;
    expect(canPlace(s, 'ev', 99, 0).sebep).toBe('disarida');
  });
});

describe('yıkım', () => {
  it('maliyetin yarısını (aşağı yuvarlanmış) iade eder ve binayı siler', () => {
    const s = createGame();
    const n = s.binalar.length;
    const t = placeBuilding(s, 'tarla', 3.8, 10, 0)!; // 25
    expect(demolish(s, t.id)).toBe(12);
    expect(s.para).toBe(150 - 25 + 12);
    expect(s.binalar).toHaveLength(n);
  });

  it('olmayan bina null', () => {
    expect(demolish(createGame(), 99999)).toBeNull();
  });

  it('doğal ağaç kesimi para ister, odun verir', () => {
    const s = createGame();
    const a = s.binalar.find((b) => b.dogal)!;
    const info = getBuildingInfo(s, a.id)!;
    expect(info.dogal).toBe(true);
    expect(info.kesimMaliyeti).toBe(2);
    expect(info.kesimOdun).toBe(2);
    expect(info.yikimIadesi).toBe(0);
    expect(demolish(s, a.id)).toBe(-2);
    expect(s.para).toBe(148);
    expect(s.stok.odun).toBe(2);
    expect(s.binalar.some((b) => b.id === a.id)).toBe(false);
  });

  it('doğal ağaç: para yetmezse kesilmez, odun stok sınırını aşmaz', () => {
    const s = createGame();
    const [a, b] = s.binalar.filter((x) => x.dogal);
    s.para = 1;
    expect(demolish(s, a.id)).toBeNull();
    expect(s.binalar.some((x) => x.id === a.id)).toBe(true);
    s.para = 10;
    s.stok.odun = 199;
    expect(demolish(s, b.id)).toBe(-2);
    expect(s.stok.odun).toBe(200);
  });
});
