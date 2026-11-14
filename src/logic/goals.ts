import type { BuildingType, GameState, GoalDef } from './types';

interface Goal extends GoalDef {
  check: (s: GameState) => boolean;
  /** Sayılabilir hedeflerde ilerleme: [mevcut, hedef]. */
  ilerleme?: (s: GameState) => [number, number];
}

/** "Zengin kasaba" hedefinin para eşiği. */
export const ZENGIN_KASABA = 2500;

function seviye3Ev(s: GameState): number {
  return s.binalar.filter((b) => b.type === 'ev' && b.seviye >= 3).length;
}

function seviyeliEv(s: GameState, seviye: number): number {
  return s.binalar.filter((b) => b.type === 'ev' && b.seviye >= seviye).length;
}

function enYuksekSeviye(s: GameState, t: BuildingType): number {
  return s.binalar.reduce((m, b) => (b.type === t ? Math.max(m, b.seviye) : m), 0);
}

// Karar: hedefler para ödülü verir (odul). İlk ikisinin ödülü açılıştaki bekleyişi kısaltır: yemek zincirine erken ulaşılır.
const GOAL_LIST: Goal[] = [
  { ad: 'Küçük köy', aciklama: '10 nüfusa ulaş.', odul: 50, check: (s) => s.nufus >= 10, ilerleme: (s) => [s.nufus, 10] },
  { ad: 'İlk yemek', aciklama: 'Fırında ya da balıkçıda ilk yemeği üret.', odul: 75, check: (s) => s.toplamYemek > 0 },
  { ad: 'Kasaba', aciklama: '50 nüfusa ulaş.', odul: 100, check: (s) => s.nufus >= 50, ilerleme: (s) => [s.nufus, 50] },
  { ad: 'İki katlı ev', aciklama: 'Bir evi 3. seviyeye çıkar.', odul: 150, check: (s) => seviye3Ev(s) >= 1 },
  {
    ad: 'Kasaba tamamlandı', aciklama: "150 nüfusa ulaş ve Saat Kulesi'ni tamamla.", odul: 300,
    // Yalnızca tamamlanmış kule sayılır (insaat alanı yok).
    check: (s) => s.nufus >= 150 && s.binalar.some((b) => b.type === 'saatKulesi' && !b.insaat),
    ilerleme: (s) => [s.nufus, 150],
  },
  // ---- 150 nüfustan sonrası ----
  {
    ad: 'Gürül gürül çeşme', aciklama: 'Bir Çeşme\'yi 3. seviyeye yükselt.', odul: 150,
    check: (s) => enYuksekSeviye(s, 'cesme') >= 3,
    ilerleme: (s) => [enYuksekSeviye(s, 'cesme'), 3],
  },
  {
    ad: 'Mutlu kasaba', aciklama: '200 nüfusa ulaş, ortalama mutluluk en az 70 olsun.', odul: 200,
    check: (s) => s.nufus >= 200 && s.mutluluk >= 70,
    ilerleme: (s) => [s.nufus, 200],
  },
  {
    ad: 'İki katlı mahalle', aciklama: '10 evi 3. seviyeye çıkar.', odul: 250,
    check: (s) => seviye3Ev(s) >= 10,
    ilerleme: (s) => [seviye3Ev(s), 10],
  },
  {
    ad: 'Pazar yeri ve mektep', aciklama: 'Bir Pazar\'ı ve bir Okul\'u 3. seviyeye yükselt.', odul: 250,
    check: (s) => enYuksekSeviye(s, 'pazar') >= 3 && enYuksekSeviye(s, 'okul') >= 3,
  },
  {
    ad: 'Dolu ambar', aciklama: 'Ambarda aynı anda 150 yemek ve 100 odun biriktir.', odul: 300,
    check: (s) => s.stok.yemek >= 150 && s.stok.odun >= 100,
  },
  {
    ad: 'Zengin kasaba', aciklama: `Kasada ${ZENGIN_KASABA} para biriktir.`, odul: 300,
    check: (s) => s.para >= ZENGIN_KASABA,
    ilerleme: (s) => [Math.floor(s.para), ZENGIN_KASABA],
  },
  {
    ad: 'Kalabalık kasaba', aciklama: '300 nüfusa ulaş.', odul: 400,
    check: (s) => s.nufus >= 300,
    ilerleme: (s) => [s.nufus, 300],
  },
  {
    ad: 'Konaklar', aciklama: '3 evi 4. seviyeye (Konak) çıkar.', odul: 400,
    check: (s) => seviyeliEv(s, 4) >= 3,
    ilerleme: (s) => [seviyeliEv(s, 4), 3],
  },
  {
    ad: 'Köşk', aciklama: 'Bir evi 5. seviyeye (Köşk) çıkar.', odul: 500,
    check: (s) => seviyeliEv(s, 5) >= 1,
  },
  {
    ad: 'Kasaba efsanesi', aciklama: '400 nüfusa ulaş, ortalama mutluluk en az 75 olsun.', odul: 1000,
    check: (s) => s.nufus >= 400 && s.mutluluk >= 75,
    ilerleme: (s) => [s.nufus, 400],
  },
];

export const GOALS: GoalDef[] = GOAL_LIST.map(({ ad, aciklama, odul }) => ({ ad, aciklama, odul }));

/** Konak ve Köşk hedefleri eklenmeden önceki hedef sayısı (eski kayıtların göçü için, save.ts). */
export const ESKI_HEDEF_SAYISI = 13;

/** "Kasaba tamamlandı" hedefinin indeksi (eski son hedef; sonrasında yeni hedefler başlar). */
export const KASABA_TAMAM_HEDEFI = 4;

/** Mevcut hedefin sayısal ilerlemesi; sayılamayan hedefte ya da hepsi bittiyse null. */
export function goalProgress(s: GameState): { mevcut: number; hedef: number } | null {
  const g = GOAL_LIST[s.hedef];
  if (!g?.ilerleme) return null;
  const [mevcut, hedef] = g.ilerleme(s);
  return { mevcut: Math.max(0, Math.min(mevcut, hedef)), hedef };
}

/** Verilen hedeflerin toplam para ödülü. */
export function goalReward(hedefler: number[]): number {
  return hedefler.reduce((t, i) => t + (GOAL_LIST[i]?.odul ?? 0), 0);
}

/**
 * Hedefleri sırayla kontrol eder; tamamlananları s.hedef'e işler, ödüllerini kasaya ekler ve indekslerini döndürür.
 * Karar: ödüller döngü bittikten sonra eklenir; bir hedefin ödülü aynı turda para hedefini tetiklemez (sonraki kontrolde sayılır).
 */
export function checkGoals(s: GameState): number[] {
  const yeni: number[] = [];
  while (s.hedef < GOAL_LIST.length && GOAL_LIST[s.hedef].check(s)) {
    yeni.push(s.hedef);
    s.hedef++;
  }
  s.para += goalReward(yeni);
  return yeni;
}
