// Üst şerit: gün, para, nüfus, mutluluk, stoklar, hız düğmeleri.
import type { DayReport, GameState, Good } from '../logic/types';
import { el, flash, tr } from './dom';
import { kisaKalanGun, mevsim, mevsimGunu, type Mevsim } from '../logic/season';
import { tuccarVarMi } from '../logic/trade';
import { kartBul } from '../logic/cards';

/** Mevsim simgesi ve adı (HUD ve bildirimler). */
export const MEVSIM_GORUNUM: Record<Mevsim, { ikon: string; ad: string }> = {
  ilkbahar: { ikon: '🌸', ad: 'İlkbahar' },
  yaz: { ikon: '☀️', ad: 'Yaz' },
  sonbahar: { ikon: '🍂', ad: 'Sonbahar' },
  kis: { ikon: '❄️', ad: 'Kış' },
};

export interface Hud {
  update(s: GameState): void;
  /** Para'nın üstündeki döküm kartı: son gün sonunun vergi, bina/yol gideri ve neti. null: henüz yok. */
  setReport(r: DayReport | null): void;
  setDayProgress(t: number): void;
  setSpeed(speed: number): void;
  /** Ses düğmesinin simgesi: açık 🔊, kapalı 🔇. */
  setSound(on: boolean): void;
}

const GOODS: { key: Good; ad: string; ikon: string }[] = [
  { key: 'bugday', ad: 'Buğday', ikon: '🌾' },
  { key: 'un', ad: 'Un', ikon: '🥣' },
  { key: 'yemek', ad: 'Yemek', ikon: '🍽️' },
  { key: 'odun', ad: 'Odun', ikon: '🪵' },
  { key: 'tas', ad: 'Taş', ikon: '🪨' },
  { key: 'mobilya', ad: 'Mobilya', ikon: '🪑' },
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

  const gun = item('Gün');
  const cubuk = el('div', 'gun-cubuk');
  const cubukIc = el('div');
  cubuk.appendChild(cubukIc);
  gun.wrap.appendChild(cubuk);
  // Gün sayacının yanında mevsim: simge + ad, altında "kışa X gün" (kışta "kışın X. günü").
  const mevsimKutu = el('div', 'hud-oge mevsim');
  const mevsimDeger = el('div', 'deger');
  const mevsimAlt = el('div', 'etiket');
  mevsimKutu.append(el('div', 'etiket', 'Mevsim'), mevsimDeger, mevsimAlt);
  box.appendChild(mevsimKutu);
  sep();
  const para = item('Para');
  para.wrap.classList.add('para');
  const dokum = el('div', 'kagit');
  dokum.id = 'paraDokum';
  para.wrap.appendChild(dokum);
  raporYaz(null);

  function raporYaz(r: DayReport | null): void {
    dokum.replaceChildren();
    if (!r) {
      dokum.append(el('h4', '', 'Gelir-gider dökümü'), el('div', '', 'İlk gün sonunda görünür.'));
      return;
    }
    dokum.appendChild(el('h4', '', `${r.gun}. günün dökümü`));
    const tablo = el('table');
    const satir = (ad: string, v: number, sinif = ''): void => {
      const t = el('tr', sinif);
      const deger = el('td', v > 0 ? 'arti' : v < 0 ? 'eksi' : '', `${v > 0 ? '+' : ''}${tr(v)}`);
      t.append(el('td', '', ad), deger);
      tablo.appendChild(t);
    };
    satir('Vergi', r.vergi);
    satir('Bina gideri', -r.binaGider);
    satir('Yol gideri', -r.yolGider);
    satir('Net', r.net, 'net');
    dokum.appendChild(tablo);
  }
  const nufus = item('Nüfus');
  const mutluluk = item('Mutluluk');
  const mCubuk = el('div', 'mutluluk-cubuk');
  const mCubukIc = el('div');
  mCubuk.appendChild(mCubukIc);
  mutluluk.wrap.appendChild(mCubuk);
  sep();
  const stoklar = GOODS.map((g) => ({ g, ...item(`${g.ikon} ${g.ad}`) }));
  sep();

  // Seçilmiş karar kartlarının simgeleri; üstüne gelince kartın adı, artısı ve eksisi.
  const kartlar = el('div', 'hud-kartlar');
  box.appendChild(kartlar);
  let kartImza = '';
  // Gezgin tüccar yalnızca geldiği gün görünür; tıklayınca takas paneli açılır.
  const tuccarDugme = el('button', 'dugme', '🛒 Tüccar');
  tuccarDugme.id = 'tuccarDugme';
  tuccarDugme.title = 'Gezgin tüccar bugün kasabada: takas için tıkla';
  tuccarDugme.addEventListener('click', onMerchant);
  box.appendChild(tuccarDugme);
  const sesDugme = el('button', 'dugme', '🔊');
  sesDugme.id = 'sesDugme';
  sesDugme.addEventListener('click', onSound);
  box.appendChild(sesDugme);
  const hizlar = el('div', 'hizlar');
  const hizDugmeleri: { speed: number; b: HTMLButtonElement }[] = [];
  for (const [speed, label, title] of [
    [0, '⏸', 'Duraklat (Boşluk)'],
    [1, '1x', 'Normal hız (1)'],
    [2, '2x', 'Hızlı (2)'],
    [3, '3x', 'Çok hızlı (3)'],
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
      mevsimAlt.textContent = m === 'kis' ? `kışın ${mevsimGunu(s.gun)}. günü` : `kışa ${kisaKalanGun(s.gun)} gün`;
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
        set(st.wrap, st.deger, v, tr(Math.floor(v)));
      }
      cubukIc.style.width = `${Math.round(s.gunIlerleme * 100)}%`;
      tuccarDugme.style.display = tuccarVarMi(s.gun) ? 'inline-block' : 'none';
      const imza = (s.kararlar ?? []).join(',');
      if (imza !== kartImza) {
        kartImza = imza;
        kartlar.replaceChildren();
        for (const id of s.kararlar ?? []) {
          const k = kartBul(id);
          if (!k) continue;
          const sp = el('span', '', k.ikon);
          sp.title = `${k.ad}\n＋ ${k.arti}\n－ ${k.eksi}`;
          kartlar.appendChild(sp);
        }
      }
    },
    setReport(r) {
      raporYaz(r);
    },
    setDayProgress(t) {
      cubukIc.style.width = `${Math.round(t * 100)}%`;
    },
    setSound(on) {
      sesDugme.textContent = on ? '🔊' : '🔇';
      sesDugme.title = on ? 'Sesi kapat' : 'Sesi aç';
    },
    setSpeed(speed) {
      for (const h of hizDugmeleri) h.b.classList.toggle('secili', h.speed === speed);
      const durdu = speed === 0;
      durdurB.textContent = durdu ? '▶' : '⏸';
      durdurB.title = durdu ? 'Devam et (Boşluk)' : 'Duraklat (Boşluk)';
    },
  };
}
