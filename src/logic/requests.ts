// Sakin istekleri: kısa vadeli küçük hedefler. Aynı anda en fazla bir istek; süre dolarsa cezasız kalkar.
// İstek türü ve isteyen sakin, tohum ve gün sayısından makeRng ile seçilir (deterministik); aynı tür art arda gelmez.
// Türler mevcut mekaniklere dayanır:
//   teslim   — senlik (ziyafet: yemek → geçici mutluluk), mobilya (mobilya → para): istek kartındaki düğmeyle
//   sayaç    — agaclandirma, cicekDik: dikilen ağaç / çiçek (placeBuilding sayar)
//   stok     — kisHazirligi (odun), erzak (yemek): stokta bulunsun, harcanmaz
//   artış    — park, golEvi, asfaltEv, yukseltme: istek geldiğindeki sayının (`baz`) üstüne çıkılsın
//   hedef ev — susuzEv (suya kavuşsun), gurultu (gürültülü binaların alanından kurtulsun)
import { BALANCE, BUILDINGS } from '../data/buildings';
import { makeRng } from '../data/map';
import type { Building, GameState, Istek, IstekSonuc, IstekTuru } from './types';
import { dist } from './geometry';
import { effectRadius, isUnlocked } from './placement';
import { mevsim } from './season';
import { gunlukYaz } from './gunluk';
import { ayar, etkiEkle } from './cards';
import { bestRoadNear, isRoadUnlocked } from './roads';
import { lakeDistance } from './terrain';

const I = BALANCE.istek;

/** İsteyen sakinin adı dil dosyasındaki listeden bu kadar seçenekle seçilir. */
export const SAKIN_SAYISI = 24;

/** Evin merkezi bir su kaynağının (Çeşme) etki alanında mı. */
function suVar(s: GameState, h: Building): boolean {
  return s.binalar.some((b) => BUILDINGS[b.type].saglar === 'su' && dist(b.x, b.z, h.x, h.z) <= effectRadius(b));
}

/** Evi kapsayan gürültülü (mutluluğu eksi) bina var mı. */
function gurultuVar(s: GameState, h: Building): boolean {
  return s.binalar.some(
    (b) => b.type !== 'ev' && ayar(s, `mutluluk.${b.type}`) < 0 && dist(b.x, b.z, h.x, h.z) <= effectRadius(b),
  );
}

const evler = (s: GameState): Building[] => s.binalar.filter((b) => b.type === 'ev').sort((a, b) => a.id - b.id);

/** Suya erişimi olmayan en küçük id'li ev. */
function susuzEv(s: GameState): Building | undefined {
  return evler(s).find((h) => !suVar(s, h));
}

/** Gürültü altındaki en küçük id'li ev. */
function gurultuluEv(s: GameState): Building | undefined {
  return evler(s).find((h) => gurultuVar(s, h));
}

/** "Artış" türlerinin şu anki sayısı. */
function sayac(s: GameState, tur: IstekTuru): number {
  switch (tur) {
    case 'park': return s.binalar.filter((b) => b.type === 'park').length;
    case 'golEvi': return evler(s).filter((h) => lakeDistance(h.x, h.z) <= 5).length;
    case 'asfaltEv': return evler(s).filter((h) => bestRoadNear(s, h)?.tur === 'asfalt').length;
    case 'yukseltme': return s.binalar.reduce((t, b) => t + (BUILDINGS[b.type].yukseltilebilir ? b.seviye : 0), 0);
    default: return 0;
  }
}

const ARTIS: IstekTuru[] = ['park', 'golEvi', 'asfaltEv', 'yukseltme'];

/** `gun` günü başlayacak bir istek için uygun türler (bir önceki tür hariç, tek seçenek kalmadıkça). */
function uygunTurler(s: GameState, gun: number): IstekTuru[] {
  const t: IstekTuru[] = ['senlik', 'agaclandirma', 'cicekDik', 'golEvi'];
  // Kış hazırlığı yalnız sonbaharda ve odun henüz yetmiyorsa (yoksa bedava ödül olur).
  if (mevsim(gun) === 'sonbahar' && s.stok.odun < I.kisOdun) t.push('kisHazirligi');
  if (susuzEv(s)) t.push('susuzEv');
  if (isUnlocked(s, 'park')) t.push('park');
  if (gurultuluEv(s)) t.push('gurultu');
  if (s.binalar.some((b) => b.type === 'marangoz')) t.push('mobilya');
  if (isRoadUnlocked(s, 'asfalt')) t.push('asfaltEv');
  if (s.binalar.some((b) => b.type === 'firin' || b.type === 'balikci') && s.stok.yemek < I.erzakYemek) t.push('erzak');
  if (s.binalar.some((b) => BUILDINGS[b.type].yukseltilebilir && b.seviye < 3)) t.push('yukseltme');
  const tekrarsiz = t.filter((x) => x !== s.sonIstekTuru);
  return tekrarsiz.length > 0 ? tekrarsiz : t;
}

function istekRng(s: GameState, gun: number): () => number {
  return makeRng(((s.haritaTohum ?? 0) ^ Math.imul(gun, 0x9e3779b1)) >>> 0);
}

/** Deterministik tür seçimi: harita tohumu + gün. */
export function istekTuruSec(s: GameState, gun: number): IstekTuru {
  const turler = uygunTurler(s, gun);
  const rng = istekRng(s, gun);
  return turler[Math.floor(rng() * turler.length)];
}

function yeniIstek(s: GameState, gun: number): Istek {
  const tur = istekTuruSec(s, gun);
  const rng = istekRng(s, gun);
  rng(); // tür seçimiyle aynı ilk sayı; ikincisi sakin
  const istek: Istek = { tur, baslangicGun: gun, ilerleme: 0, sakin: Math.floor(rng() * SAKIN_SAYISI) };
  if (tur === 'susuzEv') istek.hedefBinaId = susuzEv(s)!.id;
  if (tur === 'gurultu') istek.hedefBinaId = gurultuluEv(s)!.id;
  if (tur === 'kisHazirligi') istek.ilerleme = Math.min(s.stok.odun, I.kisOdun);
  if (tur === 'erzak') istek.ilerleme = Math.min(s.stok.yemek, I.erzakYemek);
  if (ARTIS.includes(tur)) istek.baz = sayac(s, tur);
  return istek;
}

/** İsteğin hedef sayısı (ilerleme çubuğu için). */
export function istekHedefi(tur: IstekTuru): number {
  switch (tur) {
    case 'senlik': return I.senlikYemek;
    case 'agaclandirma': return I.agacSayisi;
    case 'cicekDik': return I.cicekSayisi;
    case 'kisHazirligi': return I.kisOdun;
    case 'erzak': return I.erzakYemek;
    case 'mobilya': return I.mobilyaTeslim;
    default: return 1;
  }
}

/** Düğmeyle teslim edilen türler ve istedikleri mal. */
export function teslimMali(tur: IstekTuru): { mal: 'yemek' | 'mobilya'; miktar: number } | null {
  if (tur === 'senlik') return { mal: 'yemek', miktar: I.senlikYemek };
  if (tur === 'mobilya') return { mal: 'mobilya', miktar: I.mobilyaTeslim };
  return null;
}

/** Kasaba neşeli mi: ortalama mutluluk eşiğin üstünde (istek para ödülleri artar). */
export function neseliMi(s: GameState): boolean {
  return s.mutluluk >= BALANCE.neseliMutluluk;
}

/**
 * İsteğin şu anki para ödülü: taban × (1 + nüfus / 100), neşeli kasabada neseliIstekCarpani katı (yuvarlanır).
 * Ziyafet (senlik) para vermez, ödülü geçici mutluluktur.
 */
export function istekOdulu(s: GameState, tur: IstekTuru): number {
  const taban = I.odul[tur] ?? 0;
  return Math.round(taban * (1 + s.nufus / I.odulNufusOlcek) * (neseliMi(s) ? BALANCE.neseliIstekCarpani : 1));
}

/** Etkin isteğin son gününe kadar kalan gün (bugün dahil). İstek yoksa 0. */
export function istekKalanGun(s: GameState): number {
  if (!s.istek) return 0;
  return Math.max(0, s.istek.baslangicGun + I.sure - s.gun);
}

function bitir(s: GameState): void {
  if (s.istek) s.sonIstekTuru = s.istek.tur;
  delete s.istek;
  s.sonrakiIstekGunu = s.gun + I.bekleme;
}

/**
 * Etkin isteğin şartı tuttuysa ödülü verir, isteği kaldırır ve sonucu döndürür. Teslim türleri buradan
 * tamamlanmaz (düğmeyle). Hedef ev yıkıldıysa istek sessizce kalkar. Main oyuncu eylemlerinden sonra,
 * endDay gün sonunda çağırır.
 */
export function checkRequest(s: GameState): IstekSonuc | null {
  const ist = s.istek;
  if (!ist || s.bitti) return null;
  let tamam = false;
  const para = istekOdulu(s, ist.tur);
  switch (ist.tur) {
    case 'agaclandirma': tamam = ist.ilerleme >= I.agacSayisi; break;
    case 'cicekDik': tamam = ist.ilerleme >= I.cicekSayisi; break;
    case 'kisHazirligi':
      ist.ilerleme = Math.min(s.stok.odun, I.kisOdun);
      tamam = s.stok.odun >= I.kisOdun - 1e-9;
      break;
    case 'erzak':
      ist.ilerleme = Math.min(s.stok.yemek, I.erzakYemek);
      tamam = s.stok.yemek >= I.erzakYemek - 1e-9;
      break;
    case 'park': case 'golEvi': case 'asfaltEv': case 'yukseltme':
      tamam = sayac(s, ist.tur) > (ist.baz ?? 0);
      ist.ilerleme = tamam ? 1 : 0;
      break;
    case 'susuzEv': case 'gurultu': {
      const h = s.binalar.find((b) => b.id === ist.hedefBinaId);
      if (!h) {
        bitir(s); // ev yıkıldı: cezasız kalkar
        return null;
      }
      tamam = ist.tur === 'susuzEv' ? suVar(s, h) : !gurultuVar(s, h);
      ist.ilerleme = tamam ? 1 : 0;
      break;
    }
    default: return null; // teslim türleri
  }
  if (!tamam) return null;
  s.para += para;
  bitir(s);
  return { tur: ist.tur, para };
}

/**
 * Teslim isteği (ziyafet ya da mobilya): stoktan malı teslim et. Olursa sonucu döndürür; mal yetmezse ya da
 * istek teslim türü değilse null. Ziyafet `senlikGun` gün bütün evlere geçici mutluluk verir.
 */
export function deliverRequest(s: GameState): IstekSonuc | null {
  const ist = s.istek;
  const t = ist ? teslimMali(ist.tur) : null;
  if (s.bitti || !ist || !t || s.stok[t.mal] < t.miktar - 1e-9) return null;
  s.stok[t.mal] = Math.max(0, s.stok[t.mal] - t.miktar);
  let para = 0;
  if (ist.tur === 'senlik') {
    etkiEkle(s, { anahtar: 'evMutluluk', islem: 'ekle', deger: I.senlikMutluluk, kaynak: 'ziyafet' }, I.senlikGun);
    gunlukYaz(s, 'senlik');
  } else {
    para = istekOdulu(s, ist.tur);
    s.para += para;
  }
  bitir(s);
  return { tur: ist.tur, para };
}

/** Eski ad: ziyafet teslimi. */
export const deliverFeast = deliverRequest;

/**
 * Gün sonu (endDay, s.gun henüz artmadan): tamamlanma, süre dolması, yeni istek.
 * Dönen alanlar gün raporuna yazılır.
 */
export function istekGunSonu(s: GameState): { tamamlanan?: IstekSonuc; yeni?: IstekTuru } {
  const sonuc: { tamamlanan?: IstekSonuc; yeni?: IstekTuru } = {};
  const t = checkRequest(s);
  if (t) sonuc.tamamlanan = t;
  // Süre doldu: son günün sonunda cezasız kalkar.
  if (s.istek && s.gun >= s.istek.baslangicGun + I.sure - 1) bitir(s);
  // Yeni istek yarın başlar.
  const yarin = s.gun + 1;
  if (!s.istek && s.nufus > I.nufusEsigi && yarin >= (s.sonrakiIstekGunu ?? 0)) {
    s.istek = yeniIstek(s, yarin);
    sonuc.yeni = s.istek.tur;
  }
  return sonuc;
}
