// Ortam sesi: kuş cıvıltıları (frekans modülasyonlu kısa sinüsler, rastgele aralıklarla) ve rüzgâr
// (döngüdeki pembe gürültü, rastgele "esinti" hedeflerine yavaşça kayan alçak geçiren süzgeç).
// Mevsim değişince kuş ve rüzgâr kazançları birkaç saniyede yeni değerlerine kayar.
import type { Mevsim } from '../logic/season';
import { bitinceSok, gurultuTamponlari, rastgele, zarf } from './synth';

interface OrtamAyari {
  /** Kuş çağrıları arası ortalama süre (sn); 0 = kuş yok. */
  kusAralik: number;
  kus: number;
  ruzgar: number;
  /** Esinti süzgeç aralığı (Hz). */
  ruzgarAlt: number;
  ruzgarUst: number;
}

const AYAR: Record<Mevsim, OrtamAyari> = {
  ilkbahar: { kusAralik: 2.2, kus: 1, ruzgar: 0, ruzgarAlt: 300, ruzgarUst: 700 },
  yaz: { kusAralik: 3, kus: 0.9, ruzgar: 0.08, ruzgarAlt: 300, ruzgarUst: 650 },
  sonbahar: { kusAralik: 8, kus: 0.7, ruzgar: 0.25, ruzgarAlt: 280, ruzgarUst: 800 },
  kis: { kusAralik: 0, kus: 0, ruzgar: 0.45, ruzgarAlt: 180, ruzgarUst: 650 },
};

/** Mevsim geçişinin zaman sabiti (sn): ~3 sn'de büyük ölçüde tamamlanır. */
const GECIS = 1;

export class Ortam {
  private readonly ctx: BaseAudioContext;
  private readonly kusBus: GainNode;
  private readonly ruzgarBus: GainNode;
  private ruzgarSuzgec: BiquadFilterNode | null = null;
  private esinti: GainNode | null = null;
  private ayar: OrtamAyari = AYAR.ilkbahar;
  private mevsim: Mevsim | null = null;
  private sonrakiKus = 0;
  private sonrakiEsinti = 0;

  constructor(ctx: BaseAudioContext, hedef: AudioNode) {
    this.ctx = ctx;
    this.kusBus = ctx.createGain();
    this.kusBus.gain.value = 0;
    this.kusBus.connect(hedef);
    this.ruzgarBus = ctx.createGain();
    this.ruzgarBus.gain.value = 0;
    this.ruzgarBus.connect(hedef);
  }

  setMevsim(m: Mevsim, simdi: number, anlik = false): void {
    if (m === this.mevsim) return;
    this.mevsim = m;
    this.ayar = AYAR[m];
    if (this.ayar.ruzgar > 0) this.ruzgarKur();
    for (const [p, v] of [
      [this.kusBus.gain, this.ayar.kus * 0.5],
      [this.ruzgarBus.gain, this.ayar.ruzgar * 0.5],
    ] as [AudioParam, number][]) {
      p.cancelScheduledValues(simdi);
      if (anlik) p.setValueAtTime(v, simdi);
      else p.setTargetAtTime(v, simdi, GECIS);
    }
    this.sonrakiEsinti = simdi;
  }

  /** Rüzgâr zinciri ilk gerektiğinde kurulur, sonra sürekli çalışır (4 düğüm). */
  private ruzgarKur(): void {
    if (this.ruzgarSuzgec) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = gurultuTamponlari(ctx).pembe;
    s.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    s.connect(hp).connect(lp).connect(g).connect(this.ruzgarBus);
    s.start();
    this.ruzgarSuzgec = lp;
    this.esinti = g;
  }

  /** `kadar` anına kadar kuş çağrılarını ve esinti değişimlerini planlar. */
  zamanla(simdi: number, kadar: number): void {
    const a = this.ayar;
    if (a.kusAralik > 0) {
      if (this.sonrakiKus < simdi) this.sonrakiKus = simdi + rastgele(0.3, a.kusAralik);
      while (this.sonrakiKus < kadar) {
        this.kusCagrisi(this.sonrakiKus);
        // Üstel dağılımlı aralık: düzenli değil, ara sıra uzun boşluklar.
        this.sonrakiKus += Math.min(a.kusAralik * 4, 0.4 - Math.log(1 - Math.random()) * a.kusAralik);
      }
    }
    if (this.ruzgarSuzgec && this.esinti && this.sonrakiEsinti <= kadar) {
      const t = Math.max(simdi, this.sonrakiEsinti);
      this.ruzgarSuzgec.frequency.setTargetAtTime(rastgele(a.ruzgarAlt, a.ruzgarUst), t, rastgele(1, 2.5));
      this.esinti.gain.setTargetAtTime(rastgele(0.45, 1), t, rastgele(1, 2.5));
      this.sonrakiEsinti = t + rastgele(2, 5);
    }
  }

  /** Bir kuş çağrısı: 1–4 hece, her hece FM'li kısa bir sinüs süpürmesi. */
  private kusCagrisi(t: number): void {
    const ctx = this.ctx;
    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const cikis: AudioNode = pan ?? this.kusBus;
    if (pan) {
      pan.pan.value = rastgele(-0.8, 0.8);
      pan.connect(this.kusBus);
    }
    const temel = rastgele(2400, 4300);
    const yukari = Math.random() < 0.5;
    const n = 1 + Math.floor(Math.random() * 4);
    const tepe = rastgele(0.14, 0.26);
    let u = t;
    for (let i = 0; i < n; i++) {
      const sure = rastgele(0.05, 0.11);
      const f0 = temel * rastgele(0.92, 1.08);
      const f1 = f0 * (yukari ? rastgele(1.2, 1.45) : rastgele(0.65, 0.8));
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, u);
      o.frequency.exponentialRampToValueAtTime(f1, u + sure);
      const mod = ctx.createOscillator();
      mod.frequency.value = rastgele(25, 45);
      const modG = ctx.createGain();
      modG.gain.value = rastgele(80, 260);
      mod.connect(modG).connect(o.frequency);
      const g = ctx.createGain();
      zarf(g.gain, u, 0.008, tepe, sure);
      o.connect(g).connect(cikis);
      o.start(u);
      mod.start(u);
      o.stop(u + sure + 0.03);
      mod.stop(u + sure + 0.03);
      const dugumler: AudioNode[] = [o, mod, modG, g];
      if (pan && i === n - 1) dugumler.push(pan);
      bitinceSok(o, dugumler);
      u += sure + rastgele(0.04, 0.12);
    }
  }
}
