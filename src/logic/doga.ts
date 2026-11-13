// Haritayla gelen doğa: ormanlardaki ağaçlar ve çayırlardaki kır çiçekleri.
import { BUILDINGS } from '../data/buildings';
import { HARITA, makeRng } from '../data/map';
import type { BuildingType, GameState } from './types';
import { checkSite } from './placement';

/** En büyük taban yarıçapı: bir alanın dışındaki binanın içerideki yeni parçaya değip değmeyeceği bununla sınırlanır. */
const EN_BUYUK_TABAN = Math.max(...Object.values(BUILDINGS).map((d) => d.taban));

/**
 * (x, z) merkezli `r` yarıçaplı alanı doğal parçalarla doldurur. Çakışma denetimi yalnızca alana değebilecek
 * binalarla yapılır (uzaktakiler çakışamaz), böylece yüzlerce ağaçlık haritada da hızlıdır; sonuç bütün
 * binalarla denetlemekle birebir aynıdır. Konan binalar `s.binalar`a eklenir.
 */
function alaniDoldur(
  s: GameState, rng: () => number, tur: BuildingType, x0: number, z0: number, r0: number, hedef: number,
): void {
  const pay = r0 + BUILDINGS[tur].taban + EN_BUYUK_TABAN + 1;
  const yakin = s.binalar.filter((b) => Math.hypot(b.x - x0, b.z - z0) <= pay);
  const alt: GameState = { ...s, binalar: yakin };
  // Karar: hedef kadar parça; uygun yer bulunamazsa en fazla hedef × 4 deneme.
  let konan = 0;
  for (let deneme = 0; deneme < hedef * 4 && konan < hedef; deneme++) {
    const aci = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * r0; // disk içinde düzgün dağılım
    const rot = rng() * Math.PI * 2;
    const x = x0 + Math.cos(aci) * r;
    const z = z0 + Math.sin(aci) * r;
    if (checkSite(alt, tur, x, z) !== null) continue;
    const b = { id: s.sonrakiId++, type: tur, dogal: true, x, z, rot, seviye: 1, iyiGun: 0, kotuGun: 0 };
    s.binalar.push(b);
    yakin.push(b);
    konan++;
  }
}

/** Ormanları etkin haritanın ağaç tohumuyla doğal ağaçlarla doldurur. */
export function fillForests(s: GameState): void {
  const rng = makeRng(HARITA.agacTohum);
  for (const o of HARITA.ormanlar) alaniDoldur(s, rng, 'agac', o.x, o.z, o.r, o.agac);
}

/**
 * Etkin haritanın çayırlarını doğal çiçeklerle doldurur ve `s.cayirlar`ı işaretler.
 * Yeni oyunda ormanlardan sonra, çiçek öncesi kayıtta yüklenirken çağrılır: dolu yerler (bina, yol,
 * ağaç) atlanır, böylece mevcut kasabaya dokunmaz.
 */
export function fillMeadows(s: GameState): void {
  const rng = makeRng((HARITA.agacTohum ^ 0x2c1b3c6d) >>> 0);
  for (const c of HARITA.cayirlar) alaniDoldur(s, rng, 'cicek', c.x, c.z, c.r, c.cicek);
  s.cayirlar = true;
}
