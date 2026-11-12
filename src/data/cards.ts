// Karar kartları: belirli hedefler tamamlanınca üç kart gösterilir, oyuncu birini seçer (kalıcı).
// Her kartın bir artısı ve bir eksisi vardır. Etkiler `ayar` anahtarları üzerinden uygulanır
// (logic/cards.ts → ayar(s, anahtar)); ekonomi kodunda karta özel `if` yoktur.
import type { BuildingType, Good } from '../logic/types';

/** Kartların değiştirebildiği değerler. Tabanları BALANCE / BUILDINGS içindedir (logic/cards.ts → tabanDeger). */
export type AyarAnahtari =
  | `uretim.${BuildingType}.${Good}` // binanın günlük çıktısı
  | `mutluluk.${BuildingType}` // binanın etki alanındaki evlere mutluluk
  | `gider.${BuildingType}` // binanın taban günlük gideri
  | `depo.${BuildingType}` // ambarın stok sınırına eklediği
  | 'odunKisiBasi'
  | 'evMutluluk' // bütün evlere sabit mutluluk (taban 0)
  | 'vergiCarpani' // ev vergisi çarpanı (taban 1)
  | 'seviyeAtlamaGun' // evin bir üst seviyeye geçmesi için üst üste iyi gün
  | 'yukseltmeTasCarpani' // hizmet yükseltmesinin taş maliyeti çarpanı (taban 1)
  | 'agacMutlulukSinir'
  | 'oduncuCarpani' // oduncu üretim çarpanı (taban 1)
  | 'ticaretKota';

export interface KartEtkisi {
  anahtar: AyarAnahtari;
  /** 'ekle': taban + deger; 'carp': taban × deger. */
  islem: 'ekle' | 'carp';
  deger: number;
}

export interface KararKarti {
  id: string;
  ad: string;
  ikon: string;
  arti: string;
  eksi: string;
  etkiler: KartEtkisi[];
}

export const KARTLAR: KararKarti[] = [
  {
    id: 'balikciKasabasi', ad: 'Balıkçı kasabası', ikon: '🐟',
    arti: 'Balıkçı +2 yemek', eksi: 'Tarla −1 buğday',
    etkiler: [
      { anahtar: 'uretim.balikci.yemek', islem: 'ekle', deger: 2 },
      { anahtar: 'uretim.tarla.bugday', islem: 'ekle', deger: -1 },
    ],
  },
  {
    id: 'odunTasarrufu', ad: 'Odun tasarrufu', ikon: '🔥',
    arti: 'Evlerin odun tüketimi −%30', eksi: 'Bütün evlere −5 mutluluk',
    etkiler: [
      { anahtar: 'odunKisiBasi', islem: 'carp', deger: 0.7 },
      { anahtar: 'evMutluluk', islem: 'ekle', deger: -5 },
    ],
  },
  {
    id: 'agirVergi', ad: 'Ağır vergi', ikon: '💰',
    arti: 'Vergi +%15', eksi: 'Evler 2 yerine 3 iyi günde büyür',
    etkiler: [
      { anahtar: 'vergiCarpani', islem: 'carp', deger: 1.15 },
      { anahtar: 'seviyeAtlamaGun', islem: 'ekle', deger: 1 },
    ],
  },
  {
    id: 'tasUstalari', ad: 'Taş ustaları', ikon: '⚒️',
    arti: 'Yükseltmelerin taş maliyeti −%40', eksi: 'Taş Ocağı gürültüsü −4 yerine −8',
    etkiler: [
      { anahtar: 'yukseltmeTasCarpani', islem: 'carp', deger: 0.6 },
      { anahtar: 'mutluluk.tasOcagi', islem: 'ekle', deger: -4 },
    ],
  },
  {
    id: 'yesilKasaba', ad: 'Yeşil kasaba', ikon: '🌳',
    arti: 'Ağaç mutluluk tavanı +6', eksi: 'Oduncu üretimi −%25',
    etkiler: [
      { anahtar: 'agacMutlulukSinir', islem: 'ekle', deger: 6 },
      { anahtar: 'oduncuCarpani', islem: 'carp', deger: 0.75 },
    ],
  },
  {
    id: 'tuccarDostu', ad: 'Tüccar dostu', ikon: '🛒',
    arti: 'Tüccar takas hakkı 40 yerine 70', eksi: 'Pazar gideri 2 katı',
    etkiler: [
      { anahtar: 'ticaretKota', islem: 'ekle', deger: 30 },
      { anahtar: 'gider.pazar', islem: 'carp', deger: 2 },
    ],
  },
  {
    id: 'sessizDegirmen', ad: 'Sessiz değirmen', ikon: '🤫',
    arti: 'Değirmen gürültüsü 0', eksi: 'Değirmen −1 un',
    etkiler: [
      { anahtar: 'mutluluk.degirmen', islem: 'carp', deger: 0 },
      { anahtar: 'uretim.degirmen.un', islem: 'ekle', deger: -1 },
    ],
  },
  {
    id: 'buyukAmbar', ad: 'Büyük ambar', ikon: '🏚️',
    arti: 'Ambar +100 yerine +200', eksi: 'Ambar gideri 1 yerine 3',
    etkiler: [
      { anahtar: 'depo.ambar', islem: 'ekle', deger: 100 },
      { anahtar: 'gider.ambar', islem: 'ekle', deger: 2 },
    ],
  },
];

/** Bir seferde gösterilen kart sayısı. */
export const KART_SECENEK = 3;
