// Küçük ses yapı taşları: gürültü tamponları, kısa ton ve gürültü vuruşları, zarflar.
// Her kısa ses kendi düğümlerini kurar ve kaynak bitince (onended) hepsini bağlantıdan çıkarır.

const SESSIZ = 0.0001;

export interface GurultuTamponlari {
  beyaz: AudioBuffer;
  pembe: AudioBuffer;
}

const tamponlar = new WeakMap<BaseAudioContext, GurultuTamponlari>();

/** Bağlam başına bir kez üretilen 2 sn'lik beyaz ve pembe gürültü (döngüye uygun). */
export function gurultuTamponlari(ctx: BaseAudioContext): GurultuTamponlari {
  const var_ = tamponlar.get(ctx);
  if (var_) return var_;
  const n = Math.floor(ctx.sampleRate * 2);
  const beyaz = ctx.createBuffer(1, n, ctx.sampleRate);
  const pembe = ctx.createBuffer(1, n, ctx.sampleRate);
  const b = beyaz.getChannelData(0);
  const p = pembe.getChannelData(0);
  // Pembe gürültü: Paul Kellet'in süzgeç yaklaşımı.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b[i] = w * 0.8;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const t = { beyaz, pembe };
  tamponlar.set(ctx, t);
  return t;
}

/** Kaynak bitince verilen düğümleri bağlantıdan çıkarır. */
export function bitinceSok(kaynak: AudioScheduledSourceNode, dugumler: AudioNode[]): void {
  kaynak.onended = () => {
    for (const d of dugumler) {
      try {
        d.disconnect();
      } catch {
        /* zaten çıkmış */
      }
    }
  };
}

/** Atak + üstel sönüm zarfı. */
export function zarf(g: AudioParam, t: number, atak: number, tepe: number, sure: number): void {
  g.setValueAtTime(SESSIZ, t);
  g.linearRampToValueAtTime(tepe, t + atak);
  g.exponentialRampToValueAtTime(SESSIZ, t + Math.max(atak + 0.01, sure));
}

export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function rastgele(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export interface TonAyari {
  tip: OscillatorType;
  f: number;
  /** Verilirse frekans süre boyunca buna üstel kayar. */
  f2?: number;
  t: number;
  atak: number;
  sure: number;
  tepe: number;
  /** Alçak geçiren süzgeç kesimi (Hz). */
  lp?: number;
}

/** Tek osilatörlü kısa ton. */
export function ton(ctx: BaseAudioContext, cikis: AudioNode, a: TonAyari): void {
  const o = ctx.createOscillator();
  o.type = a.tip;
  o.frequency.setValueAtTime(a.f, a.t);
  if (a.f2 !== undefined) o.frequency.exponentialRampToValueAtTime(a.f2, a.t + a.sure);
  const g = ctx.createGain();
  zarf(g.gain, a.t, a.atak, a.tepe, a.sure);
  const dugumler: AudioNode[] = [o, g];
  if (a.lp !== undefined) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = a.lp;
    f.Q.value = 0.5;
    o.connect(f).connect(g);
    dugumler.push(f);
  } else {
    o.connect(g);
  }
  g.connect(cikis);
  o.start(a.t);
  o.stop(a.t + a.sure + 0.05);
  bitinceSok(o, dugumler);
}

export interface GurultuAyari {
  tampon: AudioBuffer;
  t: number;
  atak: number;
  sure: number;
  tepe: number;
  suzgec: BiquadFilterType;
  f: number;
  /** Verilirse süzgeç frekansı süre boyunca buna kayar. */
  f2?: number;
  q: number;
  pan?: number;
}

/** Süzgeçten geçen kısa gürültü vuruşu. */
export function gurultu(ctx: BaseAudioContext, cikis: AudioNode, a: GurultuAyari): void {
  const s = ctx.createBufferSource();
  s.buffer = a.tampon;
  const f = ctx.createBiquadFilter();
  f.type = a.suzgec;
  f.frequency.setValueAtTime(a.f, a.t);
  if (a.f2 !== undefined) f.frequency.exponentialRampToValueAtTime(a.f2, a.t + a.sure);
  f.Q.value = a.q;
  const g = ctx.createGain();
  zarf(g.gain, a.t, a.atak, a.tepe, a.sure);
  const dugumler: AudioNode[] = [s, f, g];
  s.connect(f).connect(g);
  if (a.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = a.pan;
    g.connect(p).connect(cikis);
    dugumler.push(p);
  } else {
    g.connect(cikis);
  }
  const ofset = Math.random() * Math.max(0, a.tampon.duration - a.sure - 0.1);
  s.start(a.t, ofset, a.sure + 0.05);
  bitinceSok(s, dugumler);
}
