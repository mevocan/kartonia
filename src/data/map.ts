// Harita: ekranı dolduran büyük arazi. Oynanabilir alan yuvarlatılmış kare (ADA_KENAR);
// dışında DIS_SINIR'a kadar dekoratif arazi (yoğun orman, tepeler) sürer, oraya bina/yol konmaz.
// Oynanabilir alanın içeriği (göller, tepeler, ormanlar, başlangıç yolu) her yeni oyunda tohumdan üretilir.
// Saf veri + deterministik üretim. Mantık ve çizim aynı veriyi (HARITA) kullanır.

export interface Vec2 {
  x: number;
  z: number;
}

export interface Hill {
  x: number;
  z: number;
  /** Gauss yarıçapı. */
  r: number;
  /** Tepe yüksekliği. */
  h: number;
}

export interface Blob {
  x: number;
  z: number;
  /** Ortalama yarıçap. */
  r: number;
  /** Kenar dalgalanması için sinüs terimleri: [genlik, frekans, faz]. */
  dalga: [number, number, number][];
}

/** Bir blob'un kenar çokgeni (saat yönünün tersine, n nokta). */
export function blobPolygon(b: Blob, n: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = b.r;
    for (const [a, f, p] of b.dalga) r += a * Math.sin(f * t + p);
    out.push({ x: b.x + r * Math.cos(t), z: b.z + r * Math.sin(t) });
  }
  return out;
}

/** Hafif dalgalı, köşeleri yuvarlatılmış kare (saat yönünün tersine). */
function roundedSquare(half: number, cornerR: number, n: number): Vec2[] {
  const out: Vec2[] = [];
  const inner = half - cornerR;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const dx = Math.cos(t);
    const dz = Math.sin(t);
    // Işın ile yuvarlatılmış kare kesişimi: süperelips yaklaşımı yerine doğrudan sınır noktası.
    const p = pointOnRoundedSquare(dx, dz, inner, cornerR);
    const wob = 0.8 * Math.sin(7 * t + 0.4) + 0.5 * Math.sin(13 * t + 1.9);
    const len = Math.hypot(p.x, p.z);
    out.push({ x: p.x + (p.x / len) * wob, z: p.z + (p.z / len) * wob });
  }
  return out;
}

function pointOnRoundedSquare(dx: number, dz: number, inner: number, cr: number): Vec2 {
  // İkili arama: merkezden (dx,dz) yönünde, yuvarlatılmış karenin içinde kalan en uzak nokta.
  let lo = 0;
  let hi = (inner + cr) * 2;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    const x = Math.abs(dx * m) - inner;
    const z = Math.abs(dz * m) - inner;
    const d = Math.hypot(Math.max(x, 0), Math.max(z, 0));
    if (d <= cr) lo = m;
    else hi = m;
  }
  return { x: dx * lo, z: dz * lo };
}

/** Oynanabilir alan sınırı (yarı genişlik 48). Adı tarihsel: isLand bu çokgene bakar. */
export const OYUN_YARI_GENISLIK = 48;
export const ADA_KENAR: Vec2[] = roundedSquare(OYUN_YARI_GENISLIK, 9, 160);

/** Çizilen arazinin yarı genişliği. Kamera bu alanın dışını göstermemeli. */
export const DIS_SINIR = 85;

/** Sınır dışı dekoratif tepeler (oynanabilir alanın çevresinde, manzara için). Her haritada aynıdır. */
export const DIS_TEPELER: Hill[] = [
  { x: -62, z: -20, r: 12, h: 5 },
  { x: -58, z: 35, r: 10, h: 4 },
  { x: -20, z: -64, r: 13, h: 6 },
  { x: 30, z: -62, r: 11, h: 4.5 },
  { x: 64, z: -5, r: 12, h: 5.5 },
  { x: 60, z: 45, r: 10, h: 4 },
  { x: 15, z: 64, r: 12, h: 4.5 },
  { x: -35, z: 62, r: 10, h: 3.5 },
  { x: 66, z: -60, r: 12, h: 6 },
  { x: -66, z: -64, r: 12, h: 5 },
  { x: -66, z: 66, r: 12, h: 5 },
  { x: 66, z: 66, r: 12, h: 5.5 },
];

export interface Taslik {
  x: number;
  z: number;
  r: number;
}

/** Nokta bir taşlığın içinde mi (etkin harita). */
export function inTaslik(x: number, z: number): boolean {
  return HARITA.tasliklar.some((t) => Math.hypot(x - t.x, z - t.z) <= t.r);
}

export interface Orman {
  x: number;
  z: number;
  r: number;
  agac: number;
}

/** Oynanabilir alanın içeriği. */
export interface HaritaVeri {
  /** Göller: bina ve yol konamaz. */
  goller: Blob[];
  /** Tepeler: yükseklik = Σ h·exp(-(d/r)²). */
  tepeler: Hill[];
  /** Ormanlar: oyun başında içleri doğal ağaçlarla doldurulur. */
  ormanlar: Orman[];
  /** Taşlık alanlar: taş ocağı yalnızca bunların içine kurulur. */
  tasliklar: Taslik[];
  /** Kenardan merkeze giren hazır toprak yol. */
  baslangicYolu: Vec2[];
  /** Doğal ağaçların yerleşim tohumu. */
  agacTohum: number;
}

/** Elle yapılmış ilk harita. Tohumsuz (eski) kayıtlar ve testler bunu kullanır. */
export const KLASIK_HARITA: HaritaVeri = {
  goller: [
    { x: -22, z: 14, r: 7, dalga: [[1.1, 3, 0.2], [0.6, 5, 1.0]] },
    { x: 24, z: -22, r: 4, dalga: [[0.5, 3, 1.7], [0.3, 4, 0.4]] },
    { x: 31, z: 27, r: 5, dalga: [[0.7, 3, 2.4], [0.4, 5, 0.3]] },
    { x: -31, z: -33, r: 3.5, dalga: [[0.4, 3, 0.9], [0.25, 5, 2.2]] },
  ],
  tepeler: [
    { x: 14, z: -8, r: 8, h: 2.6 },
    { x: -16, z: -20, r: 9, h: 3.0 },
    { x: 27, z: 10, r: 7, h: 2.0 },
    { x: -36, z: 2, r: 6, h: 1.6 },
    { x: 9, z: 33, r: 7, h: 1.8 },
    { x: 37, z: -38, r: 6, h: 2.2 },
    { x: -6, z: -38, r: 6, h: 1.5 },
  ],
  ormanlar: [
    { x: -17, z: -22, r: 8, agac: 60 },
    { x: 30, z: 12, r: 6, agac: 35 },
    { x: -13, z: 30, r: 6, agac: 30 },
    { x: 36, z: -9, r: 5, agac: 22 },
    { x: 6, z: -35, r: 6, agac: 30 },
    { x: -37, z: -8, r: 5, agac: 22 },
    { x: -36, z: 35, r: 5, agac: 20 },
    { x: 18, z: 38, r: 4.5, agac: 16 },
  ],
  baslangicYolu: [
    { x: 0.5, z: 45.5 },
    { x: 0.0, z: 39 },
    { x: -1.2, z: 32 },
    { x: -1.0, z: 25 },
    { x: 0.2, z: 18 },
    { x: 0.8, z: 11 },
    { x: 0.4, z: 5 },
    { x: 1.0, z: 1 },
  ],
  tasliklar: [
    { x: 22, z: 2, r: 4.5 },
    { x: -26, z: -3, r: 4 },
    { x: -2, z: -20, r: 4.5 },
  ],
  agacTohum: 1337,
};

/** Deterministik RNG (mulberry32), [0,1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Noktanın çoklu çizgiye uzaklığı. */
export function polylineDist(x: number, z: number, pts: Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

/** Üretim ayarları. */
export const HARITA_URETIM = {
  /** Merkezin bu yarıçapı göl, orman ve tepeden boş kalır: ilk evler için yer. */
  merkezBosluk: 13,
  /** Göl/orman/tepenin oynanabilir alan kenarına en az uzaklığı (yarıçap hariç). */
  kenarPayi: 4,
  golSayisi: [3, 5],
  golYaricap: [3.5, 7],
  tepeSayisi: [6, 8],
  ormanSayisi: [7, 9],
  ormanYaricap: [4.5, 8],
  taslikSayisi: [2, 4],
  taslikYaricap: [3.5, 5.5],
  /** Orman yarıçapının karesi başına ağaç. */
  agacYogunluk: 0.9,
} as const;

/**
 * Tohumdan rastgele harita. Aynı tohum hep aynı haritayı verir.
 * Garanti: başlangıç yolu karada, göl ve orman dışında; merkez çevresi boş.
 */
export function haritaUret(tohum: number): HaritaVeri {
  const U = HARITA_URETIM;
  const rnd = makeRng(tohum);
  const ara = (a: number, b: number): number => a + rnd() * (b - a);
  const tam = (r: readonly [number, number]): number => Math.floor(ara(r[0], r[1] + 1));
  const sinir = OYUN_YARI_GENISLIK - U.kenarPayi;
  /** Daire oynanabilir kare içinde ve kenara pay bırakıyor mu. */
  const icerde = (x: number, z: number, r: number): boolean => Math.abs(x) + r < sinir && Math.abs(z) + r < sinir;

  // Başlangıç yolu: rastgele bir yönden kenardan merkeze, hafif kıvrımlı.
  const yon = rnd() * Math.PI * 2;
  const ux = Math.cos(yon);
  const uz = Math.sin(yon);
  const kivrimFaz = rnd() * Math.PI * 2;
  const kivrimGenlik = ara(0.6, 1.6);
  const baslangicYolu: Vec2[] = [];
  const ADIM = 8;
  for (let i = 0; i < ADIM; i++) {
    const t = i / (ADIM - 1);
    const d = 45.5 - t * 44.5; // kenardan (45.5) merkeze (1)
    const yan = Math.sin(t * Math.PI * 1.6 + kivrimFaz) * kivrimGenlik * (1 - t * 0.7);
    baslangicYolu.push({ x: ux * d - uz * yan, z: uz * d + ux * yan });
  }

  // Göller
  const goller: Blob[] = [];
  const golHedef = tam(U.golSayisi);
  for (let deneme = 0; deneme < 400 && goller.length < golHedef; deneme++) {
    const r = ara(U.golYaricap[0], U.golYaricap[1]);
    const x = ara(-sinir, sinir);
    const z = ara(-sinir, sinir);
    const dalgaPay = r * 0.25; // dalga genliklerinin toplamı en fazla bu
    if (!icerde(x, z, r + dalgaPay)) continue;
    if (Math.hypot(x, z) < U.merkezBosluk + r + dalgaPay) continue;
    if (polylineDist(x, z, baslangicYolu) < r + dalgaPay + 3) continue;
    if (goller.some((g) => Math.hypot(x - g.x, z - g.z) < r + g.r + 8)) continue;
    goller.push({
      x, z, r,
      dalga: [[r * ara(0.08, 0.15), 3, ara(0, 6.28)], [r * ara(0.04, 0.09), 5, ara(0, 6.28)]],
    });
  }

  // Tepeler (göl üstüne denk gelirse göl çukuru kazanır)
  const tepeler: Hill[] = [];
  const tepeHedef = tam(U.tepeSayisi);
  for (let deneme = 0; deneme < 400 && tepeler.length < tepeHedef; deneme++) {
    const x = ara(-sinir, sinir);
    const z = ara(-sinir, sinir);
    if (Math.hypot(x, z) < U.merkezBosluk) continue;
    if (tepeler.some((t) => Math.hypot(x - t.x, z - t.z) < 12)) continue;
    tepeler.push({ x, z, r: ara(6, 9), h: ara(1.5, 3) });
  }

  // Ormanlar
  const ormanlar: Orman[] = [];
  const ormanHedef = tam(U.ormanSayisi);
  for (let deneme = 0; deneme < 600 && ormanlar.length < ormanHedef; deneme++) {
    const r = ara(U.ormanYaricap[0], U.ormanYaricap[1]);
    const x = ara(-sinir, sinir);
    const z = ara(-sinir, sinir);
    if (!icerde(x, z, r)) continue;
    if (Math.hypot(x, z) < U.merkezBosluk + r) continue;
    if (polylineDist(x, z, baslangicYolu) < r + 2.5) continue;
    if (goller.some((g) => Math.hypot(x - g.x, z - g.z) < r + g.r * 1.25 + 2)) continue;
    if (ormanlar.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 3)) continue;
    ormanlar.push({ x, z, r, agac: Math.round(r * r * U.agacYogunluk) });
  }

  // Taşlıklar (göl, orman ve yoldan uzak; merkezde değil). Ağaç tohumu bundan önce çekilir ki
  // taşlık eklemek eski tohumların ormanlarını değiştirmesin.
  const agacTohum = Math.floor(rnd() * 2 ** 31);
  const tasliklar: Taslik[] = [];
  const taslikHedef = tam(U.taslikSayisi);
  for (let deneme = 0; deneme < 600 && tasliklar.length < taslikHedef; deneme++) {
    const r = ara(U.taslikYaricap[0], U.taslikYaricap[1]);
    const x = ara(-sinir, sinir);
    const z = ara(-sinir, sinir);
    if (!icerde(x, z, r)) continue;
    if (Math.hypot(x, z) < U.merkezBosluk + r) continue;
    if (polylineDist(x, z, baslangicYolu) < r + 2.5) continue;
    if (goller.some((g) => Math.hypot(x - g.x, z - g.z) < r + g.r * 1.25 + 2)) continue;
    if (ormanlar.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 2)) continue;
    if (tasliklar.some((t) => Math.hypot(x - t.x, z - t.z) < r + t.r + 10)) continue;
    tasliklar.push({ x, z, r });
  }

  return { goller, tepeler, ormanlar, tasliklar, baslangicYolu, agacTohum };
}

/** Çayır: içi doğal çiçeklerle dolu küçük açıklık. Arılık yanında bal bonusu verir. */
export interface Cayir {
  x: number;
  z: number;
  r: number;
  cicek: number;
}

/**
 * Haritanın çayırları. Ayrı bir tohumla (ağaç tohumundan türetilir) en son yerleşir; böylece
 * eski tohumların göl, orman ve taşlıkları değişmez. Merkeze ormanlardan daha yakın olabilir.
 */
export function cayirlariUret(h: HaritaVeri): Cayir[] {
  const C = CAYIR_URETIM;
  const rnd = makeRng((h.agacTohum ^ 0x5bd1e995) >>> 0);
  const ara = (a: number, b: number): number => a + rnd() * (b - a);
  const sinir = OYUN_YARI_GENISLIK - C.kenarPayi;
  const hedef = Math.floor(ara(C.sayi[0], C.sayi[1] + 1));
  const cayirlar: Cayir[] = [];
  for (let deneme = 0; deneme < 800 && cayirlar.length < hedef; deneme++) {
    const r = ara(C.yaricap[0], C.yaricap[1]);
    const x = ara(-sinir, sinir);
    const z = ara(-sinir, sinir);
    if (Math.abs(x) + r > sinir || Math.abs(z) + r > sinir) continue;
    if (Math.hypot(x, z) < C.merkezBosluk + r) continue;
    if (polylineDist(x, z, h.baslangicYolu) < r + 2) continue;
    if (h.goller.some((g) => Math.hypot(x - g.x, z - g.z) < r + g.r * 1.25 + 1.5)) continue;
    if (h.ormanlar.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 1.5)) continue;
    if (h.tasliklar.some((t) => Math.hypot(x - t.x, z - t.z) < r + t.r + 1.5)) continue;
    if (cayirlar.some((c) => Math.hypot(x - c.x, z - c.z) < r + c.r + 8)) continue;
    cayirlar.push({ x, z, r, cicek: Math.round(r * r * C.yogunluk) });
  }
  return cayirlar;
}

export const CAYIR_URETIM = {
  sayi: [5, 7],
  yaricap: [2.5, 3.8],
  /** Merkezin bu yarıçapı çayırsız kalır. */
  merkezBosluk: 9,
  kenarPayi: 4,
  /** Yarıçapın karesi başına çiçek. */
  yogunluk: 1.3,
} as const;

/** Etkin harita: veri + türetilmiş alanlar. */
export interface AktifHarita extends HaritaVeri {
  /** null: klasik harita. */
  tohum: number | null;
  /** Çiçek çayırları (her haritada tohumdan türetilir). */
  cayirlar: Cayir[];
  golKenarlari: Vec2[][];
  /** İç ve dış tepeler birlikte (heightAt sıcak yolu için önceden birleştirilmiş). */
  tumTepeler: Hill[];
}

function aktiflestir(h: HaritaVeri, tohum: number | null): AktifHarita {
  return {
    ...h,
    tohum,
    cayirlar: cayirlariUret(h),
    golKenarlari: h.goller.map((g) => blobPolygon(g, 56)),
    tumTepeler: h.tepeler.concat(DIS_TEPELER),
  };
}

/**
 * Şu an oynanan harita. Mantık ve çizim alanlarını her kullanımda buradan okur, dizileri saklamaz.
 * Yalnızca haritayiAyarla ile değişir.
 */
export const HARITA: AktifHarita = aktiflestir(KLASIK_HARITA, null);

/** Etkin haritayı tohuma göre kurar (null/undefined: klasik harita). */
export function haritayiAyarla(tohum: number | null | undefined): void {
  const t = tohum ?? null;
  if (t === HARITA.tohum) return;
  Object.assign(HARITA, aktiflestir(t === null ? KLASIK_HARITA : haritaUret(t), t));
}
