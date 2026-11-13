// Kağıt şerit bildirimler + sol üstteki hedef kartı.
import type { GameState, IstekSonuc, IstekTuru, PlaceFailReason } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { GOALS, goalProgress, istekHedefi, istekKalanGun, kisaKalanGun, mevsim, mevsimGunu } from '../logic/game';
import { el } from './dom';
import { hedefMetni, t } from './i18n';

export type ToastKind = 'iyi' | 'kotu' | 'bilgi';

export interface Toasts {
  show(text: string, kind?: ToastKind): void;
}

export interface GoalCard {
  update(s: GameState): void;
}

/** Yerleştirilemeyen bina / yol için gerekçe metni. */
export const yerlestirmeSebebi = (s: PlaceFailReason): string => t(`sebep.${s}`);

export function createToasts(root: HTMLElement): Toasts {
  const box = el('div');
  box.id = 'bildirimler';
  root.appendChild(box);
  let sonMetin = '';
  let sonZaman = 0;

  return {
    show(text, kind = 'bilgi') {
      // Aynı bildirimi art arda yığma.
      const now = performance.now();
      if (text === sonMetin && now - sonZaman < 1200) return;
      sonMetin = text;
      sonZaman = now;

      const el_ = el('div', `kagit bildirim ${kind}`, text);
      box.appendChild(el_);
      while (box.children.length > 5) box.firstElementChild?.remove();
      window.setTimeout(() => {
        el_.classList.add('gidiyor');
        window.setTimeout(() => el_.remove(), 450);
      }, 3200);
    },
  };
}

export function createGoalCard(root: HTMLElement): GoalCard {
  const box = el('div', 'kagit bant');
  box.id = 'hedef';
  const baslik = el('h3');
  const aciklama = el('p');
  const ilerleme = el('div', 'ilerleme');
  box.append(baslik, aciklama, ilerleme);
  root.appendChild(box);

  return {
    update(s) {
      // Toplam hedef sayısı bilerek gösterilmez: oyuncu sıradakini görür, kaç tane kaldığını değil.
      ilerleme.textContent = t('hedef.baslik');
      if (s.hedef >= GOALS.length) {
        baslik.textContent = t('hedef.efsane');
        aciklama.textContent = t('hedef.efsaneMetin');
        return;
      }
      const g = hedefMetni(s.hedef);
      baslik.textContent = `🎯 ${g.ad}`;
      const p = goalProgress(s);
      aciklama.textContent = p ? `${g.aciklama} (${p.mevcut} / ${p.hedef})` : g.aciklama;
    },
  };
}

/**
 * Gün başında gösterilecek mevsim bildirimi (yoksa null): sonbaharın ilk günü kış uyarısı.
 */
export function mevsimBildirimi(gun: number): { metin: string; tur: ToastKind } | null {
  if (mevsimGunu(gun) !== 1) return null;
  if (mevsim(gun) === 'sonbahar') return { metin: t('bildirim.kisGeliyor', { n: kisaKalanGun(gun) }), tur: 'kotu' };
  return null;
}

// ---- Sakin istekleri ----

const I = BALANCE.istek;

/** İsteğin başlığı. */
export const istekAd = (tur: IstekTuru): string => t(`istek.${tur}.ad`);

/** İsteğin açıklaması (sayılar BALANCE'tan). */
export function istekAciklama(tur: IstekTuru): string {
  switch (tur) {
    case 'senlik': return t('istek.senlik.aciklama', { yemek: I.senlikYemek, gun: I.senlikGun, mutluluk: I.senlikMutluluk });
    case 'agaclandirma': return t('istek.agaclandirma.aciklama', { sayi: I.agacSayisi, odul: I.agacOdul });
    case 'kisHazirligi': return t('istek.kisHazirligi.aciklama', { odun: I.kisOdun, odul: I.kisOdul });
    case 'susuzEv': return t('istek.susuzEv.aciklama', { odul: I.suOdul });
  }
}

export interface RequestCard {
  update(s: GameState): void;
}

/** Hedef kartının altında küçük istek kartı: metin, ilerleme, kalan gün; Şenlik'te teslim düğmesi. */
export function createRequestCard(root: HTMLElement, onFeast: () => void, onShowHouse: (id: number) => void): RequestCard {
  const box = el('div', 'kagit');
  box.id = 'istek';
  const baslik = el('h4');
  const aciklama = el('p');
  const alt = el('div', 'ilerleme');
  const dugme = el('button', 'dugme', t('istek.teslimEt', { n: I.senlikYemek }));
  dugme.addEventListener('click', onFeast);
  const goster = el('button', 'dugme', t('istek.eviGoster'));
  goster.addEventListener('click', () => {
    if (hedefId !== undefined) onShowHouse(hedefId);
  });
  let hedefId: number | undefined;
  box.append(baslik, aciklama, alt, dugme, goster);
  root.appendChild(box);

  return {
    update(s) {
      const ist = s.istek;
      if (!ist) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      baslik.textContent = istekAd(ist.tur);
      aciklama.textContent = istekAciklama(ist.tur);
      const hedef = istekHedefi(ist.tur);
      const ilerleme = ist.tur === 'senlik' ? Math.min(Math.floor(s.stok.yemek), hedef) : Math.min(Math.floor(ist.ilerleme), hedef);
      const kalan = istekKalanGun(s);
      const sayac = ist.tur === 'susuzEv' ? '' : ist.tur === 'senlik' ? `${t('istek.stok')} ${ilerleme} / ${hedef} · ` : `${ilerleme} / ${hedef} · `;
      alt.textContent = sayac + (kalan > 1 ? t('istek.kalanGun', { n: kalan }) : t('istek.sonGun'));
      dugme.style.display = ist.tur === 'senlik' ? 'block' : 'none';
      dugme.disabled = s.stok.yemek < I.senlikYemek;
      hedefId = ist.hedefBinaId;
      goster.style.display = ist.tur === 'susuzEv' ? 'block' : 'none';
    },
  };
}

/** Tamamlanan istek bildirimi. */
export function istekTamamMetni(r: IstekSonuc): string {
  if (r.tur === 'senlik') return t('istek.senlikYapildi', { gun: I.senlikGun, mutluluk: I.senlikMutluluk });
  return t('istek.tamamlandi', { ad: istekAd(r.tur), para: r.para });
}
