// Karar kartı seçim ekranı: üç kart, artı yeşil, eksi kırmızı blokta; kartlar sırayla belirir.
// Seçilene kadar oyun duraklar (main).
import type { KararKarti } from '../data/cards';
import { el } from './dom';
import { kartMetni, t } from './i18n';

export interface CardPicker {
  /** Kartları gösterir; `alt` başlığın altındaki açıklama (gün ve seçim sırası). */
  show(alt: string, kartlar: KararKarti[]): void;
  hide(): void;
  isOpen(): boolean;
}

export function createCardPicker(root: HTMLElement, onPick: (id: string) => void): CardPicker {
  const perde = el('div');
  perde.id = 'kartSecim';
  const ust = el('div', 'kagit baslik');
  const h = el('h2', '', t('kart.yol'));
  const alt = el('p');
  ust.append(h, alt);
  const sira = el('div', 'kartlar');
  perde.append(ust, sira);
  root.appendChild(perde);

  let acik = false;

  return {
    show(metin, kartlar) {
      acik = true;
      alt.textContent = metin;
      sira.replaceChildren();
      kartlar.forEach((k, i) => {
        const b = el('button', 'kagit kart');
        b.style.animationDelay = `${80 + i * 90}ms`;
        const m = kartMetni(k);
        const arti = el('div', 'arti');
        arti.append(el('span', 'isaret', '＋'), el('span', '', m.arti));
        const eksi = el('div', 'eksi');
        eksi.append(el('span', 'isaret', '－'), el('span', '', m.eksi));
        b.append(el('div', 'ikon', k.ikon), el('h3', '', m.ad), arti, eksi, el('div', 'sec', t('kart.sec')));
        b.addEventListener('click', () => onPick(k.id));
        sira.appendChild(b);
      });
      perde.style.display = 'flex';
    },
    hide() {
      acik = false;
      perde.style.display = 'none';
    },
    isOpen: () => acik,
  };
}
