import { describe, expect, it } from 'vitest';
import { BUILDINGS, HOUSE_LEVELS } from '../src/data/buildings';
import { HARITA } from '../src/data/map';
import { canPlace, createGame, demolish, deserialize, getBuildingInfo, serialize } from '../src/logic/game';
import { evaluateNeeds, houseHappiness } from '../src/logic/economy';
import { add, blank } from './helpers';

// Çayır çiçekleri, çiçek binası ve yeni hizmetler (Park, Hamam, Tiyatro).

describe('çayırlar', () => {
  it('her haritada çayır var ve içleri doğal çiçekle dolu', () => {
    for (const tohum of [undefined, 1, 2, 3]) {
      const s = createGame(tohum);
      expect(HARITA.cayirlar.length).toBeGreaterThanOrEqual(3);
      const cicekler = s.binalar.filter((b) => b.type === 'cicek' && b.dogal);
      for (const c of HARITA.cayirlar) {
        expect(cicekler.some((b) => Math.hypot(b.x - c.x, b.z - c.z) <= c.r)).toBe(true);
      }
    }
  });

  it('çiçek öncesi kayıt yüklenince çayırlar ekilir, mevcut binalara dokunulmaz', () => {
    const s = createGame();
    s.binalar = s.binalar.filter((b) => b.type !== 'cicek');
    delete s.cayirlar;
    const ev = add(s, 'ev', HARITA.cayirlar[0].x, HARITA.cayirlar[0].z);
    const y = deserialize(serialize(s));
    expect(y.cayirlar).toBe(true);
    const cicekler = y.binalar.filter((b) => b.type === 'cicek');
    expect(cicekler.length).toBeGreaterThan(30);
    expect(y.binalar.find((b) => b.id === ev.id)).toBeDefined();
    for (const c of cicekler) {
      expect(Math.hypot(c.x - ev.x, c.z - ev.z)).toBeGreaterThanOrEqual(BUILDINGS.ev.taban + BUILDINGS.cicek.taban);
    }
    // İkinci yüklemede yeniden ekilmez.
    expect(deserialize(serialize(y)).binalar.length).toBe(y.binalar.length);
  });

  it('doğal çiçek bedava sökülür ve odun vermez', () => {
    const s = createGame();
    const c = s.binalar.find((b) => b.type === 'cicek' && b.dogal)!;
    expect(getBuildingInfo(s, c.id)).toMatchObject({ dogal: true, kesimMaliyeti: 0, kesimOdun: 0 });
    const para = s.para;
    const odun = s.stok.odun;
    expect(demolish(s, c.id)).toBe(-0);
    expect(s.para).toBe(para);
    expect(s.stok.odun).toBe(odun);
  });
});

describe('çiçek binası', () => {
  it('yol istemez; evin mutluluğunu ağaçla ortak sınır içinde artırır', () => {
    const s = blank();
    s.para = 1000;
    expect(canPlace(s, 'cicek', 10, 10).ok).toBe(true);
    const h = add(s, 'ev', 0, 0);
    const taban = houseHappiness(s, h, evaluateNeeds(s, h));
    add(s, 'cicek', 1.5, 0);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(taban + BUILDINGS.cicek.mutluluk);
    for (let i = 0; i < 8; i++) add(s, i % 2 ? 'agac' : 'cicek', Math.cos(i) * 2.2, Math.sin(i) * 2.2);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(taban + 9); // agacMutlulukSinir
  });
});

describe('yeni hizmetler', () => {
  it('park evleri mutlu eder; hamam ve tiyatro ihtiyaç sağlar', () => {
    const s = blank();
    const h = add(s, 'ev', 0, 0, 5);
    const once = houseHappiness(s, h, evaluateNeeds(s, h));
    add(s, 'park', 3, 0);
    expect(houseHappiness(s, h, evaluateNeeds(s, h))).toBe(once + BUILDINGS.park.mutluluk);
    const durum = () => Object.fromEntries(evaluateNeeds(s, h).map((n) => [n.ihtiyac, n.karsilandi]));
    expect(durum().hamam).toBe(false);
    expect(durum().kultur).toBe(false);
    add(s, 'hamam', -4, 0);
    add(s, 'tiyatro', 0, 5);
    expect(durum().hamam).toBe(true);
    expect(durum().kultur).toBe(true);
  });

  it('hamam konakta, tiyatro köşkte istenir', () => {
    expect(HOUSE_LEVELS[2].ihtiyaclar).not.toContain('hamam');
    expect(HOUSE_LEVELS[3].ihtiyaclar).toContain('hamam');
    expect(HOUSE_LEVELS[3].ihtiyaclar).not.toContain('kultur');
    expect(HOUSE_LEVELS[4].ihtiyaclar).toContain('kultur');
  });
});
