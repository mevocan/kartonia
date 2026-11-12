import { describe, expect, it } from 'vitest';
import { demolishRoad, placeBuilding } from '../src/logic/game';
import { addRoad, blank } from './helpers';

describe('yol bağlantısı', () => {
  it('bina konunca en yakın yol noktasını kaydeder', () => {
    const s = blank();
    s.para = 1000;
    const r = addRoad(s, 'toprak', [{ x: 0, z: 0 }, { x: 0, z: 10 }]);
    const b = placeBuilding(s, 'ev', 2.5, 5, 0)!;
    expect(b).not.toBeNull();
    expect(b.baglanti).toEqual({ x: 0, z: 5, yol: r.id });
  });

  it('ağaçta bağlantı yok', () => {
    const s = blank();
    s.para = 1000;
    addRoad(s, 'toprak', [{ x: 0, z: 0 }, { x: 0, z: 10 }]);
    const t = placeBuilding(s, 'agac', 4, 5, 0)!;
    expect(t.baglanti).toBeUndefined();
  });

  it('bağlı yol yıkılınca bağlantı kalan en yakın yola taşınır', () => {
    const s = blank();
    s.para = 1000;
    const a = addRoad(s, 'toprak', [{ x: 0, z: 0 }, { x: 0, z: 10 }]);
    const b = placeBuilding(s, 'ev', 2.5, 5, 0)!;
    const c = addRoad(s, 'toprak', [{ x: 5, z: 0 }, { x: 5, z: 10 }]);
    expect(b.baglanti!.yol).toBe(a.id);
    expect(demolishRoad(s, a.id)).not.toBeNull();
    expect(b.baglanti).toEqual({ x: 5, z: 5, yol: c.id });
  });
});
