// Dil desteği. Bütün arayüz metinleri src/lang/<dil>.json dosyalarındadır (düz, noktalı anahtarlar).
// Metinde {ad} yer tutucuları t(anahtar, { ad: değer }) ile doldurulur.
// Anahtar tipi tr.json'dan türetilir: olmayan bir anahtar derlemede hata verir.
// Yalnızca seçili dilin dosyası yüklenir (main.ts oyunu açmadan önce dilYukle'yi bekler).
// Dil açılışta bir kez belirlenir (localStorage, yoksa tarayıcı dili); değiştirmek sayfayı yeniden yükler.
// data/ ve logic/ Türkçe kalır; arayüz bina, kart, hedef gibi metinleri buradan okur.
import type TR from '../lang/tr.json';
import type { BuildingType, Good, KomsulukDurum, Need, RoadType } from '../logic/types';
import type { Mevsim } from '../logic/season';
import type { KararKarti } from '../data/cards';
import { BUILDINGS } from '../data/buildings';

export type Anahtar = keyof typeof TR;
export type Dil = 'tr' | 'en';
export const DILLER: Dil[] = ['tr', 'en'];
export const DIL_ANAHTARI = 'kagit-kasaba-dil';

function ilkDil(): Dil {
  try {
    const k = localStorage.getItem(DIL_ANAHTARI);
    if (k === 'tr' || k === 'en') return k;
  } catch {
    /* yok say */
  }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/** Etkin dil (oturum boyunca sabit). */
export const DIL: Dil = ilkDil();

const DOSYALAR = import.meta.glob<{ default: Record<string, string> }>('../lang/*.json');
let metinler: Record<string, string> = {};

/** Etkin dilin dosyasını yükler. Arayüz modülleri içe aktarılmadan önce beklenmeli. */
export async function dilYukle(): Promise<void> {
  const yukle = DOSYALAR[`../lang/${DIL}.json`];
  metinler = yukle ? (await yukle()).default : {};
}

/** Dil tercihini kaydeder (çağıran sayfayı yeniden yükler). */
export function dilKaydet(d: Dil): void {
  try {
    localStorage.setItem(DIL_ANAHTARI, d);
  } catch {
    /* yok say */
  }
}

/** Anahtarın etkin dildeki metni; {ad} yer tutucuları p'den doldurulur. Bulunamazsa anahtarın kendisi. */
export function t(k: Anahtar, p?: Record<string, string | number>): string {
  const m = metinler[k] ?? k;
  if (!p) return m;
  return m.replace(/\{(\w+)\}/g, (tam, ad: string) => (ad in p ? String(p[ad]) : tam));
}

/** Etkin dilde küçük harf (Türkçe İ/ı kuralıyla). */
export const kucuk = (s: string): string => s.toLocaleLowerCase(DIL);

/** Sayı biçimi (binlik ayırıcı dile göre). */
export const sayi = (n: number): string => Math.round(n).toLocaleString(DIL === 'tr' ? 'tr-TR' : 'en-US');

// ---- Veri metinleri ----

export const binaAd = (b: BuildingType): string => t(`bina.${b}.ad`);
export const binaAciklama = (b: BuildingType): string => t(`bina.${b}.aciklama`);
export const yolAd = (y: RoadType): string => t(`yol.${y}.ad`);
export const yolAciklama = (y: RoadType): string => t(`yol.${y}.aciklama`);
export const malAd = (g: Good): string => t(`mal.${g}`);
export const malAdKucuk = (g: Good): string => kucuk(malAd(g));
export const ihtiyacAd = (n: Need): string => t(`ihtiyac.${n}`);
export const mevsimAd = (m: Mevsim): string => t(`mevsim.${m}`);
/** Ev seviyesinin adı (1–3). */
export const evSeviyeAd = (s: number): string => (s >= 1 && s <= 3 ? t(`evSeviye.${s as 1 | 2 | 3}`) : '');

/** Karar kartının adı, artısı ve eksisi. */
export function kartMetni(k: KararKarti): { ad: string; arti: string; eksi: string } {
  const b = `kart.${k.id}`;
  return { ad: t(`${b}.ad` as Anahtar), arti: t(`${b}.arti` as Anahtar), eksi: t(`${b}.eksi` as Anahtar) };
}

/** Hedefin (GOALS sırası) adı ve açıklaması. */
export function hedefMetni(i: number): { ad: string; aciklama: string } {
  return { ad: t(`hedef.${i}.ad` as Anahtar), aciklama: t(`hedef.${i}.aciklama` as Anahtar) };
}

// ---- Komşuluk bonusu: mantık katmanı verideki Türkçe etiketi taşır, binaya göre dil anahtarı bulunur. ----

const KOMSULUK_BINA = new Map<string, BuildingType>();
for (const [tur, d] of Object.entries(BUILDINGS) as [BuildingType, (typeof BUILDINGS)[BuildingType]][]) {
  for (const k of d.komsuluk ?? []) KOMSULUK_BINA.set(k.etiket, tur);
}

function komsuluk(d: KomsulukDurum, alan: 'etiket' | 'sart'): string {
  const tur = KOMSULUK_BINA.get(d.etiket);
  return tur ? t(`komsuluk.${tur}.${alan}` as Anahtar) : d[alan];
}

/** Binanın komşuluk kuralının adı, büyük harfle ("Sulama"). Her binanın en fazla bir kuralı vardır. */
export function komsulukEtiket(tur: BuildingType): string {
  const m = t(`komsuluk.${tur}.etiket` as Anahtar);
  return m.charAt(0).toLocaleUpperCase(DIL) + m.slice(1);
}
/** Binanın komşuluk kuralının şartı ("kenarı göle en fazla 4 birim"). */
export const komsulukSart = (tur: BuildingType): string => t(`komsuluk.${tur}.sart` as Anahtar);

/** Etkin bonus metni: "+%25 sulama", "+3 mutluluk (göl manzarası)". */
export function bonusMetni(d: KomsulukDurum): string {
  const parca: string[] = [];
  const etiket = komsuluk(d, 'etiket');
  if (d.oran) parca.push(t('bilgi.bonusOran', { n: Math.round(d.oran * 100), etiket }));
  if (d.mutluluk) parca.push(t('bilgi.bonusMutluluk', { n: d.mutluluk, etiket }));
  return parca.join(', ');
}

/** Tutmayan bonusun şartı: "sulama: kenarı göle en fazla 4 birim". */
export const bonusSarti = (d: KomsulukDurum): string => `${komsuluk(d, 'etiket')}: ${komsuluk(d, 'sart')}`;
