import type { GameState, Good } from './types';
import { emptyGoods } from './economy';
import { haritayiAyarla } from '../data/map';
import { ESKI_HEDEF_SAYISI, GOALS } from './goals';
import { fillMeadows } from './doga';

export const SAVE_SURUM = 2; // 1: yolsuz eski sürüm, reddedilir

export function serialize(s: GameState): string {
  return JSON.stringify({ surum: SAVE_SURUM, durum: s });
}

/** Bozuk ya da uyumsuz kayıtta Error fırlatır. */
export function deserialize(json: string): GameState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Kayıt okunamadı: bozuk JSON');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Kayıt okunamadı: geçersiz biçim');
  const { surum, durum } = data as { surum?: unknown; durum?: unknown };
  if (surum !== SAVE_SURUM) throw new Error(`Kayıt sürümü desteklenmiyor: ${String(surum)}`);
  const s = durum as GameState | undefined;
  if (
    !s || typeof s !== 'object' ||
    typeof s.gun !== 'number' || typeof s.para !== 'number' ||
    !Array.isArray(s.binalar) || !Array.isArray(s.yollar) || typeof s.stok !== 'object' || s.stok === null
  ) {
    throw new Error('Kayıt okunamadı: eksik alanlar');
  }
  if (s.haritaTohum !== undefined && typeof s.haritaTohum !== 'number') {
    throw new Error('Kayıt okunamadı: geçersiz harita tohumu');
  }
  // Eski kayıt: ayrı ekmek/balık stokları ortak yemek stoğuna, ekmek sayacı yemek sayacına aktarılır.
  const eski = s as unknown as { stok: Record<string, unknown>; toplamEkmek?: unknown };
  if (typeof s.stok.yemek !== 'number') {
    const sayi = (v: unknown): number => (typeof v === 'number' ? v : 0);
    s.stok.yemek = sayi(eski.stok.ekmek) + sayi(eski.stok.balik);
  }
  delete eski.stok.ekmek;
  delete eski.stok.balik;
  if (typeof s.toplamYemek !== 'number') s.toplamYemek = typeof eski.toplamEkmek === 'number' ? eski.toplamEkmek : 0;
  delete eski.toplamEkmek;
  // Yün/kumaş/bal öncesi kayıt: bütün hedefleri bitirmişse (eski efsane) yeni Konak ve Köşk hedefleri
  // araya girdiği için yine "hepsi bitti" sayılır; efsane hedefi yeniden sorulmaz.
  if (typeof s.stok.kumas !== 'number' && s.hedef >= ESKI_HEDEF_SAYISI) s.hedef = GOALS.length;
  // Sonradan eklenen mallar (taş, mobilya, yün, kumaş, bal) eski kayıtlarda yok: 0 ile başlar.
  for (const g of Object.keys(emptyGoods()) as Good[]) {
    if (typeof s.stok[g] !== 'number') s.stok[g] = 0;
  }
  // Hal kaldırıldı (yemeği artık Pazar satar): eski kayıttaki Hal'ler aynı yerde, aynı seviyede Pazar olur.
  for (const b of s.binalar) {
    if ((b.type as string) === 'hal') b.type = 'pazar';
  }
  // Kayıttaki oyunun haritası etkin harita olur (tohumsuz eski kayıt: klasik harita).
  haritayiAyarla(s.haritaTohum);
  // Çiçek öncesi kayıt: haritanın çayırları boş yerlere ekilir (binalara, yollara dokunmaz).
  if (!s.cayirlar) fillMeadows(s);
  return s;
}
