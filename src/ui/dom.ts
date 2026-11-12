// Küçük DOM yardımcıları.

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

export function tr(n: number): string {
  return Math.round(n).toLocaleString('tr-TR');
}
