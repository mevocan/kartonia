// GameAudio uygulaması. AudioContext ilk unlock'ta oluşturulur; ondan önce gelen çağrılar yalnızca durumu saklar.
// Tarayıcıda Web Audio yoksa ya da bir şey ters giderse hiçbir metot hata fırlatmaz.
import type { GameAudio, SesEfekti, SesKanali } from './api';
import type { Mevsim } from '../logic/season';
import { SesMotoru } from './engine';

/** Müzik ve ortam için kaba zamanlayıcı aralığı (ms); asıl zamanlama ctx.currentTime ile. */
const TIK_MS = 250;

type AudioCtor = typeof AudioContext;

function audioContextSinifi(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createAudio(): GameAudio {
  let ctx: AudioContext | null = null;
  let motor: SesMotoru | null = null;
  let zamanlayici: ReturnType<typeof setInterval> | null = null;
  let acik = true;
  let durak = false;
  let mevsim: Mevsim = 'ilkbahar';
  let zoom = 0.5;
  const duzey: Record<SesKanali, number> = { genel: 1, muzik: 1 };
  let kapandi = false;

  const guvenli = (f: () => void): void => {
    try {
      f();
    } catch {
      /* ses hatası oyunu durdurmaz */
    }
  };

  return {
    unlock() {
      guvenli(() => {
        if (kapandi) return;
        if (!ctx) {
          const C = audioContextSinifi();
          if (!C) return;
          ctx = new C();
          motor = new SesMotoru(ctx, acik);
          motor.setAmbience(mevsim, zoom, true);
          motor.setPaused(durak);
          motor.setVolume('genel', duzey.genel);
          motor.setVolume('muzik', duzey.muzik);
          const m = motor;
          zamanlayici = setInterval(() => guvenli(() => m.zamanla()), TIK_MS);
        }
        if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
      });
    },
    play(e: SesEfekti) {
      if (motor && ctx && ctx.state === 'running') guvenli(() => motor!.play(e));
    },
    setEnabled(on: boolean) {
      acik = on;
      if (motor) guvenli(() => motor!.setEnabled(on));
    },
    setVolume(kanal: SesKanali, v: number) {
      duzey[kanal] = Math.min(1, Math.max(0, v));
      if (motor) guvenli(() => motor!.setVolume(kanal, duzey[kanal]));
    },
    getVolume(kanal: SesKanali) {
      return duzey[kanal];
    },
    isEnabled() {
      return acik;
    },
    setAmbience(m: Mevsim, zoom01: number) {
      mevsim = m;
      zoom = zoom01;
      if (motor) guvenli(() => motor!.setAmbience(m, zoom01));
    },
    setPaused(p: boolean) {
      durak = p;
      if (motor) guvenli(() => motor!.setPaused(p));
    },
    dispose() {
      kapandi = true;
      if (zamanlayici !== null) clearInterval(zamanlayici);
      zamanlayici = null;
      const c = ctx;
      ctx = null;
      motor = null;
      if (c) guvenli(() => void c.close().catch(() => undefined));
    },
  };
}
