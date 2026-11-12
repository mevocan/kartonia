// Mevsimler: gün sayısından saf fonksiyonla türetilir. Durumda mevsim alanı yoktur, kayıt biçimi değişmez.
// Yıl BALANCE.mevsim.gunler kadar gündür (İlkbahar, Yaz, Sonbahar, Kış). Oyun 1. gün ilkbaharda başlar.
import { BALANCE } from '../data/buildings';

export type Mevsim = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';

export const MEVSIMLER: Mevsim[] = ['ilkbahar', 'yaz', 'sonbahar', 'kis'];

export function yilUzunlugu(): number {
  return BALANCE.mevsim.gunler.reduce((a, b) => a + b, 0);
}

/** Yıl içindeki gün (0'dan başlar). */
function yilGunu(gun: number): number {
  const y = yilUzunlugu();
  return (((Math.floor(gun) - 1) % y) + y) % y;
}

/** `gun` gününün mevsimi. */
export function mevsim(gun: number): Mevsim {
  let kalan = yilGunu(gun);
  for (let i = 0; i < MEVSIMLER.length; i++) {
    if (kalan < BALANCE.mevsim.gunler[i]) return MEVSIMLER[i];
    kalan -= BALANCE.mevsim.gunler[i];
  }
  return MEVSIMLER[MEVSIMLER.length - 1];
}

/** Mevsimin kaçıncı günü (1'den başlar). */
export function mevsimGunu(gun: number): number {
  let kalan = yilGunu(gun);
  for (const n of BALANCE.mevsim.gunler) {
    if (kalan < n) return kalan + 1;
    kalan -= n;
  }
  return kalan + 1;
}

/** Kışın ilk gününe kaç gün var. Kıştaysa 0. */
export function kisaKalanGun(gun: number): number {
  if (mevsim(gun) === 'kis') return 0;
  const [a, b, c] = BALANCE.mevsim.gunler;
  return a + b + c - yilGunu(gun);
}
