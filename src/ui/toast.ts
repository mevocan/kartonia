// Bildirimler (üst ortada, HUD'un altında) ve istek / mevsim metinleri. Hedef ve istek kartları: ui/solPanel.ts.
import type { IstekSonuc, IstekTuru, PlaceFailReason } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { kisaKalanGun, mevsim, mevsimGunu } from '../logic/game';
import { el } from './dom';
import { t } from './i18n';

export type ToastKind = 'iyi' | 'kotu' | 'bilgi';

export interface Toasts {
  show(text: string, kind?: ToastKind): void;
}

/** Yerleştirilemeyen bina / yol için gerekçe metni. */
export const yerlestirmeSebebi = (s: PlaceFailReason): string => t(`sebep.${s}`);

const BILDIRIM_SINIR = 3;

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
      // En fazla üç bildirim: yenisi gelince en eskisi hemen kalkar.
      while (box.children.length > BILDIRIM_SINIR) box.firstElementChild?.remove();
      // Kötü haber daha uzun kalır (önem sırası).
      window.setTimeout(() => {
        el_.classList.add('gidiyor');
        window.setTimeout(() => el_.remove(), 250);
      }, kind === 'kotu' ? 4800 : 3200);
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

/** Tamamlanan istek bildirimi. */
export function istekTamamMetni(r: IstekSonuc): string {
  if (r.tur === 'senlik') return t('istek.senlikYapildi', { gun: I.senlikGun, mutluluk: I.senlikMutluluk });
  return t('istek.tamamlandi', { ad: istekAd(r.tur), para: r.para });
}
