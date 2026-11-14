// Mobil: küçük ekranda arayüz ölçeği, tam ekran ve yatay yön zorunluluğu.
// Arayüz masaüstüne göre tasarlandı; ekran REF_W × REF_H'den küçükse #arayuz CSS zoom ile küçültülür
// (yalnızca input.ts'teki fare etiketi JS ile konumlanır, o da olcek()e böler).
// Dokunmatik cihaz dikey tutulursa oyun durur ve "yan çevir" perdesi çıkar. Tam ekran (Android) yönü de yataya kilitler;
// iPhone Safari öğe tam ekranını desteklemez, orada "Ana Ekrana Ekle" ipucu gösterilir (manifest yatay + tam ekran açar).
import { el } from './dom';
import { t } from './i18n';

const REF_W = 1100;
const REF_H = 620;
const MIN_OLCEK = 0.5;

/** Pencere boyutuna göre arayüz ölçeği (0.5 .. 1). */
export function arayuzOlcegi(w: number, h: number): number {
  return Math.max(MIN_OLCEK, Math.min(1, w / REF_W, h / REF_H));
}

type TamEkranBelge = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type TamEkranOge = HTMLElement & { webkitRequestFullscreen?: (o?: FullscreenOptions) => Promise<void> | void };
type YonKilidi = ScreenOrientation & { lock?: (yon: string) => Promise<void> };

const belge = document as TamEkranBelge;

export function tamEkranDestekli(): boolean {
  const d = document.documentElement as TamEkranOge;
  return typeof d.requestFullscreen === 'function' || typeof d.webkitRequestFullscreen === 'function';
}

export function tamEkranda(): boolean {
  return !!(belge.fullscreenElement ?? belge.webkitFullscreenElement);
}

/** Tam ekrana geçer ve (destekleniyorsa) yönü yataya kilitler. Kullanıcı hareketi içinde çağrılmalı. */
export async function tamEkranAc(): Promise<void> {
  const d = document.documentElement as TamEkranOge;
  try {
    if (!tamEkranda()) {
      if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
      else await d.webkitRequestFullscreen?.();
    }
  } catch {
    return;
  }
  try {
    await (screen.orientation as YonKilidi | undefined)?.lock?.('landscape');
  } catch {
    /* masaüstü ya da desteklenmiyor */
  }
}

export async function tamEkranKapat(): Promise<void> {
  try {
    if (belge.exitFullscreen) await belge.exitFullscreen();
    else await belge.webkitExitFullscreen?.();
  } catch {
    /* yok say */
  }
}

export interface Mobil {
  /** Arayüzün şu anki ölçeği (#arayuz zoom). */
  olcek(): number;
  dokunmatik: boolean;
}

/** ui: #arayuz. dikeyDegisti: dokunmatik cihaz dikey/yatay olunca (oyun dikeyde durdurulur). */
export function createMobile(ui: HTMLElement, dikeyDegisti: (dikey: boolean) => void): Mobil {
  // Giriş ekranındaki notla aynı kural: dokunmatik ekranlı dizüstü (ince işaretçi de var) sayılmaz.
  const dokunmatik = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  let k = 1;

  const perde = el('div');
  perde.id = 'yanCevir';
  const kart = el('div', 'kagit yan-cevir-kart');
  kart.append(el('div', 'yan-cevir-tel', '📱'), el('h2', '', t('mobil.cevir')), el('p', '', t('mobil.cevirAlt')));
  if (tamEkranDestekli()) {
    const b = el('button', 'dugme birincil', t('mobil.tamEkran'));
    b.addEventListener('click', () => void tamEkranAc());
    kart.appendChild(b);
  } else {
    kart.appendChild(el('p', 'yan-cevir-ipucu', t('mobil.iosIpucu')));
  }
  perde.appendChild(kart);
  document.body.appendChild(perde);

  let dikey: boolean | null = null;
  function guncelle(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const yeni = arayuzOlcegi(w, h);
    if (yeni !== k) {
      k = yeni;
      ui.style.setProperty('zoom', k === 1 ? '' : String(k));
    }
    const d = dokunmatik && h > w;
    if (d !== dikey) {
      dikey = d;
      perde.classList.toggle('acik', d);
      dikeyDegisti(d);
    }
  }
  window.addEventListener('resize', guncelle);
  window.addEventListener('orientationchange', guncelle);
  guncelle();

  // Dokunmatik cihazda ilk dokunuşta tam ekran + yatay kilit (tarayıcılar yalnızca kullanıcı hareketiyle izin verir).
  if (dokunmatik && tamEkranDestekli()) {
    const ilk = (): void => {
      window.removeEventListener('pointerup', ilk);
      void tamEkranAc();
    };
    window.addEventListener('pointerup', ilk);
  }

  return { olcek: () => k, dokunmatik };
}
