// Alt kenardaki kağıt kart düğmeleri: yollar, binalar ve yıkma aracı.
import type { BuildingType, GameState, Good, RoadType } from '../logic/types';
import { BUILDINGS, BUILDING_ORDER, ROADS } from '../data/buildings';
import { isRoadUnlocked, isUnlocked } from '../logic/game';
import { el } from './dom';

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
  setSelected(tool: Tool): void;
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

const MAL_AD: Record<Good, string> = {
  bugday: 'buğday', un: 'un', yemek: 'yemek', odun: 'odun', tas: 'taş', mobilya: 'mobilya',
};

function malListesi(m: Partial<Record<Good, number>>): string {
  return (Object.keys(m) as Good[]).map((g) => `${m[g]} ${MAL_AD[g]}`).join(', ');
}

function uretimMetni(t: BuildingType): string | null {
  const d = BUILDINGS[t];
  if (d.agacBasinaOdun) return `Ağaç başına ${d.agacBasinaOdun} odun/gün`;
  if (!d.uretim) return null;
  const girdi = malListesi(d.uretim.girdi);
  const cikti = malListesi(d.uretim.cikti);
  return girdi ? `${girdi} → ${cikti} /gün` : `${cikti} /gün`;
}

type MenuKey = BuildingType | RoadType;

interface Kart {
  b: HTMLButtonElement;
  maliyet: HTMLDivElement;
  kilit: HTMLDivElement;
}

type Kategori = 'yol' | 'konut' | 'uretim' | 'hizmet';

const KATEGORI_SIRASI: Kategori[] = ['yol', 'konut', 'uretim', 'hizmet'];

const KATEGORILER: Record<Kategori, { ad: string; renk: string; ogeler: MenuKey[] }> = {
  yol: { ad: 'Yollar', renk: '#e3c08f', ogeler: ['toprak', 'asfalt'] },
  konut: { ad: 'Konut', renk: '#f4b7a3', ogeler: ['ev', 'agac'] },
  uretim: {
    ad: 'Üretim', renk: '#f2d272',
    ogeler: ['tarla', 'degirmen', 'firin', 'oduncu', 'balikci', 'tasOcagi', 'marangoz', 'ambar'],
  },
  hizmet: { ad: 'Hizmet', renk: '#a9d5e8', ogeler: ['cesme', 'pazar', 'okul', 'hastane', 'saatKulesi'] },
};
const YIKIM_RENK = '#f0a399';

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

  const ipucu = el('div', 'kagit');
  ipucu.id = 'ipucu';
  root.appendChild(ipucu);

  let secili: Tool = null;
  let kilitli = new Set<MenuKey>();
  const kartlar = new Map<MenuKey, Kart>();

  function ipucuGoster(b: HTMLElement, t: MenuKey | 'yikim'): void {
    ipucu.replaceChildren();
    const tablo = el('table');
    const satir = (a: string, v: string): void => {
      const tr = el('tr');
      tr.append(el('td', '', a), el('td', '', v));
      tablo.appendChild(tr);
    };
    if (t === 'yikim') {
      ipucu.append(
        el('h4', '', 'Yıkma aracı'),
        el('p', '', 'Bir binaya ya da yola tıkla, yıkılsın. Maliyetin yarısı geri gelir. Orman ağacını kesmek para ister, odun verir. (X)'),
      );
    } else if (isRoadTool(t)) {
      const d = ROADS[t];
      ipucu.append(el('h4', '', d.ad), el('p', '', d.aciklama + ' Sol tuşla sürükleyerek çiz.'));
      satir('Maliyet', `${d.birimMaliyet} /birim`);
      satir('Gider', d.birimGider > 0 ? `${d.birimGider} /birim/gün` : 'yok');
      satir('Mutluluk', d.mutluluk !== 0 ? `${d.mutluluk > 0 ? '+' : ''}${d.mutluluk} (kenardaki evler)` : 'yok');
      if (kilitli.has(t)) satir('Açılma', `${d.acilmaNufus} nüfus`);
      ipucu.appendChild(tablo);
    } else {
      const d = BUILDINGS[t];
      ipucu.append(el('h4', '', d.ad), el('p', '', d.aciklama));
      satir('Maliyet', String(d.maliyet));
      satir('Gider', d.gider > 0 ? `${d.gider} /gün` : 'yok');
      if (d.isci > 0) satir('İşçi', String(d.isci));
      if (d.etki > 0) satir('Etki yarıçapı', String(d.etki));
      if (d.mutluluk !== 0) satir('Mutluluk', (d.mutluluk > 0 ? '+' : '') + d.mutluluk);
      const u = uretimMetni(t);
      if (u) satir('Üretim', u);
      if (d.yer === 'gol') satir('Yer', 'göl kıyısı');
      if (d.yer === 'taslik') satir('Yer', 'taşlık alan');
      if (d.depo) satir('Stok sınırı', `+${d.depo}`);
      if (kilitli.has(t)) satir('Açılma', `${d.acilmaNufus} nüfus`);
      ipucu.appendChild(tablo);
    }
    ipucu.style.display = 'block';
    const r = b.getBoundingClientRect();
    const w = 220;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    ipucu.style.left = `${left}px`;
    ipucu.style.top = '0px';
    const h = ipucu.offsetHeight;
    ipucu.style.top = `${r.top - h - 26}px`;
  }
  const ipucuGizle = (): void => { ipucu.style.display = 'none'; };

  function kartEkle(t: MenuKey, ad: string, maliyetMetni: string, ekSinif = ''): void {
    const b = el('button', `kagit bina-kart ${ekSinif}`);
    b.style.setProperty('--kat', KATEGORILER[kategoriOf(t)].renk);
    const url = isRoadTool(t) ? yolResmi(t) : binaResmi(t);
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
    b.addEventListener('click', () => {
      if (kilitli.has(t)) return;
      onSelect(secili === t ? null : t);
    });
    b.addEventListener('mouseenter', () => ipucuGoster(b, t));
    b.addEventListener('mouseleave', ipucuGizle);
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
    ipucuGizle();
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

  for (const t of ROAD_ORDER) kartEkle(t, ROADS[t].ad, `🪙 ${ROADS[t].birimMaliyet}/birim`, 'yol-kart');
  for (const t of BUILDING_ORDER) kartEkle(t, BUILDINGS[t].ad, `🪙 ${BUILDINGS[t].maliyet}`);

  for (const k of KATEGORI_SIRASI) {
    const d = KATEGORILER[k];
    const b = el('button', 'kagit kategori');
    b.style.setProperty('--kat', d.renk);
    b.append(el('div', 'ad', d.ad), el('div', 'sayi', ''), el('span', 'yeni'));
    b.addEventListener('click', () => kategoriAc(acikKategori === k ? null : k));
    kategoriler.appendChild(b);
    kategoriButonlari.set(k, b);
  }
  kategoriler.appendChild(el('div', 'menu-ayrac'));

  const yikB = el('button', 'kagit kategori yikim');
  yikB.style.setProperty('--kat', YIKIM_RENK);
  yikB.append(el('div', 'ad', 'Yık'), el('div', 'sayi', 'X tuşu'));
  yikB.addEventListener('click', () => onSelect(secili === 'yikim' ? null : 'yikim'));
  yikB.addEventListener('mouseenter', () => ipucuGoster(yikB, 'yikim'));
  yikB.addEventListener('mouseleave', ipucuGizle);
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
        k.kilit.textContent = acik ? '' : `🔒 ${esik} nüfus`;
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
        b.querySelector('.sayi')!.textContent = `${acikSayi}/${ogeler.length} açık`;
        if (k === acikKategori) for (const t of ogeler) if (!kilitli.has(t)) gorulen.add(t);
        b.classList.toggle('yeni-var', ogeler.some((t) => !kilitli.has(t) && !gorulen.has(t)));
      }
    },
    setSelected(tool) {
      secili = tool;
      for (const [t, k] of kartlar) k.b.classList.toggle('secili', t === tool);
      yikB.classList.toggle('acik', tool === 'yikim');
    },
  };
}
