// Haritayla gelen doğa: çayırlardaki kır çiçekleri.
import { HARITA, makeRng } from '../data/map';
import type { GameState } from './types';
import { checkSite } from './placement';

/**
 * Etkin haritanın çayırlarını doğal çiçeklerle doldurur ve `s.cayirlar`ı işaretler.
 * Yeni oyunda ormanlardan sonra, çiçek öncesi kayıtta yüklenirken çağrılır: dolu yerler (bina, yol,
 * ağaç) atlanır, böylece mevcut kasabaya dokunmaz.
 */
export function fillMeadows(s: GameState): void {
  const rng = makeRng((HARITA.agacTohum ^ 0x2c1b3c6d) >>> 0);
  for (const c of HARITA.cayirlar) {
    let konan = 0;
    for (let deneme = 0; deneme < c.cicek * 4 && konan < c.cicek; deneme++) {
      const aci = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * c.r;
      const rot = rng() * Math.PI * 2;
      const x = c.x + Math.cos(aci) * r;
      const z = c.z + Math.sin(aci) * r;
      if (checkSite(s, 'cicek', x, z) !== null) continue;
      s.binalar.push({ id: s.sonrakiId++, type: 'cicek', dogal: true, x, z, rot, seviye: 1, iyiGun: 0, kotuGun: 0 });
      konan++;
    }
  }
  s.cayirlar = true;
}
