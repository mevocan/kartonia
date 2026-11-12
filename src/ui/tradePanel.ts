// Gezgin tüccar paneli: 6 mal, sat / al düğmeleri, kalan kota. Tüccar yalnızca geldiği gün açılır.
import type { GameState, Good } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { ayar, canBuy, canSell, kalanKota, tuccarKalisGunu, tuccarVarMi } from '../logic/game';
import { el, tr } from './dom';
import { malAd, malAdKucuk, t } from './i18n';

/** Bir tıklamada alınıp satılan birim. */
export const TICARET_ADIM = 5;

const MALLAR: { g: Good; ikon: string }[] = [
  { g: 'bugday', ikon: '🌾' },
  { g: 'un', ikon: '🥣' },
  { g: 'yemek', ikon: '🍽️' },
  { g: 'odun', ikon: '🪵' },
  { g: 'tas', ikon: '🪨' },
  { g: 'mobilya', ikon: '🪑' },
];

export interface TradePanel {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Açıksa satırları günceller; tüccar gittiyse kapanır. */
  update(s: GameState): void;
}

export function createTradePanel(
  root: HTMLElement,
  onBuy: (g: Good, miktar: number) => void,
  onSell: (g: Good, miktar: number) => void,
): TradePanel {
  const box = el('div', 'kagit raptiye');
  box.id = 'tuccar';
  const kapat = el('button', 'kapat', '×');
  kapat.title = t('genel.kapat');
  // Kota bütün ziyaret içindir (birkaç gün), gün başına değil.
  const kota = el('div', 'alt');
  const kalis = el('div', 'alt');
  const tablo = el('table');
  box.append(
    kapat,
    el('h3', '', t('tuccar.baslik')),
    kalis,
    el('div', 'alt', t('tuccar.fiyatNotu', { n: TICARET_ADIM })),
    kota,
    tablo,
  );
  root.appendChild(box);

  const bas = el('tr');
  const basliklar = [t('tuccar.mal'), t('tuccar.stok'), t('tuccar.sat'), '', t('tuccar.al'), ''];
  for (const b of basliklar) bas.appendChild(el('th', '', b));
  tablo.appendChild(bas);

  const satirlar = MALLAR.map((m) => {
    const tr_ = el('tr');
    const stok = el('td');
    const sat = el('button', 'dugme kucuk', `−${TICARET_ADIM}`);
    const al = el('button', 'dugme kucuk', `+${TICARET_ADIM}`);
    const f = BALANCE.ticaret.fiyat[m.g];
    const ad = malAdKucuk(m.g);
    sat.title = t('tuccar.satIpucu', { n: TICARET_ADIM, mal: ad, para: TICARET_ADIM * f.sat });
    al.title = t('tuccar.alIpucu', { n: TICARET_ADIM, mal: ad, para: TICARET_ADIM * f.al });
    sat.addEventListener('click', () => onSell(m.g, TICARET_ADIM));
    al.addEventListener('click', () => onBuy(m.g, TICARET_ADIM));
    const tdSat = el('td');
    tdSat.appendChild(sat);
    const tdAl = el('td');
    tdAl.appendChild(al);
    tr_.append(el('td', '', `${m.ikon} ${malAd(m.g)}`), stok, el('td', 'fiyat', `🪙 ${f.sat}`), tdSat, el('td', 'fiyat', `🪙 ${f.al}`), tdAl);
    tablo.appendChild(tr_);
    return { g: m.g, stok, sat, al };
  });

  let acik = false;
  kapat.addEventListener('click', () => api.close());

  const api: TradePanel = {
    open() {
      acik = true;
      box.style.display = 'block';
    },
    close() {
      acik = false;
      box.style.display = 'none';
    },
    isOpen: () => acik,
    update(s) {
      if (!acik) return;
      if (!tuccarVarMi(s.gun)) {
        api.close();
        return;
      }
      kota.textContent = t('tuccar.kota', { kalan: kalanKota(s), toplam: ayar(s, 'ticaretKota') });
      const g = tuccarKalisGunu(s.gun);
      kalis.textContent = g > 1
        ? t('tuccar.kalis', { n: g })
        : t('tuccar.sonGun');
      for (const r of satirlar) {
        r.stok.textContent = tr(Math.floor(s.stok[r.g]));
        r.sat.disabled = !canSell(s, r.g, TICARET_ADIM).ok;
        r.al.disabled = !canBuy(s, r.g, TICARET_ADIM).ok;
      }
    },
  };
  return api;
}
