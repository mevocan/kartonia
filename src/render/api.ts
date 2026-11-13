import type { BuildingType, RoadType, Vec2 } from '../logic/types';
import type { Mevsim } from '../logic/season';

// Çizim katmanının arayüze verdiği sözleşme. Uygulaması: src/render/renderer.ts → createRenderer().
// Dünya: X-Z düzlemi, Y yukarı. Arazi data/map.ts'deki ada; yükseklik logic/terrain.ts heightAt(x,z).
// Binalar ve yollar arazi yüksekliğine oturur. Doğal ağaçlar normal 'agac' binası olarak addBuilding ile gelir.

/** Harita iğnesinin türü: 'uyari' ev ihtiyacı karşılanmıyor, 'bilgi' üretim duruyor. */
export type PinTur = 'uyari' | 'bilgi';

export interface GameRenderer {
  /** Sağ sürükle döndür, orta / Shift+sağ sürükle kaydır, tekerlek yakınlaş. Kendi dinleyicilerini canvas'a takar. */
  readonly canvas: HTMLCanvasElement;

  /**
   * Bina ekler. anim=true (varsayılan): kağıt maket gibi parça parça katlanarak kurulur.
   * anim=false: anında görünür (kayıt yükleme, oyun başı ormanları).
   */
  addBuilding(
    id: number, type: BuildingType, x: number, z: number, rot: number, seviye: number,
    anim?: boolean, baglanti?: Vec2 | null,
  ): void;
  /**
   * Binanın kapısından (ön yüz, +z yerel) yol üzerindeki baglanti noktasına giden kısa kağıt patika.
   * null ise patika kaldırılır. addBuilding de baglanti verilirse aynı patikayı çizer (animasyonda patika da serilir).
   */
  setBuildingLink(id: number, baglanti: Vec2 | null): void;
  /**
   * Kasabanın canlılığı: nüfus ve gün ilerledikçe çağrılır. Sahnedeki yürüyen insan sayısı ve
   * ortam hareketleri (duman, kuşlar vb.) buna göre ölçeklenir. Mantığa etkisi yoktur.
   */
  setPopulation(nufus: number): void;
  /** Katlanıp yatma animasyonu, sonra sahneden siler. */
  removeBuilding(id: number): void;
  /** Ev ya da yükseltilebilir hizmet binasının seviyesi değişti: model yeni seviyeyle katlanarak yeniden kurulur. */
  setBuildingLevel(id: number, seviye: number): void;
  /**
   * Anıt (Saat Kulesi) inşaat aşaması: 0 = yalnızca taban + iskele, 1 = gövdenin alt yarısı,
   * 2 = gövdenin üst yarısı, 3 = saat ve balkon, 4 = çatı ve bayrak (tamam, iskele yok).
   * anim=true (varsayılan): yeni aşamanın parçaları mevcut katlanma animasyonuyla kurulur; 4'e geçişte konfeti.
   * anim=false: anında (kayıt yükleme).
   * Main, saatKulesi'ni addBuilding ile ekledikten hemen sonra (aynı karede) setMonumentStage(id, 0) çağırır;
   * kurulum animasyonu o zaman yalnızca taban + iskeleyi katlar (tam kule görünüp kaybolmaz).
   * Bu çağrı hiç yapılmayan Saat Kulesi tamamdır (eski kayıtlar).
   */
  setMonumentStage(id: number, asama: number, anim?: boolean): void;
  /** Sahnedeki bütün binaları siler (yeni oyun / kayıt yükleme). Animasyon yok. */
  clearBuildings(): void;
  /** Menü kartı için binanın 1. seviye modelinin resmi (PNG data URL, şeffaf). Üretilemediyse null. */
  buildingThumbnail(type: BuildingType): string | null;
  /** Etkin harita (data/map.ts HARITA) değişti: arazi, göller ve ördekler yeniden üretilir. */
  rebuildTerrain(): void;

  /** Yerleştirme önizlemesi. type null ise gizler. valid=false ise kırmızımsı ve yarı saydam. */
  setGhost(type: BuildingType | null, x: number, z: number, rot: number, valid: boolean): void;
  /** Zeminde kesikli kağıt halka (etki yarıçapı). r null ise gizler. */
  showRange(x: number, z: number, r: number | null): void;
  /** Bir binayı vurgular (seçim/yıkma hover). mode: 'secim' sarı, 'yikim' kırmızı. id null ise kaldırır. */
  highlight(id: number | null, mode?: 'secim' | 'yikim'): void;
  /**
   * Bina üstünde hafifçe sallanan iğne: kağıt beyazı damla, ortada simge. 'uyari' (toprak kırmızısı halka):
   * evin ihtiyacı karşılanmıyor; 'bilgi' (arduvaz halka): üretim duruyor. null kaldırır.
   */
  setPin(id: number, pin: { ikon: string; tur: PinTur } | null): void;

  /** Yol ekler; anim=true (varsayılan) kağıt şerit gibi açılarak serilir, false anında görünür. Arazi yüksekliğini izler. */
  addRoad(id: number, tur: RoadType, noktalar: Vec2[], anim?: boolean): void;
  /** Yol şeridi geri sarılarak kaybolur. */
  removeRoad(id: number): void;
  /** Animasyonsuz (yükleme). */
  clearRoads(): void;
  /** Fırçayla çizilen yolun canlı önizlemesi. tur null ise gizler. valid=false kırmızımsı. */
  setRoadGhost(tur: RoadType | null, noktalar: Vec2[], valid: boolean): void;
  /** Yolu vurgular (yıkım hover / seçim). id null ise kaldırır. */
  highlightRoad(id: number | null, mode?: 'secim' | 'yikim'): void;

  /** Ekran koordinatından arazi yüzeyindeki nokta (x,z). Ada dışındaysa y=0 düzlemiyle kesişim; hiç kesmezse null. */
  pickGround(clientX: number, clientY: number): { x: number; z: number } | null;
  /** Ekran koordinatındaki bina id'si. */
  pickBuilding(clientX: number, clientY: number): number | null;
  /** Ekran koordinatındaki yol id'si. */
  pickRoad(clientX: number, clientY: number): number | null;

  /** Dünya noktasından yukarı uçan kağıt etiketli sayı/metin. */
  floatText(x: number, z: number, text: string, color: string): void;

  /**
   * Sol tuşla sürükleyerek kaydırma (varsayılan açık). Kamera sol sürüklemeyi ancak 5 px'ten fazla
   * hareketten sonra kaydırma sayar; daha kısa hareket tıklamadır ve arayüze kalır.
   * Arayüz, yol fırçası aracında bunu kapatır (sol sürükleme yol çizer).
   */
  setLeftDragPan(on: boolean): void;
  /** Kamera yakınlaşması: 0 en yakın, 1 en uzak (ses katmanı ortam sesini buna göre kısar). */
  getZoom01(): number;
  /** Kamerayı yumuşakça (x, z) noktasına kaydırır; açı ve yakınlaşma değişmez. */
  focusOn(x: number, z: number): void;
  /** Kamerayı hedef çevresinde dAz radyan döndürür (giriş ekranında yavaş tur). */
  orbit(dAz: number): void;
  /** Sol sürükleme şu an kaydırma yapıyor mu (arayüz bu sırada tıklama/hover işlemez). */
  isPanning(): boolean;

  /**
   * Gezgin tüccar: başlangıç yolunun kenar ucunda duran tüccar arabası. konum null ise araba yoktur.
   * (x, z) arabanın duracağı yol noktası, yon radyan (Y ekseni; arabanın önü bu yöne, kasabaya bakar).
   * Main her karede çağırabilir; aynı değerde bir şey yapmaz. Gelişte araba yolun dışından yuvarlanarak
   * gelir ya da belirir, gidişte uzaklaşır / kaybolur. anlik=true: geçişsiz (kayıt yükleme, yeni oyun).
   * Yalnızca görseldir; mantığa etkisi yoktur.
   */
  setMerchant(konum: { x: number; z: number; yon: number } | null, anlik?: boolean): void;

  /** Gün ilerlemesi 0..1: güneş açısı ve ışık rengi hafifçe değişir. */
  setDayProgress(t: number): void;

  /**
   * Mevsim (logic/season.ts → mevsim(gun)). Main her karede çağırabilir; aynı değerde bir şey yapmaz.
   * Değişince görünüm birkaç saniyede yumuşakça geçer (sonbahar yaprakları, kış zemini, buz, kar).
   * anlik=true: geçişsiz, hemen (oyun açılışı / kayıt yükleme / yeni oyun).
   * Yalnızca görseldir; mantığa etkisi yoktur.
   */
  setSeason(m: Mevsim, anlik?: boolean): void;

  /** Her karede main döngüsünden çağrılır. dt saniye. */
  update(dt: number): void;
  resize(): void;
  dispose(): void;
}

// createRenderer(container: HTMLElement): GameRenderer  — renderer.ts içinde.
