// Alt kenardaki inşa menüsü: kategoriler (Yollar, Konut, Üretim, Hizmet, Doğa) + Yık; kategoriye tıklayınca
// üstünde o kategorinin kartları açılır.
// Karta tıklamak aracı seçer ve sağda bina kartını (detay) açar; kilitli kartta yalnızca detay açılır.
import type { BuildingType, GameState, RoadType } from '../logic/types';
import { BUILDINGS, BUILDING_ORDER, ROADS } from '../data/buildings';
import { isRoadUnlocked, isUnlocked } from '../logic/game';
import { el } from './dom';
import { binaAd, t, yolAd } from './i18n';
import { createBuildingCard } from './buildingCard';

export type Tool = BuildingType | RoadType | 'yikim' | null;

const ROAD_ORDER: RoadType[] = ['toprak', 'asfalt'];

export function isRoadTool(t: Tool): t is RoadType {
  return t === 'toprak' || t === 'asfalt';
}

export function isBuildingTool(t: Tool): t is BuildingType {
  return t !== null && t !== 'yikim' && !isRoadTool(t);
}

export interface BuildMenu {
  update(s: GameState): void;
  /** Seçili araç değişti: kart vurgusu ve bina kartı (null → kart kapanır). */
  setSelected(tool: Tool): void;
  /** Bina kartını kapatır (ör. haritada bir bina seçilince bilgi paneli açılır). */
  hideDetail(): void;
}

/** Yol kartlarının resmi: kağıt üstünde kıvrımlı kısa bir yol parçası (canvas, bir kez üretilir). */
const yolResimleri = new Map<RoadType, string>();
function yolResmi(t: RoadType): string {
  const hazir = yolResimleri.get(t);
  if (hazir) return hazir;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 108;
  const g = c.getContext('2d');
  if (!g) return '';
  const yol = (): void => {
    g.beginPath();
    g.moveTo(10, 92);
    g.bezierCurveTo(50, 92, 40, 20, 118, 18);
  };
  g.lineCap = 'round';
  const katman = (renk: string, en: number): void => {
    yol();
    g.strokeStyle = renk;
    g.lineWidth = en;
    g.stroke();
  };
  if (t === 'asfalt') {
    katman('#4a3a30', 38);
    katman('#efe4cf', 35);
    katman('#6f6a6b', 26);
    g.setLineDash([9, 9]);
    katman('#fff1c9', 3);
  } else {
    katman('#4a3a30', 31);
    katman('#c49a63', 28);
    katman('#d9b27c', 22);
    g.setLineDash([4, 10]);
    katman('#c49a63', 2);
  }
  const url = c.toDataURL('image/png');
  yolResimleri.set(t, url);
  return url;
}

type MenuKey = BuildingType | RoadType;

interface Kart {
  b: HTMLButtonElement;
  maliyet: HTMLDivElement;
  kilit: HTMLDivElement;
}

type Kategori = 'yol' | 'konut' | 'uretim' | 'hizmet' | 'doga';

const KATEGORI_SIRASI: Kategori[] = ['yol', 'konut', 'uretim', 'hizmet', 'doga'];

const KATEGORILER: Record<Kategori, { ad: string; ikon: string; renk: string; ogeler: MenuKey[] }> = {
  yol: { ad: t('menu.yollar'), ikon: '🛤️', renk: '#e3c08f', ogeler: ['toprak', 'asfalt'] },
  konut: { ad: t('menu.konut'), ikon: '🏠', renk: '#f4b7a3', ogeler: ['ev'] },
  uretim: {
    ad: t('menu.uretim'), ikon: '🌾', renk: '#f2d272',
    ogeler: ['tarla', 'degirmen', 'firin', 'oduncu', 'balikci', 'tasOcagi', 'marangoz', 'agil', 'dokumaci', 'arilik', 'ambar'],
  },
  hizmet: {
    ad: t('menu.hizmet'), ikon: '🏛️', renk: '#a9d5e8',
    ogeler: ['cesme', 'pazar', 'okul', 'hastane', 'park', 'hamam', 'tiyatro', 'saatKulesi', 'kervansaray', 'botanik'],
  },
  doga: { ad: t('menu.doga'), ikon: '🌳', renk: '#b9d99a', ogeler: ['agac', 'cicek', 'cit', 'bank', 'ciceklik', 'lamba', 'heykel'] },
};
const YIKIM_RENK = '#f0a399';
/** Kilitli kartın altındaki "🔒 35 nüfus". */
const NUFUS_KISA = t('genel.nufusKisa');

function kategoriOf(t: MenuKey): Kategori {
  return KATEGORI_SIRASI.find((k) => KATEGORILER[k].ogeler.includes(t)) ?? 'konut';
}

/**
 * `binaResmi`: binanın modelinden üretilmiş resim (renderer.buildingThumbnail). null dönerse
 * kart, kategori renginde düz bir kutu gösterir.
 */
export function createBuildMenu(
  root: HTMLElement,
  onSelect: (tool: Tool) => void,
  binaResmi: (t: BuildingType) => string | null,
): BuildMenu {
  const menu = el('div');
  menu.id = 'menu';
  root.appendChild(menu);
  const bar = el('div', 'kagit satir');
  bar.id = 'altMenu';
  const kategoriler = el('div', 'satir');
  menu.append(bar, kategoriler);

  let secili: Tool = null;
  let kilitli = new Set<MenuKey>();
  const kartlar = new Map<MenuKey, Kart>();
  const detay = createBuildingCard(root, () => {
    detay.hide();
    if (secili !== null) onSelect(null);
  });
  const resimOf = (k: MenuKey): string | null => (isRoadTool(k) ? yolResmi(k) : binaResmi(k));

  /** Karta tıklama: açık kart aracı seçer/bırakır (detay setSelected'da açılır); kilitli kart yalnızca detayı gösterir. */
  function kartTikla(k: MenuKey): void {
    if (kilitli.has(k)) {
      if (secili !== null) onSelect(null);
      detay.show(k, true, resimOf(k));
      return;
    }
    onSelect(secili === k ? null : k);
  }

  function kartEkle(t: MenuKey, ad: string, maliyetMetni: string, ekSinif = ''): void {
    const b = el('button', `kagit bina-kart ${ekSinif}`);
    b.style.setProperty('--kat', KATEGORILER[kategoriOf(t)].renk);
    const url = resimOf(t);
    let resim: HTMLElement;
    if (url) {
      const img = document.createElement('img');
      img.className = 'resim';
      img.src = url;
      img.alt = '';
      img.draggable = false;
      resim = img;
    } else {
      resim = el('div', 'resim bos');
    }
    const maliyet = el('div', 'maliyet', maliyetMetni);
    const kilit = el('div', 'kilit');
    b.append(resim, el('div', 'ad', ad), maliyet, kilit);
    b.addEventListener('click', () => kartTikla(t));
    bar.appendChild(b);
    kartlar.set(t, { b, maliyet, kilit });
  }

  // Kategoriye tıklayınca üstte o kategorinin bina kartları açılır; aynı kategoriye tekrar tıklamak kapatır.
  const kategoriButonlari = new Map<Kategori, HTMLButtonElement>();
  let acikKategori: Kategori | null = null;
  /** Oyuncunun açılmış hâlini gördüğü (kategorisini açtığı) kartlar; görülmeyen yeni kart kategoride nokta yakar. */
  const gorulen = new Set<MenuKey>();
  let ilkGuncelleme = true;

  function kategoriAc(k: Kategori | null): void {
    acikKategori = k;
    for (const [kk, b] of kategoriButonlari) b.classList.toggle('acik', kk === k);
    bar.classList.toggle('acik', k !== null);
    if (k !== null) bar.style.setProperty('--kat', KATEGORILER[k].renk);
    for (const [t, kart] of kartlar) {
      const goster = k !== null && KATEGORILER[k].ogeler.includes(t);
      kart.b.style.display = goster ? '' : 'none';
      if (goster && !kilitli.has(t)) gorulen.add(t);
    }
    if (k !== null) kategoriButonlari.get(k)?.classList.remove('yeni-var');
  }

  for (const yol of ROAD_ORDER) kartEkle(yol, yolAd(yol), `🪙 ${ROADS[yol].birimMaliyet}${t('genel.birimBasi')}`, 'yol-kart');
  for (const bina of BUILDING_ORDER) kartEkle(bina, binaAd(bina), `🪙 ${BUILDINGS[bina].maliyet}`);

  for (const k of KATEGORI_SIRASI) {
    const d = KATEGORILER[k];
    const b = el('button', 'kagit kategori');
    b.style.setProperty('--kat', d.renk);
    const yazi = el('div', 'yazi');
    yazi.append(el('div', 'ad', d.ad), el('div', 'sayi', ''));
    b.append(el('span', 'ikon', d.ikon), yazi, el('span', 'yeni'));
    b.addEventListener('click', () => kategoriAc(acikKategori === k ? null : k));
    kategoriler.appendChild(b);
    kategoriButonlari.set(k, b);
  }
  kategoriler.appendChild(el('div', 'menu-ayrac'));

  const yikB = el('button', 'kagit kategori yikim');
  yikB.style.setProperty('--kat', YIKIM_RENK);
  const yikYazi = el('div', 'yazi');
  yikYazi.append(el('div', 'ad', t('menu.yik')), el('div', 'sayi', t('menu.xTusu')));
  yikB.append(el('span', 'ikon', '🔨'), yikYazi);
  yikB.addEventListener('click', () => onSelect(secili === 'yikim' ? null : 'yikim'));
  kategoriler.appendChild(yikB);
  kategoriAc(null);

  return {
    update(s) {
      const yeniKilitli = new Set<MenuKey>();
      for (const [t, k] of kartlar) {
        let acik: boolean;
        let esik: number;
        let fiyat: number;
        if (isRoadTool(t)) {
          acik = isRoadUnlocked(s, t);
          esik = ROADS[t].acilmaNufus;
          fiyat = ROADS[t].birimMaliyet;
        } else {
          acik = isUnlocked(s, t);
          esik = BUILDINGS[t].acilmaNufus;
          fiyat = BUILDINGS[t].maliyet;
        }
        if (!acik) yeniKilitli.add(t);
        k.b.classList.toggle('kilitli', !acik);
        // Nüfus yetiyor ama bir anıt bekleniyorsa (büyük projeler: Saat Kulesi) onu yaz.
        const anit = !isRoadTool(t) ? BUILDINGS[t].acilmaAnit : undefined;
        k.kilit.textContent = acik ? '' : anit && s.nufus >= esik ? `🔒 ${binaAd(anit)}` : `🔒 ${esik} ${NUFUS_KISA}`;
        k.maliyet.style.display = acik ? '' : 'none';
        k.maliyet.classList.toggle('yetmez', s.para < fiyat);
      }
      kilitli = yeniKilitli;
      if (ilkGuncelleme) {
        // Kayıttan yüklenirken zaten açık olanlar "yeni" sayılmaz.
        for (const t of kartlar.keys()) if (!kilitli.has(t)) gorulen.add(t);
        ilkGuncelleme = false;
      }
      for (const k of KATEGORI_SIRASI) {
        const b = kategoriButonlari.get(k)!;
        const ogeler = KATEGORILER[k].ogeler;
        const acikSayi = ogeler.filter((t) => !kilitli.has(t)).length;
        b.querySelector('.sayi')!.textContent = t('menu.acik', { acik: acikSayi, toplam: ogeler.length });
        if (k === acikKategori) for (const t of ogeler) if (!kilitli.has(t)) gorulen.add(t);
        b.classList.toggle('yeni-var', ogeler.some((t) => !kilitli.has(t) && !gorulen.has(t)));
      }
    },
    setSelected(tool) {
      secili = tool;
      for (const [t, k] of kartlar) k.b.classList.toggle('secili', t === tool);
      yikB.classList.toggle('acik', tool === 'yikim');
      if (tool === null) detay.hide();
      else detay.show(tool, false, tool === 'yikim' ? null : resimOf(tool));
    },
    hideDetail() {
      detay.hide();
    },
  };
}
