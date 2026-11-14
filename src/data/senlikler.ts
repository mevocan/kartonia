// Mevsim şenlikleri: her mevsimin kendi şenliği vardır, yılda bir kez, oyuncu isterse başlatır (rastgele değil).
// Bedel ödenir, kasaba birkaç gün geçici etkiler kazanır (GameState.etkiler; ayar() üzerinden). Bedel nüfusla büyür.
import type { AyarAnahtari, KartEtkisi } from './cards';
import type { BuildingType, Good } from '../logic/types';
import type { Mevsim } from '../logic/season';

export interface SenlikTanimi {
  id: string;
  ikon: string;
  /** Başlatma şartı: kasabada en az bu kadar (doğal olmayan) bina. */
  sart?: { bina: BuildingType; adet: number };
  /** Taban bedel (para ve mallar); nüfusla ölçeklenir. */
  bedel: Partial<Record<Good | 'para', number>>;
  etkiler: KartEtkisi[];
  /** Etki süresine eklenen gün (ör. Panayır sıradaki tüccar ziyaretini kapsasın). */
  ekSure?: number;
}

export const SENLIKLER: Record<Mevsim, SenlikTanimi> = {
  ilkbahar: {
    id: 'cicekSenligi', ikon: '🌸',
    sart: { bina: 'cicek', adet: 10 },
    bedel: { para: 60 },
    etkiler: [
      { anahtar: 'evMutluluk', islem: 'ekle', deger: 6 },
      { anahtar: 'uretim.arilik.bal', islem: 'carp', deger: 1.5 },
    ],
  },
  yaz: {
    id: 'panayir', ikon: '🎡',
    sart: { bina: 'pazar', adet: 1 },
    bedel: { para: 50, yemek: 20 },
    etkiler: [
      { anahtar: 'ticaretSatisCarpani', islem: 'carp', deger: 1.25 },
      { anahtar: 'ticaretKota', islem: 'carp', deger: 2 },
    ],
    ekSure: 3,
  },
  sonbahar: {
    id: 'hasatSenligi', ikon: '🌾',
    bedel: { bugday: 40, yemek: 20 },
    etkiler: [{ anahtar: 'vergiCarpani', islem: 'carp', deger: 1.2 }],
  },
  kis: {
    id: 'kisSoleni', ikon: '🏮',
    bedel: { odun: 30, yemek: 30 },
    etkiler: [
      { anahtar: 'kisOdunCarpani', islem: 'carp', deger: 0.5 },
      { anahtar: 'evMutluluk', islem: 'ekle', deger: 4 },
    ],
  },
};

/** Etki süresi (gün) tabanı; karar kartı (Şenlikçi) uzatabilir. */
export const SENLIK_SURE = 5;
/** Bedel ölçeği: taban × (1 + nüfus / SENLIK_NUFUS_OLCEK). */
export const SENLIK_NUFUS_OLCEK = 150;

/** Bu anahtarlar şenlik etkisiyle değişebilir (arayüzde etki çipleri için). */
export type SenlikAnahtari = AyarAnahtari;
