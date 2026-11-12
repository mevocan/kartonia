// Karar kartı seçim ekranı: üç kağıt kart, artı yeşil, eksi kırmızı. Seçilene kadar oyun duraklar (main).
import type { KararKarti } from '../data/cards';
import { el } from './dom';

export interface CardPicker {
  /** Kartları gösterir; `baslik` tamamlanan hedefin adı. */
  show(baslik: string, kartlar: KararKarti[]): void;
  hide(): void;
  isOpen(): boolean;
}

export function createCardPicker(root: HTMLElement, onPick: (id: string) => void): CardPicker {
  const perde = el('div');
  perde.id = 'kartSecim';
  const ust = el('div', 'kagit bant baslik');
  const h = el('h2', '', 'Kasabanın yolu');
  const alt = el('p');
  ust.append(h, alt);
  const sira = el('div', 'kartlar');
  perde.append(ust, sira);
  root.appendChild(perde);

  let acik = false;

  return {
    show(baslik, kartlar) {
      acik = true;
      alt.textContent = `🎯 ${baslik} tamamlandı. Kasabanın karakterini seç: seçim kalıcıdır.`;
      sira.replaceChildren();
      kartlar.forEach((k, i) => {
        const b = el('button', 'kagit kart');
        b.style.setProperty('--egim', `${(i - 1) * 2.5}deg`);
        b.append(
          el('div', 'ikon', k.ikon),
          el('h3', '', k.ad),
          el('div', 'arti', `＋ ${k.arti}`),
          el('div', 'eksi', `－ ${k.eksi}`),
          el('div', 'sec', 'Seç'),
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
