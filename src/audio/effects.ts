// Kısa efektler. Hepsi kodla üretilir; kağıt maket hissine uygun, kısa ve yumuşak.
import type { SesEfekti } from './api';
import { gurultu, gurultuTamponlari, mtof, rastgele, ton } from './synth';

/** `e` efektini `t` anında `cikis`a çalar. */
export function efektCal(ctx: BaseAudioContext, cikis: AudioNode, e: SesEfekti, t: number): void {
  switch (e) {
    case 'kurulum':
      return kurulum(ctx, cikis, t);
    case 'yol':
      return yol(ctx, cikis, t);
    case 'secim':
      return secim(ctx, cikis, t);
    case 'hata':
      return hata(ctx, cikis, t);
    case 'vergi':
      return vergi(ctx, cikis, t);
    case 'hedef':
      return hedef(ctx, cikis, t);
    case 'seviye':
      return seviye(ctx, cikis, t);
  }
}

/** Kağıt hışırtısı: yumuşak bir katlanma süpürmesi + birkaç kısa çıtırtı. */
function kurulum(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  const { beyaz, pembe } = gurultuTamponlari(ctx);
  gurultu(ctx, cikis, { tampon: pembe, t, atak: 0.04, sure: 0.32, tepe: 0.7, suzgec: 'bandpass', f: 900, f2: 2200, q: 0.7 });
  const n = 4 + Math.floor(Math.random() * 3);
  let u = t + 0.02;
  for (let i = 0; i < n; i++) {
    gurultu(ctx, cikis, {
      tampon: beyaz,
      t: u,
      atak: 0.003,
      sure: rastgele(0.025, 0.06),
      tepe: rastgele(0.45, 0.8),
      suzgec: 'bandpass',
      f: rastgele(1800, 4200),
      q: rastgele(0.8, 1.6),
      pan: rastgele(-0.3, 0.3),
    });
    u += rastgele(0.035, 0.08);
  }
}

/** Yol: kısa sürtünme, bandpass gürültü süpürmesi. */
function yol(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  const { pembe } = gurultuTamponlari(ctx);
  gurultu(ctx, cikis, { tampon: pembe, t, atak: 0.06, sure: 0.3, tepe: 1.0, suzgec: 'bandpass', f: rastgele(550, 700), f2: rastgele(1800, 2400), q: 1.4 });
}

/** Seçim: yumuşak kısa tık. */
function secim(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  ton(ctx, cikis, { tip: 'sine', f: 1250, f2: 880, t, atak: 0.003, sure: 0.07, tepe: 0.4 });
  ton(ctx, cikis, { tip: 'triangle', f: 2500, t, atak: 0.002, sure: 0.03, tepe: 0.08 });
}

/** Hata: alçak, yumuşak iki notalı "bonk". */
function hata(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  ton(ctx, cikis, { tip: 'triangle', f: 233, f2: 220, t, atak: 0.01, sure: 0.16, tepe: 0.17, lp: 700 });
  ton(ctx, cikis, { tip: 'triangle', f: 175, f2: 165, t: t + 0.13, atak: 0.01, sure: 0.22, tepe: 0.17, lp: 600 });
}

/** Vergi: 2–3 küçük bozuk para şıngırtısı (uyumsuz kısmi tonlu yüksek sinüsler, hızlı sönüm). */
function vergi(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  const n = 2 + Math.floor(Math.random() * 2);
  let u = t;
  for (let i = 0; i < n; i++) {
    const f = rastgele(2100, 2800);
    ton(ctx, cikis, { tip: 'sine', f, t: u, atak: 0.002, sure: 0.22, tepe: 0.12 });
    ton(ctx, cikis, { tip: 'sine', f: f * 2.76, t: u, atak: 0.002, sure: 0.12, tepe: 0.05 });
    ton(ctx, cikis, { tip: 'triangle', f: f * 1.51, t: u, atak: 0.002, sure: 0.08, tepe: 0.04 });
    u += rastgele(0.07, 0.11);
  }
}

/** Hedef: küçük yükselen pentatonik arpej (Sol majör pentatonik). */
function hedef(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  const notalar = [74, 76, 79, 83, 86]; // Re5 Mi5 Sol5 Si5 Re6
  notalar.forEach((m, i) => {
    const u = t + i * 0.085;
    const son = i === notalar.length - 1;
    ton(ctx, cikis, { tip: 'sine', f: mtof(m), t: u, atak: 0.008, sure: son ? 0.9 : 0.45, tepe: 0.16 });
    ton(ctx, cikis, { tip: 'triangle', f: mtof(m), t: u, atak: 0.008, sure: 0.2, tepe: 0.04, lp: 3000 });
  });
}

/** Seviye: kısa parlak "ding" (çan benzeri kısmi tonlar). */
function seviye(ctx: BaseAudioContext, cikis: AudioNode, t: number): void {
  const f = mtof(91); // Sol6
  ton(ctx, cikis, { tip: 'sine', f, t, atak: 0.004, sure: 1.1, tepe: 0.2 });
  ton(ctx, cikis, { tip: 'sine', f: f * 2.0, t, atak: 0.003, sure: 0.4, tepe: 0.06 });
  ton(ctx, cikis, { tip: 'sine', f: f * 2.93, t, atak: 0.002, sure: 0.18, tepe: 0.04 });
  ton(ctx, cikis, { tip: 'sine', f: f / 2, t, atak: 0.006, sure: 0.6, tepe: 0.06 });
}
