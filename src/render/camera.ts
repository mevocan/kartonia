import * as THREE from 'three';

// Elle yazılmış yörünge kamerası.
// Sol sürükle (5 px eşikten sonra): kaydır. Sağ sürükle: döndür. Orta / Shift+sağ: kaydır.
// WASD / ok tuşları: kaydır. Tekerlek: yakınlaş. Hedef oynanabilir alanda kalır.
// Açı ve mesafe sınırları ufkun hiç görünmemesini sağlar (üst ışın her zaman yere bakar);
// uzak kenarı renderer'daki dinamik sis örter.

const DEG = Math.PI / 180;
const MIN_EL = 35 * DEG;
const MAX_EL = 70 * DEG;
const MIN_DIST = 12;
const MAX_DIST = 56;
const DRAG_ESIK = 5;

export interface CamBounds {
  /** Hedefin kalacağı alan (oynanabilir alan yarı genişliği). */
  target: number;
  /** Ekran görüntüsünün yerdeki izi bu yarı genişliği aşmasın (çizilen arazi − pay). */
  view: number;
}

export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3(0, 0, 8);
  private az = 0;
  private el = 50 * DEG;
  private dist = 32;
  private tTarget = this.target.clone();
  private tAz = this.az;
  private tEl = this.el;
  private tDist = this.dist;

  private drag: 'rotate' | 'pan' | 'left' | null = null;
  private pointerId = -1;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private leftPanning = false;
  private leftPanEnabled = true;
  private keys = new Set<string>();
  private moving = true;

  private el_: HTMLElement;
  private limit: number;
  private viewLimit: number;

  constructor(el: HTMLElement, bounds: CamBounds) {
    this.el_ = el;
    this.limit = bounds.target;
    this.viewLimit = bounds.view;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.apply();
  }

  setLeftDragPan(on: boolean): void {
    this.leftPanEnabled = on;
    if (!on && this.drag === 'left') {
      this.drag = null;
      this.leftPanning = false;
    }
  }

  isPanning(): boolean {
    return this.leftPanning;
  }

  /** Yakınlaşma 0 (en yakın) .. 1 (en uzak). Ses katmanı ortam sesini buna göre kısar. */
  getZoom01(): number {
    return Math.min(1, Math.max(0, (this.dist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
  }

  getDistance(): number {
    return this.dist;
  }

  getTarget(): THREE.Vector3 {
    return this.target;
  }

  private onContext = (e: Event) => e.preventDefault();

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = keyName(e);
    if (!k) return;
    this.keys.add(k);
    this.moving = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = keyName(e);
    if (k) this.keys.delete(k);
  };

  private onBlur = () => this.keys.clear();

  private onDown = (e: PointerEvent) => {
    if (this.drag) return;
    if (e.button === 2) this.drag = e.shiftKey ? 'pan' : 'rotate';
    else if (e.button === 1) this.drag = 'pan';
    else if (e.button === 0 && this.leftPanEnabled) this.drag = 'left';
    else return;
    if (e.button !== 0) e.preventDefault();
    this.pointerId = e.pointerId;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.leftPanning = false;
    if (e.button !== 0) this.capture(e.pointerId);
  };

  private capture(id: number): void {
    try {
      this.el_.setPointerCapture(id);
    } catch {
      /* yok say */
    }
  }

  private onMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.pointerId) return;
    if (this.drag === 'left' && !this.leftPanning) {
      if (Math.hypot(e.clientX - this.startX, e.clientY - this.startY) < DRAG_ESIK) return;
      this.leftPanning = true;
      this.capture(e.pointerId);
    }
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (this.drag === 'rotate') {
      this.tAz -= dx * 0.006;
      this.tEl = THREE.MathUtils.clamp(this.tEl + dy * 0.005, this.minEl(this.tDist), MAX_EL);
    } else {
      const h = this.el_.clientHeight || 1;
      const k = (2 * this.tDist * Math.tan((this.camera.fov * DEG) / 2)) / h;
      const fy = k / Math.max(0.35, Math.sin(this.tEl));
      this.panBy(-dx * k, dy * fy);
    }
    this.moving = true;
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.drag = null;
    this.pointerId = -1;
    // Arayüzün pointerup/click dinleyicileri de isPanning()'i true görsün: bayrağı olaydan sonra indir.
    if (this.leftPanning) setTimeout(() => (this.leftPanning = false), 0);
    try {
      this.el_.releasePointerCapture(e.pointerId);
    } catch {
      /* yok say */
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    this.tDist = THREE.MathUtils.clamp(this.tDist * Math.exp(d * 0.0012), MIN_DIST, MAX_DIST);
    this.tEl = Math.max(this.tEl, this.minEl(this.tDist));
    this.moving = true;
  };

  /** Uzaklaştıkça en düşük yükseklik açısı artar (uzak kenar görünmesin). */
  private minEl(dist: number): number {
    const k = (dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
    return MIN_EL + Math.max(0, k) * 12 * DEG;
  }

  /** right: ekran sağına, fwd: ekran yukarısına (yerde). */
  private panBy(right: number, fwd: number): void {
    const rx = Math.cos(this.tAz);
    const rz = -Math.sin(this.tAz);
    const fx = -Math.sin(this.tAz);
    const fz = -Math.cos(this.tAz);
    this.tTarget.x += rx * right + fx * fwd;
    this.tTarget.z += rz * right + fz * fwd;
    this.tTarget.x = THREE.MathUtils.clamp(this.tTarget.x, -this.limit, this.limit);
    this.tTarget.z = THREE.MathUtils.clamp(this.tTarget.z, -this.limit, this.limit);
    this.moving = true;
  }

  /** Ekran köşelerinin y=0 düzlemindeki izi (hedefe göre). */
  private footprint(az: number, el: number, dist: number): { x0: number; x1: number; z0: number; z1: number } {
    const c = Math.cos(el);
    const px = dist * c * Math.sin(az);
    const py = dist * Math.sin(el);
    const pz = dist * c * Math.cos(az);
    const fl = Math.hypot(px, py, pz);
    const fx = -px / fl, fy = -py / fl, fz = -pz / fl;
    // right = f × up
    let rx = -fz, rz = fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    // u = r × f
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    const tv = Math.tan((this.camera.fov * DEG) / 2);
    const th = tv * this.camera.aspect;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const dx = fx + rx * sx * th + ux * sy * tv;
        const dy = fy + uy * sy * tv;
        const dz = fz + rz * sx * th + uz * sy * tv;
        const t = dy < -1e-3 ? -py / dy : 1e4;
        const gx = px + dx * t;
        const gz = pz + dz * t;
        x0 = Math.min(x0, gx); x1 = Math.max(x1, gx);
        z0 = Math.min(z0, gz); z1 = Math.max(z1, gz);
      }
    }
    return { x0, x1, z0, z1 };
  }

  /** Görüntü izi çizilen arazinin içinde kalsın: gerekirse uzaklığı kısalt, hedefi içeri it. */
  private constrain(): void {
    const B = this.viewLimit;
    let fp = this.footprint(this.tAz, this.tEl, this.tDist);
    for (let i = 0; i < 30 && (fp.x1 - fp.x0 > 2 * B || fp.z1 - fp.z0 > 2 * B) && this.tDist > MIN_DIST; i++) {
      this.tDist = Math.max(MIN_DIST, this.tDist * 0.96);
      fp = this.footprint(this.tAz, this.tEl, this.tDist);
    }
    const clampAxis = (v: number, lo0: number, hi0: number) => {
      const lo = Math.max(-this.limit, -B - lo0);
      const hi = Math.min(this.limit, B - hi0);
      return lo > hi ? (lo + hi) / 2 : THREE.MathUtils.clamp(v, lo, hi);
    };
    this.tTarget.x = clampAxis(this.tTarget.x, fp.x0, fp.x1);
    this.tTarget.z = clampAxis(this.tTarget.z, fp.z0, fp.z1);
  }

  setAspect(a: number): void {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
    this.moving = true;
  }

  private apply(): void {
    const c = Math.cos(this.el);
    this.camera.position.set(
      this.target.x + this.dist * c * Math.sin(this.az),
      this.target.y + this.dist * Math.sin(this.el),
      this.target.z + this.dist * c * Math.cos(this.az),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /** Sönümleme ve klavye kaydırması; kamera hareket ettiyse true. */
  update(dt: number): boolean {
    if (this.keys.size) {
      const sp = this.tDist * 0.9 * dt;
      let r = 0;
      let f = 0;
      if (this.keys.has('L')) r -= 1;
      if (this.keys.has('R')) r += 1;
      if (this.keys.has('U')) f += 1;
      if (this.keys.has('D')) f -= 1;
      if (r || f) this.panBy(r * sp, f * sp);
    }
    if (!this.moving) return false;
    this.constrain();
    const k = 1 - Math.exp(-dt * 10);
    this.az += (this.tAz - this.az) * k;
    this.el += (this.tEl - this.el) * k;
    this.dist += (this.tDist - this.dist) * k;
    this.target.lerp(this.tTarget, k);
    const done =
      !this.keys.size &&
      Math.abs(this.tAz - this.az) < 1e-4 &&
      Math.abs(this.tEl - this.el) < 1e-4 &&
      Math.abs(this.tDist - this.dist) < 1e-3 &&
      this.target.distanceToSquared(this.tTarget) < 1e-6;
    if (done) {
      this.az = this.tAz;
      this.el = this.tEl;
      this.dist = this.tDist;
      this.target.copy(this.tTarget);
      this.moving = false;
    }
    this.apply();
    return true;
  }

  dispose(): void {
    const e = this.el_;
    e.removeEventListener('pointerdown', this.onDown);
    e.removeEventListener('pointermove', this.onMove);
    e.removeEventListener('pointerup', this.onUp);
    e.removeEventListener('pointercancel', this.onUp);
    e.removeEventListener('wheel', this.onWheel);
    e.removeEventListener('contextmenu', this.onContext);
    e.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}

function keyName(e: KeyboardEvent): 'U' | 'D' | 'L' | 'R' | null {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'U';
    case 'KeyS':
    case 'ArrowDown':
      return 'D';
    case 'KeyA':
    case 'ArrowLeft':
      return 'L';
    case 'KeyD':
    case 'ArrowRight':
      return 'R';
    default:
      return null;
  }
}
