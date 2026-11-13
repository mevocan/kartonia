import * as THREE from 'three';
import { ADA_KENAR, DIS_SINIR, HARITA, OYUN_YARI_GENISLIK, blobPolygon, type Blob, type Vec2 } from '../data/map';
import { heightAt, isLake, SU_SEVIYESI } from '../logic/terrain';
import { PALETTE } from './palette';
import { groundPaperTexture, lineMaterial, modelMaterial, paperTexture, rng, treeMaterial } from './paper';
import { ModelBuilder } from './models/builder';
import { buildDecorTree } from './models/nature';
import { MEVSIM_GLSL, bindMevsim, kisW } from './season';

// Ekranı dolduran kağıt arazi: ±DIS_SINIR karesi, sarsılmış ızgara üçgenleri (low-poly katlanmış kağıt),
// parlak kağıt göller, oynanabilir alan sınırında kağıt şerit + kazıklar, dışarıda yoğun dekor ormanı.

/** Göl kıyısındaki kum şeridi genişliği. */
const KUM = 0.85;
const STEP = 1.05;

function blobR(b: Blob, t: number): number {
  let r = b.r;
  for (const [a, f, p] of b.dalga) r += a * Math.sin(f * t + p);
  return r;
}

function blobDist(b: Blob, x: number, z: number): number {
  const dx = x - b.x;
  const dz = z - b.z;
  return Math.hypot(dx, dz) - blobR(b, Math.atan2(dz, dx));
}

function nearestLake(x: number, z: number): { g: Blob; d: number } {
  let best = HARITA.goller[0];
  let d = Infinity;
  for (const g of HARITA.goller) {
    const v = blobDist(g, x, z);
    if (v < d) {
      d = v;
      best = g;
    }
  }
  return { g: best, d };
}

/** Oynanabilir yuvarlatılmış kareye işaretli uzaklık (dışarıda pozitif). */
export function playDist(x: number, z: number): number {
  const cr = 9;
  const inner = OYUN_YARI_GENISLIK - cr;
  const qx = Math.abs(x) - inner;
  const qz = Math.abs(z) - inner;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - cr;
}

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Sınır dışı dekor ormanı yoğunluğu 0..1. */
function decorDensity(x: number, z: number): number {
  const out = playDist(x, z);
  if (out < 2) return 0;
  const edge = Math.min(1, (out - 2) / 6);
  const n = 0.5 + 0.5 * Math.sin(x * 0.13 + 1.7) * Math.sin(z * 0.11 + 0.4) + 0.25 * Math.sin(x * 0.37 - z * 0.29);
  return Math.max(0, Math.min(1, edge * (0.35 + 0.65 * n)));
}

const tmpC = new THREE.Color();
const cForest = new THREE.Color();

function colorAt(x: number, z: number, h: number, jitter: number, out: THREE.Color, ldMax: number): void {
  // ldMax: üçgenin köşelerinden göle en uzak olanı. Kum şeridi ayrı düzgün halka mesh olarak çizilir.
  if (ldMax < 0.03) {
    out.set(PALETTE.golYatak);
  } else {
    const outside = playDist(x, z) > 0;
    out.set(outside ? PALETTE.cimenDis : PALETTE.cimen);
    let forest = 0;
    for (const o of HARITA.ormanlar) {
      const d = Math.hypot(x - o.x, z - o.z);
      forest = Math.max(forest, 1 - Math.max(0, (d - o.r * 0.7) / (o.r * 0.6)));
    }
    if (forest > 0) out.lerp(cForest.set(PALETTE.ormanZemin), Math.min(1, forest) * 0.8);
    // Çayırlar: açık, sarımsı çimen lekesi (çiçeklerin altı)
    let cayir = 0;
    for (const c of HARITA.cayirlar) {
      const d = Math.hypot(x - c.x, z - c.z);
      cayir = Math.max(cayir, 1 - Math.max(0, (d - c.r * 0.8) / (c.r * 0.5)));
    }
    if (cayir > 0) out.lerp(cForest.set(PALETTE.cimenAcik), Math.min(1, cayir) * 0.75);
    let tasli = 0;
    for (const t of HARITA.tasliklar) {
      const d = Math.hypot(x - t.x, z - t.z);
      tasli = Math.max(tasli, 1 - Math.max(0, (d - t.r * 0.75) / (t.r * 0.45)));
    }
    if (tasli > 0) out.lerp(cForest.set(PALETTE.tas), Math.min(1, tasli) * 0.7);
    const dd = decorDensity(x, z);
    if (dd > 0) out.lerp(cForest.set(PALETTE.ormanDis), dd * 0.85);
    out.lerp(tmpC.set(PALETTE.cimenAcik), Math.min(1, Math.max(0, h / (outside ? 6 : 3))) * 0.8);
  }
  out.multiplyScalar(1 + jitter);
}

export interface Terrain {
  group: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

export function createTerrain(): Terrain {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // ---------- Arazi ızgarası ----------
  const N = Math.ceil((2 * DIS_SINIR) / STEP);
  const s = (2 * DIS_SINIR) / N;
  const V = N + 1;
  const vx = new Float32Array(V * V);
  const vz = new Float32Array(V * V);
  const vh = new Float32Array(V * V);
  const vl = new Float32Array(V * V);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const k = j * V + i;
      let x = -DIS_SINIR + i * s;
      let z = -DIS_SINIR + j * s;
      const border = i === 0 || j === 0 || i === N || j === N;
      if (!border) {
        x += (hash2(i, j) - 0.5) * s * 0.42;
        z += (hash2(j + 17, i + 3) - 0.5) * s * 0.42;
        // Göl kıyısına kenetle: su kenarı arazide de temiz okunsun.
        const { g, d } = nearestLake(x, z);
        const snap = Math.abs(d) < 0.5 ? 0 : null;
        if (snap !== null) {
          const t = Math.atan2(z - g.z, x - g.x);
          const rr = blobR(g, t) + snap;
          x = g.x + Math.cos(t) * rr;
          z = g.z + Math.sin(t) * rr;
        }
      }
      let h = heightAt(x, z);
      const ld = nearestLake(x, z).d;
      if (Math.abs(ld) < 0.02) h = SU_SEVIYESI + 0.015;
      else if (ld < 0) h = Math.min(h, SU_SEVIYESI - 0.08);
      else h = Math.max(h, SU_SEVIYESI + 0.03);
      vx[k] = x;
      vz[k] = z;
      vh[k] = h;
      vl[k] = ld;
    }
  }
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const c = new THREE.Color();
  const pushTri = (a: number, b: number, d: number) => {
    const cr = (vx[b] - vx[a]) * (vz[d] - vz[a]) - (vz[b] - vz[a]) * (vx[d] - vx[a]);
    if (Math.abs(cr) < 1e-4) return;
    if (cr > 0) [a, b] = [b, a];
    const cx = (vx[a] + vx[b] + vx[d]) / 3;
    const cz = (vz[a] + vz[b] + vz[d]) / 3;
    const ch = (vh[a] + vh[b] + vh[d]) / 3;
    const ldMax = Math.max(vl[a], vl[b], vl[d]);
    colorAt(cx, cz, ch, (hash2(cx, cz) - 0.5) * 0.07, c, ldMax);
    for (const v of [a, b, d]) {
      pos.push(vx[v], vh[v], vz[v]);
      col.push(c.r, c.g, c.b);
      uv.push(vx[v] * 0.08, vz[v] * 0.08);
    }
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * V + i;
      const b = a + 1;
      const d = a + V;
      const cc = d + 1;
      if (hash2(i + 0.5, j + 0.5) < 0.5) {
        pushTri(a, cc, b);
        pushTri(a, d, cc);
      } else {
        pushTri(a, d, b);
        pushTri(b, d, cc);
      }
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  topGeo.computeVertexNormals();
  const grassTex = groundPaperTexture(1);
  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTex, roughness: 0.95, flatShading: true });
  // Mevsim: tepe renkleri sabit kalır, shader sonbaharda sarartır, kışın karla örter (ucuz, her karede hesap yok).
  topMat.onBeforeCompile = (sh) => {
    bindMevsim(sh.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + MEVSIM_GLSL)
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = mevsimZemin(color.rgb);\n#endif');
  };
  topMat.customProgramCacheKey = () => 'zemin-mevsim';
  const top = new THREE.Mesh(topGeo, topMat);
  top.receiveShadow = true;
  top.raycast = () => {};
  group.add(top);
  disposables.push(topGeo, topMat, grassTex);
  const creaseGeo = new THREE.EdgesGeometry(topGeo, 10);
  const creaseMat = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.08, depthWrite: false });
  const crease = new THREE.LineSegments(creaseGeo, creaseMat);
  crease.position.y = 0.004;
  crease.raycast = () => {};
  group.add(crease);
  disposables.push(creaseGeo, creaseMat);

  // ---------- Göller ----------
  const waterMat = new THREE.MeshStandardMaterial({
    color: PALETTE.su,
    map: paperTexture(),
    roughness: 0.28,
    metalness: 0.05,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const waveMats = [0, 1, 2].map(
    () => new THREE.MeshBasicMaterial({ color: PALETTE.dalga, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  disposables.push(waterMat, ...waveMats);
  const shorePts: number[] = [];
  const waveGeo = new THREE.PlaneGeometry(1, 0.08);
  waveGeo.rotateX(-Math.PI / 2);
  disposables.push(waveGeo);
  const sandMat = new THREE.MeshStandardMaterial({
    color: PALETTE.kum,
    map: paperTexture(),
    roughness: 0.95,
    flatShading: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const sandEdgeMat = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.18 });
  disposables.push(sandMat, sandEdgeMat);
  HARITA.goller.forEach((lake, gi) => {
    // Pürüzsüz kıyı: blob formülünden yoğun örneklenmiş çokgen.
    const poly = blobPolygon(lake, 200);
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z)));
    const g = new THREE.ShapeGeometry(shape, 1);
    g.rotateX(-Math.PI / 2);
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 0.15, uvA.getY(i) * 0.15);
    const water = new THREE.Mesh(g, waterMat);
    water.position.y = SU_SEVIYESI;
    water.receiveShadow = true;
    water.raycast = () => {};
    group.add(water);
    disposables.push(g);
    // Kum halkası: su kenarından dışa sabit ofset, araziyi izler.
    const m = poly.length;
    const offs = [-0.08, 0.25, 0.55, KUM];
    const ring = (i: number, o: number): [number, number, number] => {
      const a = poly[(i - 1 + m) % m];
      const b = poly[(i + 1) % m];
      let nx = b.z - a.z;
      let nz = -(b.x - a.x);
      const L = Math.hypot(nx, nz) || 1;
      nx /= L;
      nz /= L;
      // Dışa baksın
      if ((poly[i].x - lake.x) * nx + (poly[i].z - lake.z) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      const x = poly[i].x + nx * o;
      const z = poly[i].z + nz * o;
      const y = o <= 0 ? SU_SEVIYESI + 0.022 : Math.max(heightAt(x, z), SU_SEVIYESI + 0.03) + 0.035;
      return [x, y, z];
    };
    const sp: number[] = [];
    const su: number[] = [];
    const edgeOut: number[] = [];
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      for (let k = 0; k < offs.length - 1; k++) {
        const a0 = ring(i, offs[k]), a1 = ring(i, offs[k + 1]), b0 = ring(j, offs[k]), b1 = ring(j, offs[k + 1]);
        sp.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
        for (const q of [a0, b0, b1, a0, b1, a1]) su.push(q[0] * 0.3, q[2] * 0.3);
      }
      const i0 = ring(i, offs[0]), j0 = ring(j, offs[0]);
      shorePts.push(i0[0], i0[1] + 0.004, i0[2], j0[0], j0[1] + 0.004, j0[2]);
      const io = ring(i, KUM), jo = ring(j, KUM);
      edgeOut.push(io[0], io[1] + 0.004, io[2], jo[0], jo[1] + 0.004, jo[2]);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
    sg.computeVertexNormals();
    const sand = new THREE.Mesh(sg, sandMat);
    sand.receiveShadow = true;
    sand.raycast = () => {};
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgeOut, 3));
    const el = new THREE.LineSegments(eg, sandEdgeMat);
    el.raycast = () => {};
    group.add(sand, el);
    disposables.push(sg, eg);
    const count = Math.round(lake.r * 2.2);
    const wr = rng(99 + gi);
    for (let k = 0; k < count; k++) {
      const ang = wr() * Math.PI * 2;
      const rad = Math.sqrt(wr()) * lake.r * 0.7;
      const w = new THREE.Mesh(waveGeo, waveMats[k % 3]);
      w.position.set(lake.x + Math.cos(ang) * rad, SU_SEVIYESI + 0.02, lake.z + Math.sin(ang) * rad);
      w.scale.x = 0.35 + wr() * 0.5;
      w.rotation.y = 0.3 + (wr() - 0.5) * 0.3;
      w.raycast = () => {};
      group.add(w);
    }
  });
  const shoreGeo = new THREE.BufferGeometry();
  shoreGeo.setAttribute('position', new THREE.Float32BufferAttribute(shorePts, 3));
  const shoreMat = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.55 });
  const shore = new THREE.LineSegments(shoreGeo, shoreMat);
  shore.raycast = () => {};
  group.add(shore);
  disposables.push(shoreGeo, shoreMat);

  // ---------- Sınır: kağıt şerit + kazıklar ----------
  {
    const pts: Vec2[] = [];
    for (let i = 0; i < ADA_KENAR.length; i++) {
      const a = ADA_KENAR[i];
      const b = ADA_KENAR[(i + 1) % ADA_KENAR.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
    }
    const n = pts.length;
    const p: number[] = [];
    const lp: number[] = [];
    const hw = 0.24;
    const side = (i: number, sg: number): [number, number, number] => {
      const a = pts[(i - 1 + n) % n];
      const b = pts[(i + 1) % n];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const L = Math.hypot(tx, tz) || 1;
      tx /= L;
      tz /= L;
      const x = pts[i].x - tz * hw * sg;
      const z = pts[i].z + tx * hw * sg;
      return [x, heightAt(x, z) + 0.06, z];
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const al = side(i, 1), ar = side(i, -1), bl = side(j, 1), br = side(j, -1);
      p.push(...al, ...ar, ...br, ...al, ...br, ...bl);
      lp.push(...al, ...bl, ...ar, ...br);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const uvs = new Float32Array((p.length / 3) * 2);
    for (let i = 0; i < p.length / 3; i++) {
      uvs[i * 2] = p[i * 3] * 0.3;
      uvs[i * 2 + 1] = p[i * 3 + 2] * 0.3;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: PALETTE.sinirSerit,
      map: paperTexture(),
      roughness: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const strip = new THREE.Mesh(g, m);
    strip.receiveShadow = true;
    strip.raycast = () => {};
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const lines = new THREE.LineSegments(lg, lineMaterial());
    lines.raycast = () => {};
    group.add(strip, lines);
    disposables.push(g, m, lg);

    // Kazıklar (instanced) + aralarında ince ip
    const pb = new ModelBuilder('kazik');
    pb.box(0.09, 0.5, 0.09, PALETTE.sinirKazik, { wob: 0 });
    pb.cone(0.08, 0.1, 4, PALETTE.kiremit, { y: 0.5, wob: 0 });
    const post = pb.bake();
    for (const pc of post.pieces) {
      pc.geo.dispose();
      pc.edges.dispose();
    }
    const every = 5; // 5 × 0.6 = 3 birim
    const count = Math.floor(n / every);
    const im = new THREE.InstancedMesh(post.geo, modelMaterial('base'), count);
    im.castShadow = true;
    im.raycast = () => {};
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const rope: number[] = [];
    let prev: THREE.Vector3 | null = null;
    let first: THREE.Vector3 | null = null;
    for (let k = 0; k < count; k++) {
      const pt = pts[k * every];
      const y = heightAt(pt.x, pt.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.7);
      mtx.compose(new THREE.Vector3(pt.x, y, pt.z), q, new THREE.Vector3(1, 0.9 + hash2(k, 3) * 0.25, 1));
      im.setMatrixAt(k, mtx);
      const topP = new THREE.Vector3(pt.x, y + 0.42, pt.z);
      if (prev) rope.push(prev.x, prev.y, prev.z, topP.x, topP.y, topP.z);
      else first = topP;
      prev = topP;
    }
    if (prev && first) rope.push(prev.x, prev.y, prev.z, first.x, first.y, first.z);
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3));
    const ropeMat = new THREE.LineBasicMaterial({ color: PALETTE.kenar, transparent: true, opacity: 0.5 });
    const ropeL = new THREE.LineSegments(rg, ropeMat);
    ropeL.raycast = () => {};
    group.add(ropeL);
    disposables.push(post.geo, post.edges, rg, ropeMat);
  }

  // ---------- Dekor ormanı (yalnız çizim; instanced, kenar çizgisiz) ----------
  {
    const r = rng(7331);
    const geos = [0, 1, 2].map((v) => {
      const b = buildDecorTree(v).bake();
      for (const pc of b.pieces) {
        pc.geo.dispose();
        pc.edges.dispose();
      }
      b.edges.dispose();
      return b.geo;
    });
    // Varyant × 4x4 hücre (ana ve gölge geçişinde frustum ayıklaması için)
    const buckets: THREE.Matrix4[][] = Array.from({ length: 48 }, () => []);
    const step = 1.75;
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let z = -DIS_SINIR + 1; z < DIS_SINIR - 1; z += step) {
      for (let x = -DIS_SINIR + 1; x < DIS_SINIR - 1; x += step) {
        const px = x + (r() - 0.5) * step * 0.9;
        const pz = z + (r() - 0.5) * step * 0.9;
        const dens = decorDensity(px, pz);
        if (r() > dens || isLake(px, pz)) continue;
        const v = r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2;
        const cell = (u: number) => Math.min(3, Math.max(0, Math.floor(((u + DIS_SINIR) / (2 * DIS_SINIR)) * 4)));
        const quad = cell(px) + cell(pz) * 4;
        const sc = 1.0 + r() * 0.8;
        q.setFromAxisAngle(up, r() * Math.PI * 2);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, heightAt(px, pz) - 0.02, pz), q, new THREE.Vector3(sc, sc * (0.9 + r() * 0.3), sc));
        buckets[v * 16 + quad].push(m);
      }
    }
    const mat = treeMaterial();
    buckets.forEach((list, bi) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geos[Math.floor(bi / 16)], mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      im.raycast = () => {};
      group.add(im);
    });
    disposables.push(...geos);
  }

  // ---------- Taşlıklar: serpiştirilmiş kağıt kayalar (yalnız çizim, instanced) ----------
  if (HARITA.tasliklar.length > 0) {
    const r = rng((HARITA.agacTohum ^ 0x5a5a5a) >>> 0);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    geo.translate(0, 0.35, 0);
    const mats = [PALETTE.tas, PALETTE.tasKoyu].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95 }),
    );
    const lists: THREE.Matrix4[][] = [[], []];
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    for (const t of HARITA.tasliklar) {
      const n = Math.round(t.r * t.r * 1.6);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * t.r * 0.95;
        const px = t.x + Math.cos(a) * d;
        const pz = t.z + Math.sin(a) * d;
        if (isLake(px, pz)) continue;
        const s = 0.18 + r() * 0.32;
        q.setFromEuler(eul.set(r() * 0.4, r() * Math.PI * 2, r() * 0.4));
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(px, heightAt(px, pz) - s * 0.3, pz), q, new THREE.Vector3(s * (1 + r() * 0.5), s * (0.55 + r() * 0.5), s),
        );
        lists[r() < 0.6 ? 0 : 1].push(m);
      }
    }
    lists.forEach((list, i) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mats[i], list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      im.receiveShadow = true;
      im.raycast = () => {};
      group.add(im);
    });
    disposables.push(geo, ...mats);
  }

  const cSu = new THREE.Color(PALETTE.su);
  const cBuz = new THREE.Color(PALETTE.buz);
  const cKum = new THREE.Color(PALETTE.kum);
  const cKarKum = new THREE.Color(PALETTE.karKum);
  let sonK = -1;

  return {
    group,
    update(time: number) {
      // Kış: göl mat buz, dalgalar söner, kum karlanır.
      const k = kisW();
      for (let i = 0; i < waveMats.length; i++) {
        waveMats[i].opacity = (0.15 + 0.55 * Math.max(0, Math.sin(time * 0.9 + i * 2.1))) * (1 - k);
      }
      if (k !== sonK) {
        sonK = k;
        waterMat.color.copy(cSu).lerp(cBuz, k);
        waterMat.roughness = 0.28 + 0.6 * k;
        sandMat.color.copy(cKum).lerp(cKarKum, k * 0.85);
        for (const w of waveMats) w.visible = k < 0.99;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Ekran ışınını arazi yüzeyine (heightAt) yürüterek keser. */
export function rayTerrain(ray: THREE.Ray, out: THREE.Vector3): THREE.Vector3 | null {
  const o = ray.origin;
  const d = ray.direction;
  if (d.y >= -1e-4) return null;
  let t = Math.max(0, (o.y - 8) / -d.y);
  const tEnd = (o.y + 1) / -d.y;
  const stepLen = 0.25;
  let prevT = t;
  for (; t <= tEnd; t += stepLen) {
    const x = o.x + d.x * t;
    const y = o.y + d.y * t;
    const z = o.z + d.z * t;
    if (y <= heightAt(x, z)) {
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 12; k++) {
        const m = (lo + hi) / 2;
        if (o.y + d.y * m > heightAt(o.x + d.x * m, o.z + d.z * m)) lo = m;
        else hi = m;
      }
      return out.copy(o).addScaledVector(d, hi);
    }
    prevT = t;
  }
  return null;
}
