// Üst şerit: gün, para, nüfus, mutluluk, stoklar, hız düğmeleri.
import type { BuildingType, DayReport, GameState, Good } from '../logic/types';
import { isUnlocked } from '../logic/placement';
import type { SesKanali } from '../audio/api';
import { el, flash, tr } from './dom';
import { kisaKalanGun, mevsim, mevsimGunu, type Mevsim } from '../logic/season';
import { tuccarVarMi } from '../logic/trade';
import { malAd, mevsimAd, t } from './i18n';

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
  /** Ses düğmesinin simgesi: açık 🔊, kapalı 🔇. */
  /** Ses düğmesi ve paneli: aç/kapa durumu ve düzeyler (0..1). */
  setSound(on: boolean, genel: number, muzik: number): void;
}

/** `uretici` verilmiş mal, stokta yokken o bina açılana kadar şeritte görünmez (şerit kalabalıklaşmasın). */
const GOODS: { key: Good; ad: string; ikon: string; uretici?: BuildingType }[] = [
  { key: 'bugday', ad: malAd('bugday'), ikon: '🌾' },
  { key: 'un', ad: malAd('un'), ikon: '🥣' },
  { key: 'yemek', ad: malAd('yemek'), ikon: '🍽️' },
  { key: 'odun', ad: malAd('odun'), ikon: '🪵' },
  { key: 'tas', ad: malAd('tas'), ikon: '🪨' },
  { key: 'mobilya', ad: malAd('mobilya'), ikon: '🪑' },
  { key: 'yun', ad: malAd('yun'), ikon: '🧶', uretici: 'agil' },
  { key: 'kumas', ad: malAd('kumas'), ikon: '🧵', uretici: 'dokumaci' },
  { key: 'bal', ad: malAd('bal'), ikon: '🍯', uretici: 'arilik' },
];

function yuz(m: number): string {
  if (m >= 80) return '😄';
  if (m >= 60) return '🙂';
  if (m >= 40) return '😐';
  if (m >= 20) return '🙁';
  return '😣';
}

function mutlulukRengi(m: number): string {
  if (m >= 60) return '#7fb069';
  if (m >= 40) return '#e2b04a';
  return '#d9705f';
}

export function createHud(
  root: HTMLElement,
  onSpeed: (speed: number) => void,
  onTogglePause: () => void,
  onMerchant: () => void,
  onSound: () => void,
  onVolume: (kanal: SesKanali, v: number) => void,
): Hud {
  const box = el('div', 'kagit bant');
  box.id = 'hud';
  root.appendChild(box);

  function item(etiket: string): { wrap: HTMLDivElement; deger: HTMLDivElement } {
    const wrap = el('div', 'hud-oge');
    const deger = el('div', 'deger', '0');
    wrap.append(el('div', 'etiket', etiket), deger);
    box.appendChild(wrap);
    return { wrap, deger };
  }
  const sep = (): void => { box.appendChild(el('div', 'ayrac')); };

  const gun = item(t('hud.gun'));
  const cubuk = el('div', 'gun-cubuk');
  const cubukIc = el('div');
  cubuk.appendChild(cubukIc);
  gun.wrap.appendChild(cubuk);
  // Gün sayacının yanında mevsim: simge + ad, altında "kışa X gün" (kışta "kışın X. günü").
  const mevsimKutu = el('div', 'hud-oge mevsim');
  const mevsimDeger = el('div', 'deger');
  const mevsimAlt = el('div', 'etiket');
  mevsimKutu.append(el('div', 'etiket', t('hud.mevsim')), mevsimDeger, mevsimAlt);
  box.appendChild(mevsimKutu);
  sep();
  const para = item(t('hud.para'));
  para.wrap.classList.add('para');
  const dokum = el('div', 'kagit');
  dokum.id = 'paraDokum';
  para.wrap.appendChild(dokum);
  raporYaz(null);

  function raporYaz(r: DayReport | null): void {
    dokum.replaceChildren();
    if (!r) {
      dokum.append(
        el('h4', '', t('hud.dokumBaslik')),
        el('div', '', t('hud.dokumBos')),
      );
      return;
    }
    dokum.appendChild(el('h4', '', t('hud.dokumGun', { gun: r.gun })));
    const tablo = el('table');
    const satir = (ad: string, v: number, sinif = ''): void => {
      const t = el('tr', sinif);
      const deger = el('td', v > 0 ? 'arti' : v < 0 ? 'eksi' : '', `${v > 0 ? '+' : ''}${tr(v)}`);
      t.append(el('td', '', ad), deger);
      tablo.appendChild(t);
    };
    satir(t('hud.vergi'), r.vergi);
    satir(t('hud.binaGider'), -r.binaGider);
    satir(t('hud.yolGider'), -r.yolGider);
    satir(t('hud.net'), r.net, 'net');
    dokum.appendChild(tablo);
  }
  const nufus = item(t('hud.nufus'));
  const mutluluk = item(t('hud.mutluluk'));
  const mCubuk = el('div', 'mutluluk-cubuk');
  const mCubukIc = el('div');
  mCubuk.appendChild(mCubukIc);
  mutluluk.wrap.appendChild(mCubuk);
  sep();
  const stoklar = GOODS.map((g) => {
    const o = item('');
    // Etiket: simge + ad; dar pencerede ad gizlenir (CSS), simge kalır. Tam ad title'da.
    const et = o.wrap.querySelector('.etiket')!;
    et.append(el('span', '', g.ikon), el('span', 'ad', ` ${g.ad}`));
    o.wrap.title = g.ad;
    return { g, ...o };
  });
  sep();

  // Gezgin tüccar yalnızca geldiği gün görünür; tıklayınca takas paneli açılır.
  const tuccarDugme = el('button', 'dugme', t('hud.tuccar'));
  tuccarDugme.id = 'tuccarDugme';
  tuccarDugme.title = t('hud.tuccarIpucu');
  tuccarDugme.addEventListener('click', onMerchant);
  box.appendChild(tuccarDugme);
  // Ses: düğme küçük bir panel açar (aç/kapa, genel ses ve müzik düzeyi sürgüleri).
  const sesKutu = el('div', 'ses-kutu');
  const sesDugme = el('button', 'dugme', '🔊');
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
  // Panelin dışına tıklanınca kapanır.
  document.addEventListener('pointerdown', (e) => {
    if (!sesKutu.contains(e.target as Node)) sesPanel.classList.remove('acik');
  });
  sesKutu.append(sesDugme, sesPanel);
  box.appendChild(sesKutu);
  const hizlar = el('div', 'hizlar');
  const hizDugmeleri: { speed: number; b: HTMLButtonElement }[] = [];
  for (const [speed, label, title] of [
    [0, '⏸', t('hud.duraklat')],
    [1, '1x', t('hud.hiz1')],
    [2, '2x', t('hud.hiz2')],
    [3, '3x', t('hud.hiz3')],
  ] as const) {
    const b = el('button', '', label);
    b.title = title;
    // Duraklat düğmesi aç/kapa: duraklamışken basınca oyun önceki hızıyla devam eder.
    b.addEventListener('click', () => (speed === 0 ? onTogglePause() : onSpeed(speed)));
    hizlar.appendChild(b);
    hizDugmeleri.push({ speed, b });
  }
  box.appendChild(hizlar);
  const durdurB = hizDugmeleri[0].b;

  const onceki = new Map<HTMLElement, number>();
  function set(wrap: HTMLElement, deger: HTMLElement, v: number, text: string): void {
    const eski = onceki.get(wrap);
    deger.textContent = text;
    if (eski !== undefined && Math.round(eski) !== Math.round(v)) {
      flash(wrap, v > eski ? 'vurgu-arti' : 'vurgu-eksi');
    }
    onceki.set(wrap, v);
  }

  return {
    update(s) {
      set(gun.wrap, gun.deger, s.gun, String(s.gun));
      const m = mevsim(s.gun);
      mevsimDeger.textContent = `${MEVSIM_GORUNUM[m].ikon} ${MEVSIM_GORUNUM[m].ad}`;
      mevsimAlt.textContent = m === 'kis'
        ? t('hud.kisinGunu', { n: mevsimGunu(s.gun) })
        : t('hud.kisaKalan', { n: kisaKalanGun(s.gun) });
      mevsimKutu.classList.toggle('kis', m === 'kis');
      mevsimKutu.classList.toggle('yakin', m === 'sonbahar');
      set(para.wrap, para.deger, s.para, tr(s.para));
      para.deger.style.color = s.para < 0 ? '#c9544a' : '';
      set(nufus.wrap, nufus.deger, s.nufus, tr(s.nufus));
      set(mutluluk.wrap, mutluluk.deger, s.mutluluk, `${yuz(s.mutluluk)} ${Math.round(s.mutluluk)}`);
      mCubukIc.style.width = `${Math.max(0, Math.min(100, s.mutluluk))}%`;
      mCubukIc.style.background = mutlulukRengi(s.mutluluk);
      for (const st of stoklar) {
        const v = s.stok[st.g.key];
        const u = st.g.uretici;
        st.wrap.style.display = !u || v >= 1 || isUnlocked(s, u) ? '' : 'none';
        set(st.wrap, st.deger, v, tr(Math.floor(v)));
      }
      cubukIc.style.width = `${Math.round(s.gunIlerleme * 100)}%`;
      tuccarDugme.style.display = tuccarVarMi(s.gun) ? 'inline-block' : 'none';
    },
    setReport(r) {
      raporYaz(r);
    },
    setDayProgress(t) {
      cubukIc.style.width = `${Math.round(t * 100)}%`;
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
