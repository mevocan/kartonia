// Gezgin tüccar paneli: 6 mal, sat / al düğmeleri, kalan kota. Tüccar yalnızca geldiği gün açılır.
import type { GameState, Good } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { ayar, canBuy, canSell, kalanKota, tuccarVarMi } from '../logic/game';
import { el, tr } from './dom';

/** Bir tıklamada alınıp satılan birim. */
export const TICARET_ADIM = 5;

const MALLAR: { g: Good; ad: string; ikon: string }[] = [
  { g: 'bugday', ad: 'Buğday', ikon: '🌾' },
  { g: 'un', ad: 'Un', ikon: '🥣' },
  { g: 'yemek', ad: 'Yemek', ikon: '🍽️' },
  { g: 'odun', ad: 'Odun', ikon: '🪵' },
  { g: 'tas', ad: 'Taş', ikon: '🪨' },
  { g: 'mobilya', ad: 'Mobilya', ikon: '🪑' },
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
  kapat.title = 'Kapat';
  const kota = el('div', 'alt');
  const tablo = el('table');
  box.append(
    kapat,
    el('h3', '', '🛒 Gezgin tüccar'),
    el('div', 'alt', `Bugün kasabada. Fiyatlar sabit; satış fiyatı alıştan düşük. Her düğme ${TICARET_ADIM} birim.`),
    kota,
    tablo,
  );
  root.appendChild(box);

  const bas = el('tr');
  for (const b of ['Mal', 'Stok', 'Sat', '', 'Al', '']) bas.appendChild(el('th', '', b));
  tablo.appendChild(bas);

  const satirlar = MALLAR.map((m) => {
    const tr_ = el('tr');
    const stok = el('td');
    const sat = el('button', 'dugme kucuk', `−${TICARET_ADIM}`);
    const al = el('button', 'dugme kucuk', `+${TICARET_ADIM}`);
    const f = BALANCE.ticaret.fiyat[m.g];
    sat.title = `${TICARET_ADIM} ${m.ad.toLowerCase()} sat: +${TICARET_ADIM * f.sat} para`;
    al.title = `${TICARET_ADIM} ${m.ad.toLowerCase()} al: −${TICARET_ADIM * f.al} para`;
    sat.addEventListener('click', () => onSell(m.g, TICARET_ADIM));
    al.addEventListener('click', () => onBuy(m.g, TICARET_ADIM));
    const tdSat = el('td');
    tdSat.appendChild(sat);
    const tdAl = el('td');
    tdAl.appendChild(al);
    tr_.append(el('td', '', `${m.ikon} ${m.ad}`), stok, el('td', 'fiyat', `🪙 ${f.sat}`), tdSat, el('td', 'fiyat', `🪙 ${f.al}`), tdAl);
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
      kota.textContent = `Kalan takas hakkı: ${kalanKota(s)} / ${ayar(s, 'ticaretKota')} birim`;
      for (const r of satirlar) {
        r.stok.textContent = tr(Math.floor(s.stok[r.g]));
        r.sat.disabled = !canSell(s, r.g, TICARET_ADIM).ok;
        r.al.disabled = !canBuy(s, r.g, TICARET_ADIM).ok;
      }
    },
  };
  return api;
}
