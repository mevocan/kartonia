// Kağıt şerit bildirimler + sol üstteki hedef kartı.
import type { GameState, IstekSonuc, IstekTuru, PlaceFailReason } from '../logic/types';
import { BALANCE } from '../data/buildings';
import { GOALS, goalProgress, istekHedefi, istekKalanGun, kisaKalanGun, mevsim, mevsimGunu } from '../logic/game';
import { el } from './dom';

export type ToastKind = 'iyi' | 'kotu' | 'bilgi';

export interface Toasts {
  show(text: string, kind?: ToastKind): void;
}

export interface GoalCard {
  update(s: GameState): void;
}

export const YERLESTIRME_SEBEP: Record<PlaceFailReason, string> = {
  disarida: 'Harita sınırının dışı.',
  gol: 'Göle yapılamaz.',
  egim: 'Zemin çok eğimli.',
  cakisiyor: 'Başka bir binaya ya da ağaca çok yakın.',
  yol: 'Yolun üstüne yapılamaz.',
  yolYok: 'Bir yolun kenarına koymalısın.',
  baglantisiz: 'Yol mevcut bir yola bağlanmalı.',
  kisa: 'Yol çok kısa.',
  golYok: 'Balıkçı göl kıyısına kurulmalı.',
  taslikYok: 'Taş ocağı taşlık bir alana kurulmalı.',
  tas: 'Taş yetmiyor. Taş ocağı kur.',
  odun: 'Odun yetmiyor. Oduncu kur ya da ağaç kes.',
  mobilya: 'Mobilya yetmiyor. Marangoz kur.',
  para: 'Para yetmiyor.',
  kilitli: 'Bu bina henüz açılmadı.',
  bitti: 'Oyun bitti.',
};

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

      const t = el('div', `kagit bildirim ${kind}`, text);
      box.appendChild(t);
      while (box.children.length > 5) box.firstElementChild?.remove();
      window.setTimeout(() => {
        t.classList.add('gidiyor');
        window.setTimeout(() => t.remove(), 450);
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
      const tamam = Math.min(s.hedef, GOALS.length);
      ilerleme.textContent = `Hedef ${Math.min(tamam + 1, GOALS.length)} / ${GOALS.length}  ` +
        '●'.repeat(tamam) + '○'.repeat(GOALS.length - tamam);
      if (s.hedef >= GOALS.length) {
        baslik.textContent = '🏆 Kasaba efsanesi!';
        aciklama.textContent = 'Bütün hedefler bitti. Kasabanı büyütmeye devam et.';
        ilerleme.textContent = '●'.repeat(GOALS.length);
        return;
      }
      const g = GOALS[s.hedef];
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
  const m = mevsim(gun);
  if (m === 'sonbahar') return { metin: `🍂 Kış ${kisaKalanGun(gun)} gün sonra. Yemek ve odun biriktir.`, tur: 'kotu' };
  return null;
}

// ---- Sakin istekleri ----

const I = BALANCE.istek;

/** İsteklerin başlığı ve açıklaması. */
export const ISTEK_METIN: Record<IstekTuru, { ad: string; aciklama: string }> = {
  senlik: { ad: '🎉 Şenlik', aciklama: `Sakinler şenlik istiyor: stoktan ${I.senlikYemek} yemek teslim et. Ödül: ${I.senlikGun} gün bütün evlere +${I.senlikMutluluk} mutluluk.` },
  agaclandirma: { ad: '🌳 Ağaçlandırma', aciklama: `${I.agacSayisi} ağaç dik. Ödül: ${I.agacOdul} para.` },
  kisHazirligi: { ad: '🪵 Kış hazırlığı', aciklama: `Stokta ${I.kisOdun} odun bulunsun. Ödül: ${I.kisOdul} para.` },
  susuzEv: { ad: '💧 Susuz ev', aciklama: `Bir ev suya kavuşsun (yakınına Çeşme kur). Ödül: ${I.suOdul} para.` },
};

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
  const dugme = el('button', 'dugme', `Yemeği teslim et (🍽️ ${I.senlikYemek})`);
  dugme.addEventListener('click', onFeast);
  const goster = el('button', 'dugme', 'Evi göster');
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
      const m = ISTEK_METIN[ist.tur];
      baslik.textContent = m.ad;
      aciklama.textContent = m.aciklama;
      const hedef = istekHedefi(ist.tur);
      const ilerleme = ist.tur === 'senlik' ? Math.min(Math.floor(s.stok.yemek), hedef) : Math.min(Math.floor(ist.ilerleme), hedef);
      const kalan = istekKalanGun(s);
      const sayac = ist.tur === 'susuzEv' ? '' : ist.tur === 'senlik' ? `Stok ${ilerleme} / ${hedef} · ` : `${ilerleme} / ${hedef} · `;
      alt.textContent = `${sayac}${kalan > 1 ? `${kalan} gün kaldı` : 'son gün'}`;
      dugme.style.display = ist.tur === 'senlik' ? 'block' : 'none';
      dugme.disabled = s.stok.yemek < I.senlikYemek;
      hedefId = ist.hedefBinaId;
      goster.style.display = ist.tur === 'susuzEv' ? 'block' : 'none';
    },
  };
}

/** Tamamlanan istek bildirimi. */
export function istekTamamMetni(r: IstekSonuc): string {
  if (r.tur === 'senlik') return `🎉 Şenlik yapıldı! ${I.senlikGun} gün boyunca bütün evlere +${I.senlikMutluluk} mutluluk.`;
  return `✅ İstek tamamlandı: ${ISTEK_METIN[r.tur].ad} (+${r.para} para)`;
}
