// Mantık API'si: types.ts'deki sözleşmenin tek giriş noktası.
import { BALANCE, BUILDINGS } from '../data/buildings';
import { HARITA, OYUN_YARI_GENISLIK, haritayiAyarla, makeRng } from '../data/map';
import type { BuildingInfo, DayReport, GameState } from './types';
import {
  buildingUpkeep, checkSite, demolishRefund, effectRadius, monumentStage, nextMonumentCost, upgradeCost, upgradeStone,
} from './placement';
import { resample } from './geometry';
import { bestRoadNear } from './roads';
import { adjacencyBonus } from './adjacency';
import { mevsim } from './season';
import { ayar } from './cards';
import {
  emptyGoods, endDay, evaluateNeeds, houseHappiness, housePopulation, houseTax, isProducer, treesInRange, workerRatio,
} from './economy';

export {
  isUnlocked, canPlace, placeBuilding, demolish, upgradeCost, upgradeStone, canUpgrade, upgradeBuilding, effectRadius,
  buildingUpkeep, stockLimit, monumentStage, canAdvanceMonument, advanceMonument,
} from './placement';
export { endDay, housesInRange } from './economy';
export {
  isRoadUnlocked, planRoad, placeRoad, demolishRoad, getRoadInfo, nearestRoad,
} from './roads';
export { heightAt, isLand, isLake } from './terrain';
export { adjacencyBonus, bonusText } from './adjacency';
export { mevsim, mevsimGunu, kisaKalanGun, MEVSIMLER, type Mevsim } from './season';
export {
  tuccarVarMi, tuccaraKalanGun, kalanKota, tuccarKonumu, canBuy, canSell, buyGood, sellGood, type TicaretSebep,
} from './trade';
export { checkRequest, deliverFeast, istekHedefi, istekKalanGun, geciciMutlulukBugun } from './requests';
export { ayar, kartCek, kartSec, kartBul, bekleyenSecim } from './cards';
export { serialize, deserialize } from './save';
export { GOALS, goalProgress, KASABA_TAMAM_HEDEFI } from './goals';

export const GUN_SURESI = BALANCE.gunSuresi;
// Oynanabilir alanın yarı genişliği (artık yuvarlatılmış kare; kurallarda isLand kullanılır).
export const ZEMIN_YARICAP = OYUN_YARI_GENISLIK;
export const BOSLUK = BALANCE.bosluk;
export const STOK_SINIR = BALANCE.stokSinir;

export { makeRng };

/** Ormanları etkin haritanın ağaç tohumuyla doğal ağaçlarla doldurur. */
function fillForests(s: GameState): void {
  const rng = makeRng(HARITA.agacTohum);
  for (const o of HARITA.ormanlar) {
    // Karar: hedef `agac` kadar ağaç; uygun yer bulunamazsa en fazla agac × 4 deneme.
    let konan = 0;
    for (let deneme = 0; deneme < o.agac * 4 && konan < o.agac; deneme++) {
      const aci = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * o.r; // disk içinde düzgün dağılım
      const rot = rng() * Math.PI * 2;
      const x = o.x + Math.cos(aci) * r;
      const z = o.z + Math.sin(aci) * r;
      if (checkSite(s, 'agac', x, z) !== null) continue;
      s.binalar.push({ id: s.sonrakiId++, type: 'agac', dogal: true, x, z, rot, seviye: 1, iyiGun: 0, kotuGun: 0 });
      konan++;
    }
  }
}

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
  };
  if (haritaTohum !== undefined) s.haritaTohum = haritaTohum;
  s.yollar.push({ id: s.sonrakiId++, tur: 'toprak', noktalar: resample(HARITA.baslangicYolu, BALANCE.yolOrnekAraligi) });
  fillForests(s);
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
    info.dogal = true;
    info.kesimMaliyeti = BALANCE.dogalAgacKesimMaliyeti;
    info.kesimOdun = BALANCE.dogalAgacKesimOdun;
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
  }
  if (isProducer(b.type)) info.isciOrani = workerRatio(s);
  if (BUILDINGS[b.type].kisinUretmez && mevsim(s.gun) === 'kis') info.kisinDurdu = true;
  if (BUILDINGS[b.type].anit) {
    const m = nextMonumentCost(b);
    info.anit = { asama: monumentStage(b), toplam: BALANCE.anit.asamalar.length, sonraki: m ? { para: m.para, mal: { ...m.mal } } : null };
  }
  if (b.type === 'oduncu') info.agacSayisi = treesInRange(s, b);
  return info;
}
