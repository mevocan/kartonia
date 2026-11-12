import type { BuildingDef, BuildingType, Good, HouseLevelDef, RoadDef, RoadType } from '../logic/types';

// Denge değerleri. Hepsi ayarlanabilir.
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  ev: {
    type: 'ev', ad: 'Ev', aciklama: 'Sakinler yaşar ve vergi öder. İhtiyaçları karşılanınca büyür.',
    maliyet: 20, gider: 0, taban: 1.1, etki: 0, mutluluk: 0, isci: 0, acilmaNufus: 0,
    komsuluk: [{ kaynak: 'gol', mesafe: 5, mutluluk: 3, etiket: 'göl manzarası', sart: 'merkezi göle en fazla 5 birim' }],
  },
  agac: {
    type: 'agac', ad: 'Ağaç', aciklama: 'Yakındaki evleri mutlu eder. Oduncu ağaç ister.',
    maliyet: 5, gider: 0, taban: 0.5, etki: 4, mutluluk: 3, isci: 0, acilmaNufus: 0,
  },
  tarla: {
    type: 'tarla', ad: 'Tarla', aciklama: 'Buğday üretir.',
    maliyet: 25, gider: 1, taban: 2.2, etki: 0, mutluluk: 0, isci: 2, acilmaNufus: 0,
    uretim: { girdi: {}, cikti: { bugday: 6 } }, kisinUretmez: true,
    komsuluk: [{ kaynak: 'gol', mesafe: 4, kenardan: true, oran: 0.25, etiket: 'sulama', sart: 'kenarı göle en fazla 4 birim' }],
  },
  cesme: {
    type: 'cesme', ad: 'Çeşme', aciklama: 'Etki alanındaki evlere su verir.',
    maliyet: 30, gider: 1, taban: 0.8, etki: 7, mutluluk: 2, isci: 0, acilmaNufus: 0, saglar: 'su', yukseltilebilir: true,
  },
  degirmen: {
    type: 'degirmen', ad: 'Değirmen', aciklama: 'Buğdayı una çevirir. Biraz gürültülüdür.',
    maliyet: 50, gider: 2, taban: 1.4, etki: 4, mutluluk: -6, isci: 2, acilmaNufus: 12,
    uretim: { girdi: { bugday: 6 }, cikti: { un: 6 } },
    komsuluk: [{ kaynak: 'tepe', yukseklik: 1.0, oran: 0.25, etiket: 'rüzgâr', sart: 'tepede (yükseklik en az 1)' }],
  },
  firin: {
    type: 'firin', ad: 'Fırın', aciklama: 'Undan ekmek pişirir (yemek) ve etki alanındaki evlere yemek satar.',
    maliyet: 45, gider: 2, taban: 1.2, etki: 6, mutluluk: 0, isci: 2, acilmaNufus: 12, yemekSatar: true,
    uretim: { girdi: { un: 4 }, cikti: { yemek: 8 } },
    komsuluk: [{ kaynak: 'degirmen', mesafe: 6, oran: 0.25, etiket: 'taze un', sart: '6 birim içinde Değirmen' }],
  },
  oduncu: {
    type: 'oduncu', ad: 'Oduncu', aciklama: 'Etki alanındaki her ağaçtan odun toplar. Gürültülüdür.',
    maliyet: 40, gider: 2, taban: 1.2, etki: 6, mutluluk: -5, isci: 2, acilmaNufus: 35, agacBasinaOdun: 1,
  },
  pazar: {
    type: 'pazar', ad: 'Pazar', aciklama: 'Etki alanındaki evlere pazar erişimi verir ve stoktaki yemeği satar.',
    maliyet: 70, gider: 9, taban: 1.8, etki: 8, mutluluk: 3, isci: 3, acilmaNufus: 35, saglar: 'pazar', yemekSatar: true, yukseltilebilir: true,
  },
  okul: {
    type: 'okul', ad: 'Okul', aciklama: 'Etki alanındaki evlere eğitim ve mutluluk verir.',
    maliyet: 90, gider: 12, taban: 1.8, etki: 9, mutluluk: 5, isci: 3, acilmaNufus: 60, saglar: 'okul', yukseltilebilir: true,
  },
  saatKulesi: {
    type: 'saatKulesi', ad: 'Saat Kulesi', aciklama: 'Kasabanın simgesi. İskeleyle başlar, malzeme gönderildikçe dört aşamada yükselir; bitince geniş bir alana mutluluk yayar.',
    maliyet: 100, gider: 5, taban: 1.3, etki: 12, mutluluk: 12, isci: 1, acilmaNufus: 110, anit: true,
  },
  hastane: {
    type: 'hastane', ad: 'Hastane', aciklama: 'Etki alanındaki evlere sağlık hizmeti ve mutluluk verir.',
    maliyet: 120, gider: 15, taban: 1.9, etki: 9, mutluluk: 4, isci: 4, acilmaNufus: 80, saglar: 'saglik', yukseltilebilir: true,
  },
  ambar: {
    type: 'ambar', ad: 'Ambar', aciklama: 'Her malın stok sınırını 100 artırır.',
    maliyet: 60, gider: 1, taban: 1.6, etki: 0, mutluluk: 0, isci: 1, acilmaNufus: 25, depo: 100,
  },
  balikci: {
    type: 'balikci', ad: 'Balıkçı', aciklama: 'Göl kıyısına kurulur, balık tutar (yemek). Fırından az ama zincirsiz üretir.',
    maliyet: 35, gider: 1, taban: 1.0, etki: 0, mutluluk: 0, isci: 2, acilmaNufus: 10, yer: 'gol',
    uretim: { girdi: {}, cikti: { yemek: 3 } },
  },
  tasOcagi: {
    type: 'tasOcagi', ad: 'Taş Ocağı', aciklama: 'Taşlık alana kurulur, taş çıkarır. Taş, hizmet binası yükseltmelerinde kullanılır. Gürültülüdür.',
    maliyet: 45, gider: 2, taban: 1.5, etki: 5, mutluluk: -4, isci: 3, acilmaNufus: 30, yer: 'taslik',
    uretim: { girdi: {}, cikti: { tas: 4 } },
  },
  marangoz: {
    type: 'marangoz', ad: 'Marangoz', aciklama: 'Odundan mobilya yapar. İki katlı evler mobilya ister.',
    maliyet: 55, gider: 2, taban: 1.3, etki: 4, mutluluk: -2, isci: 2, acilmaNufus: 45,
    uretim: { girdi: { odun: 4 }, cikti: { mobilya: 4 } },
    komsuluk: [{ kaynak: 'oduncu', mesafe: 6, oran: 0.25, etiket: 'yakın odun', sart: '6 birim içinde Oduncu' }],
  },
};

export const BUILDING_ORDER: BuildingType[] = [
  'ev', 'agac', 'tarla', 'cesme', 'degirmen', 'firin', 'oduncu', 'balikci', 'tasOcagi', 'marangoz', 'ambar',
  'pazar', 'okul', 'hastane', 'saatKulesi',
];

export const HOUSE_LEVELS: HouseLevelDef[] = [
  { seviye: 1, nufus: 3, ihtiyaclar: [] },
  { seviye: 2, nufus: 6, ihtiyaclar: ['su', 'yemek'] },
  { seviye: 3, nufus: 10, ihtiyaclar: ['su', 'yemek', 'odun', 'pazar', 'okul', 'mobilya', 'saglik'] },
];

export const ROADS: Record<RoadType, RoadDef> = {
  toprak: {
    tur: 'toprak', ad: 'Toprak Yol', aciklama: 'Ucuz patika. Binalar yol kenarına kurulur.',
    birimMaliyet: 1, birimGider: 0, genislik: 1.0, mutluluk: 0, acilmaNufus: 0,
  },
  asfalt: {
    tur: 'asfalt', ad: 'Asfalt Yol', aciklama: 'Pahalı ama düzgün. Kenarındaki evler daha mutlu.',
    birimMaliyet: 3, birimGider: 0.1, genislik: 1.4, mutluluk: 5, acilmaNufus: 35,
  },
};

export const BALANCE = {
  baslangicPara: 150,
  gunSuresi: 15,
  zeminYaricap: 48,
  bosluk: 0.1,
  stokSinir: 200,
  yikimIadeOrani: 0.5,
  /** Kişi başı günlük yemek. */
  yemekKisiBasi: 0.25,
  odunKisiBasi: 0.2,
  /** Ev mutluluğunun tabanı; ev yokken kasabanın ortalama mutluluğu da budur. */
  mutlulukTaban: 45,
  /** Bir evi kapsayan ağaçların mutluluk toplamı en fazla bu kadar sayılır. */
  agacMutlulukSinir: 9,
  /** Evin mevcut seviyesinde karşılanan ihtiyaç başına mutluluk. */
  ihtiyacMutluluk: 2,
  mutlulukMin: 0,
  mutlulukMax: 100,
  /** Ev vergisi: floor(nüfus × (vergiTaban + mutluluk/100) × vergiSeviyeCarpani[seviye − 1]). */
  vergiTaban: 0.5,
  /** Ev seviyesine göre vergi çarpanı (1, 2, 3). 3. seviye ev kalabalık ama kişi başı daha az öder. */
  vergiSeviyeCarpani: [1, 1, 0.6],
  seviyeGunEsigi: 2,
  borcSiniri: -50,
  borcGunSiniri: 3,
  /** Bina, en yakın yol kenarına (merkez mesafesi − taban − yol yarı genişliği) en fazla bu kadar uzak olabilir. */
  yolYakinlik: 1.0,
  /** Fırça noktaları bu aralıkla yeniden örneklenir. */
  yolOrnekAraligi: 0.75,
  /** Yol ucu, mevcut bir yolun orta çizgisine bu mesafedeyse ona kenetlenir. */
  yolKenetlenme: 1.5,
  yolMinUzunluk: 1.5,
  /** Bina tabanı üzerindeki en yüksek ve en alçak nokta farkı sınırı. */
  egimSiniri: 0.6,
  dogalAgacKesimMaliyeti: 2,
  dogalAgacKesimOdun: 2,
  /** Hizmet binası yükseltmesi: seviye 1, 2, 3 için çarpanlar (indeks = seviye − 1). */
  yukseltme: {
    etki: [1, 1.4, 1.8],
    gider: [1, 1.5, 2],
    /** O seviyeye çıkmanın maliyeti, kurulum maliyetine oranla (seviye 1 kurulumun kendisidir). */
    maliyet: [0, 0.6, 1.0],
    /** O seviyeye çıkmak için gereken taş (taş ocağından). */
    tas: [0, 10, 25],
  },
  /** Seviye 3 evlerde kişi başı günlük mobilya. */
  mobilyaKisiBasi: 0.1,
  /** Balıkçı: taban kenarı göle en fazla bu kadar uzak olabilir. */
  golKiyisi: 1.5,
  /**
   * Anıt projesi (anit: true binalar, Saat Kulesi). Yerleştirme BUILDINGS.maliyet kadar (iskele);
   * sonra her aşama bilgi panelindeki "Malzeme gönder" ile para + mal ister. Aura, gider ve hedef
   * yalnızca bütün aşamalar bitince geçerlidir. Yıkımda harcanan paranın yarısı döner, mallar dönmez.
   */
  anit: {
    asamalar: [
      { para: 100, mal: { tas: 20 } },
      { para: 100, mal: { odun: 30 } },
      { para: 150, mal: { mobilya: 20 } },
      { para: 200, mal: { tas: 30, mobilya: 20 } },
    ] as { para: number; mal: Partial<Record<Good, number>> }[],
  },
  /**
   * Gezgin tüccar (logic/trade.ts): her `aralik` günde bir gelir (ilk geliş `aralik`. gün), o gün kalır.
   * Fiyatlar sabit: `sat` oyuncunun sattığı, `al` oyuncunun aldığı birim fiyat. Ziyaret başına alım + satım
   * toplamı `kota` birim. Satış fiyatı alıştan belirgin düşük: tüccar para basma yolu değil, takas aracıdır.
   */
  ticaret: {
    aralik: 6,
    kota: 40,
    fiyat: {
      bugday: { sat: 1, al: 3 },
      un: { sat: 2, al: 5 },
      yemek: { sat: 2, al: 6 },
      odun: { sat: 2, al: 5 },
      tas: { sat: 3, al: 8 },
      mobilya: { sat: 6, al: 15 },
    } as Record<Good, { sat: number; al: number }>,
  },
  /**
   * Sakin istekleri (logic/requests.ts). Nüfus `nufusEsigi`ni geçince, aynı anda en fazla bir istek;
   * biri bittikten `bekleme` gün sonra yenisi. Süre `sure` gün; dolarsa cezasız kalkar.
   */
  istek: {
    nufusEsigi: 10,
    bekleme: 3,
    sure: 4,
    senlikYemek: 30,
    senlikMutluluk: 5,
    senlikGun: 3,
    agacSayisi: 5,
    agacOdul: 40,
    kisOdun: 40,
    kisOdul: 60,
    suOdul: 30,
  },
  /** Mevsimler (logic/season.ts): yıl = İlkbahar, Yaz, Sonbahar, Kış gün sayıları. */
  mevsim: {
    gunler: [5, 5, 5, 3],
    /** Kışın 3. seviye evlerin odun tüketimi bu kat. */
    kisOdunCarpani: 2,
  },
} as const;
