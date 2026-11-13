// Sol panel: sıradaki hedef (küçük başlar, tıklayınca açılır), sakinlerin isteği ve kasaba uyarıları.
// Açık/kapalı tercihi localStorage'da (kagit-kasaba-panel) kalır. Kutlama animasyonu arayüz zamanıyla çalışır.
import type { GameState } from '../logic/types';
import { BALANCE, BUILDING_ORDER, BUILDINGS } from '../data/buildings';
import { GOALS, goalProgress, istekHedefi, istekKalanGun } from '../logic/game';
import { townAlerts } from '../logic/pins';
import { el, tr } from './dom';
import { binaAd, hedefMetni, t } from './i18n';
import { istekAciklama, istekAd } from './toast';

const PANEL_ANAHTARI = 'kagit-kasaba-panel';
/** Hedef tamamlanınca kartın kutlama süresi (ms); ardından sıradaki hedef gelir. */
const KUTLAMA = 1900;

/** Panel tercihleri: hangi kartlar açık. */
export function panelTercihi(): { hedef: boolean; yol: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(PANEL_ANAHTARI) ?? '{}') as { hedef?: unknown; yol?: unknown };
    return { hedef: v.hedef === true, yol: v.yol !== false };
  } catch {
    return { hedef: false, yol: true };
  }
}

export function panelTercihKaydet(alan: 'hedef' | 'yol', acik: boolean): void {
  try {
    localStorage.setItem(PANEL_ANAHTARI, JSON.stringify({ ...panelTercihi(), [alan]: acik }));
  } catch {
    /* yok say */
  }
}

/** Sol üstteki sütun: içine hedef, istek ve uyarılar girer. */
export function createLeftColumn(root: HTMLElement): HTMLDivElement {
  const col = el('div');
  col.id = 'solPanel';
  root.appendChild(col);
  return col;
}

// ---- Hedef ----

export interface GoalCard {
  update(s: GameState): void;
  /** Tamamlanan hedefi kutlar; kutlama bitince kart sıradaki hedefe geçer. */
  kutla(ad: string): void;
}

/** Nüfusla açılacak ilk bina (yoksa null). */
function siradakiAcilis(s: GameState): { ad: string; nufus: number } | null {
  let en: { ad: string; nufus: number } | null = null;
  for (const b of BUILDING_ORDER) {
    const n = BUILDINGS[b].acilmaNufus;
    if (n > s.nufus && (!en || n < en.nufus)) en = { ad: binaAd(b), nufus: n };
  }
  return en;
}

export function createGoalCard(col: HTMLElement): GoalCard {
  const box = el('div', 'kagit');
  box.id = 'hedef';
  box.setAttribute('role', 'button');
  box.tabIndex = 0;
  const ust = el('div', 'ust');
  const etiket = el('span', 'etiket', t('hedef.baslik'));
  ust.append(etiket, el('span', 'ok', '▾'));
  const baslik = el('h3');
  const aciklama = el('p', 'aciklama');
  const cubuk = el('div', 'ilerleme-cubuk');
  const cubukIc = el('div');
  cubuk.appendChild(cubukIc);
  const detay = el('div', 'detay');
  const sayi = el('div', 'sayi');
  const acilis = el('div', 'acilis');
  detay.append(sayi, acilis);
  const parilti = el('div', 'parilti');
  for (let i = 0; i < 10; i++) {
    const p = el('span');
    p.style.setProperty('--a', `${i * 36}deg`);
    p.style.setProperty('--g', `${i % 3}`);
    parilti.appendChild(p);
  }
  box.append(ust, baslik, aciklama, cubuk, detay, parilti);
  col.appendChild(box);

  box.classList.toggle('acik', panelTercihi().hedef);
  const ac = (): void => {
    const acik = !box.classList.contains('acik');
    box.classList.toggle('acik', acik);
    panelTercihKaydet('hedef', acik);
  };
  box.addEventListener('click', ac);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ac();
    }
  });

  let son: GameState | null = null;
  let kutlaniyor = 0;

  function ciz(s: GameState): void {
    etiket.textContent = t('hedef.baslik');
    if (s.hedef >= GOALS.length) {
      baslik.textContent = t('hedef.efsane');
      aciklama.textContent = t('hedef.efsaneMetin');
      cubuk.style.display = 'none';
      sayi.textContent = '';
    } else {
      const g = hedefMetni(s.hedef);
      baslik.textContent = `🎯 ${g.ad}`;
      aciklama.textContent = g.aciklama;
      const p = goalProgress(s);
      cubuk.style.display = p ? '' : 'none';
      if (p) cubukIc.style.width = `${Math.round((p.mevcut / p.hedef) * 100)}%`;
      // Yalnızca bu hedefin ilerlemesi; toplam hedef sayısı gösterilmez.
      sayi.textContent = p ? `${tr(p.mevcut)} / ${tr(p.hedef)}` : '';
    }
    const a = siradakiAcilis(s);
    acilis.textContent = a ? t('hedef.sonrakiAcilis', { bina: a.ad, n: tr(a.nufus) }) : '';
    detay.style.display = sayi.textContent || acilis.textContent ? '' : 'none';
  }

  return {
    update(s) {
      son = s;
      if (!kutlaniyor) ciz(s);
    },
    kutla(ad) {
      window.clearTimeout(kutlaniyor);
      box.classList.remove('kutlama');
      void box.offsetWidth; // animasyonu yeniden başlat
      box.classList.add('kutlama');
      etiket.textContent = t('hedef.tamam');
      baslik.textContent = `✓ ${ad}`;
      cubuk.style.display = '';
      cubukIc.style.width = '100%';
      kutlaniyor = window.setTimeout(() => {
        kutlaniyor = 0;
        box.classList.remove('kutlama');
        if (son) ciz(son);
        box.classList.add('yeni');
        window.setTimeout(() => box.classList.remove('yeni'), 400);
      }, KUTLAMA);
    },
  };
}

// ---- Sakinlerin isteği ----

const I = BALANCE.istek;

export interface RequestCard {
  update(s: GameState): void;
}

/** Hedefin altında istek kartı: metin, ilerleme çubuğu, kalan gün; Şenlik'te teslim, Susuz ev'de "evi göster". */
export function createRequestCard(col: HTMLElement, onFeast: () => void, onShowHouse: (id: number) => void): RequestCard {
  const box = el('div', 'kagit');
  box.id = 'istek';
  const ust = el('div', 'ust');
  const gunCip = el('span', 'gun-cip');
  ust.append(el('span', 'etiket', t('istek.baslik')), gunCip);
  const baslik = el('h4');
  const aciklama = el('p');
  const cubuk = el('div', 'ilerleme-cubuk');
  const cubukIc = el('div');
  cubuk.appendChild(cubukIc);
  const alt = el('div', 'ilerleme');
  const dugme = el('button', 'dugme', t('istek.teslimEt', { n: I.senlikYemek }));
  dugme.addEventListener('click', onFeast);
  const goster = el('button', 'dugme', t('istek.eviGoster'));
  let hedefId: number | undefined;
  goster.addEventListener('click', () => {
    if (hedefId !== undefined) onShowHouse(hedefId);
  });
  box.append(ust, baslik, aciklama, cubuk, alt, dugme, goster);
  col.appendChild(box);
  let onceki = '';

  return {
    update(s) {
      const ist = s.istek;
      if (!ist) {
        box.style.display = 'none';
        onceki = '';
        return;
      }
      box.style.display = 'block';
      // Yeni istek gelince kart kısa bir girişle belirir.
      const imza = `${ist.tur}:${ist.baslangicGun}`;
      if (imza !== onceki) {
        onceki = imza;
        box.classList.remove('yeni');
        void box.offsetWidth;
        box.classList.add('yeni');
      }
      baslik.textContent = istekAd(ist.tur);
      aciklama.textContent = istekAciklama(ist.tur);
      const hedef = istekHedefi(ist.tur);
      const ilerleme = ist.tur === 'senlik' ? Math.min(Math.floor(s.stok.yemek), hedef) : Math.min(Math.floor(ist.ilerleme), hedef);
      const kalan = istekKalanGun(s);
      gunCip.textContent = kalan > 1 ? t('istek.kalanGun', { n: kalan }) : t('istek.sonGun');
      gunCip.classList.toggle('acil', kalan <= 1);
      const sayacli = ist.tur !== 'susuzEv';
      cubuk.style.display = sayacli ? '' : 'none';
      alt.style.display = sayacli ? '' : 'none';
      if (sayacli) {
        cubukIc.style.width = `${Math.round((ilerleme / Math.max(1, hedef)) * 100)}%`;
        alt.textContent = ist.tur === 'senlik' ? `${t('istek.stok')} ${ilerleme} / ${hedef}` : `${ilerleme} / ${hedef}`;
      }
      box.classList.toggle('hazir', sayacli && ilerleme >= hedef);
      dugme.style.display = ist.tur === 'senlik' ? 'block' : 'none';
      dugme.disabled = s.stok.yemek < I.senlikYemek;
      hedefId = ist.hedefBinaId;
      goster.style.display = ist.tur === 'susuzEv' ? 'block' : 'none';
    },
  };
}

// ---- Kasaba uyarıları ----

export interface AlertList {
  update(s: GameState): void;
}

/**
 * İsteğin altında küçük uyarı şeritleri: borç, küçülmek üzere evler (tıklayınca sıradaki eve gider), işçi eksikliği.
 * Uyarı yoksa hiçbir şey görünmez.
 */
export function createAlertList(col: HTMLElement, onShowHouse: (id: number) => void): AlertList {
  const box = el('div');
  box.id = 'uyarilar';
  col.appendChild(box);
  let imza = '';
  let evler: number[] = [];
  let sira = 0;

  return {
    update(s) {
      const liste = townAlerts(s);
      const yeni = JSON.stringify(liste.map((u) => (u.tur === 'isci' ? { tur: u.tur, oran: Math.round(u.oran * 100) } : u)));
      if (yeni === imza) return;
      imza = yeni;
      box.replaceChildren();
      for (const u of liste) {
        const cip = el(u.tur === 'kuculen' ? 'button' : 'div', `uyari-cip ${u.tur}`);
        let ikon = '';
        let metin = '';
        if (u.tur === 'borc') {
          ikon = '💸';
          metin = t('uyari.borc', { sinir: BALANCE.borcSiniri, gun: u.gun, toplam: BALANCE.borcGunSiniri });
        } else if (u.tur === 'kuculen') {
          ikon = '🏚️';
          metin = t('uyari.kuculen', { n: u.evler.length });
          evler = u.evler;
          cip.title = t('uyari.kuculenIpucu');
          cip.addEventListener('click', () => {
            if (!evler.length) return;
            sira = (sira + 1) % evler.length;
            onShowHouse(evler[sira]);
          });
        } else {
          ikon = '👷';
          metin = t('uyari.isci', { n: Math.round(u.oran * 100) });
        }
        cip.append(el('span', 'ikon', ikon), el('span', '', metin));
        box.appendChild(cip);
      }
    },
  };
}
