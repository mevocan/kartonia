// Kodla üretilen sakin müzik: Sol majör pentatonik, ~66 BPM.
// Birkaç akor arasında dolaşan yumuşak bir pad + bas, üstünde adım adım yürüyen seyrek bir melodi.
// Melodi cümleleri arasında sessizlikler vardır; akor sırası ve ritim kalıpları rastgele seçilir, ton hep aynı kalır.
import type { Mevsim } from '../logic/season';
import { bitinceSok, mtof, rastgele, zarf } from './synth';

const BPM = 66;
const VURUS = 60 / BPM;
const OLCU = 4 * VURUS;
/** Akor başına ölçü sayısı. */
const AKOR_OLCU = 2;

/** Sol pentatonik basamakları (Sol3'ten yarım ses uzaklıkları). */
const PENTA = [0, 2, 4, 7, 9];
const KOK = 55; // Sol3
const MELODI_ALT = 5; // Sol4
const MELODI_UST = 12; // Si5

function basamakMidi(d: number): number {
  return KOK + 12 * Math.floor(d / 5) + PENTA[((d % 5) + 5) % 5];
}

interface Akor {
  pad: number[];
  bas: number;
  /** Akor tonlarının pentatonik sınıfları (0=Sol 1=La 2=Si 3=Re 4=Mi). */
  tonlar: number[];
  sonraki: number[];
}

const AKORLAR: Akor[] = [
  { pad: [55, 59, 62], bas: 43, tonlar: [0, 2, 3], sonraki: [1, 2, 3] }, // Sol
  { pad: [52, 55, 59], bas: 40, tonlar: [4, 0, 2], sonraki: [2, 0] }, // Mi minör
  { pad: [57, 62, 64], bas: 45, tonlar: [1, 3, 4], sonraki: [3, 0, 1] }, // La sus
  { pad: [50, 57, 64], bas: 38, tonlar: [3, 1, 4], sonraki: [0, 1] }, // Re sus
];

/** Ölçü içi ritim kalıpları: [başlangıç vuruşu, uzunluk]. */
const RITIMLER: [number, number][][] = [
  [[0, 2], [2, 2]],
  [[0, 1], [1, 1], [2, 2]],
  [[0, 1.5], [1.5, 0.5], [2, 2]],
  [[0, 3], [3, 1]],
  [[0, 4]],
  [[1, 1], [2, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 1], [3, 1]],
];

/** Mevsime göre melodi süzgeci: çok küçük bir renk farkı. */
const PARLAKLIK: Record<Mevsim, number> = { ilkbahar: 2400, yaz: 2800, sonbahar: 2000, kis: 1700 };

export class Muzik {
  private readonly ctx: BaseAudioContext;
  private readonly cikis: GainNode;
  private readonly yanki: GainNode;
  private sonrakiOlcu = -1;
  private olcuNo = 0;
  private akor = 0;
  private basamak = 8;
  /** Cümle içindeki ölçü (0–3); negatifse kalan sessiz ölçü sayısı. */
  private cumleOlcu = 0;
  private parlaklik = PARLAKLIK.ilkbahar;

  constructor(ctx: BaseAudioContext, hedef: AudioNode) {
    this.ctx = ctx;
    this.cikis = ctx.createGain();
    this.cikis.connect(hedef);
    // Hafif yankı: gecikme + geri besleme döngüsünde süzgeç (sürekli 4 düğüm).
    this.yanki = ctx.createGain();
    this.yanki.gain.value = 0.3;
    const gecikme = ctx.createDelay(2);
    gecikme.delayTime.value = VURUS * 0.75;
    const geri = ctx.createGain();
    geri.gain.value = 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    this.yanki.connect(gecikme);
    gecikme.connect(lp);
    lp.connect(geri);
    geri.connect(gecikme);
    lp.connect(this.cikis);
  }

  setMevsim(m: Mevsim): void {
    this.parlaklik = PARLAKLIK[m];
  }

  /** `simdi`den `kadar` anına kadar olan ölçüleri planlar. */
  zamanla(simdi: number, kadar: number): void {
    if (this.sonrakiOlcu < simdi) {
      // İlk başlangıç ya da uzun bir aradan sonra: kısa bir sessizlikle yeniden başla, yalnızca pad.
      this.sonrakiOlcu = simdi + 0.5;
      this.olcuNo = 0;
      this.cumleOlcu = -1;
    }
    while (this.sonrakiOlcu < kadar) {
      this.olcuCal(this.sonrakiOlcu);
      this.sonrakiOlcu += OLCU;
      this.olcuNo++;
    }
  }

  private olcuCal(t: number): void {
    if (this.olcuNo % AKOR_OLCU === 0) {
      if (this.olcuNo > 0) {
        const s = AKORLAR[this.akor].sonraki;
        this.akor = s[Math.floor(Math.random() * s.length)];
      }
      this.padCal(t, AKORLAR[this.akor]);
    }
    if (this.olcuNo % AKOR_OLCU === 1 && Math.random() < 0.5) {
      this.basCal(t, AKORLAR[this.akor].bas, 0.05);
    }

    if (this.cumleOlcu < 0) {
      this.cumleOlcu++;
      return;
    }
    const sonOlcu = this.cumleOlcu === 3;
    const ritim = sonOlcu ? (Math.random() < 0.5 ? [[0, 4]] : [[0, 2]]) : RITIMLER[Math.floor(Math.random() * RITIMLER.length)];
    for (const [bas, uzun] of ritim) {
      if (!sonOlcu && Math.random() < 0.15) continue; // ara sıra bir nota atlanır
      this.notaSec(bas % 2 === 0 || sonOlcu);
      this.notaCal(t + bas * VURUS, uzun * VURUS);
    }
    this.cumleOlcu++;
    if (this.cumleOlcu > 3) {
      // Cümle bitti: 1–2 ölçü (bazen daha uzun) sessizlik.
      const r = Math.random();
      this.cumleOlcu = r < 0.15 ? -4 : r < 0.6 ? -2 : -1;
    }
  }

  /** Bir sonraki melodi basamağı: küçük adımlar, güçlü vuruşta akor tonuna oturur. */
  private notaSec(guclu: boolean): void {
    const adimlar = [-2, -1, -1, 1, 1, 2, 0];
    let d = this.basamak + adimlar[Math.floor(Math.random() * adimlar.length)];
    if (d < MELODI_ALT) d = MELODI_ALT + (MELODI_ALT - d);
    if (d > MELODI_UST) d = MELODI_UST - (d - MELODI_UST);
    if (guclu) {
      const tonlar = AKORLAR[this.akor].tonlar;
      for (const k of [0, 1, -1, 2, -2]) {
        const a = d + k;
        if (a >= MELODI_ALT && a <= MELODI_UST && tonlar.includes(((a % 5) + 5) % 5)) {
          d = a;
          break;
        }
      }
    }
    this.basamak = d;
  }

  private notaCal(t: number, uzun: number): void {
    const ctx = this.ctx;
    const f = mtof(basamakMidi(this.basamak));
    const sure = Math.min(uzun + 0.8, 3);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 1.002;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.parlaklik;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    zarf(g.gain, t, rastgele(0.04, 0.08), rastgele(0.16, 0.22), sure);
    o1.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(g);
    g.connect(this.cikis);
    g.connect(this.yanki);
    o1.start(t);
    o2.start(t);
    o1.stop(t + sure + 0.05);
    o2.stop(t + sure + 0.05);
    bitinceSok(o1, [o1, o2, g2, lp, g]);
  }

  private padCal(t: number, a: Akor): void {
    const ctx = this.ctx;
    const sure = AKOR_OLCU * OLCU;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    lp.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 2);
    g.gain.setValueAtTime(0.07, t + sure - 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + sure + 1.5);
    lp.connect(g).connect(this.cikis);
    const dugumler: AudioNode[] = [lp, g];
    let son: OscillatorNode | null = null;
    for (const m of a.pad) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = mtof(m);
      o.detune.value = rastgele(-4, 4);
      o.connect(lp);
      o.start(t);
      o.stop(t + sure + 1.6);
      dugumler.push(o);
      son = o;
    }
    if (son) bitinceSok(son, dugumler);
    this.basCal(t, a.bas, 0.08);
  }

  private basCal(t: number, midi: number, tepe: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(midi);
    const g = ctx.createGain();
    zarf(g.gain, t, 0.25, tepe, 4);
    o.connect(g).connect(this.cikis);
    o.start(t);
    o.stop(t + 4.1);
    bitinceSok(o, [o, g]);
  }
}
