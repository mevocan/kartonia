// Kasaba günlüğü (defter) ve yıl sonu gazetesi (Kartonia Postası). İkisi de ortada açılan kağıt pencerelerdir;
// açıkken oyun durur (main yönetir). Gazete her yıl sonunda kendiliğinden açılır (oyuncu kapatabilir: localStorage).
import type { BuildingType, Gazete, GameState, GunlukKaydi } from '../logic/types';
import { GOALS, kartBul, mevsim, yilNo } from '../logic/game';
import { el, panelAc, panelKapat, tr } from './dom';
import { binaAd, evSeviyeAd, hedefMetni, kartMetni, kucuk, mevsimAd, t, type Anahtar } from './i18n';
import { SENLIKLER } from '../data/senlikler';
import type { Mevsim } from '../logic/season';

/** Kasaba unvanının adı (0 Mezra … 4 Efsane kasaba). */
export const unvanAd = (n: number): string => t(`unvan.${Math.max(0, Math.min(4, n))}` as Anahtar);

/** Mevsim şenliğinin adı. */
export const senlikAd = (m: Mevsim): string => t(`senlik.${m}.ad` as Anahtar);

const GAZETE_ANAHTARI = 'kagit-kasaba-gazete';

/** Yıl sonu gazetesi kendiliğinden açılsın mı (varsayılan evet). */
export function gazeteGosterilsin(): boolean {
  try {
    return localStorage.getItem(GAZETE_ANAHTARI) !== '0';
  } catch {
    return true;
  }
}

function gazeteTercihi(acik: boolean): void {
  try {
    localStorage.setItem(GAZETE_ANAHTARI, acik ? '1' : '0');
  } catch {
    /* yok say */
  }
}

/** Bir günlük kaydının metni. */
export function gunlukMetni(k: GunlukKaydi): string {
  switch (k.tur) {
    case 'ilkEv': return t('gunluk.ilkEv');
    case 'ilkYemek': return t('gunluk.ilkYemek');
    case 'ilkTuccar': return t('gunluk.ilkTuccar');
    case 'ilkKis': return t('gunluk.ilkKis');
    case 'nufus': return t('gunluk.nufus', { n: tr(Number(k.veri)) });
    case 'evSeviye': return t('gunluk.evSeviye', { ad: kucuk(evSeviyeAd(Number(k.veri))) });
    case 'kule': return t('gunluk.kule', { n: Number(k.veri) });
    case 'kuleTamam': return t('gunluk.kuleTamam');
    case 'kart': {
      const kart = kartBul(String(k.veri));
      return kart ? t('gunluk.kart', { ikon: kart.ikon, ad: kartMetni(kart).ad }) : t('gunluk.kartBilinmeyen');
    }
    case 'senlik': return t('gunluk.senlik');
    case 'hedef': return t('gunluk.hedef', { ad: hedefMetni(Number(k.veri)).ad });
    case 'gazete': return t('gunluk.gazete', { yil: Number(k.veri) });
    case 'gunlukBasladi': return t('gunluk.basladi');
    case 'festival': return t('gunluk.festival', { ad: senlikAd(String(k.veri) as Mevsim) });
    case 'projeTamam': return t('gunluk.projeTamam', { ad: binaAd(String(k.veri) as BuildingType) });
    case 'unvan': return t('gunluk.unvan', { ad: unvanAd(Number(k.veri)) });
  }
}

function ikon(k: GunlukKaydi): string {
  switch (k.tur) {
    case 'ilkEv': return '🏠';
    case 'ilkYemek': return '🍞';
    case 'ilkTuccar': return '🛒';
    case 'ilkKis': return '❄️';
    case 'nufus': return '👥';
    case 'evSeviye': return '🏡';
    case 'kule': case 'kuleTamam': return '🕰️';
    case 'kart': return '🃏';
    case 'senlik': return '🎉';
    case 'hedef': return '🎯';
    case 'gazete': return '📰';
    case 'gunlukBasladi': return '📖';
    case 'festival': return SENLIKLER[k.veri as Mevsim]?.ikon ?? '🎪';
    case 'projeTamam': return '🏛️';
    case 'unvan': return '🏅';
  }
}

// ---- Gazete ----

export interface Newspaper {
  show(g: Gazete): void;
  hide(): void;
  isOpen(): boolean;
}

export function createNewspaper(root: HTMLElement, onClose: () => void): Newspaper {
  const perde = el('div', 'perde');
  perde.id = 'gazetePerde';
  const box = el('div', 'kagit');
  box.id = 'gazete';
  perde.appendChild(box);
  root.appendChild(perde);
  let acik = false;

  return {
    show(g) {
      box.replaceChildren();
      const bas = el('div', 'manset-ust');
      bas.append(
        el('div', 'gazete-ad', t('gazete.ad')),
        el('div', 'gazete-tarih', g.unvan !== undefined
          ? t('gazete.unvan', { unvan: unvanAd(g.unvan), yil: g.yil, gun: g.gun })
          : t('gazete.tarih', { yil: g.yil, gun: g.gun })),
      );
      const manset = el('h2', 'manset', g.manset ? gunlukMetni(g.manset) : t('gazete.sakinYil'));
      const fark = g.nufusSon - g.nufusBasi;
      const sayilar = el('div', 'gazete-sayilar');
      for (const [ad, deger] of [
        [t('gazete.nufus'), `${tr(g.nufusBasi)} → ${tr(g.nufusSon)}${fark !== 0 ? ` (${fark > 0 ? '+' : '−'}${tr(Math.abs(fark))})` : ''}`],
        [t('gazete.bina'), tr(g.kurulanBina)],
        [t('gazete.vergi'), `${tr(g.vergi)} 💰`],
        [t('gazete.yemek'), `${tr(g.yemek)} 🍽️`],
      ] as const) {
        const k = el('div', 'kutu');
        k.append(el('div', 'deger', deger), el('div', 'etiket', ad));
        sayilar.appendChild(k);
      }
      const sutun = el('div', 'gazete-sutun');
      if (g.enMutluEv) {
        sutun.appendChild(el('p', '', t('gazete.enMutlu', { ad: kucuk(evSeviyeAd(g.enMutluEv.seviye)), m: g.enMutluEv.mutluluk })));
      }
      sutun.appendChild(el('p', '', g.hedef < GOALS.length
        ? t('gazete.ipucu', { hedef: hedefMetni(g.hedef).ad })
        : t('gazete.ipucuEfsane')));
      const alt = el('div', 'gazete-alt');
      const secim = el('label', 'secim');
      const kutu = el('input');
      kutu.type = 'checkbox';
      kutu.checked = gazeteGosterilsin();
      kutu.addEventListener('change', () => gazeteTercihi(kutu.checked));
      secim.append(kutu, el('span', '', t('gazete.herYil')));
      const devam = el('button', 'dugme birincil', t('gazete.devam'));
      devam.addEventListener('click', () => onClose());
      alt.append(secim, devam);
      box.append(bas, manset, sayilar, sutun, alt);
      perde.style.display = 'flex';
      panelAc(box);
      acik = true;
    },
    hide() {
      if (!acik) return;
      acik = false;
      perde.style.display = 'none';
    },
    isOpen: () => acik,
  };
}

// ---- Günlük ----

export interface Journal {
  show(s: GameState): void;
  hide(): void;
  isOpen(): boolean;
}

export function createJournal(root: HTMLElement, onClose: () => void, onNewspaper: (g: Gazete) => void): Journal {
  const perde = el('div', 'perde');
  perde.id = 'gunlukPerde';
  const box = el('div', 'kagit');
  box.id = 'gunluk';
  perde.appendChild(box);
  root.appendChild(perde);
  perde.addEventListener('pointerdown', (e) => {
    if (e.target === perde) onClose();
  });
  let acik = false;

  return {
    show(s) {
      box.replaceChildren();
      const kapat = el('button', 'kapat', '×');
      kapat.title = t('genel.kapatEsc');
      kapat.addEventListener('click', () => onClose());
      box.append(kapat, el('h3', '', t('gunluk.baslik')));
      const liste = el('div', 'gunluk-liste');
      const kayitlar = (s.gunluk ?? []).filter((k) => !k.gizli);
      if (kayitlar.length === 0) liste.appendChild(el('p', 'bos', t('gunluk.bos')));
      // Yıl ve mevsim başlıklarıyla, eskiden yeniye.
      let sonBaslik = '';
      for (const k of kayitlar) {
        const baslik = t('gunluk.yilMevsim', { yil: yilNo(k.gun), mevsim: mevsimAd(mevsim(k.gun)) });
        if (baslik !== sonBaslik) {
          liste.appendChild(el('h4', '', baslik));
          sonBaslik = baslik;
        }
        const satir = el('div', 'kayit');
        satir.append(el('span', 'gun', t('gunluk.gun', { n: k.gun })), el('span', 'ikon', ikon(k)), el('span', 'metin', gunlukMetni(k)));
        if (k.tur === 'gazete') {
          const g = (s.gazeteler ?? []).find((x) => x.yil === Number(k.veri));
          if (g) {
            satir.classList.add('tiklanir');
            satir.title = t('gunluk.gazeteAc');
            satir.addEventListener('click', () => onNewspaper(g));
          }
        }
        liste.appendChild(satir);
      }
      box.appendChild(liste);
      perde.style.display = 'flex';
      panelAc(box);
      acik = true;
      liste.scrollTop = liste.scrollHeight; // en yeni anlar altta
    },
    hide() {
      if (!acik) return;
      acik = false;
      panelKapat(box);
      perde.style.display = 'none';
    },
    isOpen: () => acik,
  };
}
