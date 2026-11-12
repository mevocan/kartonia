import * as THREE from 'three';
import { KONFETI, PALETTE } from './palette';
import { paperMaterial, canvasTexture } from './paper';

// Elle yazılmış easing, tween yöneticisi, kağıt konfeti ve uçan kağıt etiketler.

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  /** 0→1→0 tek tümsek. */
  bump: (t: number) => Math.sin(Math.PI * t),
};

interface Tween {
  owner: unknown;
  t: number;
  delay: number;
  dur: number;
  ease: (t: number) => number;
  update: (k: number) => void;
  done?: () => void;
}

export class Tweens {
  private list: Tween[] = [];

  add(owner: unknown, dur: number, easeFn: (t: number) => number, update: (k: number) => void, done?: () => void, delay = 0): void {
    this.list.push({ owner, t: 0, delay, dur, ease: easeFn, update, done });
    if (delay <= 0) update(easeFn(0));
  }

  /** Sahibinin bütün tween'lerini durdurur (done çağrılmaz). */
  kill(owner: unknown): void {
    this.list = this.list.filter((tw) => tw.owner !== owner);
  }

  update(dt: number): void {
    if (!this.list.length) return;
    const finished: Tween[] = [];
    for (const tw of this.list) {
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
      }
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(tw.ease(k));
      if (k >= 1) finished.push(tw);
    }
    if (finished.length) {
      this.list = this.list.filter((tw) => !finished.includes(tw));
      for (const tw of finished) tw.done?.();
    }
  }

  get active(): boolean {
    return this.list.length > 0;
  }

  clear(): void {
    this.list = [];
  }
}

// ---------- Konfeti ----------

interface Bit {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  floorY: number;
}

const MAX_BITS = 500;

export class Confetti {
  private bits: Bit[] = [];
  private pool: THREE.Mesh[] = [];
  private geo = new THREE.PlaneGeometry(0.14, 0.09);
  private seed = 1;

  private parent: THREE.Object3D;
  private floor: (x: number, z: number) => number;

  constructor(parent: THREE.Object3D, floor: (x: number, z: number) => number = () => 0) {
    this.parent = parent;
    this.floor = floor;
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  burst(x: number, y: number, z: number, count: number, colors: readonly string[] = KONFETI, power = 1): void {
    for (let i = 0; i < count && this.bits.length < MAX_BITS; i++) {
      const col = colors[Math.floor(this.rnd() * colors.length)];
      const mesh = this.pool.pop() ?? new THREE.Mesh(this.geo);
      mesh.material = paperMaterial(col, true);
      mesh.castShadow = false;
      mesh.raycast = () => {};
      const a = this.rnd() * Math.PI * 2;
      const sp = (1.2 + this.rnd() * 2) * power;
      mesh.position.set(x + Math.cos(a) * 0.3, y + this.rnd() * 0.4, z + Math.sin(a) * 0.3);
      mesh.rotation.set(this.rnd() * 6, this.rnd() * 6, this.rnd() * 6);
      const size = 0.6 + this.rnd() * 0.7;
      mesh.scale.setScalar(size);
      this.parent.add(mesh);
      const max = 1.1 + this.rnd() * 0.8;
      this.bits.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * sp, (3 + this.rnd() * 2.5) * power, Math.sin(a) * sp),
        spin: new THREE.Vector3((this.rnd() - 0.5) * 12, (this.rnd() - 0.5) * 12, (this.rnd() - 0.5) * 12),
        life: max,
        max,
        size,
        floorY: this.floor(mesh.position.x, mesh.position.z) + 0.02,
      });
    }
  }

  update(dt: number): void {
    if (!this.bits.length) return;
    const keep: Bit[] = [];
    for (const b of this.bits) {
      b.life -= dt;
      if (b.life <= 0) {
        this.parent.remove(b.mesh);
        this.pool.push(b.mesh);
        continue;
      }
      // Kağıt: yerçekimi + güçlü hava sürtünmesi, salınarak düşer.
      b.vel.y -= 7 * dt;
      const drag = Math.exp(-2.6 * dt);
      b.vel.multiplyScalar(drag);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.position.x += Math.sin(b.life * 7 + b.size * 10) * 0.25 * dt;
      if (b.mesh.position.y < b.floorY) {
        b.mesh.position.y = b.floorY;
        b.vel.set(0, 0, 0);
        b.spin.multiplyScalar(0.8);
      }
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      const k = b.life / b.max;
      b.mesh.scale.setScalar(b.size * Math.min(1, k * 4));
      keep.push(b);
    }
    this.bits = keep;
  }

  get active(): boolean {
    return this.bits.length > 0;
  }

  clear(): void {
    for (const b of this.bits) this.parent.remove(b.mesh);
    this.bits = [];
  }

  dispose(): void {
    this.clear();
    this.geo.dispose();
  }
}

// ---------- Uçan kağıt etiketler ----------

interface Label {
  sprite: THREE.Sprite;
  key: string;
  t: number;
  dur: number;
  y0: number;
  tilt: number;
  aspect: number;
}

interface LabelTex {
  tex: THREE.CanvasTexture;
  aspect: number;
  uses: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class FloatLabels {
  private labels: Label[] = [];
  private texCache = new Map<string, LabelTex>();

  private parent: THREE.Object3D;

  constructor(parent: THREE.Object3D) {
    this.parent = parent;
  }

  private texture(text: string, color: string): LabelTex {
    const key = text + '|' + color;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    if (this.texCache.size > 120) {
      for (const [k, v] of this.texCache) {
        if (v.uses === 0) {
          v.tex.dispose();
          this.texCache.delete(k);
        }
      }
    }
    const font = 'bold 44px "Trebuchet MS", "Segoe UI", sans-serif';
    const measure = document.createElement('canvas').getContext('2d');
    let tw = 60;
    if (measure) {
      measure.font = font;
      tw = measure.measureText(text).width;
    }
    const w = Math.ceil(tw + 48);
    const h = 72;
    const tex = canvasTexture(w, h, (ctx) => {
      // Hafif gölge + kağıt etiket + kesik kenar hissi için ince çerçeve
      ctx.fillStyle = 'rgba(60,40,20,0.18)';
      roundRect(ctx, 5, 8, w - 8, h - 12, 12);
      ctx.fill();
      ctx.fillStyle = PALETTE.etiketKagit;
      roundRect(ctx, 2, 3, w - 8, h - 12, 12);
      ctx.fill();
      ctx.strokeStyle = PALETTE.etiketKenar;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, (w - 6) / 2, (h - 9) / 2 + 2);
    });
    const v = { tex, aspect: w / h, uses: 0 };
    this.texCache.set(key, v);
    return v;
  }

  add(x: number, y: number, z: number, text: string, color: string): void {
    const lt = this.texture(text, color);
    lt.uses++;
    const mat = new THREE.SpriteMaterial({ map: lt.tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const hgt = 0.62;
    sprite.scale.set(hgt * lt.aspect, hgt, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 20;
    sprite.raycast = () => {};
    this.parent.add(sprite);
    this.labels.push({ sprite, key: text + '|' + color, t: 0, dur: 1.9, y0: y, tilt: (Math.random() - 0.5) * 0.25, aspect: lt.aspect });
  }

  update(dt: number): void {
    if (!this.labels.length) return;
    const keep: Label[] = [];
    for (const l of this.labels) {
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      l.sprite.position.y = l.y0 + ease.outCubic(k) * 1.9;
      const mat = l.sprite.material;
      mat.rotation = l.tilt * Math.sin(l.t * 3);
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      const base = 0.62 * Math.max(0.01, pop);
      l.sprite.scale.set(l.aspect * base, base, 1);
      mat.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      if (k >= 1) {
        this.parent.remove(l.sprite);
        mat.dispose();
        const lt = this.texCache.get(l.key);
        if (lt) lt.uses--;
        continue;
      }
      keep.push(l);
    }
    this.labels = keep;
  }

  get active(): boolean {
    return this.labels.length > 0;
  }

  dispose(): void {
    for (const l of this.labels) {
      this.parent.remove(l.sprite);
      l.sprite.material.dispose();
    }
    this.labels = [];
    for (const v of this.texCache.values()) v.tex.dispose();
    this.texCache.clear();
  }
}
