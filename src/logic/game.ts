// Mantık API'si: types.ts'deki sözleşmenin tek giriş noktası.
import { BALANCE, BUILDINGS, HOUSE_LEVELS, dogaTuru } from '../data/buildings';
import { HARITA, OYUN_YARI_GENISLIK, haritayiAyarla, makeRng } from '../data/map';
import type { BuildingInfo, DayReport, GameState, Good } from './types';
import {
  anitAsamalari, buildingUpkeep, demolishRefund, effectRadius, stockLimit, monumentStage, naturalCut, nextMonumentCost, upgradeCost,
  upgradeStone,
} from './placement';
import { fillForests, fillMeadows } from './doga';
import { resample } from './geometry';
import { bestRoadNear } from './roads';
import { adjacencyBonus } from './adjacency';
import { mevsim } from './season';
import { ayar, mevsimEtkileri } from './cards';
import {
  emptyGoods, endDay, evaluateNeeds, houseHappiness, housePopulation, houseTax, housesInRange, isProducer, treesInRange, workerRatio,
} from './economy';

export {
  isUnlocked, canPlace, placeBuilding, demolish, upgradeCost, upgradeStone, canUpgrade, upgradeBuilding, effectRadius,
  buildingUpkeep, stockLimit, monumentStage, canAdvanceMonument, advanceMonument, anitAsamalari, anitTamam,
} from './placement';
export { endDay, housesInRange } from './economy';
export {
  isRoadUnlocked, planRoad, placeRoad, demolishRoad, getRoadInfo, nearestRoad,
} from './roads';
export { heightAt, isLand, isLake } from './terrain';
export { adjacencyBonus, adjacencySources, bonusText } from './adjacency';
export { mevsim, mevsimGunu, kisaKalanGun, MEVSIMLER, type Mevsim } from './season';
export {
  tuccarVarMi, tuccarGeldiMi, tuccarKalisGunu, tuccaraKalanGun, kalanKota, tuccarKonumu, canBuy, canSell, buyGood, sellGood,
  birimFiyat, ticaretTutari, gununFirsati, siparisDurumu, siparisTeslim, ziyaretNo,
  type TicaretSebep,
} from './trade';
export {
  checkRequest, deliverFeast, deliverRequest, istekHedefi, istekKalanGun, istekOdulu, neseliMi, teslimMali,
} from './requests';
export { ayar, kartCek, kartSec, kartBul, bekleyenSecim, secimGunu, toplamSecim, suregenEtkiler, mevsimEtkileri } from './cards';
export { senlikDurumu, senlikBaslat, senlikBedeli, type SenlikDurumu } from './senlik';
export { serialize, deserialize } from './save';
export { GOALS, goalProgress, goalReward, KASABA_TAMAM_HEDEFI, EFSANE_HEDEFI, ZENGIN_KASABA } from './goals';
export { kasabaUnvani, UNVAN_SAYISI } from './gunluk';
export { YIL_GUN, yilNo, yilSonuMu } from './gunluk';
export {
  anlikGoruntu, geriAl, geriAlEkle, geriAlinabilir, geriAlTemizle, geriAlYigini, type GeriAlTur, type GeriAlYigini,
} from './undo';

export const GUN_SURESI = BALANCE.gunSuresi;
// Oynanabilir alanın yarı genişliği (artık yuvarlatılmış kare; kurallarda isLand kullanılır).
export const ZEMIN_YARICAP = OYUN_YARI_GENISLIK;
export const BOSLUK = BALANCE.bosluk;
export const STOK_SINIR = BALANCE.stokSinir;

export { makeRng };

/**
 * Yeni oyun. `haritaTohum` verilirse harita o tohumdan rastgele üretilir; verilmezse klasik harita.
 * Etkin haritayı (HARITA) da bu oyunun haritasına çevirir.
 */
export function createGame(haritaTohum?: number): GameState {
  haritayiAyarla(haritaTohum);
  const s: GameState = {
    gun: 1,
    gunIlerleme: 0,
    para: BALANCE.baslangicPara,
    nufus: 0,
    mutluluk: BALANCE.mutlulukTaban,
    stok: emptyGoods(),
    binalar: [],
    yollar: [],
    sonrakiId: 1,
    borcGunu: 0,
    bitti: false,
    hedef: 0,
    toplamYemek: 0,
    gunluk: [],
  };
  if (haritaTohum !== undefined) s.haritaTohum = haritaTohum;
  s.yollar.push({ id: s.sonrakiId++, tur: 'toprak', noktalar: resample(HARITA.baslangicYolu, BALANCE.yolOrnekAraligi) });
  fillForests(s);
  fillMeadows(s);
  return s;
}

/** Günü ilerletir; gün dolarsa endDay raporunu döndürür. Bir tick'te en fazla bir gün geçer. */
export function tick(s: GameState, dt: number): DayReport | null {
  if (s.bitti || dt <= 0) return null;
  s.gunIlerleme += dt / GUN_SURESI;
  if (s.gunIlerleme < 1) return null;
  s.gunIlerleme = 0;
  return endDay(s);
}

export function getBuildingInfo(s: GameState, id: number): BuildingInfo | null {
  const b = s.binalar.find((x) => x.id === id);
  if (!b) return null;
  const info: BuildingInfo = {
    id: b.id,
    type: b.type,
    seviye: b.seviye,
    gider: buildingUpkeep(b, s),
    yikimIadesi: demolishRefund(b),
    etki: effectRadius(b),
  };
  if (BUILDINGS[b.type].yukseltilebilir) {
    const m = upgradeCost(b);
    if (m === null) info.yukseltme = null;
    else {
      const sonraki = { ...b, seviye: b.seviye + 1 };
      info.yukseltme = { maliyet: m, tas: upgradeStone(b, s) ?? 0, etki: effectRadius(sonraki), gider: buildingUpkeep(sonraki, s) };
    }
  }
  if (b.dogal) {
    const k = naturalCut(b);
    info.dogal = true;
    info.kesimMaliyeti = k.maliyet;
    info.kesimOdun = k.odun;
  }
  if (BUILDINGS[b.type].komsuluk) info.komsuluk = adjacencyBonus(s, b.type, b.x, b.z, b.id).durumlar;
  if (b.type === 'ev') {
    // Tahmin: yemek/odun/mobilya stoğa bakılarak (diğer evlerin payı düşülmeden) değerlendirilir, tüketilmez.
    const st = evaluateNeeds(s, b);
    const m = houseHappiness(s, b, st);
    info.nufus = housePopulation(b);
    info.mutluluk = m;
    info.tahminiVergi = houseTax(info.nufus, m, b.seviye, ayar(s, 'vergiCarpani'));
    info.ihtiyaclar = st;
    info.yol = bestRoadNear(s, b)?.tur ?? null;
    info.evGun = { iyi: b.iyiGun, kotu: b.kotuGun, buyumeEsik: ayar(s, 'seviyeAtlamaGun'), kuculmeEsik: BALANCE.seviyeGunEsigi };
    if (b.seviye < HOUSE_LEVELS.length) info.mutsuz = m < BALANCE.buyumeMutluluk;
  }
  if (isProducer(b.type)) {
    const oran = workerRatio(s);
    info.isciOrani = oran;
    const d = BUILDINGS[b.type];
    const kis = !!d.kisinUretmez && mevsim(s.gun) === 'kis';
    if (d.uretim) {
      const carpan = 1 + (d.komsuluk ? adjacencyBonus(s, b.type, b.x, b.z, b.id).oran : 0);
      const sinir = stockLimit(s);
      const cikti = (Object.keys(d.uretim.cikti) as Good[]).map((mal): [Good, number] => [mal, ayar(s, `uretim.${b.type}.${mal}`)]);
      // runProduction ile aynı sınır: çıktı deposu dolarsa üretim (ve girdi) o oranda düşer. Girdi stoğu ayrıca
      // gösterilir (aynı gün başka bir binanın üreteceği girdi henüz stokta olmayabilir).
      let k = kis ? 0 : oran;
      for (const [mal, n] of cikti) if (n > 0) k = Math.min(k, Math.max(0, (sinir - s.stok[mal]) / (n * carpan)));
      info.uretimTahmini = {
        girdi: (Object.entries(d.uretim.girdi) as [Good, number][]).map(([mal, n]) => ({ mal, miktar: n * k, stok: s.stok[mal] })),
        cikti: cikti.map(([mal, n]) => ({ mal, miktar: n * carpan * k })),
      };
    } else if (d.agacBasinaOdun !== undefined) {
      const miktar = Math.max(0, Math.min(treesInRange(s, b) * d.agacBasinaOdun * ayar(s, 'oduncuCarpani') * oran, stockLimit(s) - s.stok.odun));
      info.uretimTahmini = { girdi: [], cikti: [{ mal: 'odun', miktar }] };
    }
  }
  if (info.etki > 0 && b.type !== 'ev' && !dogaTuru(b.type)) info.kapsananEv = housesInRange(s, b.id).length;
  if (BUILDINGS[b.type].kisinUretmez && mevsim(s.gun) === 'kis') info.kisinDurdu = true;
  // Bu mevsimin üretim etkisi (ilkbahar arılık, yaz tarla, sonbahar oduncu).
  for (const e of mevsimEtkileri(mevsim(s.gun))) {
    const bu = e.anahtar.startsWith(`uretim.${b.type}.`) || (b.type === 'oduncu' && e.anahtar === 'oduncuCarpani');
    if (bu && e.islem === 'carp') info.mevsimCarpani = e.deger;
  }
  if (BUILDINGS[b.type].anit) {
    const m = nextMonumentCost(b);
    info.anit = { asama: monumentStage(b), toplam: anitAsamalari(b.type).length, sonraki: m ? { para: m.para, mal: { ...m.mal } } : null };
  }
  if (b.type === 'oduncu') info.agacSayisi = treesInRange(s, b);
  return info;
}
