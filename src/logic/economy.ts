import { BALANCE, BUILDING_ORDER, BUILDINGS, HOUSE_LEVELS, ROADS, dogaTuru } from '../data/buildings';
import type {
  Building, BuildingType, DayReport, GameState, Good, HouseLevelDef, Need, NeedStatus, UretimSorunu,
} from './types';
import { dist } from './geometry';
import { buildingUpkeep, effectRadius, isUnlockedAt, stockLimit } from './placement';
import { checkGoals } from './goals';
import { bestRoadNear, roadUpkeep } from './roads';
import { adjacencyBonus } from './adjacency';
import { mevsim } from './season';
import { geciciMutlulukBugun, istekGunSonu } from './requests';
import { ticaretGunSonu } from './trade';
import { ayar, kartGunSonu } from './cards';

// Marangoz odunu kullandığı için oduncudan sonra gelir.
// Ağıl buğdayı değirmenden sonra alır; dokumacı ağıldan sonra gelir.
export const URETIM_SIRASI: BuildingType[] = [
  'tarla', 'degirmen', 'firin', 'oduncu', 'balikci', 'tasOcagi', 'marangoz', 'agil', 'dokumaci', 'arilik',
];

export function emptyGoods(): Record<Good, number> {
  return { bugday: 0, un: 0, yemek: 0, odun: 0, tas: 0, mobilya: 0, yun: 0, kumas: 0, bal: 0 };
}

export function isProducer(t: BuildingType): boolean {
  const d = BUILDINGS[t];
  return d.uretim !== undefined || d.agacBasinaOdun !== undefined;
}

/** nüfus / toplam işçi ihtiyacı, en fazla 1. */
export function workerRatio(s: GameState): number {
  // Karar: işçi ihtiyacı bütün binaların `isci` toplamıdır (pazar/okul dahil), ama oran yalnızca üretimi düşürür.
  let ihtiyac = 0;
  for (const b of s.binalar) ihtiyac += BUILDINGS[b.type].isci;
  if (ihtiyac <= s.nufus) return 1;
  return s.nufus / ihtiyac;
}

export function houseLevel(seviye: number): HouseLevelDef {
  const i = Math.min(Math.max(Math.round(seviye), 1), HOUSE_LEVELS.length) - 1;
  return HOUSE_LEVELS[i];
}

export function housePopulation(h: Building): number {
  return houseLevel(h.seviye).nufus;
}

/** `target` binasının merkezi `b` binasının etki alanında mı. */
export function inRange(b: Building, target: Building): boolean {
  const r = effectRadius(b);
  return r > 0 && dist(b.x, b.z, target.x, target.z) <= r;
}

export function housesInRange(s: GameState, id: number): number[] {
  const b = s.binalar.find((x) => x.id === id);
  if (!b) return [];
  return s.binalar.filter((h) => h.type === 'ev' && h.id !== b.id && inRange(b, h)).map((h) => h.id);
}

export function treesInRange(s: GameState, b: Building): number {
  // Karar: aynı ağaç birden çok oduncunun alanındaysa her biri için ayrı sayılır.
  return s.binalar.filter((t) => t.type === 'agac' && inRange(b, t)).length;
}

/** Etki alanı olan bir sağlayıcı: merkez ve yarıçap (o anki seviyesine göre). */
interface Saglayici {
  x: number;
  z: number;
  r: number;
}

/**
 * İhtiyaç sağlayan binaların listesi: hizmetler (`saglar`) ihtiyaca göre, yemek satış yerleri (`yemekSatar`) ayrı.
 * Bir kez kurulur, bütün evlerin ihtiyaç denetiminde paylaşılır (her ev için bütün binaları taramak yerine).
 * Bina eklenince, yıkılınca ya da yükseltilince yeniden kurulmalıdır; bu yüzden saklanmaz, çağıran kurar.
 */
export interface HizmetIndeksi {
  saglar: Map<Need, Saglayici[]>;
  yemek: Saglayici[];
}

export function hizmetIndeksi(s: GameState): HizmetIndeksi {
  const ix: HizmetIndeksi = { saglar: new Map(), yemek: [] };
  for (const b of s.binalar) {
    const d = BUILDINGS[b.type];
    if (!d.saglar && !d.yemekSatar) continue;
    const r = effectRadius(b);
    if (r <= 0) continue;
    const p = { x: b.x, z: b.z, r };
    if (d.saglar) {
      const l = ix.saglar.get(d.saglar);
      if (l) l.push(p);
      else ix.saglar.set(d.saglar, [p]);
    }
    if (d.yemekSatar) ix.yemek.push(p);
  }
  return ix;
}

function kapsar(l: readonly Saglayici[] | undefined, h: Building): boolean {
  return !!l && l.some((p) => dist(p.x, p.z, h.x, h.z) <= p.r);
}

type StokIhtiyaci = 'yemek' | 'odun' | 'mobilya' | 'kumas' | 'bal';

function isStockNeed(n: Need): n is StokIhtiyaci {
  return n === 'yemek' || n === 'odun' || n === 'mobilya' || n === 'kumas' || n === 'bal';
}

/** Kişi başı günlük tüketim. Kışın odun (3. seviye ve üstü evler odun ister) kisOdunCarpani katı. */
function perCapita(s: GameState, n: StokIhtiyaci): number {
  switch (n) {
    case 'yemek': return BALANCE.yemekKisiBasi;
    case 'odun': return ayar(s, 'odunKisiBasi') * (mevsim(s.gun) === 'kis' ? BALANCE.mevsim.kisOdunCarpani : 1);
    case 'mobilya': return BALANCE.mobilyaKisiBasi;
    case 'kumas': return BALANCE.kumasKisiBasi;
    case 'bal': return BALANCE.balKisiBasi;
  }
}

/**
 * Evin mevcut + bir üst seviyesinin ihtiyaçları (tekrarsız) ve durumu.
 * `tuketim` verilirse mevcut seviyenin stok ihtiyaçları (yemek, odun, mobilya, kumaş, bal) stoktan düşülür ve oraya eklenir.
 * `ix`: birçok ev art arda değerlendirilirken bir kez kurulmuş sağlayıcı listesi (verilmezse burada kurulur).
 */
export function evaluateNeeds(s: GameState, h: Building, tuketim?: Record<Good, number>, ix: HizmetIndeksi = hizmetIndeksi(s)): NeedStatus[] {
  const cur = houseLevel(h.seviye);
  const next = h.seviye < HOUSE_LEVELS.length ? houseLevel(h.seviye + 1) : null;
  const list: Need[] = [];
  for (const n of [...cur.ihtiyaclar, ...(next ? next.ihtiyaclar : [])]) if (!list.includes(n)) list.push(n);
  return list.map((n): NeedStatus => {
    if (isStockNeed(n)) {
      const mevcut = cur.ihtiyaclar.includes(n);
      // Karar: yalnızca üst seviyenin ihtiyacıysa (ör. seviye 1 için yemek) stokta üst seviye nüfusu kadar
      // pay var mı diye bakılır ama tüketilmez. Mevcut seviyenin ihtiyacıysa tüketilir.
      const nufus = mevcut || !next ? cur.nufus : next.nufus;
      const miktar = nufus * perCapita(s, n);
      // Yemek yalnızca bir satış yerinden alınır (fırın, pazar).
      const ulasir = n !== 'yemek' || kapsar(ix.yemek, h);
      const ok = ulasir && s.stok[n] >= miktar - 1e-9;
      if (ok && mevcut && tuketim) {
        s.stok[n] = Math.max(0, s.stok[n] - miktar);
        tuketim[n] += miktar;
      }
      return { ihtiyac: n, karsilandi: ok };
    }
    return { ihtiyac: n, karsilandi: kapsar(ix.saglar.get(n), h) };
  });
}

function currentNeedsMet(h: Building, st: NeedStatus[]): number {
  const cur = houseLevel(h.seviye).ihtiyaclar;
  return st.filter((x) => x.karsilandi && cur.includes(x.ihtiyac)).length;
}

/** Taban + kapsayan binaların mutluluğu (ağaçlar sınırlı) + en iyi yol + karşılanan mevcut seviye ihtiyacı başına bonus. */
export function houseHappiness(s: GameState, h: Building, st: NeedStatus[]): number {
  let toplam: number = BALANCE.mutlulukTaban;
  let agac = 0;
  for (const b of s.binalar) {
    if (b.type === 'ev' || !inRange(b, h)) continue;
    const m = ayar(s, `mutluluk.${b.type}`);
    if (dogaTuru(b.type)) agac += m; // ağaç ve çiçek ortak sınırı paylaşır
    else toplam += m;
  }
  toplam += Math.min(agac, ayar(s, 'agacMutlulukSinir'));
  const yol = bestRoadNear(s, h); // yakın yollardan yalnızca en iyisi sayılır
  if (yol) toplam += ROADS[yol.tur].mutluluk;
  toplam += currentNeedsMet(h, st) * BALANCE.ihtiyacMutluluk;
  toplam += adjacencyBonus(s, h.type, h.x, h.z, h.id).mutluluk; // göl manzarası
  toplam += geciciMutlulukBugun(s); // şenlik
  toplam += ayar(s, 'evMutluluk'); // karar kartları (ör. odun tasarrufu)
  return Math.min(BALANCE.mutlulukMax, Math.max(BALANCE.mutlulukMin, toplam));
}

/** floor(nüfus × (vergiTaban + mutluluk/100) × seviye çarpanı × kart vergi çarpanı). */
export function houseTax(nufus: number, mutluluk: number, seviye = 1, vergiCarpani = 1): number {
  const k = BALANCE.vergiSeviyeCarpani[houseLevel(seviye).seviye - 1];
  // Küçük pay: 10 × 1.5 × 0.6 gibi çarpımlar kayan noktada 8.999… çıkıp bir aşağı yuvarlanmasın.
  return Math.floor(nufus * (BALANCE.vergiTaban + mutluluk / 100) * k * vergiCarpani + 1e-9);
}

export function buildingsUpkeep(s: GameState): number {
  let g = 0;
  for (const b of s.binalar) g += buildingUpkeep(b, s);
  return g;
}

export function roadsUpkeep(s: GameState): number {
  let g = 0;
  for (const r of s.yollar) g += roadUpkeep(r);
  return g;
}

export function totalUpkeep(s: GameState): number {
  return buildingsUpkeep(s) + roadsUpkeep(s);
}

/**
 * Üretim. `sorunlar` verilirse günü yarıdan az verimle geçiren binalar oraya yazılır: eksik girdi malı,
 * dolu depo ('depo') ya da etki alanında ağaç olmaması ('agac'). İşçi eksikliği bütün kasabanındır, yazılmaz.
 */
export function runProduction(
  s: GameState, uretilen: Record<Good, number>, tuketilen: Record<Good, number>, sorunlar?: UretimSorunu[],
): void {
  const oran = workerRatio(s);
  const sinir = stockLimit(s);
  const kis = mevsim(s.gun) === 'kis';
  for (const t of URETIM_SIRASI) {
    const d = BUILDINGS[t];
    if (kis && d.kisinUretmez) continue; // Tarla kışın üretmez; Değirmen stoktaki buğdayla çalışır.
    for (const b of s.binalar) {
      if (b.type !== t) continue;
      if (d.uretim) {
        let f = oran;
        const girdi = Object.entries(d.uretim.girdi) as [Good, number][];
        // Çıktı miktarları karar kartlarıyla değişebilir (ayar).
        const cikti = (Object.keys(d.uretim.cikti) as Good[]).map((g): [Good, number] => [g, ayar(s, `uretim.${t}.${g}`)]);
        // Komşuluk bonusu yalnızca çıktıyı artırır; girdi tüketimi değişmez (gereken × f).
        const carpan = 1 + (d.komsuluk ? adjacencyBonus(s, t, b.x, b.z, b.id).oran : 0);
        let neden: UretimSorunu['neden'] | null = null;
        for (const [g, n] of girdi) {
          if (n > 0 && s.stok[g] / n < f) {
            f = s.stok[g] / n;
            if (f < oran * 0.5) neden = g;
          }
        }
        // Karar: çıktı stok sınırına dayanırsa üretim (ve girdi tüketimi) de o oranda düşer, girdi boşa gitmez.
        // Sınır denetimi bonuslu çıktıyla yapılır.
        for (const [g, n] of cikti) {
          if (n > 0 && (sinir - s.stok[g]) / (n * carpan) < f) {
            f = (sinir - s.stok[g]) / (n * carpan);
            if (f < oran * 0.5) neden = 'depo';
          }
        }
        if (neden && sorunlar) sorunlar.push({ id: b.id, neden });
        if (f <= 0) continue;
        for (const [g, n] of girdi) {
          s.stok[g] = Math.max(0, s.stok[g] - n * f);
          tuketilen[g] += n * f;
        }
        for (const [g, n] of cikti) {
          s.stok[g] = Math.min(sinir, s.stok[g] + n * f * carpan);
          uretilen[g] += n * f * carpan;
        }
      } else if (d.agacBasinaOdun !== undefined) {
        const agac = treesInRange(s, b);
        if (sorunlar && agac === 0) sorunlar.push({ id: b.id, neden: 'agac' });
        else if (sorunlar && s.stok.odun >= sinir) sorunlar.push({ id: b.id, neden: 'depo' });
        const miktar = Math.min(agac * d.agacBasinaOdun * ayar(s, 'oduncuCarpani') * oran, sinir - s.stok.odun);
        if (miktar <= 0) continue;
        s.stok.odun += miktar;
        uretilen.odun += miktar;
      }
    }
  }
  s.toplamYemek += uretilen.yemek;
}

export function endDay(s: GameState): DayReport {
  const rapor: DayReport = {
    gun: s.gun, vergi: 0, gider: 0, binaGider: 0, yolGider: 0, net: 0, binaVergileri: [], uretilen: emptyGoods(), tuketilen: emptyGoods(),
    seviyeDegisimleri: [], yeniHedefler: [], yeniAcilanlar: [], oyunBitti: s.bitti, uretimSorunlari: [],
  };
  if (s.bitti) return rapor;

  const oncekiNufus = s.nufus;

  // 1. Üretim (işçi oranı önceki gün nüfusuyla).
  runProduction(s, rapor.uretilen, rapor.tuketilen, rapor.uretimSorunlari);

  // 2. Ev ihtiyaçları, mutluluk, vergi (id'si küçük ev önce beslenir).
  const evler = s.binalar.filter((b) => b.type === 'ev').sort((a, b) => a.id - b.id);
  const mutluluklar = new Map<number, number>();
  const durumlar = new Map<number, NeedStatus[]>();
  const ix = hizmetIndeksi(s); // bu döngüde bina eklenmez, yıkılmaz, yükseltilmez
  for (const h of evler) {
    const st = evaluateNeeds(s, h, rapor.tuketilen, ix);
    durumlar.set(h.id, st);
    const m = houseHappiness(s, h, st);
    mutluluklar.set(h.id, m);
    // Karar: vergi, seviye değişiminden önceki seviyenin nüfusuyla hesaplanır.
    const v = houseTax(housePopulation(h), m, h.seviye, ayar(s, 'vergiCarpani'));
    rapor.binaVergileri.push({ id: h.id, miktar: v });
    rapor.vergi += v;
  }

  // 3. Seviye atlama / düşme (2 gün üst üste kuralı).
  for (const h of evler) {
    const st = durumlar.get(h.id)!;
    const cur = houseLevel(h.seviye);
    const next = h.seviye < HOUSE_LEVELS.length ? houseLevel(h.seviye + 1) : null;
    const ok = (n: Need) => st.some((x) => x.ihtiyac === n && x.karsilandi);
    const eski = h.seviye;

    if (next && next.ihtiyaclar.every(ok)) h.iyiGun++;
    else h.iyiGun = 0;
    if (cur.ihtiyaclar.every(ok)) h.kotuGun = 0;
    else h.kotuGun++;

    if (next && h.iyiGun >= ayar(s, 'seviyeAtlamaGun')) {
      h.seviye++;
      h.iyiGun = 0;
      h.kotuGun = 0;
    } else if (h.seviye > 1 && h.kotuGun >= BALANCE.seviyeGunEsigi) {
      h.seviye--;
      h.iyiGun = 0;
      h.kotuGun = 0;
    }
    if (h.seviye !== eski) rapor.seviyeDegisimleri.push({ id: h.id, eski, yeni: h.seviye });
  }

  // 4. Para.
  rapor.binaGider = buildingsUpkeep(s);
  rapor.yolGider = roadsUpkeep(s);
  rapor.gider = rapor.binaGider + rapor.yolGider;
  rapor.net = rapor.vergi - rapor.gider;
  s.para += rapor.net;

  // 5. Nüfus ve nüfus-ağırlıklı ortalama mutluluk (yeni seviyelerle; ev yoksa taban mutluluk).
  recomputeTotals(s, mutluluklar);

  // 6. Borç ve oyun sonu.
  if (s.para < BALANCE.borcSiniri) s.borcGunu++;
  else s.borcGunu = 0;
  if (s.borcGunu >= BALANCE.borcGunSiniri) s.bitti = true;

  // 7. Hedefler ve yeni açılan binalar.
  rapor.yeniHedefler = checkGoals(s);
  rapor.yeniAcilanlar = BUILDING_ORDER.filter((t) => !isUnlockedAt(oncekiNufus, t) && isUnlockedAt(s.nufus, t));

  // 8. Sakin istekleri ve gezgin tüccar (tüccar bir gün kalır).
  const ist = istekGunSonu(s);
  if (ist.tamamlanan) rapor.tamamlananIstek = ist.tamamlanan;
  if (ist.yeni) rapor.yeniIstek = ist.yeni;
  ticaretGunSonu(s);
  kartGunSonu(s); // 50, 100, 150. gün: karar kartı seçimi

  rapor.oyunBitti = s.bitti;
  s.gun++;
  return rapor;
}

// Karar: nüfus ve ortalama mutluluk yalnızca gün sonunda güncellenir (yerleştirme/yıkımda değil).
function recomputeTotals(s: GameState, mutluluklar: Map<number, number>): void {
  let nufus = 0;
  let agirlikli = 0;
  for (const b of s.binalar) {
    if (b.type !== 'ev') continue;
    const p = housePopulation(b);
    nufus += p;
    agirlikli += p * (mutluluklar.get(b.id) ?? BALANCE.mutlulukTaban);
  }
  s.nufus = nufus;
  s.mutluluk = nufus > 0 ? agirlikli / nufus : BALANCE.mutlulukTaban;
}
