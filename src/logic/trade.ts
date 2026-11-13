// Gezgin tüccar: her BALANCE.ticaret.aralik günde bir, başlangıç yolunun kenar ucuna gelir. Gelince takas
// menüsü açılır ve oyun durur; oyuncu menüyü kapatınca tüccar yola çıkar (`tuccarUgurla`). Geliş günleri gün
// sayısından türetilir; ziyaretin bittiği gün (`tuccarGitti`) ve ziyaretteki kota sayacı saklanır.
import { BALANCE } from '../data/buildings';
import { HARITA } from '../data/map';
import type { GameState, Good } from './types';
import { stockLimit } from './placement';
import { ayar } from './cards';

/** Tüccarın geliş günü mü: aralik. günden başlayarak her aralik günde bir (8, 16, 24, ...). */
export function tuccarGunu(gun: number): boolean {
  const { aralik } = BALANCE.ticaret;
  const g = Math.floor(gun);
  return g >= aralik && g % aralik === 0;
}

/** Tüccar şu an kasabada mı: geliş günü ve bu ziyaret henüz bitmedi (oyuncu menüyü kapatmadı). */
export function tuccarVarMi(s: GameState): boolean {
  return tuccarGunu(s.gun) && s.tuccarGitti !== Math.floor(s.gun);
}

/** Ziyareti bitirir: tüccar yola çıkar, kota sayacı silinir. Tüccar yoksa bir şey yapmaz. */
export function tuccarUgurla(s: GameState): void {
  if (!tuccarVarMi(s)) return;
  s.tuccarGitti = Math.floor(s.gun);
  delete s.tuccarKota;
}

/** Sıradaki gelişe kaç gün var (bugün geliş günüyse 0). */
export function tuccaraKalanGun(gun: number): number {
  if (tuccarGunu(gun)) return 0;
  const a = BALANCE.ticaret.aralik;
  return a - (Math.floor(gun) % a);
}

/** Bu ziyarette kalan alım + satım birimi. */
export function kalanKota(s: GameState): number {
  return Math.max(0, ayar(s, 'ticaretKota') - (s.tuccarKota ?? 0));
}

/**
 * Arabanın durduğu yer: başlangıç yolunun kenar ucunda, sınırdan birkaç birim içeride (yolun ikinci
 * noktası; ilk nokta tam harita sınırında, oraya gelen araba sınır ormanının içinden geçer). Önü kasabaya bakar.
 */
export function tuccarKonumu(): { x: number; z: number; yon: number } | null {
  const y = HARITA.baslangicYolu;
  if (y.length < 3) return null;
  const [, a, b] = y;
  return { x: a.x, z: a.z, yon: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Nedenler: bitti, kilitli (tüccar yok), kota, para (alım), stok (satışta stok yetmiyor), depo (alımda depo dolu). */
export type TicaretSebep = 'bitti' | 'kilitli' | 'kota' | 'para' | 'stok' | 'depo';

function denetle(s: GameState, g: Good, miktar: number, alim: boolean): { ok: boolean; sebep?: TicaretSebep } {
  if (s.bitti) return { ok: false, sebep: 'bitti' };
  if (!tuccarVarMi(s)) return { ok: false, sebep: 'kilitli' };
  if (!(miktar > 0)) return { ok: false, sebep: 'kota' };
  if (miktar > kalanKota(s)) return { ok: false, sebep: 'kota' };
  if (alim) {
    if (s.para < miktar * BALANCE.ticaret.fiyat[g].al) return { ok: false, sebep: 'para' };
    if (s.stok[g] + miktar > stockLimit(s) + 1e-9) return { ok: false, sebep: 'depo' };
  } else if (s.stok[g] < miktar - 1e-9) return { ok: false, sebep: 'stok' };
  return { ok: true };
}

export function canBuy(s: GameState, g: Good, miktar: number): { ok: boolean; sebep?: TicaretSebep } {
  return denetle(s, g, miktar, true);
}

export function canSell(s: GameState, g: Good, miktar: number): { ok: boolean; sebep?: TicaretSebep } {
  return denetle(s, g, miktar, false);
}

/** Tüccardan mal al. Ödenen parayı döndürür; olmazsa null. */
export function buyGood(s: GameState, g: Good, miktar: number): number | null {
  if (!canBuy(s, g, miktar).ok) return null;
  const tutar = miktar * BALANCE.ticaret.fiyat[g].al;
  s.para -= tutar;
  s.stok[g] += miktar;
  s.tuccarKota = (s.tuccarKota ?? 0) + miktar;
  return tutar;
}

/** Tüccara mal sat. Alınan parayı döndürür; olmazsa null. */
export function sellGood(s: GameState, g: Good, miktar: number): number | null {
  if (!canSell(s, g, miktar).ok) return null;
  const tutar = miktar * BALANCE.ticaret.fiyat[g].sat;
  s.para += tutar;
  s.stok[g] = Math.max(0, s.stok[g] - miktar);
  s.tuccarKota = (s.tuccarKota ?? 0) + miktar;
  return tutar;
}

/** Gün sonu: ziyaret en geç gününde biter (menü açıkken zaman durduğu için normalde zaten bitmiştir). */
export function ticaretGunSonu(s: GameState): void {
  delete s.tuccarKota;
}
