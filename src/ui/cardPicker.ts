// Karar kartı seçim ekranı: üç kağıt kart, artı yeşil, eksi kırmızı. Seçilene kadar oyun duraklar (main).
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
  const ust = el('div', 'kagit bant baslik');
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
        b.style.setProperty('--egim', `${(i - 1) * 2.5}deg`);
        const m = kartMetni(k);
        b.append(
          el('div', 'ikon', k.ikon),
          el('h3', '', m.ad),
          el('div', 'arti', `＋ ${m.arti}`),
          el('div', 'eksi', `－ ${m.eksi}`),
          el('div', 'sec', t('kart.sec')),
        );
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
