import * as THREE from 'three';
import { ease } from './anim';
import { lineMaterial, modelMaterial } from './paper';
import type { ModelTemplate } from './models/index';
import type { PieceBaked } from './models/builder';

// Kağıt maket kurulma animasyonu: taban serilir → duvarlar menteşeden kalkar → çatı yarıları kapanır →
// detaylar zıplayarak oturur. Parçalar ayrı mesh; animasyon bitince çağıran birleşik mesh'e geçer.

interface Slot {
  piece: PieceBaked;
  mesh: THREE.Mesh;
  lines: THREE.LineSegments;
  start: number;
  dur: number;
  /** Menteşe yoksa nasıl açılır. */
  mode: 'hinge' | 'spread' | 'grow' | 'drop';
}

export interface FoldRun {
  obj: THREE.Group;
  /** Toplam süre (sn, hız 1). */
  dur: number;
  /** time ∈ [0, dur]: 0 kurulmamış, dur tam kurulu. */
  set(time: number): void;
  dispose(): void;
}

const mT = new THREE.Matrix4();
const mR = new THREE.Matrix4();
const mS = new THREE.Matrix4();

export interface FoldOpts {
  /** Bu parçalar animasyonsuz, kurulu hâlde durur (ör. anıtın önceki aşamaları). */
  fixed?: (p: PieceBaked) => boolean;
  /** Verilirse yalnızca bunu geçen (ve sabit olmayan) parçalar oynatılır; geri kalanlar hiç çizilmez. */
  only?: (p: PieceBaked) => boolean;
}

/** mat: parça malzemesi (ağaçlar mevsim renkli ağaç malzemesini verir). */
export function createFold(tpl: ModelTemplate, mat: THREE.Material = modelMaterial('base'), opts: FoldOpts = {}): FoldRun {
  const obj = new THREE.Group();
  const lmat = lineMaterial('base');
  const slots: Slot[] = [];
  const animated: PieceBaked[] = [];
  for (const p of tpl.body.pieces) {
    if (opts.fixed?.(p)) {
      // Sabit parça: kurulu konumda, timeline'a girmez.
      const mesh = new THREE.Mesh(p.geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      const lines = new THREE.LineSegments(p.edges, lmat);
      lines.raycast = () => {};
      obj.add(mesh, lines);
    } else if (!opts.only || opts.only(p)) animated.push(p);
  }
  const byRole = (r: PieceBaked['role']) => animated.filter((p) => p.role === r);

  const mk = (piece: PieceBaked, start: number, dur: number, mode: Slot['mode']) => {
    const mesh = new THREE.Mesh(piece.geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => {};
    const lines = new THREE.LineSegments(piece.edges, lmat);
    lines.matrixAutoUpdate = false;
    lines.raycast = () => {};
    obj.add(mesh, lines);
    slots.push({ piece, mesh, lines, start, dur, mode });
  };

  // (a) taban
  const taban = byRole('taban');
  taban.forEach((p, i) => mk(p, i * 0.05, 0.32, 'spread'));
  let t = taban.length ? 0.22 : 0;
  // (b) duvarlar + gövdeler, sırayla
  const walls = [...byRole('duvar'), ...byRole('govde')];
  const ws = walls.length ? Math.min(0.09, 0.5 / walls.length) : 0;
  let wallEnd = t;
  walls.forEach((p, i) => {
    const st = t + i * ws;
    const d = p.hinge ? 0.42 : 0.38;
    mk(p, st, d, p.hinge ? 'hinge' : 'grow');
    wallEnd = Math.max(wallEnd, st + d);
  });
  // (c) çatı
  t = walls.length ? wallEnd - 0.12 : t;
  const roofs = byRole('cati');
  let roofEnd = t;
  roofs.forEach((p, i) => {
    const st = t + i * Math.min(0.07, 0.3 / roofs.length);
    mk(p, st, 0.42, p.hinge ? 'hinge' : 'drop');
    roofEnd = Math.max(roofEnd, st + 0.42);
  });
  // (d) detaylar
  t = roofs.length ? roofEnd - 0.12 : Math.max(t, wallEnd - 0.1);
  const det = byRole('detay');
  const ds = det.length ? Math.min(0.045, 0.38 / det.length) : 0;
  let end = Math.max(roofEnd, wallEnd);
  det.forEach((p, i) => {
    const st = t + i * ds;
    mk(p, st, 0.3, 'drop');
    end = Math.max(end, st + 0.3);
  });

  // Dönen parça (değirmen kanadı) en sonda
  let spinner: THREE.Group | null = null;
  let spStart = 0;
  const extra = tpl.spinner ? tpl.spinner.part : tpl.ripple;
  if (extra) {
    const s = new THREE.Group();
    const m = new THREE.Mesh(extra.geo, mat);
    m.castShadow = true;
    m.raycast = () => {};
    const l = new THREE.LineSegments(extra.edges, lmat);
    l.raycast = () => {};
    s.add(m, l);
    if (tpl.spinner) s.position.set(tpl.spinner.x, tpl.spinner.y, tpl.spinner.z);
    obj.add(s);
    spinner = s;
    spStart = end - 0.1;
    end = spStart + 0.4;
  }

  const dur = end + 0.05;

  function set(time: number): void {
    for (const s of slots) {
      const k = Math.min(1, Math.max(0, (time - s.start) / s.dur));
      const p = s.piece;
      let visible = true;
      if (s.mode === 'hinge' && p.hinge) {
        // Duvarlar kurulmadan önce de yere yatık görünür (açınım); çatılar başlayınca belirir.
        if (p.role === 'cati' || p.role === 'detay') visible = time > s.start;
        else visible = time > 0.08;
        const e = ease.outBack(k);
        const h = p.hinge;
        mT.makeTranslation(h.o.x, h.o.y, h.o.z);
        mR.makeRotationAxis(h.axis, h.angle * (1 - e));
        mT.multiply(mR);
        mS.makeTranslation(-h.o.x, -h.o.y, -h.o.z);
        mT.multiply(mS);
      } else if (s.mode === 'spread') {
        visible = k > 0;
        const e = Math.max(0.001, ease.outCubic(k));
        const c = p.center;
        // Hafif kıvrılma: serilirken kenar biraz kalkık
        mT.makeTranslation(c.x, p.bottom + (1 - k) * 0.08, c.z);
        mS.makeScale(e, 1, e);
        mT.multiply(mS);
        mS.makeTranslation(-c.x, -p.bottom, -c.z);
        mT.multiply(mS);
      } else if (s.mode === 'grow') {
        visible = k > 0;
        const e = Math.max(0.001, ease.outBack(k));
        const c = p.center;
        mT.makeTranslation(c.x, p.bottom, c.z);
        mS.makeScale(1, e, 1);
        mT.multiply(mS);
        mS.makeTranslation(-c.x, -p.bottom, -c.z);
        mT.multiply(mS);
      } else {
        visible = k > 0;
        const e = Math.max(0.001, ease.outBack(k));
        const c = p.center;
        const off = (1 - ease.outCubic(Math.min(1, k * 1.3))) * 0.6;
        mT.makeTranslation(c.x, c.y + off, c.z);
        mS.makeScale(e, e, e);
        mT.multiply(mS);
        mS.makeTranslation(-c.x, -c.y, -c.z);
        mT.multiply(mS);
      }
      s.mesh.visible = visible;
      s.lines.visible = visible;
      s.mesh.matrix.copy(mT);
      s.lines.matrix.copy(mT);
      s.mesh.matrixWorldNeedsUpdate = true;
      s.lines.matrixWorldNeedsUpdate = true;
    }
    if (spinner) {
      const k = Math.min(1, Math.max(0, (time - spStart) / 0.4));
      const e = Math.max(0.001, ease.outBack(k));
      spinner.visible = k > 0;
      spinner.scale.setScalar(e);
      if (tpl.spinner) spinner.rotation.z = (1 - k) * -2;
    }
  }

  set(0);
  return {
    obj,
    dur,
    set,
    dispose() {
      obj.clear();
    },
  };
}
