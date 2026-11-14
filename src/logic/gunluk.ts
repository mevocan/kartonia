// Kasaba günlüğü ve yıl sonu gazetesi (Kartonia Postası).
// Günlük: kasabanın önemli anları (ilk ev, ilk kış, nüfus eşikleri, kule aşamaları, seçilen kartlar …) tarihleriyle.
// "İlk" anlar ve eşikler gün sonunda durumdan çıkarılır; eylem anları (kart, şenlik, kule aşaması) eylemde yazılır.
// Yıl: 18 gün (mevsimler). Her yılın son gününün sonunda yılın sayılarından bir gazete çıkar ve saklanır.
// Bu modül economy/placement'a bağımlı değildir (döngü olmasın): gerekli değerler parametreyle gelir.
import { BALANCE } from '../data/buildings';
import type { DayReport, Gazete, GameState, GunlukKaydi, GunlukTur } from './types';

/** Bir yılın gün sayısı (mevsim günlerinin toplamı). */
export const YIL_GUN = BALANCE.mevsim.gunler.reduce((a, b) => a + b, 0);

/** Günlükte en fazla bu kadar kayıt tutulur; aşılırsa en eski tekrarlanan kayıt silinir. */
export const GUNLUK_SINIR = 200;

/** Günlüğe yazılan nüfus eşikleri. */
export const NUFUS_ESIKLERI = [50, 100, 200, 300, 400];

/** Gün sayısından yıl (1'den başlar). */
export function yilNo(gun: number): number {
  return Math.floor((Math.max(1, gun) - 1) / YIL_GUN) + 1;
}

/** Bu gün yılın son günü mü (kışın son günü). */
export function yilSonuMu(gun: number): boolean {
  return gun >= YIL_GUN && gun % YIL_GUN === 0;
}

/** Bir kez yazılan türler: silinmez, tekrar yazılmaz (nüfus ve ev seviyesi veriyle birlikte tekildir). */
const TEKIL: GunlukTur[] = ['ilkEv', 'ilkYemek', 'ilkTuccar', 'ilkKis', 'kuleTamam', 'nufus', 'evSeviye', 'gunlukBasladi'];

function varMi(s: GameState, tur: GunlukTur, veri?: number | string): boolean {
  return (s.gunluk ?? []).some((k) => k.tur === tur && (veri === undefined || k.veri === veri));
}

/** Günlüğe kayıt ekler (bugünün tarihiyle). Sınır aşılırsa en eski tekrarlanan kayıt düşer. */
export function gunlukYaz(s: GameState, tur: GunlukTur, veri?: number | string): void {
  const g = (s.gunluk ??= []);
  const k: GunlukKaydi = { gun: s.gun, tur };
  if (veri !== undefined) k.veri = veri;
  g.push(k);
  if (g.length > GUNLUK_SINIR) {
    const i = g.findIndex((x) => !TEKIL.includes(x.tur));
    g.splice(i >= 0 ? i : 0, 1);
  }
}

/** Yılın sayaçları (yoksa bu yıl için başlatır). */
export function yilSayaci(s: GameState): NonNullable<GameState['yil']> {
  const yil = yilNo(s.gun);
  if (!s.yil || s.yil.yil !== yil) s.yil = { yil, nufusBasi: s.nufus, kurulanBina: 0, vergi: 0, yemek: 0 };
  return s.yil;
}

/** Manşet önceliği: yılın en büyük anı gazetenin başlığı olur. */
function oncelik(k: GunlukKaydi): number {
  switch (k.tur) {
    case 'kuleTamam': return 100;
    case 'evSeviye': return k.veri === 5 ? 90 : k.veri === 4 ? 80 : 50;
    case 'nufus': return 55 + Number(k.veri) / 100;
    case 'ilkKis': return 40;
    case 'ilkTuccar': return 35;
    case 'ilkYemek': return 30;
    case 'ilkEv': return 25;
    case 'kule': return 22;
    case 'kart': return 20;
    case 'senlik': return 15;
    case 'hedef': return 10;
    default: return 0;
  }
}

/**
 * Gün sonu (endDay, s.gun henüz artmadan, hedefler işlendikten sonra): yılın sayaçları, "ilk" anlar ve eşikler,
 * yıl sonuysa gazete. `mutluluklar`: bu günün ev mutlulukları (gazetenin "en mutlu ev"i için).
 */
export function gunlukGunSonu(s: GameState, rapor: DayReport, mutluluklar: Map<number, number>): void {
  const y = yilSayaci(s);
  y.vergi += rapor.vergi;
  y.yemek += rapor.uretilen.yemek;

  if (!varMi(s, 'ilkEv') && s.binalar.some((b) => b.type === 'ev')) gunlukYaz(s, 'ilkEv');
  if (!varMi(s, 'ilkYemek') && s.toplamYemek > 0) gunlukYaz(s, 'ilkYemek');
  const { aralik, kalis } = BALANCE.ticaret;
  if (!varMi(s, 'ilkTuccar') && s.gun >= aralik && s.gun % aralik < kalis) gunlukYaz(s, 'ilkTuccar');
  if (!varMi(s, 'ilkKis') && yilSonuMu(s.gun)) gunlukYaz(s, 'ilkKis');
  for (const n of NUFUS_ESIKLERI) if (s.nufus >= n && !varMi(s, 'nufus', n)) gunlukYaz(s, 'nufus', n);
  for (const c of rapor.seviyeDegisimleri) {
    if (c.yeni > c.eski && c.yeni >= 3 && !varMi(s, 'evSeviye', c.yeni)) gunlukYaz(s, 'evSeviye', c.yeni);
  }
  for (const i of rapor.yeniHedefler) gunlukYaz(s, 'hedef', i);

  if (!yilSonuMu(s.gun)) return;
  // Yıl sonu: gazete. Manşet bu yılın en önemli kaydı.
  const bas = (y.yil - 1) * YIL_GUN + 1;
  let manset: GunlukKaydi | null = null;
  for (const k of s.gunluk ?? []) {
    if (k.gizli || k.gun < bas || k.gun > s.gun || oncelik(k) === 0) continue;
    if (!manset || oncelik(k) > oncelik(manset)) manset = k;
  }
  let enMutlu: Gazete['enMutluEv'] = null;
  for (const b of s.binalar) {
    const m = mutluluklar.get(b.id);
    if (b.type !== 'ev' || m === undefined) continue;
    if (!enMutlu || m > enMutlu.mutluluk || (m === enMutlu.mutluluk && b.seviye > enMutlu.seviye)) {
      enMutlu = { id: b.id, seviye: b.seviye, mutluluk: Math.round(m) };
    }
  }
  const gazete: Gazete = {
    yil: y.yil, gun: s.gun, nufusBasi: y.nufusBasi, nufusSon: s.nufus, kurulanBina: y.kurulanBina,
    vergi: y.vergi, yemek: Math.round(y.yemek), manset, enMutluEv: enMutlu, hedef: s.hedef,
  };
  (s.gazeteler ??= []).push(gazete);
  gunlukYaz(s, 'gazete', y.yil);
  rapor.gazete = gazete;
  delete s.yil; // yeni yıl ilk kullanımda başlar (nüfus başı o günün nüfusu)
}

/** Yerleştirilen bina yılın sayacına eklenir (ağaç ve çiçek hariç). */
export function binaSayaci(s: GameState): void {
  yilSayaci(s).kurulanBina++;
}

/**
 * Günlüksüz eski kayıt: günlük boş başlar, ama oyunda zaten olmuş "ilk" anlar ve eşikler gizli kayıtla işaretlenir
 * (yoksa ilk gün sonunda "ilk ev" bugünün tarihiyle yazılırdı).
 */
export function gunlukGocu(s: GameState): void {
  if (s.gunluk) return;
  const g: GunlukKaydi[] = [];
  const gizli = (tur: GunlukTur, veri?: number): void => {
    g.push(veri === undefined ? { gun: s.gun, tur, gizli: true } : { gun: s.gun, tur, veri, gizli: true });
  };
  if (s.binalar.some((b) => b.type === 'ev')) gizli('ilkEv');
  if (s.toplamYemek > 0) gizli('ilkYemek');
  if (s.gun > BALANCE.ticaret.aralik) gizli('ilkTuccar');
  if (s.gun > YIL_GUN) gizli('ilkKis');
  for (const n of NUFUS_ESIKLERI) if (s.nufus >= n) gizli('nufus', n);
  const enUst = s.binalar.reduce((m, b) => (b.type === 'ev' ? Math.max(m, b.seviye) : m), 0);
  for (let sev = 3; sev <= enUst; sev++) gizli('evSeviye', sev);
  if (s.binalar.some((b) => b.type === 'saatKulesi' && !b.insaat)) gizli('kuleTamam');
  g.push({ gun: s.gun, tur: 'gunlukBasladi' });
  s.gunluk = g;
}
