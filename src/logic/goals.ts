import type { BuildingType, GameState, GoalDef } from './types';

interface Goal extends GoalDef {
  check: (s: GameState) => boolean;
  /** Sayılabilir hedeflerde ilerleme: [mevcut, hedef]. */
  ilerleme?: (s: GameState) => [number, number];
}

function seviye3Ev(s: GameState): number {
  return s.binalar.filter((b) => b.type === 'ev' && b.seviye >= 3).length;
}

function enYuksekSeviye(s: GameState, t: BuildingType): number {
  return s.binalar.reduce((m, b) => (b.type === t ? Math.max(m, b.seviye) : m), 0);
}

const GOAL_LIST: Goal[] = [
  { ad: 'Küçük köy', aciklama: '10 nüfusa ulaş.', check: (s) => s.nufus >= 10, ilerleme: (s) => [s.nufus, 10] },
  { ad: 'İlk yemek', aciklama: 'Fırında ya da balıkçıda ilk yemeği üret.', check: (s) => s.toplamYemek > 0 },
  { ad: 'Kasaba', aciklama: '50 nüfusa ulaş.', check: (s) => s.nufus >= 50, ilerleme: (s) => [s.nufus, 50] },
  { ad: 'İki katlı ev', aciklama: 'Bir evi 3. seviyeye çıkar.', check: (s) => seviye3Ev(s) >= 1 },
  {
    ad: 'Kasaba tamamlandı', aciklama: "150 nüfusa ulaş ve Saat Kulesi'ni tamamla.",
    // Yalnızca tamamlanmış kule sayılır (insaat alanı yok).
    check: (s) => s.nufus >= 150 && s.binalar.some((b) => b.type === 'saatKulesi' && !b.insaat),
    ilerleme: (s) => [s.nufus, 150],
  },
  // ---- 150 nüfustan sonrası ----
  {
    ad: 'Gürül gürül çeşme', aciklama: 'Bir Çeşme\'yi 3. seviyeye yükselt.',
    check: (s) => enYuksekSeviye(s, 'cesme') >= 3,
    ilerleme: (s) => [enYuksekSeviye(s, 'cesme'), 3],
  },
  {
    ad: 'Mutlu kasaba', aciklama: '200 nüfusa ulaş, ortalama mutluluk en az 70 olsun.',
    check: (s) => s.nufus >= 200 && s.mutluluk >= 70,
    ilerleme: (s) => [s.nufus, 200],
  },
  {
    ad: 'İki katlı mahalle', aciklama: '10 evi 3. seviyeye çıkar.',
    check: (s) => seviye3Ev(s) >= 10,
    ilerleme: (s) => [seviye3Ev(s), 10],
  },
  {
    ad: 'Pazar yeri ve mektep', aciklama: 'Bir Pazar\'ı ve bir Okul\'u 3. seviyeye yükselt.',
    check: (s) => enYuksekSeviye(s, 'pazar') >= 3 && enYuksekSeviye(s, 'okul') >= 3,
  },
  {
    ad: 'Dolu ambar', aciklama: 'Ambarda aynı anda 150 yemek ve 100 odun biriktir.',
    check: (s) => s.stok.yemek >= 150 && s.stok.odun >= 100,
  },
  {
    ad: 'Zengin kasaba', aciklama: 'Kasada 1000 para biriktir.',
    check: (s) => s.para >= 1000,
    ilerleme: (s) => [Math.floor(s.para), 1000],
  },
  {
    ad: 'Kalabalık kasaba', aciklama: '300 nüfusa ulaş.',
    check: (s) => s.nufus >= 300,
    ilerleme: (s) => [s.nufus, 300],
  },
  {
    ad: 'Kasaba efsanesi', aciklama: '400 nüfusa ulaş, ortalama mutluluk en az 75 olsun.',
    check: (s) => s.nufus >= 400 && s.mutluluk >= 75,
    ilerleme: (s) => [s.nufus, 400],
  },
];

export const GOALS: GoalDef[] = GOAL_LIST.map(({ ad, aciklama }) => ({ ad, aciklama }));

/** "Kasaba tamamlandı" hedefinin indeksi (eski son hedef; sonrasında yeni hedefler başlar). */
export const KASABA_TAMAM_HEDEFI = 4;

/** Mevcut hedefin sayısal ilerlemesi; sayılamayan hedefte ya da hepsi bittiyse null. */
export function goalProgress(s: GameState): { mevcut: number; hedef: number } | null {
  const g = GOAL_LIST[s.hedef];
  if (!g?.ilerleme) return null;
  const [mevcut, hedef] = g.ilerleme(s);
  return { mevcut: Math.max(0, Math.min(mevcut, hedef)), hedef };
}

/** Hedefleri sırayla kontrol eder; tamamlananları s.hedef'e işler ve indekslerini döndürür. */
export function checkGoals(s: GameState): number[] {
  const yeni: number[] = [];
  while (s.hedef < GOAL_LIST.length && GOAL_LIST[s.hedef].check(s)) {
    yeni.push(s.hedef);
    s.hedef++;
  }
  return yeni;
}
