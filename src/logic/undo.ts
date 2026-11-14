// Geri al: aynı gün içinde son oyuncu eylemlerini geri alır. Her geri alınabilir eylemden önce durumun bir kopyası
// alınır; geri alınca o kopyaya dönülür (gün ilerlemesi korunur). Gün sonunda yığın boşalır (ekonomi işlenmiştir).
// Tüccar takası, kart seçimi, istek teslimi ve anıt aşaması geri alınamaz ve yığını boşaltır (main çağırır).
import type { BuildingType, GameState } from './types';

/** Geri alınabilen eylemler. */
export type GeriAlTur = 'bina' | 'yol' | 'yikim' | 'yolYikim' | 'yukseltme';

export interface GeriAlKaydi {
  tur: GeriAlTur;
  /** Bina eylemlerinde binanın türü (bildirim metni için). */
  binaTur?: BuildingType;
  /** Eylemden önceki durum. */
  durum: GameState;
}

export interface GeriAlYigini {
  kayitlar: GeriAlKaydi[];
}

/** En fazla bu kadar eylem geri alınır. */
export const GERI_AL_SINIR = 20;

export function geriAlYigini(): GeriAlYigini {
  return { kayitlar: [] };
}

/** Eylemden önceki durumun kopyası. Eylem başarılı olursa geriAlEkle ile yığına konur. */
export function anlikGoruntu(s: GameState): GameState {
  return structuredClone(s);
}

export function geriAlEkle(y: GeriAlYigini, onceki: GameState, tur: GeriAlTur, binaTur?: BuildingType): void {
  y.kayitlar.push(binaTur ? { tur, binaTur, durum: onceki } : { tur, durum: onceki });
  if (y.kayitlar.length > GERI_AL_SINIR) y.kayitlar.shift();
}

export function geriAlinabilir(y: GeriAlYigini): boolean {
  return y.kayitlar.length > 0;
}

/**
 * Son eylemi geri alır: eylemden önceki durumu döndürür (gün ilerlemesi şimdiki değerde kalır). Yığın boşsa null.
 * Dönen durum yeni bir nesnedir; çağıran eskisinin yerine koyar.
 */
export function geriAl(y: GeriAlYigini, s: GameState): { durum: GameState; kayit: GeriAlKaydi } | null {
  const k = y.kayitlar.pop();
  if (!k) return null;
  const durum = k.durum;
  durum.gunIlerleme = s.gunIlerleme;
  return { durum, kayit: k };
}

export function geriAlTemizle(y: GeriAlYigini): void {
  y.kayitlar.length = 0;
}
