// Küçük DOM yardımcıları.
import { sayi } from './i18n';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Elemana kısa bir vurgu animasyonu uygular (sınıfı kaldırıp yeniden ekler). */
export function flash(e: HTMLElement, extra?: string): void {
  e.classList.remove('vurgu', 'vurgu-arti', 'vurgu-eksi');
  void e.offsetWidth; // animasyonu yeniden başlat
  e.classList.add('vurgu');
  if (extra) e.classList.add(extra);
  window.setTimeout(() => e.classList.remove('vurgu', 'vurgu-arti', 'vurgu-eksi'), 700);
}

/** Kapanış süresi (ms); stil.css'teki .kapaniyor geçişiyle aynı. */
const KAPANIS = 140;

/** Paneli kısa bir solmayla gizler. Bu sırada `panelAc` çağrılırsa kapanış iptal olur. */
export function panelKapat(e: HTMLElement): void {
  if (e.style.display === 'none') return;
  e.classList.add('kapaniyor');
  window.setTimeout(() => {
    if (e.classList.contains('kapaniyor')) {
      e.style.display = 'none';
      e.classList.remove('kapaniyor');
    }
  }, KAPANIS);
}

/** Paneli gösterir (süren bir kapanışı iptal eder). */
export function panelAc(e: HTMLElement): void {
  e.classList.remove('kapaniyor');
  e.style.display = 'block';
}

export function tr(n: number): string {
  return sayi(n);
}
