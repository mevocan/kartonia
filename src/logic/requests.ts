// Sakin istekleri: kısa vadeli küçük hedefler. Aynı anda en fazla bir istek; süre dolarsa cezasız kalkar.
// İstek türü tohum ve gün sayısından makeRng ile seçilir (deterministik).
import { BALANCE, BUILDINGS } from '../data/buildings';
import { makeRng } from '../data/map';
import type { Building, GameState, Istek, IstekSonuc, IstekTuru } from './types';
import { dist } from './geometry';
import { effectRadius } from './placement';
import { mevsim } from './season';

const I = BALANCE.istek;

/** Evin merkezi bir su kaynağının (Çeşme) etki alanında mı. */
function suVar(s: GameState, h: Building): boolean {
  return s.binalar.some((b) => BUILDINGS[b.type].saglar === 'su' && dist(b.x, b.z, h.x, h.z) <= effectRadius(b));
}

/** Suya erişimi olmayan en küçük id'li ev. */
function susuzEv(s: GameState): Building | undefined {
  return s.binalar.filter((b) => b.type === 'ev').sort((a, b) => a.id - b.id).find((h) => !suVar(s, h));
}

/** `gun` günü başlayacak bir istek için uygun türler. */
function uygunTurler(s: GameState, gun: number): IstekTuru[] {
  const t: IstekTuru[] = ['senlik', 'agaclandirma'];
  // Kış hazırlığı yalnız sonbaharda ve odun henüz yetmiyorsa (yoksa bedava ödül olur).
  if (mevsim(gun) === 'sonbahar' && s.stok.odun < I.kisOdun) t.push('kisHazirligi');
  if (susuzEv(s)) t.push('susuzEv');
  return t;
}

/** Deterministik tür seçimi: harita tohumu + gün. */
export function istekTuruSec(s: GameState, gun: number): IstekTuru {
  const turler = uygunTurler(s, gun);
  const rng = makeRng(((s.haritaTohum ?? 0) ^ Math.imul(gun, 0x9e3779b1)) >>> 0);
  return turler[Math.floor(rng() * turler.length)];
}

function yeniIstek(s: GameState, gun: number): Istek {
  const tur = istekTuruSec(s, gun);
  const istek: Istek = { tur, baslangicGun: gun, ilerleme: 0 };
  if (tur === 'susuzEv') istek.hedefBinaId = susuzEv(s)!.id;
  if (tur === 'kisHazirligi') istek.ilerleme = Math.min(s.stok.odun, I.kisOdun);
  return istek;
}

/** İsteğin hedef sayısı (ilerleme çubuğu için). */
export function istekHedefi(tur: IstekTuru): number {
  if (tur === 'senlik') return I.senlikYemek;
  if (tur === 'agaclandirma') return I.agacSayisi;
  if (tur === 'kisHazirligi') return I.kisOdun;
  return 1;
}

/** Etkin isteğin son gününe kadar kalan gün (bugün dahil). İstek yoksa 0. */
export function istekKalanGun(s: GameState): number {
  if (!s.istek) return 0;
  return Math.max(0, s.istek.baslangicGun + I.sure - s.gun);
}

function bitir(s: GameState): void {
  delete s.istek;
  s.sonrakiIstekGunu = s.gun + I.bekleme;
}

/**
 * Etkin isteğin şartı tuttuysa ödülü verir, isteği kaldırır ve sonucu döndürür. Şenlik buradan
 * tamamlanmaz (düğmeyle teslim edilir). Hedef ev yıkıldıysa istek sessizce kalkar. Main oyuncu
 * eylemlerinden sonra, endDay gün sonunda çağırır.
 */
export function checkRequest(s: GameState): IstekSonuc | null {
  const ist = s.istek;
  if (!ist || s.bitti) return null;
  let tamam = false;
  let para = 0;
  if (ist.tur === 'agaclandirma') {
    tamam = ist.ilerleme >= I.agacSayisi;
    para = I.agacOdul;
  } else if (ist.tur === 'kisHazirligi') {
    ist.ilerleme = Math.min(s.stok.odun, I.kisOdun);
    tamam = s.stok.odun >= I.kisOdun - 1e-9;
    para = I.kisOdul;
  } else if (ist.tur === 'susuzEv') {
    const h = s.binalar.find((b) => b.id === ist.hedefBinaId);
    if (!h) {
      bitir(s); // ev yıkıldı: cezasız kalkar
      return null;
    }
    tamam = suVar(s, h);
    ist.ilerleme = tamam ? 1 : 0;
    para = I.suOdul;
  }
  if (!tamam) return null;
  s.para += para;
  bitir(s);
  return { tur: ist.tur, para };
}

/** Şenlik: stoktan yemeği teslim et. Olursa sonucu döndürür; yemek yetmezse ya da istek şenlik değilse null. */
export function deliverFeast(s: GameState): IstekSonuc | null {
  if (s.bitti || s.istek?.tur !== 'senlik' || s.stok.yemek < I.senlikYemek - 1e-9) return null;
  s.stok.yemek = Math.max(0, s.stok.yemek - I.senlikYemek);
  // Bugün dahil senlikGun gün bütün evlere geçici mutluluk.
  s.geciciMutluluk = { deger: I.senlikMutluluk, bitisGun: s.gun + I.senlikGun - 1 };
  bitir(s);
  return { tur: 'senlik', para: 0 };
}

/** Bu gün evlere eklenen geçici mutluluk (Şenlik). */
export function geciciMutlulukBugun(s: GameState): number {
  const g = s.geciciMutluluk;
  return g && s.gun <= g.bitisGun ? g.deger : 0;
}

/**
 * Gün sonu (endDay, s.gun henüz artmadan): tamamlanma, süre dolması, yeni istek, biten şenlik.
 * Dönen alanlar gün raporuna yazılır.
 */
export function istekGunSonu(s: GameState): { tamamlanan?: IstekSonuc; yeni?: IstekTuru } {
  const sonuc: { tamamlanan?: IstekSonuc; yeni?: IstekTuru } = {};
  const t = checkRequest(s);
  if (t) sonuc.tamamlanan = t;
  // Süre doldu: son günün sonunda cezasız kalkar.
  if (s.istek && s.gun >= s.istek.baslangicGun + I.sure - 1) bitir(s);
  // Şenlik mutluluğu bitti.
  if (s.geciciMutluluk && s.geciciMutluluk.bitisGun <= s.gun) delete s.geciciMutluluk;
  // Yeni istek yarın başlar.
  const yarin = s.gun + 1;
  if (!s.istek && s.nufus > I.nufusEsigi && yarin >= (s.sonrakiIstekGunu ?? 0)) {
    s.istek = yeniIstek(s, yarin);
    sonuc.yeni = s.istek.tur;
  }
  return sonuc;
}
