import type { BuildingType, Vec2 } from '../logic/types';
import { HARITA } from '../data/map';
import { isLake, isLand } from '../logic/terrain';
import { createRenderer } from './renderer';
import type { GameRenderer } from './api';
import { PALETTE } from './palette';
import { rng } from './paper';
import { MEVSIMLER, type Mevsim } from '../logic/season';

// Görsel deneme: ormanlar (animasyonsuz), birkaç yol ve sırayla katlanarak kurulan binalar.
// Arayüz ajanı ?preview ile çağırır. Sol tık: binayı yık / boş yere ev kur. Ev sürekli yeniden kurulur.

export function runPreview(container: HTMLElement): GameRenderer {
  const r = createRenderer(container);
  let id = 1;

  // ?preview&mevsim=kis|sonbahar|yaz|ilkbahar: o mevsim anında. mevsim=dongu: 6 sn'de bir sıradaki mevsime geçer.
  const mp = new URLSearchParams(location.search).get('mevsim');
  if (mp && (MEVSIMLER as string[]).includes(mp)) r.setSeason(mp as Mevsim, true);
  else if (mp === 'dongu') {
    let mi = 0;
    r.setSeason(MEVSIMLER[0], true);
    setInterval(() => r.setSeason(MEVSIMLER[(mi = (mi + 1) % MEVSIMLER.length)]), 6000);
  }

  // Ormanlar
  const rand = rng(HARITA.agacTohum);
  for (const o of HARITA.ormanlar) {
    for (let i = 0; i < o.agac; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * o.r;
      const x = o.x + Math.cos(a) * d;
      const z = o.z + Math.sin(a) * d;
      if (!isLand(x, z) || isLake(x, z)) continue;
      r.addBuilding(1000 + id++, 'agac', x, z, rand() * 6.28, 1, false);
    }
  }

  // Mevsim denemesinde kameranın gördüğü yere birkaç ağaç (renk geçişi görünsün).
  if (mp) {
    const tr = rng(77);
    for (let i = 0; i < 26; i++) {
      const x = -13 + tr() * 9;
      const z = 2 + tr() * 14;
      if (!isLand(x, z) || isLake(x, z)) continue;
      r.addBuilding(1000 + id++, 'agac', x, z, tr() * 6.28, 1, false);
    }
  }

  // ?preview&anit: Saat Kulesi aşamaları 0–4 yan yana (anında; 1. aşamada uyarı, 2.'de seçim vurgusu).
  // ?preview&anit=dongu: ortada tek kule; 3.5 sn'de bir sonraki aşamaya katlanarak ilerler, 4'ten sonra yıkılıp yeniden kurulur.
  const anit = new URLSearchParams(location.search).get('anit');
  if (anit !== null) {
    // Kamerayı yaklaştır (tekerlek olayıyla, kamera kendi sınırında durur).
    r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, cancelable: true }));
    if (anit === 'kare') {
      // ?preview&anit=kare&asama=N&t=S: N-1'den N'ye geçişin S. saniyesi (sabit adımlarla, ekran görüntüsü için).
      // asama=0: addBuilding + setMonumentStage(0) ilk kurulumu.
      const q = new URLSearchParams(location.search);
      const n = Number(q.get('asama') ?? 1);
      const t = Number(q.get('t') ?? 0.5);
      for (let k = 0; k < 90; k++) r.update(1 / 30); // kamera yakınlaşması otursun
      if (n <= 0) {
        r.addBuilding(9000, 'saatKulesi', 0, 9, 0.5, 1, true);
        r.setMonumentStage(9000, 0);
      } else {
        r.addBuilding(9000, 'saatKulesi', 0, 9, 0.5, 1, false);
        r.setMonumentStage(9000, n - 1, false);
        r.setMonumentStage(9000, n);
      }
      for (let k = 0; k < t * 30; k++) r.update(1 / 30);
      const dur0 = () => {
        r.update(0);
        requestAnimationFrame(dur0);
      };
      requestAnimationFrame(dur0);
      return r;
    }
    if (anit === 'dongu') {
      let kid = 9000;
      let a = 0;
      const kur = () => {
        r.addBuilding(kid, 'saatKulesi', 0, 9, 0.5, 1, true);
        r.setMonumentStage(kid, 0);
        a = 0;
      };
      setTimeout(kur, 600);
      setInterval(() => {
        if (a < 4) r.setMonumentStage(kid, ++a);
        else {
          r.removeBuilding(kid);
          kid++;
          setTimeout(kur, 1200);
          a = 5;
        }
      }, 3500);
    } else {
      for (let i = 0; i <= 4; i++) {
        const tid = 9000 + i;
        r.addBuilding(tid, 'saatKulesi', -5.6 + i * 2.8, 9.5, 0.35, 1, false);
        r.setMonumentStage(tid, i, false);
      }
      r.setWarning(9001, true);
      r.highlight(9002, 'secim');
    }
    let last0 = performance.now();
    const loop0 = (now: number) => {
      const dt = (now - last0) / 1000;
      last0 = now;
      r.update(dt);
      requestAnimationFrame(loop0);
    };
    requestAnimationFrame(loop0);
    window.addEventListener('resize', () => r.resize());
    return r;
  }

  // ?preview&tuccar: kısa bir yolun ucunda gezgin tüccar arabası, kamera yakın.
  //   tuccar        → araba gelir, ~6 sn durur, gider, 1.5 sn sonra yeniden gelir (döngü).
  //   tuccar=dur    → araba anında yerinde (anlik=true).
  //   tuccar=kare&evre=gelis|gidis&t=S → o geçişin S. saniyesi (sabit adımlarla, ekran görüntüsü için).
  const tq = new URLSearchParams(location.search);
  const tuccar = tq.get('tuccar');
  if (tuccar !== null) {
    const yol: Vec2[] = [{ x: 0.5, z: 5.5 }, { x: -1.5, z: 9 }, { x: -4, z: 12 }, { x: -7.5, z: 14.5 }];
    r.addRoad(1, 'toprak', yol, false);
    const konum = { x: yol[0].x, z: yol[0].z, yon: Math.atan2(yol[1].x - yol[0].x, yol[1].z - yol[0].z) };
    r.addBuilding(2, 'ev', 1.6, 10.6, -2.4, 2, false);
    r.addBuilding(3, 'ev', -4.6, 8.4, 1.0, 1, false);
    const tr = rng(91);
    for (let i = 0; i < 14; i++) {
      const x = 4 + tr() * 7;
      const z = 0 + tr() * 5;
      r.addBuilding(1000 + id++, 'agac', x, z, tr() * 6.28, 1, false);
    }
    r.setPopulation(10);
    for (let k = 0; k < 3; k++) r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, cancelable: true }));
    if (tuccar === 'kare') {
      const evre = tq.get('evre') ?? 'gelis';
      const t = Number(tq.get('t') ?? 1);
      for (let k = 0; k < 90; k++) r.update(1 / 30);
      if (evre === 'gidis') {
        r.setMerchant(konum, true);
        r.update(1 / 30);
        r.setMerchant(null);
      } else r.setMerchant(konum);
      for (let k = 0; k < t * 30; k++) r.update(1 / 30);
      const dur1 = () => {
        r.update(0);
        requestAnimationFrame(dur1);
      };
      requestAnimationFrame(dur1);
      return r;
    }
    // main gibi her karede çağrılır; aynı değerde bir şey yapmamalı.
    let simdi: typeof konum | null = null;
    if (tuccar === 'dur') r.setMerchant(konum, true);
    else {
      const tik = () => {
        simdi = simdi ? null : { ...konum };
        setTimeout(tik, simdi ? 8600 : 4100);
      };
      setTimeout(tik, 500);
    }
    let last1 = performance.now();
    const loop1 = (now: number) => {
      const dt = (now - last1) / 1000;
      last1 = now;
      if (tuccar !== 'dur') r.setMerchant(simdi);
      r.update(dt);
      requestAnimationFrame(loop1);
    };
    requestAnimationFrame(loop1);
    window.addEventListener('resize', () => r.resize());
    return r;
  }

  // Yollar
  const roads: [number, 'toprak' | 'asfalt', Vec2[]][] = [
    [1, 'toprak', HARITA.baslangicYolu],
    [2, 'asfalt', [{ x: 1.0, z: 2 }, { x: 4, z: 0.5 }, { x: 8, z: 0.8 }, { x: 11, z: 3 }]],
    [3, 'toprak', [{ x: 1.0, z: 2 }, { x: -2.5, z: 0 }, { x: -6, z: -1.5 }, { x: -9, z: -4.5 }]],
    [4, 'toprak', [{ x: 0.6, z: 8 }, { x: -4, z: 9.5 }, { x: -6.5, z: 12 }]],
  ];
  roads.forEach(([rid, tur, pts], i) => setTimeout(() => r.addRoad(rid, tur, pts), 300 + i * 700));

  const items: [BuildingType, number, number, number, number][] = [
    ['saatKulesi', 2.6, 4.2, 0.2, 1],
    ['ev', -2, 6, 1.6, 1],
    ['ev', 2.2, 8.8, -1.4, 2],
    ['ev', 1.8, 13, -1.6, 3],
    ['cesme', -2.2, 12.5, 0, 1],
    ['pazar', 5.5, 3.2, 3.1, 1],
    ['okul', 7.5, -2.3, 0.1, 1],
    ['firin', -3, -2.2, 0.4, 1],
    ['degirmen', -6.5, -4.0, 0.5, 1],
    ['tarla', -9.5, -0.8, 0.3, 1],
    ['oduncu', -7.5, -8.2, 0.6, 1],
    ['ev', -5, 7.2, 0.1, 2],
    ['ev', 10.5, 5.6, -2.6, 1],
    ['agac', 4.2, 11, 0, 1],
    ['agac', -1.2, 15.5, 0, 1],
  ];
  // En yakın yol noktası (patika ucu) ve önü yola dönük açı.
  const link = (x: number, z: number): { p: Vec2; rot: number } => {
    let best: Vec2 = { x, z };
    let bd = Infinity;
    for (const [, , pts] of roads) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        const q = { x: a.x + dx * t, z: a.z + dz * t };
        const d = Math.hypot(q.x - x, q.z - z);
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
    }
    return { p: best, rot: Math.atan2(best.x - x, best.z - z) };
  };
  r.setPopulation(40);

  items.forEach(([t, x, z, rot, lv], i) => {
    const myId = id++;
    const l = t === 'agac' ? null : link(x, z);
    setTimeout(() => r.addBuilding(myId, t, x, z, l ? l.rot : rot, lv, true, l ? l.p : null), 2600 + 450 * i);
  });
  setTimeout(() => r.setWarning(3, true), 9000);

  // Sürekli yeniden kurulan ev (katlanmayı izlemek için)
  let demo = 5000;
  setInterval(() => {
    r.removeBuilding(demo);
    demo++;
    const l = link(4.6, 7.4);
    setTimeout(() => r.addBuilding(demo, 'ev', 4.6, 7.4, l.rot, 1 + (demo % 3), true, l.p), 900);
  }, 3600);

  let next = 100;
  r.canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0 || r.isPanning()) return;
    const b = r.pickBuilding(e.clientX, e.clientY);
    if (b !== null) {
      r.removeBuilding(b);
      return;
    }
    const g = r.pickGround(e.clientX, e.clientY);
    if (g) r.addBuilding(next++, 'ev', g.x, g.z, Math.random() * 6, 1 + (next % 3));
  });
  r.canvas.addEventListener('pointermove', (e) => {
    const g = r.pickGround(e.clientX, e.clientY);
    if (!g) return;
    const ok = isLand(g.x, g.z) && !isLake(g.x, g.z);
    r.setGhost('degirmen', g.x, g.z, 0.5, ok);
    r.showRange(g.x, g.z, 4);
  });

  let day = 0;
  let tick = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    day = (day + dt / 15) % 1;
    r.setDayProgress(day);
    tick += dt;
    if (tick > 2.5) {
      tick = 0;
      r.floatText(2.2, 8.8, '+7', PALETTE.vergiYazi);
    }
    r.update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => r.resize());
  return r;
}
