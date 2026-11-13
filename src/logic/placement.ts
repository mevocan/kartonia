import { BALANCE, BUILDINGS, dogaTuru } from '../data/buildings';
import type { Building, BuildingType, GameState, Good, PlaceCheck, PlaceFailReason } from './types';
import { circleSamples, circlesOverlap } from './geometry';
import { heightAt, isLake, isLand, lakeDistance } from './terrain';
import { inTaslik } from '../data/map';
import { nearestRoad, roadEdgeGap } from './roads';
import { ayar } from './cards';

export function isUnlockedAt(nufus: number, t: BuildingType): boolean {
  return nufus >= BUILDINGS[t].acilmaNufus;
}

export function isUnlocked(s: GameState, t: BuildingType): boolean {
  return isUnlockedAt(s.nufus, t);
}

/** Yer kontrolü (para/kilit hariç): disarida → gol → egim → taslikYok → golYok → cakisiyor → yol → yolYok. Uygunsa null. */
export function checkSite(s: GameState, t: BuildingType, x: number, z: number): PlaceFailReason | null {
  const d = BUILDINGS[t];
  const ornekler = circleSamples(x, z, d.taban, 8);
  if (ornekler.some((p) => !isLand(p.x, p.z))) return 'disarida';
  if (ornekler.some((p) => isLake(p.x, p.z))) return 'gol';
  let min = Infinity;
  let max = -Infinity;
  for (const p of ornekler) {
    const h = heightAt(p.x, p.z);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  if (max - min > BALANCE.egimSiniri) return 'egim';
  // Taş ocağı: merkezi bir taşlık alanın içinde olmalı.
  if (d.yer === 'taslik' && !inTaslik(x, z)) return 'taslikYok';
  // Balıkçı: taban kenarı göle en fazla golKiyisi uzak (komşuluk bonuslarıyla aynı göl mesafesi).
  if (d.yer === 'gol' && lakeDistance(x, z) - d.taban > BALANCE.golKiyisi) {
    return 'golYok';
  }
  for (const b of s.binalar) {
    if (circlesOverlap(x, z, d.taban, b.x, b.z, BUILDINGS[b.type].taban, BALANCE.bosluk)) return 'cakisiyor';
  }
  let enYakin = Infinity;
  for (const r of s.yollar) {
    const g = roadEdgeGap(r, x, z, d.taban);
    if (g < 0) return 'yol';
    enYakin = Math.min(enYakin, g);
  }
  if (!dogaTuru(t) && enYakin > BALANCE.yolYakinlik) return 'yolYok';
  return null;
}

export function canPlace(s: GameState, t: BuildingType, x: number, z: number): PlaceCheck {
  if (s.bitti) return { ok: false, sebep: 'bitti' };
  if (!isUnlocked(s, t)) return { ok: false, sebep: 'kilitli' };
  if (s.para < BUILDINGS[t].maliyet) return { ok: false, sebep: 'para' };
  const sebep = checkSite(s, t, x, z);
  return sebep ? { ok: false, sebep } : { ok: true };
}

export function placeBuilding(s: GameState, t: BuildingType, x: number, z: number, rot: number): Building | null {
  if (!canPlace(s, t, x, z).ok) return null;
  s.para -= BUILDINGS[t].maliyet;
  const b: Building = { id: s.sonrakiId++, type: t, x, z, rot, seviye: 1, iyiGun: 0, kotuGun: 0 };
  if (BUILDINGS[t].anit) b.insaat = BALANCE.anit.asamalar.length; // iskeleyle başlar
  if (t === 'agac' && s.istek?.tur === 'agaclandirma') s.istek.ilerleme++; // ağaçlandırma isteği
  if (!dogaTuru(t)) b.baglanti = linkFor(s, x, z);
  s.binalar.push(b);
  return b;
}

// ---- Hizmet binası yükseltmesi ----

const MAKS_YUKSELTME = BALANCE.yukseltme.etki.length;

/** Yükseltilebilir binanın seviye indeksi (0..2); diğerleri 0. */
function upgradeIndex(b: Building): number {
  if (!BUILDINGS[b.type].yukseltilebilir) return 0;
  return Math.min(Math.max(Math.round(b.seviye), 1), MAKS_YUKSELTME) - 1;
}

/** Seviyeye göre etki yarıçapı. İnşaatı süren anıtın etkisi yoktur (aura yalnızca tamamlanınca). */
export function effectRadius(b: Building): number {
  if (b.insaat) return 0;
  return BUILDINGS[b.type].etki * BALANCE.yukseltme.etki[upgradeIndex(b)];
}

/** Seviyeye göre günlük gider (yuvarlanır). */
export function buildingUpkeep(b: Building, s?: GameState): number {
  if (b.insaat) return 0; // inşaatı süren anıtın gideri yok
  const taban = s ? ayar(s, `gider.${b.type}`) : BUILDINGS[b.type].gider; // kartlar (tüccar dostu, büyük ambar)
  return Math.round(taban * BALANCE.yukseltme.gider[upgradeIndex(b)]);
}

/** Verilen seviyeye çıkma maliyeti (seviye 2 ya da 3). */
function levelCost(t: BuildingType, seviye: number): number {
  return Math.round(BUILDINGS[t].maliyet * BALANCE.yukseltme.maliyet[seviye - 1]);
}

/** Bir sonraki seviyenin maliyeti; yükseltilemiyorsa ya da en üst seviyedeyse null. */
export function upgradeCost(b: Building): number | null {
  if (!BUILDINGS[b.type].yukseltilebilir || b.seviye >= MAKS_YUKSELTME) return null;
  return levelCost(b.type, b.seviye + 1);
}

/** Bir sonraki seviyenin taş ihtiyacı; yükseltilemiyorsa null. */
export function upgradeStone(b: Building, s?: GameState): number | null {
  if (upgradeCost(b) === null) return null;
  // Karar kartları taş maliyetini çarpabilir (taş ustaları); s verilmezse kartsız.
  return Math.round(BALANCE.yukseltme.tas[b.seviye] * (s ? ayar(s, 'yukseltmeTasCarpani') : 1));
}

export function canUpgrade(s: GameState, id: number): PlaceCheck {
  if (s.bitti) return { ok: false, sebep: 'bitti' };
  const b = s.binalar.find((x) => x.id === id);
  const m = b ? upgradeCost(b) : null;
  if (!b || m === null) return { ok: false, sebep: 'kilitli' };
  if (s.para < m) return { ok: false, sebep: 'para' };
  if (s.stok.tas < (upgradeStone(b, s) ?? 0) - 1e-9) return { ok: false, sebep: 'tas' };
  return { ok: true };
}

/** Binayı bir seviye yükseltir, parayı ve taşı düşer. Harcanan parayı döndürür; olmazsa null. */
export function upgradeBuilding(s: GameState, id: number): number | null {
  if (!canUpgrade(s, id).ok) return null;
  const b = s.binalar.find((x) => x.id === id)!;
  const m = upgradeCost(b)!;
  s.para -= m;
  s.stok.tas = Math.max(0, s.stok.tas - (upgradeStone(b, s) ?? 0));
  b.seviye++;
  return m;
}

/** Bir malın stok sınırı: taban sınır + her ambarın deposu. */
export function stockLimit(s: GameState): number {
  let sinir = BALANCE.stokSinir;
  for (const b of s.binalar) if (BUILDINGS[b.type].depo) sinir += ayar(s, `depo.${b.type}`); // kartlar (büyük ambar)
  return sinir;
}

export function demolishRefund(b: Building): number {
  if (b.dogal) return 0;
  // Yükseltmelere harcanan para da iadeye dahildir.
  let harcanan = BUILDINGS[b.type].maliyet;
  if (BUILDINGS[b.type].yukseltilebilir) for (let l = 2; l <= upgradeIndex(b) + 1; l++) harcanan += levelCost(b.type, l);
  // Anıt: tamamlanan aşamalara harcanan para da dahil (mallar geri gelmez).
  if (BUILDINGS[b.type].anit) for (let i = 0; i < monumentStage(b); i++) harcanan += BALANCE.anit.asamalar[i].para;
  return Math.floor(harcanan * BALANCE.yikimIadeOrani);
}

/** Doğal parçayı kaldırmanın bedeli: orman ağacı para ister ve odun verir, çayır çiçeği bedavadır. */
export function naturalCut(b: Building): { maliyet: number; odun: number } {
  if (b.type !== 'agac') return { maliyet: 0, odun: 0 };
  return { maliyet: BALANCE.dogalAgacKesimMaliyeti, odun: BALANCE.dogalAgacKesimOdun };
}

/**
 * İade miktarını döndürür. Doğal ağaç: kesim parası düşülür, odun eklenir, −kesimMaliyeti döner.
 * Bina yoksa, oyun bittiyse ya da kesime para yetmiyorsa null.
 */
export function demolish(s: GameState, id: number): number | null {
  if (s.bitti) return null;
  const i = s.binalar.findIndex((b) => b.id === id);
  if (i < 0) return null;
  const b = s.binalar[i];
  if (b.dogal) {
    const { maliyet: m, odun } = naturalCut(b);
    if (s.para < m) return null;
    s.binalar.splice(i, 1);
    s.para -= m;
    s.stok.odun = Math.max(s.stok.odun, Math.min(stockLimit(s), s.stok.odun + odun));
    return -m;
  }
  const iade = demolishRefund(b);
  s.binalar.splice(i, 1);
  s.para += iade;
  return iade;
}

/** Binanın yol bağlantı ucu: en yakın yolun orta çizgisindeki nokta. */
export function linkFor(s: GameState, x: number, z: number): Building['baglanti'] {
  const n = nearestRoad(s, x, z);
  return n ? { x: n.x, z: n.z, yol: n.id } : null;
}

// ---- Anıt (Saat Kulesi) inşaatı ----

/** Anıtın tamamlanan aşama sayısı (0..toplam). Anıt değilse 0; insaat alanı yoksa tamam. */
export function monumentStage(b: Building): number {
  if (!BUILDINGS[b.type].anit) return 0;
  const toplam = BALANCE.anit.asamalar.length;
  return toplam - Math.min(toplam, Math.max(0, b.insaat ?? 0));
}

/** Sıradaki aşamanın maliyeti; anıt değilse ya da tamamsa null. */
export function nextMonumentCost(b: Building): (typeof BALANCE.anit.asamalar)[number] | null {
  if (!BUILDINGS[b.type].anit || !b.insaat) return null;
  return BALANCE.anit.asamalar[monumentStage(b)] ?? null;
}

/** Sıradaki aşamaya malzeme gönderilebilir mi. Nedenler: bitti, kilitli (anıt değil / tamam), para, tas, odun, mobilya. */
export function canAdvanceMonument(s: GameState, id: number): PlaceCheck {
  if (s.bitti) return { ok: false, sebep: 'bitti' };
  const b = s.binalar.find((x) => x.id === id);
  const m = b ? nextMonumentCost(b) : null;
  if (!m) return { ok: false, sebep: 'kilitli' };
  if (s.para < m.para) return { ok: false, sebep: 'para' };
  for (const [g, n] of Object.entries(m.mal) as [Good, number][]) {
    if (s.stok[g] < n - 1e-9) {
      if (g === 'tas' || g === 'odun' || g === 'mobilya') return { ok: false, sebep: g };
      return { ok: false, sebep: 'kilitli' }; // tanımlı olmayan mal (veri hatası)
    }
  }
  return { ok: true };
}

/** Sıradaki aşamayı tamamlar: parayı ve malları düşer. Harcanan parayı döndürür; olmazsa null. */
export function advanceMonument(s: GameState, id: number): number | null {
  if (!canAdvanceMonument(s, id).ok) return null;
  const b = s.binalar.find((x) => x.id === id)!;
  const m = nextMonumentCost(b)!;
  s.para -= m.para;
  for (const [g, n] of Object.entries(m.mal) as [Good, number][]) s.stok[g] = Math.max(0, s.stok[g] - n);
  b.insaat = (b.insaat ?? 1) - 1;
  if (b.insaat <= 0) delete b.insaat; // tamam: eski kayıtlardaki kulelerle aynı biçim
  return m.para;
}
