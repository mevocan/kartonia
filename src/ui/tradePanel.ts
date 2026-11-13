// Gezgin tüccar paneli: mal satırları (simge, ad, stok, sat / al düğmeleri) ve kota çubuğu. Tüccar gelince
// açılır, açıkken oyun durur; oyuncu × ya da "Alışverişi bitir" ile kapatınca tüccar yola çıkar (onDone).
// close() yalnızca paneli gizler (ör. ana menü açılınca), tüccarı uğurlamaz.
import type { GameState, Good } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { ayar, canBuy, canSell, kalanKota, tuccarVarMi } from '../logic/game';
import { el, panelAc, panelKapat, tr } from './dom';
import { MAL_IKON } from './ikonlar';
import { malAd, malAdKucuk, t } from './i18n';

/** Bir tıklamada alınıp satılan birim. */
export const TICARET_ADIM = 5;

const MALLAR: Good[] = ['bugday', 'un', 'yemek', 'odun', 'tas', 'mobilya', 'yun', 'kumas', 'bal'];

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
  /** Oyuncu alışverişi bitirdi (× ya da "Alışverişi bitir"). */
  onDone: () => void,
): TradePanel {
  const box = el('div', 'kagit');
  box.id = 'tuccar';
  const kapat = el('button', 'kapat', '×');
  kapat.title = t('genel.kapat');
  const ust = el('div', 'ust');
  const kalis = el('span', 'kalis-cip', t('tuccar.durdu'));
  ust.append(el('h3', '', t('tuccar.baslik')), kalis);
  const bitir = el('button', 'dugme birincil', t('tuccar.bitir'));
  bitir.addEventListener('click', () => onDone());
  // Kota bütün ziyaret içindir (birkaç gün), gün başına değil.
  const kota = el('div', 'kota');
  const kotaCubuk = el('div', 'ilerleme-cubuk');
  const kotaIc = el('div');
  kotaCubuk.appendChild(kotaIc);
  const liste = el('div', 'mallar');
  box.append(kapat, ust, el('div', 'not', t('tuccar.fiyatNotu', { n: TICARET_ADIM })), kota, kotaCubuk, liste, bitir);
  root.appendChild(box);

  const satirlar = MALLAR.map((g) => {
    const satir = el('div', 'mal-satir');
    const stok = el('span', 'stok');
    const f = BALANCE.ticaret.fiyat[g];
    const ad = malAdKucuk(g);
    const sat = el('button', 'dugme kucuk sat', t('tuccar.satDugme', { n: TICARET_ADIM, para: TICARET_ADIM * f.sat }));
    const al = el('button', 'dugme kucuk al', t('tuccar.alDugme', { n: TICARET_ADIM, para: TICARET_ADIM * f.al }));
    sat.title = t('tuccar.satIpucu', { n: TICARET_ADIM, mal: ad, para: TICARET_ADIM * f.sat });
    al.title = t('tuccar.alIpucu', { n: TICARET_ADIM, mal: ad, para: TICARET_ADIM * f.al });
    sat.addEventListener('click', () => onSell(g, TICARET_ADIM));
    al.addEventListener('click', () => onBuy(g, TICARET_ADIM));
    const adKutu = el('span', 'ad');
    adKutu.append(el('span', 'ikon', MAL_IKON[g]), el('span', '', malAd(g)));
    satir.append(adKutu, stok, sat, al);
    liste.appendChild(satir);
    return { g, stok, sat, al };
  });

  let acik = false;
  kapat.addEventListener('click', () => onDone());

  const api: TradePanel = {
    open() {
      acik = true;
      panelAc(box);
    },
    close() {
      acik = false;
      panelKapat(box);
    },
    isOpen: () => acik,
    update(s) {
      if (!acik) return;
      if (!tuccarVarMi(s)) {
        api.close();
        return;
      }
      const toplam = ayar(s, 'ticaretKota');
      const kalan = kalanKota(s);
      kota.textContent = t('tuccar.kota', { kalan, toplam });
      kotaIc.style.width = `${Math.round((kalan / Math.max(1, toplam)) * 100)}%`;
      for (const r of satirlar) {
        r.stok.textContent = tr(Math.floor(s.stok[r.g]));
        r.sat.disabled = !canSell(s, r.g, TICARET_ADIM).ok;
        r.al.disabled = !canBuy(s, r.g, TICARET_ADIM).ok;
      }
    },
  };
  return api;
}
