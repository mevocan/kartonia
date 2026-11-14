// Gezgin tüccar: her BALANCE.ticaret.aralik günde bir, başlangıç yolunun kenar ucuna gelir ve `kalis` gün kalır.
// Geliş günleri gün sayısından türetilir (durum alanı yok); yalnızca ziyaretteki kota sayacı saklanır.
import { BALANCE } from '../data/buildings';
import { HARITA } from '../data/map';
import type { GameState, Good } from './types';
import { stockLimit } from './placement';
import { ayar } from './cards';

/** Tüccar bu gün kasabada mı: aralik. günden başlayarak her ziyarette kalis gün (ör. 8–10, 16–18, ...). */
export function tuccarVarMi(gun: number): boolean {
  const { aralik, kalis } = BALANCE.ticaret;
  const g = Math.floor(gun);
  return g >= aralik && g % aralik < kalis;
}

/** Ziyaretin ilk günü mü (geliş bildirimi için). */
export function tuccarGeldiMi(gun: number): boolean {
  return tuccarVarMi(gun) && Math.floor(gun) % BALANCE.ticaret.aralik === 0;
}

/** Tüccar buradaysa bugün dahil kaç gün daha kalacak; değilse 0. */
export function tuccarKalisGunu(gun: number): number {
  if (!tuccarVarMi(gun)) return 0;
  return BALANCE.ticaret.kalis - (Math.floor(gun) % BALANCE.ticaret.aralik);
}

/** Sıradaki gelişe kaç gün var (bugün buradaysa 0). */
export function tuccaraKalanGun(gun: number): number {
  if (tuccarVarMi(gun)) return 0;
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
  if (!tuccarVarMi(s.gun)) return { ok: false, sebep: 'kilitli' };
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

/** Gün sonu: ziyaretin son günü bittiyse kota sayacı sıfırlanır (kota bütün ziyaret içindir). */
export function ticaretGunSonu(s: GameState): void {
  if (!tuccarVarMi(s.gun + 1)) delete s.tuccarKota;
}
