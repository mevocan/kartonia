// Ses motoru: verilen bir bağlam (AudioContext ya da test için OfflineAudioContext) üstünde kazanç ağacını kurar.
// ana → sınırlayıcı → hoparlör; ana ← efekt / ortam / müzik alt kazançları.
// Zamanlama yalnızca ctx.currentTime ile yapılır; `zamanla` dışarıdan kaba bir zamanlayıcıyla çağrılır.
import type { SesEfekti, SesKanali } from './api';
import type { Mevsim } from '../logic/season';
import { Ortam } from './ambience';
import { efektCal } from './effects';
import { Muzik } from './music';

export const SEVIYE = {
  ana: 0.8,
  efekt: 0.8,
  ortam: 0.45,
  muzik: 0.22,
  /** Duraklatılmışken ortam ve müzik çarpanı. */
  durak: 0.5,
  /** zoom01 = 1 iken ortamın kalan oranı. */
  uzakOrtam: 0.3,
};

/** Aynı efektin iki çalınışı arasındaki en kısa süre (sn). */
const EFEKT_ARALIK = 0.07;
/** Kaba zamanlayıcı ileriye bu kadar planlar (sn). */
export const ILERI = 1.6;

export class SesMotoru {
  readonly ctx: BaseAudioContext;
  private readonly ana: GainNode;
  private readonly efekt: GainNode;
  private readonly ortamKazanc: GainNode;
  private readonly muzikKazanc: GainNode;
  private readonly ortam: Ortam;
  private readonly muzik: Muzik;
  private readonly sonCalma = new Map<SesEfekti, number>();
  private acik: boolean;
  private durak = false;
  /** Oyuncunun ses düzeyleri (0..1): genel ana kazancı, müzik müzik kazancını çarpar. */
  private duzey = { genel: 1, muzik: 1 };
  private zoom = -1;
  private mevsim: Mevsim | null = null;

  constructor(ctx: BaseAudioContext, acik: boolean) {
    this.ctx = ctx;
    this.acik = acik;
    const sinir = ctx.createDynamicsCompressor();
    sinir.threshold.value = -8;
    sinir.knee.value = 6;
    sinir.ratio.value = 12;
    sinir.attack.value = 0.003;
    sinir.release.value = 0.2;
    sinir.connect(ctx.destination);
    this.ana = ctx.createGain();
    this.ana.gain.value = acik ? SEVIYE.ana : 0;
    this.ana.connect(sinir);
    this.efekt = this.altKazanc(SEVIYE.efekt);
    this.ortamKazanc = this.altKazanc(SEVIYE.ortam);
    this.muzikKazanc = this.altKazanc(SEVIYE.muzik);
    this.ortam = new Ortam(ctx, this.ortamKazanc);
    this.muzik = new Muzik(ctx, this.muzikKazanc);
  }

  private altKazanc(v: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.ana);
    return g;
  }

  play(e: SesEfekti): void {
    if (!this.acik) return;
    const t = this.ctx.currentTime;
    const son = this.sonCalma.get(e);
    if (son !== undefined && t - son < EFEKT_ARALIK) return;
    this.sonCalma.set(e, t);
    efektCal(this.ctx, this.efekt, e, t + 0.005);
  }

  isEnabled(): boolean {
    return this.acik;
  }

  /** Ana kazancın hedefi: kapalıysa 0, açıksa SEVIYE.ana × genel düzey. */
  private anaHedef(): number {
    return this.acik ? SEVIYE.ana * this.duzey.genel : 0;
  }

  /** Müzik kazancının hedefi: SEVIYE.muzik × müzik düzeyi × (duraklıysa SEVIYE.durak). */
  private muzikHedef(): number {
    return SEVIYE.muzik * this.duzey.muzik * (this.durak ? SEVIYE.durak : 1);
  }

  /** Oyuncunun ses düzeyi (0..1). Yumuşak geçişle uygulanır. */
  setVolume(kanal: SesKanali, v: number): void {
    const d = Math.min(1, Math.max(0, v));
    if (d === this.duzey[kanal]) return;
    this.duzey[kanal] = d;
    const t = this.ctx.currentTime;
    if (kanal === 'genel') this.ana.gain.setTargetAtTime(this.anaHedef(), t, 0.08);
    else this.muzikKazanc.gain.setTargetAtTime(this.muzikHedef(), t, 0.08);
  }

  getVolume(kanal: SesKanali): number {
    return this.duzey[kanal];
  }

  setEnabled(on: boolean): void {
    if (on === this.acik) return;
    this.acik = on;
    const t = this.ctx.currentTime;
    const g = this.ana.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.anaHedef(), t + 0.3);
  }

  setAmbience(m: Mevsim, zoom01: number, anlik = false): void {
    const t = this.ctx.currentTime;
    if (m !== this.mevsim) {
      this.mevsim = m;
      this.ortam.setMevsim(m, t, anlik);
      this.muzik.setMevsim(m);
    }
    const z = Math.min(1, Math.max(0, zoom01));
    if (Math.abs(z - this.zoom) > 0.01) {
      this.zoom = z;
      this.ortamGuncelle();
    }
  }

  setPaused(p: boolean): void {
    if (p === this.durak) return;
    this.durak = p;
    this.ortamGuncelle();
    this.muzikKazanc.gain.setTargetAtTime(this.muzikHedef(), this.ctx.currentTime, 0.3);
  }

  private ortamGuncelle(): void {
    const z = Math.max(0, this.zoom);
    const v = SEVIYE.ortam * (1 - (1 - SEVIYE.uzakOrtam) * z) * (this.durak ? SEVIYE.durak : 1);
    this.ortamKazanc.gain.setTargetAtTime(v, this.ctx.currentTime, 0.25);
  }

  /** Müzik ve ortam olaylarını `kadar` anına kadar planlar. Ses kapalıyken yeni olay planlanmaz. */
  zamanla(kadar = this.ctx.currentTime + ILERI): void {
    if (!this.acik) return;
    const simdi = this.ctx.currentTime;
    this.muzik.zamanla(simdi, kadar);
    this.ortam.zamanla(simdi, kadar);
  }
}
