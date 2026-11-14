// Mevsim şenlikleri: her mevsimin şenliği yılda bir kez, oyuncu isterse başlatılır (data/senlikler.ts).
// Bedel (para + mal, nüfusla büyür) ödenir; etkiler süreli etki olarak eklenir (ayar() üzerinden okunur).
import { SENLIKLER, SENLIK_NUFUS_OLCEK, type SenlikTanimi } from '../data/senlikler';
import type { GameState, Good } from './types';
import { mevsim, type Mevsim } from './season';
import { ayar, etkiEkle } from './cards';
import { gunlukYaz, yilNo } from './gunluk';

export type SenlikSebep = 'bitti' | 'yapildi' | 'sart' | 'para' | Good;

export interface SenlikDurumu {
  mevsim: Mevsim;
  tanim: SenlikTanimi;
  /** Bugünkü bedel (nüfus ve kartlarla ölçeklenmiş). */
  bedel: Partial<Record<Good | 'para', number>>;
  /** Etkinin süresi (gün). */
  sure: number;
  /** Şart binasının kasabadaki sayısı (şart yoksa tanımsız). */
  sartSayi?: number;
  /** Bu yıl yapıldı mı. */
  yapildi: boolean;
  /** Bu şenliğin etkisi şu an sürüyor mu; sürüyorsa son günü. */
  bitisGun?: number;
  ok: boolean;
  sebep?: SenlikSebep;
}

/** Bugünkü bedel: taban × (1 + nüfus / ölçek) × kart çarpanı, yuvarlanır. */
export function senlikBedeli(s: GameState, t: SenlikTanimi): Partial<Record<Good | 'para', number>> {
  const k = (1 + s.nufus / SENLIK_NUFUS_OLCEK) * ayar(s, 'senlikBedelCarpani');
  const out: Partial<Record<Good | 'para', number>> = {};
  for (const [m, n] of Object.entries(t.bedel) as [Good | 'para', number][]) out[m] = Math.round(n * k);
  return out;
}

/** Bu mevsimin şenliği ve başlatılabilir mi. */
export function senlikDurumu(s: GameState): SenlikDurumu {
  const m = mevsim(s.gun);
  const tanim = SENLIKLER[m];
  const bedel = senlikBedeli(s, tanim);
  const sure = ayar(s, 'senlikSure') + (tanim.ekSure ?? 0);
  const yapildi = s.senlikYili?.[m] === yilNo(s.gun);
  const etki = (s.etkiler ?? []).find((e) => e.kaynak === `senlik.${m}` && s.gun <= e.bitisGun);
  const d: SenlikDurumu = { mevsim: m, tanim, bedel, sure, yapildi, ok: false };
  if (etki) d.bitisGun = etki.bitisGun;
  if (tanim.sart) d.sartSayi = s.binalar.filter((b) => b.type === tanim.sart!.bina && !b.dogal).length;
  let sebep: SenlikSebep | undefined;
  if (s.bitti) sebep = 'bitti';
  else if (yapildi) sebep = 'yapildi';
  else if (tanim.sart && d.sartSayi! < tanim.sart.adet) sebep = 'sart';
  else {
    for (const [mal, n] of Object.entries(bedel) as [Good | 'para', number][]) {
      const var_ = mal === 'para' ? s.para : s.stok[mal];
      if (var_ < n - 1e-9) {
        sebep = mal;
        break;
      }
    }
  }
  if (sebep) d.sebep = sebep;
  else d.ok = true;
  return d;
}

/** Bu mevsimin şenliğini başlatır: bedel düşülür, etkiler eklenir, günlüğe yazılır. Olmazsa false. */
export function senlikBaslat(s: GameState): boolean {
  const d = senlikDurumu(s);
  if (!d.ok) return false;
  for (const [mal, n] of Object.entries(d.bedel) as [Good | 'para', number][]) {
    if (mal === 'para') s.para -= n;
    else s.stok[mal] = Math.max(0, s.stok[mal] - n);
  }
  for (const e of d.tanim.etkiler) etkiEkle(s, { ...e, kaynak: `senlik.${d.mevsim}` }, d.sure);
  (s.senlikYili ??= {})[d.mevsim] = yilNo(s.gun);
  gunlukYaz(s, 'festival', d.mevsim);
  return true;
}
