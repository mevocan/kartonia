// Üst bar: dört ada. Zaman (gün, mevsim, gün ilerlemesi) · Kasaba (para, nüfus, mutluluk) ·
// Stok (yemek, odun + bütün stoklar paneli) · Kontrol (tüccar, ses, hız).
// Sayı geçişleri arayüz zamanıyla (performance.now) çalışır: oyun 3x hızdayken de aynı hızdadır.
import type { BuildingType, DayReport, GameState, Good } from '../logic/types';
import { HOUSE_LEVELS } from '../data/buildings';
import { isUnlocked, stockLimit } from '../logic/placement';
import type { SesKanali } from '../audio/api';
import { el, flash, tr } from './dom';
import { kisaKalanGun, mevsim, mevsimGunu, type Mevsim } from '../logic/season';
import { tuccarVarMi } from '../logic/trade';
import { malAd, mevsimAd, t } from './i18n';
import { MAL_IKON } from './ikonlar';

/** Mevsim simgesi ve adı (HUD ve bildirimler). */
export const MEVSIM_GORUNUM: Record<Mevsim, { ikon: string; ad: string }> = {
  ilkbahar: { ikon: '🌸', ad: mevsimAd('ilkbahar') },
  yaz: { ikon: '☀️', ad: mevsimAd('yaz') },
  sonbahar: { ikon: '🍂', ad: mevsimAd('sonbahar') },
  kis: { ikon: '❄️', ad: mevsimAd('kis') },
};

export interface Hud {
  update(s: GameState): void;
  /** Para'nın üstündeki döküm kartı: son gün sonunun vergi, bina/yol gideri ve neti. null: henüz yok. */
  setReport(r: DayReport | null): void;
  setDayProgress(t: number): void;
  setSpeed(speed: number): void;
  /** Ses düğmesi ve paneli: aç/kapa durumu ve düzeyler (0..1). */
  setSound(on: boolean, genel: number, muzik: number): void;
}

/** Bütün mallar (stok paneli). `uretici` verilmiş mal, stokta yokken o bina açılana kadar görünmez. */
const GOODS: { key: Good; uretici?: BuildingType }[] = [
  { key: 'bugday' }, { key: 'un' }, { key: 'yemek' }, { key: 'odun' }, { key: 'tas' }, { key: 'mobilya' },
  { key: 'yun', uretici: 'agil' }, { key: 'kumas', uretici: 'dokumaci' }, { key: 'bal', uretici: 'arilik' },
];
/** Üst barda hep görünen mallar: evlerin her gün tükettikleri. */
const BARDAKI: Good[] = ['yemek', 'odun'];

/** Sayı geçişi süresi (ms). */
const GECIS = 250;

function yuz(m: number): string {
  if (m >= 80) return '😄';
  if (m >= 60) return '🙂';
  if (m >= 40) return '😐';
  if (m >= 20) return '🙁';
  return '😣';
}

function mutlulukRengi(m: number): string {
  if (m >= 60) return '#78966b';
  if (m >= 40) return '#d9a13b';
  return '#c4614a';
}

/** Evlerin şu an tükettiği mallar: bunlardan biri bitmişse değeri kritik görünür. */
function tuketilenMallar(s: GameState): Set<Good> {
  const out = new Set<Good>();
  for (const b of s.binalar) {
    if (b.type !== 'ev') continue;
    for (const n of HOUSE_LEVELS[Math.min(b.seviye, HOUSE_LEVELS.length) - 1]?.ihtiyaclar ?? []) {
      if (GOODS.some((g) => g.key === n)) out.add(n as Good);
    }
  }
  return out;
}

export function createHud(
  root: HTMLElement,
  onSpeed: (speed: number) => void,
  onTogglePause: () => void,
  onMerchant: () => void,
  onSound: () => void,
  onVolume: (kanal: SesKanali, v: number) => void,
): Hud {
  const box = el('div');
  box.id = 'hud';
  root.appendChild(box);
  const ada = (sinif = ''): HTMLDivElement => {
    const a = el('div', `kagit ada ${sinif}`);
    box.appendChild(a);
    return a;
  };

  // ---- Sayı geçişi ----
  const anlik = new Map<HTMLElement, { v: number; hedef: number; bas: number; t0: number; bicim: (v: number) => string; raf: number }>();
  function sayiYaz(deger: HTMLElement, v: number, bicim: (v: number) => string): void {
    const a = anlik.get(deger);
    if (!a) {
      deger.textContent = bicim(v);
      anlik.set(deger, { v, hedef: v, bas: v, t0: 0, bicim, raf: 0 });
      return;
    }
    a.bicim = bicim;
    if (Math.round(a.hedef) === Math.round(v)) {
      // Geçiş sürüyorsa da durdur: yoksa bir sonraki karede ara değer geri yazılır.
      cancelAnimationFrame(a.raf);
      deger.textContent = bicim(v);
      a.hedef = v;
      a.v = v;
      return;
    }
    cancelAnimationFrame(a.raf);
    a.bas = a.v;
    a.hedef = v;
    a.t0 = performance.now();
    const adim = (now: number): void => {
      const k = Math.min(1, (now - a.t0) / GECIS);
      const e = 1 - (1 - k) ** 3;
      a.v = a.bas + (a.hedef - a.bas) * e;
      deger.textContent = a.bicim(k < 1 ? a.v : a.hedef);
      if (k < 1) a.raf = requestAnimationFrame(adim);
      else a.v = a.hedef;
    };
    a.raf = requestAnimationFrame(adim);
  }

  function item(parent: HTMLElement, ikon: string, etiket: string): { wrap: HTMLDivElement; deger: HTMLDivElement; metin: HTMLDivElement } {
    const wrap = el('div', 'hud-oge');
    const metin = el('div', 'metin');
    const deger = el('div', 'deger', '0');
    metin.append(el('div', 'etiket', etiket), deger);
    wrap.append(el('span', 'ikon', ikon), metin);
    wrap.title = etiket;
    parent.appendChild(wrap);
    return { wrap, deger, metin };
  }

  // ---- Zaman adası ----
  const zaman = ada('hud-zaman');
  const zUst = el('div', 'ust');
  const gunYazi = el('span', 'gun');
  const mevsimYazi = el('span', 'mevsim');
  zUst.append(gunYazi, mevsimYazi);
  const kalanYazi = el('div', 'kalan');
  const cubuk = el('div', 'gun-cubuk');
  const cubukIc = el('div');
  cubuk.appendChild(cubukIc);
  zaman.append(zUst, kalanYazi, cubuk);

  // ---- Kasaba adası ----
  const kasaba = ada();
  const para = item(kasaba, '💰', t('hud.para'));
  para.wrap.classList.add('para');
  para.wrap.removeAttribute('title'); // döküm kartı zaten açılıyor
  const dokum = el('div', 'kagit');
  dokum.id = 'paraDokum';
  para.wrap.appendChild(dokum);
  raporYaz(null);

  function raporYaz(r: DayReport | null): void {
    dokum.replaceChildren();
    if (!r) {
      dokum.append(el('h4', '', t('hud.dokumBaslik')), el('div', '', t('hud.dokumBos')));
      return;
    }
    dokum.appendChild(el('h4', '', t('hud.dokumGun', { gun: r.gun })));
    const tablo = el('table');
    const satir = (ad: string, v: number, sinif = ''): void => {
      const tr_ = el('tr', sinif);
      const deger = el('td', v > 0 ? 'arti' : v < 0 ? 'eksi' : '', `${v > 0 ? '+' : ''}${tr(v)}`);
      tr_.append(el('td', '', ad), deger);
      tablo.appendChild(tr_);
    };
    satir(t('hud.vergi'), r.vergi);
    satir(t('hud.binaGider'), -r.binaGider);
    satir(t('hud.yolGider'), -r.yolGider);
    satir(t('hud.net'), r.net, 'net');
    dokum.appendChild(tablo);
  }
  const nufus = item(kasaba, '👥', t('hud.nufus'));
  const mutluluk = item(kasaba, '🙂', t('hud.mutluluk'));
  const mutlulukIkon = mutluluk.wrap.querySelector('.ikon')!;
  const mCubuk = el('div', 'mutluluk-cubuk');
  const mCubukIc = el('div');
  mCubuk.appendChild(mCubukIc);
  mutluluk.metin.appendChild(mCubuk);

  // ---- Stok adası ----
  const stokAda = ada();
  const bardakiler = BARDAKI.map((g) => ({ g, ...item(stokAda, MAL_IKON[g], malAd(g)) }));
  const stokKutu = el('div', 'stok-kutu');
  const stokAc = el('button', 'stok-ac');
  stokAc.append(el('span', '', '📦'), el('span', 'ok', '▾'));
  stokAc.title = t('hud.stoklar');
  const stokPanel = el('div', 'kagit');
  stokPanel.id = 'stokPanel';
  const stokBaslik = el('h4');
  const stokSinir = el('span', 'sinir');
  stokBaslik.append(el('span', '', t('hud.stoklar')), stokSinir);
  stokPanel.appendChild(stokBaslik);
  const satirlar = GOODS.map((g) => {
    const satir = el('div', 'stok-satir');
    const deger = el('span', 'deger');
    const doluluk = el('div');
    const cub = el('div', 'cubuk');
    cub.appendChild(doluluk);
    satir.append(el('span', 'ikon', MAL_IKON[g.key]), el('span', 'ad', malAd(g.key)), deger, cub);
    stokPanel.appendChild(satir);
    return { g, satir, deger, doluluk };
  });
  stokAc.addEventListener('click', (e) => {
    e.stopPropagation();
    stokPanel.classList.toggle('acik');
    stokAc.classList.toggle('acik', stokPanel.classList.contains('acik'));
  });
  stokKutu.append(stokAc, stokPanel);
  stokAda.appendChild(stokKutu);

  // ---- Kontrol adası ----
  const kontrol = ada();
  // Gezgin tüccar yalnızca geldiği gün görünür; tıklayınca takas paneli açılır.
  const tuccarDugme = el('button', 'hud-dugme', t('hud.tuccar'));
  tuccarDugme.id = 'tuccarDugme';
  tuccarDugme.title = t('hud.tuccarIpucu');
  tuccarDugme.addEventListener('click', onMerchant);
  kontrol.appendChild(tuccarDugme);
  // Ses: düğme küçük bir panel açar (aç/kapa, genel ses ve müzik düzeyi sürgüleri).
  const sesKutu = el('div', 'ses-kutu');
  const sesDugme = el('button', 'hud-dugme', '🔊');
  sesDugme.id = 'sesDugme';
  sesDugme.title = t('hud.sesAyar');
  const sesPanel = el('div', 'kagit');
  sesPanel.id = 'sesPanel';
  const sesAc = el('button', 'dugme', t('hud.sesAcik'));
  sesAc.addEventListener('click', onSound);
  function surgu(ad: string, kanal: SesKanali): [HTMLInputElement, HTMLSpanElement] {
    const satir = el('label', 'surgu');
    const s = el('input');
    s.type = 'range';
    s.min = '0';
    s.max = '100';
    s.step = '5';
    const deger = el('span', 'deger');
    s.addEventListener('input', () => {
      deger.textContent = t('hud.yuzde', { n: s.value });
      onVolume(kanal, Number(s.value) / 100);
    });
    satir.append(el('span', 'ad', ad), s, deger);
    sesPanel.appendChild(satir);
    return [s, deger];
  }
  sesPanel.appendChild(sesAc);
  const [genelSurgu, genelDeger] = surgu(t('hud.genelSes'), 'genel');
  const [muzikSurgu, muzikDeger] = surgu(t('hud.muzik'), 'muzik');
  sesDugme.addEventListener('click', (e) => {
    e.stopPropagation();
    sesPanel.classList.toggle('acik');
  });
  // Açılır panellerin dışına tıklanınca kapanırlar.
  document.addEventListener('pointerdown', (e) => {
    if (!sesKutu.contains(e.target as Node)) sesPanel.classList.remove('acik');
    if (!stokKutu.contains(e.target as Node)) {
      stokPanel.classList.remove('acik');
      stokAc.classList.remove('acik');
    }
  });
  sesKutu.append(sesDugme, sesPanel);
  kontrol.appendChild(sesKutu);
  const hizlar = el('div', 'hizlar');
  const hizDugmeleri: { speed: number; b: HTMLButtonElement }[] = [];
  for (const [speed, label, title] of [
    [0, '⏸', t('hud.duraklat')],
    [1, '1x', t('hud.hiz1')],
    [2, '2x', t('hud.hiz2')],
    [3, '3x', t('hud.hiz3')],
  ] as const) {
    const b = el('button', speed === 0 ? 'durdur' : '', label);
    b.title = title;
    // Duraklat düğmesi aç/kapa: duraklamışken basınca oyun önceki hızıyla devam eder.
    b.addEventListener('click', () => (speed === 0 ? onTogglePause() : onSpeed(speed)));
    hizlar.appendChild(b);
    hizDugmeleri.push({ speed, b });
  }
  kontrol.appendChild(hizlar);
  const durdurB = hizDugmeleri[0].b;

  // Değer değişince kısa renk vurgusu (artış yeşil, azalış kırmızı) + sayı geçişi.
  const onceki = new Map<HTMLElement, number>();
  function set(wrap: HTMLElement, deger: HTMLElement, v: number, bicim: (v: number) => string): void {
    const eski = onceki.get(wrap);
    if (eski !== undefined && Math.round(eski) !== Math.round(v)) flash(wrap, v > eski ? 'vurgu-arti' : 'vurgu-eksi');
    onceki.set(wrap, v);
    sayiYaz(deger, v, bicim);
  }
  const tam = (v: number): string => tr(Math.floor(v));

  return {
    update(s) {
      gunYazi.textContent = `${t('hud.gun')} ${s.gun}`;
      const m = mevsim(s.gun);
      mevsimYazi.textContent = `${MEVSIM_GORUNUM[m].ikon} ${MEVSIM_GORUNUM[m].ad}`;
      kalanYazi.textContent = m === 'kis'
        ? t('hud.kisinGunu', { n: mevsimGunu(s.gun) })
        : t('hud.kisaKalan', { n: kisaKalanGun(s.gun) });
      zaman.classList.toggle('kis', m === 'kis');
      zaman.classList.toggle('yakin', m === 'sonbahar');

      set(para.wrap, para.deger, s.para, tr);
      para.wrap.classList.toggle('borc', s.para < 0);
      set(nufus.wrap, nufus.deger, s.nufus, tr);
      set(mutluluk.wrap, mutluluk.deger, s.mutluluk, (v) => String(Math.round(v)));
      mutlulukIkon.textContent = yuz(s.mutluluk);
      mCubukIc.style.width = `${Math.max(0, Math.min(100, s.mutluluk))}%`;
      mCubukIc.style.background = mutlulukRengi(s.mutluluk);

      const gerekli = tuketilenMallar(s);
      const kritik = (g: Good): boolean => s.stok[g] < 1 && gerekli.has(g);
      for (const b of bardakiler) {
        set(b.wrap, b.deger, s.stok[b.g], tam);
        b.wrap.classList.toggle('kritik', kritik(b.g));
      }
      const sinir = stockLimit(s);
      stokSinir.textContent = t('hud.stokSinir', { n: tr(sinir) });
      let digerKritik = false;
      for (const r of satirlar) {
        const v = s.stok[r.g.key];
        const u = r.g.uretici;
        r.satir.style.display = !u || v >= 1 || isUnlocked(s, u) ? '' : 'none';
        r.deger.textContent = tam(v);
        r.doluluk.style.width = `${Math.min(100, (v / sinir) * 100)}%`;
        r.satir.classList.toggle('dolu', v >= sinir - 0.5);
        const k = kritik(r.g.key);
        r.satir.classList.toggle('kritik', k);
        if (k && !BARDAKI.includes(r.g.key)) digerKritik = true;
      }
      stokAc.classList.toggle('uyari', digerKritik);
      cubukIc.style.width = `${Math.round(s.gunIlerleme * 100)}%`;
      tuccarDugme.style.display = tuccarVarMi(s) ? 'inline-block' : 'none';
    },
    setReport(r) {
      raporYaz(r);
    },
    setDayProgress(p) {
      cubukIc.style.width = `${Math.round(p * 100)}%`;
    },
    setSound(on, genel, muzik) {
      sesDugme.textContent = on ? (genel > 0 ? '🔊' : '🔈') : '🔇';
      sesAc.textContent = t(on ? 'hud.sesAcik' : 'hud.sesKapali');
      sesAc.classList.toggle('kapali', !on);
      genelSurgu.value = String(Math.round(genel * 100));
      muzikSurgu.value = String(Math.round(muzik * 100));
      genelDeger.textContent = t('hud.yuzde', { n: genelSurgu.value });
      muzikDeger.textContent = t('hud.yuzde', { n: muzikSurgu.value });
    },
    setSpeed(speed) {
      for (const h of hizDugmeleri) h.b.classList.toggle('secili', h.speed === speed);
      const durdu = speed === 0;
      durdurB.textContent = durdu ? '▶' : '⏸';
      durdurB.title = t(durdu ? 'hud.devam' : 'hud.duraklat');
    },
  };
}
