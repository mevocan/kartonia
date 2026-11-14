// Kağıt Kasaba — ortak tipler ve mantık API sözleşmesi.
// Bu dosya mantık, çizim ve arayüz arasındaki sözleşmedir. Değiştirmeden önce bütün katmanları düşün.
import type { AyarAnahtari, KartEtkisi } from '../data/cards';
import type { Mevsim } from './season';

/** Süreli etki: ayar anahtarına `islem` ile `deger` uygular, bitisGun dahil. */
export interface GeciciEtki {
  anahtar: AyarAnahtari;
  islem: 'ekle' | 'carp';
  deger: number;
  bitisGun: number;
  /** Kaynağı (arayüzde çip için): 'ziyafet' ya da 'senlik.<mevsim>'. */
  kaynak: string;
}

export type BuildingType =
  | 'ev'
  | 'agac'
  | 'tarla'
  | 'cesme'
  | 'degirmen'
  | 'firin'
  | 'oduncu'
  | 'pazar'
  | 'okul'
  | 'saatKulesi'
  | 'hastane'
  | 'ambar'
  | 'balikci'
  | 'tasOcagi'
  | 'marangoz'
  | 'agil'
  | 'dokumaci'
  | 'arilik'
  | 'cicek'
  | 'park'
  | 'hamam'
  | 'tiyatro'
  // Süsler (yol istemez, mutlulukları bir eve en fazla BALANCE.susMutlulukSinir sayılır)
  | 'bank'
  | 'lamba'
  | 'cit'
  | 'ciceklik'
  | 'heykel'
  // Büyük projeler (anıt; Saat Kulesi bitince açılır)
  | 'kervansaray'
  | 'botanik'
  // Mahalle meydanı: karakteri (Çarşı / Bahçeli / Zanaat) etki alanına uygulanır
  | 'meydan';

/** 'yemek' ortak yemek stoğudur: fırın, balıkçı (ve ileride başka yemek binaları) farklı miktarlarda üretir. */
export type Good = 'bugday' | 'un' | 'yemek' | 'odun' | 'tas' | 'mobilya' | 'yun' | 'kumas' | 'bal';

/** 'yemek' ihtiyacı: bir yemek satış yerinin (fırın, pazar) etki alanında olmak + stokta yeterli yemek. */
export type Need = 'su' | 'yemek' | 'odun' | 'pazar' | 'okul' | 'mobilya' | 'saglik' | 'kumas' | 'bal' | 'hamam' | 'kultur';

export interface BuildingDef {
  type: BuildingType;
  ad: string;
  aciklama: string;
  maliyet: number;
  /** Günlük para gideri. */
  gider: number;
  /** Dairesel taban yarıçapı (dünya birimi). Çakışma ve model boyutu buna göre. */
  taban: number;
  /** Etki yarıçapı (su, pazar, okul, mutluluk aurası, oduncu ağaç arama). 0 = yok. */
  etki: number;
  /** Etki alanındaki evlere eklenen mutluluk (eksi olabilir). */
  mutluluk: number;
  /** Gereken işçi sayısı. */
  isci: number;
  /** Günlük üretim: girdi tüketilir, çıktı üretilir (tam işçi ve tam girdiyle). */
  uretim?: { girdi: Partial<Record<Good, number>>; cikti: Partial<Record<Good, number>> };
  /** Sadece oduncu: etki alanındaki ağaç başına günlük odun. */
  agacBasinaOdun?: number;
  /** Bu bina, etki alanındaki evlere bu ihtiyacı sağlar. */
  saglar?: Need;
  /** Açılması için gereken nüfus. */
  acilmaNufus: number;
  /** Yer şartı: 'gol' göl kıyısında (BALANCE.golKiyisi), 'taslik' haritadaki bir taşlık alanın içinde. */
  yer?: 'gol' | 'taslik';
  /** Fırın, pazar: etki alanındaki evlere yemek satar (evin 'yemek' ihtiyacının yer şartı). */
  yemekSatar?: boolean;
  /** Ambar: stok sınırına eklenen miktar. */
  depo?: number;
  /** Hizmet binası: yerinde yükseltilir, etki alanı ve gideri büyür (BALANCE.yukseltme). */
  yukseltilebilir?: boolean;
  /** Anıt (Saat Kulesi, büyük projeler): iskeleyle kurulur, aşamalarla tamamlanır (anitAsamalar ya da BALANCE.anit.asamalar). */
  anit?: boolean;
  /** Anıtın aşamaları (yoksa BALANCE.anit.asamalar). */
  anitAsamalar?: { para: number; mal: Partial<Record<Good, number>> }[];
  /** Anıt tamamlanınca kalıcı ayar etkileri (ayar() okur). */
  anitEtkileri?: KartEtkisi[];
  /** Bu anıt tamamlanmadan açılmaz (nüfus eşiğine ek olarak). */
  acilmaAnit?: BuildingType;
  /** Kasabada yalnızca bir tane olabilir. */
  tek?: boolean;
  /** Süs: yol istemez, patikası yoktur; mutluluğu bir eve en fazla BALANCE.susMutlulukSinir sayılır. */
  sus?: boolean;
  /** Kışın üretmez (Tarla). */
  kisinUretmez?: boolean;
  /** Komşuluk bonusları (logic/adjacency.ts): yerine göre üretim ya da mutluluk artışı. */
  komsuluk?: KomsulukDef[];
}

/**
 * Bir komşuluk kuralı. Şart tutarsa üretim binasında çıktı `oran` kadar artar (0.25 = +%25),
 * evde `mutluluk` eklenir.
 *   kaynak 'gol':  göle uzaklık ≤ mesafe (kenardan: taban kenarından, değilse merkezden).
 *   kaynak 'tepe': merkezde arazi yüksekliği ≥ yukseklik.
 *   kaynak bina türü: o türden bir binanın merkezi ≤ mesafe (merkezden merkeze).
 */
export interface KomsulukDef {
  kaynak: 'gol' | 'tepe' | BuildingType;
  mesafe?: number;
  kenardan?: boolean;
  yukseklik?: number;
  oran?: number;
  mutluluk?: number;
  /** Kısa ad: "sulama", "rüzgâr", "taze un", "göl manzarası". */
  etiket: string;
  /** Şartın açıklaması (bilgi panelinde, bonus yokken): "göle 4 birim yakın". */
  sart: string;
}

/** Bir komşuluk kuralının bir konumdaki durumu. */
export interface KomsulukDurum {
  etiket: string;
  sart: string;
  aktif: boolean;
  oran: number;
  mutluluk: number;
}

export interface HouseLevelDef {
  seviye: 1 | 2 | 3 | 4 | 5;
  nufus: number;
  ihtiyaclar: Need[];
}

export type { Vec2 } from '../data/map';
import type { Vec2 } from '../data/map';

export type RoadType = 'toprak' | 'asfalt';

export interface RoadDef {
  tur: RoadType;
  ad: string;
  aciklama: string;
  /** Birim uzunluk başına maliyet (toplam yukarı yuvarlanır). */
  birimMaliyet: number;
  /** Birim uzunluk başına günlük gider (toplam aşağı yuvarlanır). */
  birimGider: number;
  /** Yol genişliği (dünya birimi). */
  genislik: number;
  /** Bu yolun yakınındaki evlere mutluluk (ev en iyi yakın yolun değerini alır). */
  mutluluk: number;
  acilmaNufus: number;
}

/** Fırçayla çizilmiş tek yol parçası: yeniden örneklenmiş çoklu çizgi. */
export interface Road {
  id: number;
  tur: RoadType;
  noktalar: Vec2[];
}

export interface RoadPlan {
  ok: boolean;
  sebep?: PlaceFailReason;
  /** Yeniden örneklenmiş ve uçları mevcut yollara kenetlenmiş noktalar (önizleme bunları çizer). */
  noktalar: Vec2[];
  uzunluk: number;
  maliyet: number;
}

export interface RoadInfo {
  id: number;
  tur: RoadType;
  uzunluk: number;
  gider: number;
  yikimIadesi: number;
  /** Bir bina yol yakınlığını yalnızca bu yoldan alıyorsa false. */
  silinebilir: boolean;
}

export interface Building {
  id: number;
  type: BuildingType;
  /** Haritayla gelen orman ağacı ya da çayır çiçeği. Ağacı kesmek para ister, odun verir; çiçek bedavadır. */
  dogal?: boolean;
  /** Ağaç dışı binalar: kapıdan yola giden patikanın yol üzerindeki ucu (en yakın yol noktası) ve o yolun id'si. */
  baglanti?: { x: number; z: number; yol: number } | null;
  x: number;
  z: number;
  /** Radyan, Y ekseni etrafında. */
  rot: number;
  /** Evler 1–5, yükseltilebilir hizmet binaları 1–3, diğerleri hep 1. */
  seviye: number;
  /** Üst seviye ihtiyaçlarının üst üste karşılandığı gün sayısı. */
  iyiGun: number;
  /**
   * Anıt inşaatı: kalan aşama sayısı. Alan yoksa bina tamamdır (eski kayıtlardaki kuleler de).
   * İnşaat sürerken aura, gider ve hedef sayılmaz.
   */
  insaat?: number;
  /** Mevcut seviye ihtiyaçlarının üst üste karşılanmadığı gün sayısı. */
  kotuGun: number;
  /** Meydan: seçilen mahalle karakteri (logic/meydan.ts). Seçilmeden etkisizdir. */
  karakter?: 'carsi' | 'bahceli' | 'zanaat';
}

export interface GameState {
  gun: number;
  /** 0..1, içinde bulunulan günün ilerlemesi. */
  gunIlerleme: number;
  para: number;
  nufus: number;
  mutluluk: number;
  stok: Record<Good, number>;
  binalar: Building[];
  yollar: Road[];
  /** Bina ve yollar ortak id sayacını kullanır. */
  sonrakiId: number;
  /** Paranın üst üste −50 altında bittiği gün sayısı. */
  borcGunu: number;
  bitti: boolean;
  /** Tamamlanan hedef sayısı (GOALS dizisindeki indeks). */
  hedef: number;
  /** Bugüne kadar üretilen toplam yemek (hedef için). */
  toplamYemek: number;
  /** Rastgele haritanın tohumu. Yoksa klasik (elle yapılmış) harita. */
  haritaTohum?: number;
  /** Haritanın çayırlarına doğal çiçekler ekildi (çiçek öncesi kayıtlarda yüklenirken ekilir). */
  cayirlar?: boolean;
  /** Gezgin tüccar: bu ziyarette kullanılan alım + satım birimi. Gün sonunda sıfırlanır. */
  tuccarKota?: number;
  /** Etkin sakin isteği (en fazla bir). */
  istek?: Istek;
  /** Bir sonraki isteğin en erken gelebileceği gün (bir istek bitince bekleme süresi). */
  sonrakiIstekGunu?: number;
  /** Eski biçim (ziyafet ödülü); yüklenirken `etkiler`e taşınır. */
  geciciMutluluk?: { deger: number; bitisGun: number };
  /** Süreli etkiler (mevsim şenlikleri, ziyafet): ayar() bitisGun dahil uygular, gün sonunda süresi biten kalkar. */
  etkiler?: GeciciEtki[];
  /** Mevsim şenliklerinin en son yapıldığı yıl (yılda bir kez). */
  senlikYili?: Partial<Record<Mevsim, number>>;
  /** Tüccarın bıraktığı sipariş: `ziyaret` numaralı gelişte teslim edilirse normal fiyatın üstü ödenir. */
  tuccarSiparis?: { mal: Good; miktar: number; ziyaret: number };
  /** Bir önceki sakin isteğinin türü (aynı tür art arda gelmez). */
  sonIstekTuru?: IstekTuru;
  /** Seçilmiş karar kartlarının id'leri (seçim sırasıyla, kalıcı). Eski kayıtta yok = boş. */
  kararlar?: string[];
  /** Kart seçimi bekleyen seçim numaraları (0: 50. gün, 1: 100. gün, 2: 150. gün). Seçilene kadar oyun duraklar. */
  bekleyenKararlar?: number[];
  /** Kasaba günlüğü (logic/gunluk.ts). Eski kayıtta yok: yüklenirken gunlukGocu ile başlar. */
  gunluk?: GunlukKaydi[];
  /** İçinde bulunulan yılın sayaçları (gazete için); yıl sonunda silinir. */
  yil?: { yil: number; nufusBasi: number; kurulanBina: number; vergi: number; yemek: number };
  /** Çıkan yıl sonu gazeteleri (yalnızca sayılar). */
  gazeteler?: Gazete[];
}

export type GunlukTur =
  | 'ilkEv' | 'ilkYemek' | 'ilkTuccar' | 'ilkKis' | 'nufus' | 'evSeviye' | 'kule' | 'kuleTamam' | 'kart' | 'senlik'
  | 'hedef' | 'gazete' | 'gunlukBasladi' | 'festival' | 'projeTamam' | 'unvan';

export interface GunlukKaydi {
  gun: number;
  tur: GunlukTur;
  /** nufus: eşik; evSeviye: seviye; kule: tamamlanan aşama; kart: kart id; hedef: hedef indeksi; gazete: yıl. */
  veri?: number | string;
  /** Günlükten önce olmuş an (eski kayıt göçü): yalnızca tekrar yazılmasın diye durur, gösterilmez. */
  gizli?: true;
}

/** Yıl sonu gazetesi (Kartonia Postası): yılın sayıları ve manşeti. */
export interface Gazete {
  yil: number;
  /** Çıktığı gün (yılın son günü). */
  gun: number;
  nufusBasi: number;
  nufusSon: number;
  kurulanBina: number;
  vergi: number;
  yemek: number;
  /** Yılın en önemli günlük kaydı (yoksa null). */
  manset: GunlukKaydi | null;
  enMutluEv: { id: number; seviye: number; mutluluk: number } | null;
  /** Gazete çıktığında sıradaki hedefin indeksi (ipucu için). */
  hedef: number;
  /** Kasabanın o günkü unvanı (eski gazetelerde yok). */
  unvan?: number;
}

export type PlaceFailReason =
  | 'disarida'     // ada dışında
  | 'gol'          // göle taşıyor
  | 'egim'         // taban üzerindeki yükseklik farkı egimSiniri'ni aşıyor
  | 'cakisiyor'    // başka bina/ağaç ile çakışıyor
  | 'yol'          // bina yolun üstüne taşıyor / yol binanın üstünden geçiyor
  | 'yolYok'       // bina (ağaç hariç) bir yolun kenarında değil
  | 'baglantisiz'  // yolun iki ucu da mevcut bir yola kenetlenmiyor
  | 'kisa'         // yol çok kısa
  | 'golYok'       // göl kıyısında olmalı (balıkçı)
  | 'taslikYok'    // taşlık alanda olmalı (taş ocağı)
  | 'tas'          // yükseltmeye / anıta taş yetmiyor
  | 'odun'         // anıta odun yetmiyor
  | 'mobilya'      // anıta mobilya yetmiyor
  | 'kumas'        // anıta kumaş yetmiyor
  | 'bal'          // anıta bal yetmiyor
  | 'tek'          // bu binadan kasabada zaten var
  | 'meydanCakisiyor' // başka bir Meydan'ın alanıyla çakışıyor
  | 'bahceli'      // Bahçeli Meydan'ın alanına üretim binası konamaz
  | 'para'
  | 'kilitli'
  | 'bitti';

export interface PlaceCheck {
  ok: boolean;
  sebep?: PlaceFailReason;
}

export interface LevelChange {
  id: number;
  eski: number;
  yeni: number;
}

export interface DayReport {
  gun: number;
  /** Bütün evlerin vergi toplamı. */
  vergi: number;
  /** Toplam gider (binaGider + yolGider). */
  gider: number;
  binaGider: number;
  yolGider: number;
  /** vergi − gider: kasaya eklenen. */
  net: number;
  /** Ev başına vergi (uçan sayılar için). */
  binaVergileri: { id: number; miktar: number }[];
  uretilen: Record<Good, number>;
  tuketilen: Record<Good, number>;
  seviyeDegisimleri: LevelChange[];
  /** Bu gün tamamlanan hedeflerin indeksleri. */
  yeniHedefler: number[];
  /** Tamamlanan hedeflerin kasaya eklenen toplam ödülü (vergi ve net bunu içermez). */
  hedefOdulu: number;
  /** Mutluluğu büyüme eşiğinin altında olduğu için büyüyemeyen evler (en üst seviye hariç; harita iğneleri için). */
  mutsuzEvler: number[];
  /** Yılın son günüyse çıkan gazete. */
  gazete?: Gazete;
  /** Bu gün sonunda gelen yeni sakin isteği. */
  yeniIstek?: IstekTuru;
  /** Bu gün sonunda tamamlanan istek (Şenlik hariç: o düğmeyle hemen tamamlanır). */
  tamamlananIstek?: IstekSonuc;
  /** Bu gün açılan bina türleri. */
  yeniAcilanlar: BuildingType[];
  /** Günü yarıdan az verimle geçiren üretim binaları ve nedeni (harita iğneleri için). */
  uretimSorunlari: UretimSorunu[];
  /**
   * Gün sonundaki gerçek dağıtımda mevcut seviyesinin bir stok ihtiyacı (yemek, odun, mobilya, kumaş, bal)
   * karşılanmayan evler ve ilk eksik mal (harita iğneleri için; ortak stok id sırasıyla paylaşılır).
   */
  evStokEksikleri: { id: number; neden: Need }[];
  oyunBitti: boolean;
}

/** Bir üretim binasının verimsiz gün nedeni: eksik girdi malı, dolu depo ya da ağaçsız oduncu. */
export interface UretimSorunu {
  id: number;
  neden: Good | 'depo' | 'agac';
}

/**
 * Haritada bina üstünde gösterilecek iğne. 'ihtiyac': evin mevcut seviyesinin karşılanmayan ihtiyacı
 * (sürerse ev küçülür). 'uretim': son gün sonundaki üretim sorunu. 'mutsuz': ev mutluluğu büyüme eşiğinin altında
 * (son gün sonundan; ihtiyaç iğnesi olan evde gösterilmez).
 */
export type BinaIgnesi =
  | { id: number; tur: 'ihtiyac'; neden: Need }
  | { id: number; tur: 'uretim'; neden: UretimSorunu['neden'] }
  | { id: number; tur: 'mutsuz' };

export interface NeedStatus {
  ihtiyac: Need;
  karsilandi: boolean;
}

export interface BuildingInfo {
  id: number;
  type: BuildingType;
  seviye: number;
  /** Evler için. */
  nufus?: number;
  mutluluk?: number;
  tahminiVergi?: number;
  /** Evler: mevcut + bir üst seviyenin ihtiyaçları ve durumu. */
  ihtiyaclar?: NeedStatus[];
  /** Üretim binaları: işçi oranı 0..1. */
  isciOrani?: number;
  /** Oduncu: etki alanındaki ağaç sayısı. */
  agacSayisi?: number;
  gider: number;
  yikimIadesi: number;
  /** Seviyeye göre etki yarıçapı (0 = yok). */
  etki: number;
  /** Yükseltilebilir binalar: bir sonraki seviye; en üst seviyede null. Diğer binalarda tanımsız. */
  yukseltme?: { maliyet: number; tas: number; etki: number; gider: number } | null;
  /** Orman ağacı: kesim maliyeti ve verdiği odun (yikimIadesi 0). */
  dogal?: boolean;
  kesimMaliyeti?: number;
  kesimOdun?: number;
  /** Ev: yakınındaki en iyi yol türü. */
  yol?: RoadType | null;
  /** Komşuluk kuralı olan binalar: her kuralın şu anki durumu (aktif ya da değil). */
  komsuluk?: KomsulukDurum[];
  /** Anıt: tamamlanan aşama / toplam ve sıradaki aşamanın maliyeti (bittiyse null). Diğer binalarda tanımsız. */
  anit?: { asama: number; toplam: number; sonraki: { para: number; mal: Partial<Record<Good, number>> } | null };
  /** Kışın üretmeyen bina şu an kışta: üretim durdu. */
  kisinDurdu?: boolean;
  /**
   * Üretim binaları: bugünkü işçi oranı ve komşuluk bonusuyla beklenen günlük girdi ve çıktı (girdi stoğu
   * yetmezse gerçek üretim düşer; `stok` o malın şu anki stoğu). Oduncu: girdi yok, çıktı ağaç sayısından.
   */
  uretimTahmini?: { girdi: { mal: Good; miktar: number; stok: number }[]; cikti: { mal: Good; miktar: number }[] };
  /** Etki alanı olan bina (ev ve doğa hariç): alanındaki ev sayısı. */
  kapsananEv?: number;
  /** Ev: üst seviye ihtiyaçlarının üst üste karşılandığı / mevcut seviyeninkilerin karşılanmadığı gün ve eşikleri. */
  evGun?: { iyi: number; kotu: number; buyumeEsik: number; kuculmeEsik: number };
  /** Meydan: seçili karakter (yoksa tanımsız) ve karakter değiştirme bedeli. */
  meydan?: { karakter?: 'carsi' | 'bahceli' | 'zanaat'; degisim: number; kapsananBina: number };
  /** Binanın bulunduğu Meydan'ın karakteri (ev ve üretim binasında, etkisi varsa). */
  mahalle?: 'carsi' | 'bahceli' | 'zanaat';
  /** Üretim binası: bu mevsimin üretim çarpanı (yalnızca etkisi olan mevsimde). */
  mevsimCarpani?: number;
  /** Ev: mutluluğu büyüme eşiğinin altında, bu yüzden büyüyemez (en üst seviyede tanımsız). */
  mutsuz?: boolean;
}

export interface GoalDef {
  ad: string;
  aciklama: string;
  /** Tamamlanınca kasaya eklenen para. */
  odul: number;
}

/*
 * Mantık API'si (src/logic/game.ts bunları dışa verir):
 *
 *   createGame(haritaTohum?): GameState                   // tohumdan rastgele harita (yoksa klasik); başlangıç yolu + ormanlar
 *   isUnlocked(s: GameState, t: BuildingType): boolean
 *   canPlace(s: GameState, t: BuildingType, x: number, z: number): PlaceCheck
 *   placeBuilding(s, t, x, z, rot): Building | null      // parayı düşer
 *   upgradeCost(b): number | null ; canUpgrade(s, id): PlaceCheck ; upgradeBuilding(s, id): number | null
 *   effectRadius(b): number ; buildingUpkeep(b): number   // seviyeye göre etki yarıçapı ve gider
 *   demolish(s, id): number | null                       // iade miktarı (doğal ağaçta: −kesimMaliyeti, odun eklenir), binayı siler
 *
 *   Arazi (src/logic/terrain.ts, saf; çizim katmanı da import eder):
 *   heightAt(x, z): number ; isLand(x, z): boolean ; isLake(x, z): boolean
 *
 *   Yollar (src/logic/roads.ts):
 *   isRoadUnlocked(s, tur): boolean
 *   planRoad(s, tur, hamNoktalar: Vec2[]): RoadPlan      // fırça noktaları → örnekle, kenetle, doğrula
 *   placeRoad(s, tur, hamNoktalar): Road | null
 *   demolishRoad(s, id): number | null                    // silinebilir değilse null
 *   getRoadInfo(s, id): RoadInfo | null
 *   nearestRoad(s, x, z): { id: number; tur: RoadType; x: number; z: number; mesafe: number } | null
 *
 *   tick(s, dtSaniye): DayReport | null                   // gunIlerleme'yi ilerletir, gün dolunca endDay
 *   endDay(s): DayReport
 *   getBuildingInfo(s, id): BuildingInfo | null
 *   housesInRange(s, id): number[]                         // bir binanın etki alanındaki ev id'leri
 *   serialize(s): string ; deserialize(json): GameState    // save.ts
 *
 *   Sabitler: GUN_SURESI (15), ZEMIN_YARICAP (48), BOSLUK (0.1), STOK_SINIR (200, ambarsız taban sınır)
 *   stockLimit(s): number   // 200 + ambar başına depo
 *   GOALS: GoalDef[]  (goals.ts)
 */

/** Sakin isteği türleri (logic/requests.ts). */
/** 'senlik' arayüzde "Ziyafet" adıyla görünür (kayıt uyumu için kimlik değişmedi). */
export type IstekTuru =
  | 'senlik' | 'agaclandirma' | 'kisHazirligi' | 'susuzEv' | 'park' | 'golEvi' | 'cicekDik' | 'gurultu' | 'mobilya'
  | 'asfaltEv' | 'erzak' | 'yukseltme';

export interface Istek {
  tur: IstekTuru;
  /** İsteğin geldiği ilk gün. Süre: baslangicGun .. baslangicGun + sure − 1. */
  baslangicGun: number;
  /** Sayaç türleri: dikilen ağaç / çiçek; stok türleri: stoktaki mal; diğerleri 0/1. */
  ilerleme: number;
  /** Susuz ev / gürültülü ev: kurtarılması istenen ev. */
  hedefBinaId?: number;
  /** Artış türleri (park, golEvi, asfaltEv, yukseltme): istek geldiğindeki sayı. */
  baz?: number;
  /** İsteyen sakinin ad sırası (dil dosyasındaki `sakin.adlar` listesinde). Eski kayıtta yok. */
  sakin?: number;
}

export interface IstekSonuc {
  tur: IstekTuru;
  /** Verilen para ödülü (Şenlik'te 0: ödülü geçici mutluluktur). */
  para: number;
}
