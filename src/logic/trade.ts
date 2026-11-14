// Gezgin tüccar: her BALANCE.ticaret.aralik günde bir, başlangıç yolunun kenar ucuna gelir ve `kalis` gün kalır.
// Geliş günleri gün sayısından türetilir (durum alanı yok); yalnızca ziyaretteki kota sayacı saklanır.
import { BALANCE } from '../data/buildings';
import { HARITA, makeRng } from '../data/map';
import type { BuildingType, GameState, Good } from './types';
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

/** Bir mal kasabada üretiliyor mu (üreticisi var mı): fırsat ve sipariş malları bunlardan seçilir. */
const URETICI: Record<Good, BuildingType[]> = {
  bugday: ['tarla'], un: ['degirmen'], yemek: ['firin', 'balikci'], odun: ['oduncu'], tas: ['tasOcagi'],
  mobilya: ['marangoz'], yun: ['agil'], kumas: ['dokumaci'], bal: ['arilik'],
};
const MALLAR = Object.keys(URETICI) as Good[];

function uretilenMallar(s: GameState): Good[] {
  const var_ = new Set(s.binalar.map((b) => b.type));
  return MALLAR.filter((g) => URETICI[g].some((t) => var_.has(t)));
}

/** Ziyaret numarası (8–10. gün: 1, 16–18: 2, ...). */
export function ziyaretNo(gun: number): number {
  return Math.floor(Math.floor(gun) / BALANCE.ticaret.aralik);
}

function ziyaretRng(s: GameState, ziyaret: number, tuz: number): () => number {
  return makeRng(((s.haritaTohum ?? 0) ^ Math.imul(ziyaret + 1, 0x27d4eb2d) ^ tuz) >>> 0);
}

/**
 * Günün fırsatı (her ziyarette bir kez, tohum + ziyaret numarasından): bir mal iki katına satılır, bir mal %40 ucuza
 * alınır. Satış fırsatı kasabanın ürettiği mallardan seçilir. Tüccar yoksa null.
 */
export function gununFirsati(s: GameState): { sat: Good; al: Good } | null {
  if (!tuccarVarMi(s.gun)) return null;
  const rng = ziyaretRng(s, ziyaretNo(s.gun), 0x5a17);
  const uretilen = uretilenMallar(s);
  const havuz = uretilen.length ? uretilen : MALLAR;
  const sat = havuz[Math.floor(rng() * havuz.length)];
  const kalan = MALLAR.filter((g) => g !== sat);
  return { sat, al: kalan[Math.floor(rng() * kalan.length)] };
}

/**
 * Birim fiyat: satış fiyatı ayar('ticaretSatisCarpani') ile değişir (kartlar, Panayır); günün fırsatındaki mal
 * iki katına satılır / %40 ucuza alınır.
 */
export function birimFiyat(s: GameState, g: Good): { sat: number; al: number } {
  const f = BALANCE.ticaret.fiyat[g];
  const fr = gununFirsati(s);
  const T = BALANCE.ticaret;
  return {
    sat: f.sat * ayar(s, 'ticaretSatisCarpani') * (fr?.sat === g ? T.firsatSatis : 1),
    al: f.al * (fr?.al === g ? T.firsatAlis : 1),
  };
}

/** Tüccarın siparişi bu ziyarette teslim edilebilir mi; tutar normal satış fiyatının siparisCarpani katı. */
export function siparisDurumu(s: GameState): { mal: Good; miktar: number; para: number; ok: boolean } | null {
  const o = s.tuccarSiparis;
  if (!o || !tuccarVarMi(s.gun) || o.ziyaret !== ziyaretNo(s.gun)) return null;
  const para = Math.round(o.miktar * BALANCE.ticaret.fiyat[o.mal].sat * BALANCE.ticaret.siparisCarpani);
  return { mal: o.mal, miktar: o.miktar, para, ok: !s.bitti && s.stok[o.mal] >= o.miktar - 1e-9 };
}

/** Siparişi teslim eder (kotadan düşmez). Ödenen parayı döndürür; olmazsa null. */
export function siparisTeslim(s: GameState): number | null {
  const d = siparisDurumu(s);
  if (!d?.ok) return null;
  s.stok[d.mal] = Math.max(0, s.stok[d.mal] - d.miktar);
  s.para += d.para;
  delete s.tuccarSiparis;
  return d.para;
}

/** Bir takasın tutarı (yuvarlanır). */
export function ticaretTutari(s: GameState, g: Good, miktar: number, alim: boolean): number {
  const f = birimFiyat(s, g);
  return Math.round(miktar * (alim ? f.al : f.sat));
}

/** Nedenler: bitti, kilitli (tüccar yok), kota, para (alım), stok (satışta stok yetmiyor), depo (alımda depo dolu). */
export type TicaretSebep = 'bitti' | 'kilitli' | 'kota' | 'para' | 'stok' | 'depo';

function denetle(s: GameState, g: Good, miktar: number, alim: boolean): { ok: boolean; sebep?: TicaretSebep } {
  if (s.bitti) return { ok: false, sebep: 'bitti' };
  if (!tuccarVarMi(s.gun)) return { ok: false, sebep: 'kilitli' };
  if (!(miktar > 0)) return { ok: false, sebep: 'kota' };
  if (miktar > kalanKota(s)) return { ok: false, sebep: 'kota' };
  if (alim) {
    if (s.para < ticaretTutari(s, g, miktar, true)) return { ok: false, sebep: 'para' };
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
  const tutar = ticaretTutari(s, g, miktar, true);
  s.para -= tutar;
  s.stok[g] += miktar;
  s.tuccarKota = (s.tuccarKota ?? 0) + miktar;
  return tutar;
}

/** Tüccara mal sat. Alınan parayı döndürür; olmazsa null. */
export function sellGood(s: GameState, g: Good, miktar: number): number | null {
  if (!canSell(s, g, miktar).ok) return null;
  const tutar = ticaretTutari(s, g, miktar, false);
  s.para += tutar;
  s.stok[g] = Math.max(0, s.stok[g] - miktar);
  s.tuccarKota = (s.tuccarKota ?? 0) + miktar;
  return tutar;
}

/**
 * Gün sonu: ziyaretin son günü bittiyse kota sayacı sıfırlanır (kota bütün ziyaret içindir); teslim edilmeyen
 * sipariş cezasız kalkar ve tüccar bir sonraki ziyareti için yeni bir sipariş bırakır (kasabanın ürettiği bir mal).
 */
export function ticaretGunSonu(s: GameState): void {
  if (!tuccarVarMi(s.gun + 1)) delete s.tuccarKota;
  if (tuccarVarMi(s.gun) && !tuccarVarMi(s.gun + 1)) {
    delete s.tuccarSiparis;
    const uretilen = uretilenMallar(s);
    if (uretilen.length) {
      const sonraki = ziyaretNo(s.gun) + 1;
      const rng = ziyaretRng(s, sonraki, 0x0de5);
      const mal = uretilen[Math.floor(rng() * uretilen.length)];
      const { siparisMin, siparisMaks } = BALANCE.ticaret;
      const miktar = Math.round((siparisMin + rng() * (siparisMaks - siparisMin)) / 5) * 5;
      s.tuccarSiparis = { mal, miktar, ziyaret: sonraki };
    }
  }
}
