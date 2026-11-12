// Sol alt köşe: kasabanın seçtiği karar kartları (ad, artı, eksi) hep görünür; sıradaki seçim günü de yazar.
import type { GameState } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { kartBul, toplamSecim } from '../logic/game';
import { el } from './dom';
import { kartMetni, t } from './i18n';

export interface CardList {
  update(s: GameState): void;
}

export function createCardList(root: HTMLElement): CardList {
  const box = el('div', 'kagit bant');
  box.id = 'kasabaYolu';
  const baslik = el('h4', '', t('kart.yolIkonlu'));
  const liste = el('div', 'liste');
  const alt = el('div', 'alt');
  box.append(baslik, liste, alt);
  root.appendChild(box);

  let imza = '';

  return {
    update(s) {
      const kararlar = s.kararlar ?? [];
      const { aralik } = BALANCE.kartSecimi;
      const yapilan = kararlar.length + (s.bekleyenKararlar?.length ?? 0);
      const sonraki = yapilan < toplamSecim() ? (Math.floor(s.gun / aralik) + 1) * aralik : null;
      const yeni = `${kararlar.join(',')}|${sonraki}`;
      if (yeni === imza) return;
      imza = yeni;

      liste.replaceChildren();
      for (const id of kararlar) {
        const k = kartBul(id);
        if (!k) continue;
        const satir = el('div', 'kart');
        const m = kartMetni(k);
        satir.append(
          el('div', 'ad', `${k.ikon} ${m.ad}`),
          el('div', 'arti', `＋ ${m.arti}`),
          el('div', 'eksi', `－ ${m.eksi}`),
        );
        liste.appendChild(satir);
      }
      if (kararlar.length === 0) liste.appendChild(el('div', 'bos', t('kart.yok')));
      const sayi = `${kararlar.length} / ${toplamSecim()}`;
      alt.textContent = sonraki !== null
        ? t('kart.siradaki', { gun: sonraki, sayi })
        : t('kart.hepsi', { sayi });
    },
  };
}
