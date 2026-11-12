import { describe, expect, it } from 'vitest';
import { HARITA, HARITA_URETIM, KLASIK_HARITA, haritaUret, polylineDist } from '../src/data/map';
import { canPlace, createGame, deserialize, serialize } from '../src/logic/game';
import { isLake, isLand } from '../src/logic/terrain';

const TOHUMLAR = Array.from({ length: 150 }, (_, i) => (i * 2654435761) >>> 0);

describe('rastgele harita', () => {
  it('aynı tohum aynı haritayı, farklı tohum farklı haritayı verir', () => {
    expect(haritaUret(42)).toEqual(haritaUret(42));
    expect(haritaUret(42)).not.toEqual(haritaUret(43));
  });

  it('tohumsuz yeni oyun klasik haritayı kullanır', () => {
    createGame(7);
    const s = createGame();
    expect(s.haritaTohum).toBeUndefined();
    expect(HARITA.tohum).toBeNull();
    expect(HARITA.goller).toEqual(KLASIK_HARITA.goller);
  });

  it('başlangıç yolu karada ve göl dışında, merkez boş, ormanlar yola değmez', () => {
    for (const t of TOHUMLAR) {
      const h = haritaUret(t);
      createGame(t); // etkin harita bu olsun
      for (const p of h.baslangicYolu) {
        expect(isLand(p.x, p.z), `tohum ${t}`).toBe(true);
        expect(isLake(p.x, p.z), `tohum ${t}`).toBe(false);
      }
      for (const g of h.goller) {
        expect(Math.hypot(g.x, g.z), `tohum ${t}`).toBeGreaterThan(HARITA_URETIM.merkezBosluk + g.r);
        expect(polylineDist(g.x, g.z, h.baslangicYolu)).toBeGreaterThan(g.r + 3);
      }
      for (const o of h.ormanlar) expect(polylineDist(o.x, o.z, h.baslangicYolu)).toBeGreaterThan(o.r + 2);
      expect(h.goller.length, `tohum ${t}`).toBeGreaterThanOrEqual(2);
      expect(h.ormanlar.length, `tohum ${t}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('her haritada ilk ev başlangıç yolunun kenarına konabilir', () => {
    for (const t of TOHUMLAR) {
      const s = createGame(t);
      const yol = s.yollar[0].noktalar;
      let konur = false;
      for (let i = 0; i < yol.length && !konur; i++) {
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
          if (canPlace(s, 'ev', yol[i].x + dx, yol[i].z + dz).ok) {
            konur = true;
            break;
          }
        }
      }
      expect(konur, `tohum ${t}`).toBe(true);
    }
  });

  it('yeni oyun tohumu kaydeder, ormanları doldurur ve hızlıdır', () => {
    createGame(99);
    const t0 = performance.now();
    const s = createGame(12345);
    expect(performance.now() - t0).toBeLessThan(100);
    expect(s.haritaTohum).toBe(12345);
    expect(s.binalar.filter((b) => b.dogal).length).toBeGreaterThan(100);
  });

  it('kayıt yüklenince o oyunun haritası etkin olur', () => {
    const a = createGame(555);
    const json = serialize(a);
    createGame(); // klasik
    const b = deserialize(json);
    expect(b.haritaTohum).toBe(555);
    expect(HARITA.tohum).toBe(555);
    expect(HARITA.goller).toEqual(haritaUret(555).goller);
  });

  it('tohumsuz eski kayıt klasik haritayla açılır', () => {
    createGame(777);
    const eski = createGame();
    const json = serialize(eski);
    createGame(777);
    deserialize(json);
    expect(HARITA.tohum).toBeNull();
  });
});
