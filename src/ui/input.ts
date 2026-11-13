// Sol tık, yol fırçası ve klavye girişi. Sağ/orta tuş ve tekerlek renderer'ın kamerasına aittir.
import type { BuildingType, GameState, RoadType, Vec2 } from '../logic/types';
import type { GameRenderer } from '../render/api';
import { BUILDINGS, dogaTuru } from '../data/buildings';
import { adjacencyBonus, canPlace, effectRadius, nearestRoad, planRoad } from '../logic/game';
import { isBuildingTool, isRoadTool, type Tool } from './buildMenu';
import { yerlestirmeSebebi } from './toast';
import { el } from './dom';
import { bonusMetni, t } from './i18n';

export interface Selection {
  kind: 'bina' | 'yol';
  id: number;
}

export interface InputDeps {
  renderer: GameRenderer;
  /** Fırça etiketinin ekleneceği HTML katmanı. */
  ui: HTMLElement;
  getState(): GameState;
  getTool(): Tool;
  setTool(tool: Tool): void;
  getSelected(): Selection | null;
  select(sel: Selection | null): void;
  place(type: BuildingType, x: number, z: number, rot: number): void;
  placeRoad(tur: RoadType, noktalar: Vec2[]): void;
  demolish(id: number): void;
  demolishRoad(id: number): void;
  setSpeed(speed: number): void;
  togglePause(): void;
}

export interface Input {
  /** Araç, seçim ya da durum değişince hayalet/halka/vurguyu yeniden hesaplar. */
  refresh(): void;
  dispose(): void;
}

const DONUS_ADIMI = Math.PI / 12; // 15°
const TIK_ESIGI = 5; // px
const FIRCA_ADIMI = 0.3; // dünya birimi

export function createInput(deps: InputDeps): Input {
  const { renderer } = deps;
  const canvas = renderer.canvas;

  const etiket = el('div', 'kagit');
  etiket.id = 'fircaEtiket';
  deps.ui.appendChild(etiket);

  let fare: { x: number; y: number } | null = null;
  let basma: { x: number; y: number; id: number; kaydirdi: boolean } | null = null;
  let firca: { tur: RoadType; noktalar: Vec2[]; id: number } | null = null;
  /** Kullanıcının Q/E ile verdiği dönüş ofseti. */
  let ofset = 0;

  /** Bina yol kenarındaysa önü (+z) en yakın yola bakar; üstüne kullanıcı ofseti eklenir. */
  function donus(t: BuildingType, x: number, z: number): number {
    if (dogaTuru(t)) return ofset;
    const yol = nearestRoad(deps.getState(), x, z);
    if (!yol) return ofset;
    return Math.atan2(yol.x - x, yol.z - z) + ofset;
  }

  function etiketGizle(): void {
    etiket.style.display = 'none';
  }

  function fircaGuncelle(): void {
    if (!firca) return;
    const plan = planRoad(deps.getState(), firca.tur, firca.noktalar);
    renderer.setRoadGhost(firca.tur, plan.noktalar, plan.ok);
    if (plan.ok) {
      etiket.textContent = `${plan.uzunluk.toFixed(1)} ${t('genel.birim')} · 🪙 ${plan.maliyet}`;
    } else {
      const sebep = yerlestirmeSebebi(plan.sebep ?? 'kisa');
      etiket.textContent = plan.sebep === 'para' ? `🪙 ${plan.maliyet} · ${sebep}` : sebep;
    }
    etiket.classList.toggle('kotu', !plan.ok);
    etiket.classList.remove('soluk', 'iyi');
    if (fare) {
      etiket.style.left = `${fare.x + 16}px`;
      etiket.style.top = `${fare.y + 16}px`;
    }
    etiket.style.display = 'block';
  }

  /**
   * Hayalet binanın üstünde komşuluk etiketi (fırça etiketiyle aynı kağıt): bonus varsa "+%25 sulama",
   * kural var ama şart tutmuyorsa soluk "bonus yok". Kuralı olmayan binada gizli.
   */
  function bonusEtiketi(tur: BuildingType, x: number, z: number): void {
    const b = adjacencyBonus(deps.getState(), tur, x, z);
    if (b.durumlar.length === 0 || !fare) {
      etiketGizle();
      return;
    }
    const aktif = b.durumlar.filter((d) => d.aktif);
    etiket.textContent = aktif.length > 0 ? aktif.map(bonusMetni).join(' · ') : t('bilgi.bonusYok');
    etiket.classList.remove('kotu');
    etiket.classList.toggle('soluk', aktif.length === 0);
    etiket.classList.toggle('iyi', aktif.length > 0);
    etiket.style.left = `${fare.x + 16}px`;
    etiket.style.top = `${fare.y - 40}px`;
    etiket.style.display = 'block';
  }

  function fircaIptal(): void {
    firca = null;
    renderer.setRoadGhost(null, [], false);
    etiketGizle();
  }

  function refresh(): void {
    const tool = deps.getTool();
    // Yol fırçasında sol sürükleme yol çizer; diğer bütün modlarda haritayı kaydırır.
    renderer.setLeftDragPan(!isRoadTool(tool));
    const s = deps.getState();

    if (!firca) renderer.setRoadGhost(null, [], false);

    if (isBuildingTool(tool)) {
      const p = fare ? renderer.pickGround(fare.x, fare.y) : null;
      if (!p) {
        renderer.setGhost(null, 0, 0, 0, false);
        renderer.showRange(0, 0, null);
        etiketGizle();
      } else {
        const ok = canPlace(s, tool, p.x, p.z).ok;
        renderer.setGhost(tool, p.x, p.z, donus(tool, p.x, p.z), ok);
        const etki = BUILDINGS[tool].etki;
        renderer.showRange(p.x, p.z, etki > 0 ? etki : null);
        bonusEtiketi(tool, p.x, p.z);
      }
      renderer.highlight(null);
      renderer.highlightRoad(null);
      canvas.style.cursor = 'default';
      return;
    }

    renderer.setGhost(null, 0, 0, 0, false);
    if (!firca) etiketGizle(); // bina aracından çıkınca komşuluk etiketi kalmasın

    if (isRoadTool(tool)) {
      renderer.showRange(0, 0, null);
      renderer.highlight(null);
      renderer.highlightRoad(null);
      canvas.style.cursor = 'crosshair';
      return;
    }

    if (tool === 'yikim') {
      renderer.showRange(0, 0, null);
      const bid = fare ? renderer.pickBuilding(fare.x, fare.y) : null;
      const rid = fare && bid === null ? renderer.pickRoad(fare.x, fare.y) : null;
      renderer.highlight(bid, 'yikim');
      renderer.highlightRoad(rid, 'yikim');
      canvas.style.cursor = bid !== null || rid !== null ? 'pointer' : 'default';
      return;
    }

    canvas.style.cursor = 'default';
    const sel = deps.getSelected();
    const b = sel?.kind === 'bina' ? s.binalar.find((x) => x.id === sel.id) : undefined;
    const r = sel?.kind === 'yol' ? s.yollar.find((x) => x.id === sel.id) : undefined;
    if (b) {
      renderer.highlight(b.id, 'secim');
      const etki = effectRadius(b);
      renderer.showRange(b.x, b.z, etki > 0 ? etki : null);
    } else {
      renderer.highlight(null);
      renderer.showRange(0, 0, null);
    }
    renderer.highlightRoad(r ? r.id : null, 'secim');
  }

  function tikla(x: number, y: number): void {
    const tool = deps.getTool();
    if (tool === 'yikim') {
      const bid = renderer.pickBuilding(x, y);
      if (bid !== null) {
        deps.demolish(bid);
        return;
      }
      const rid = renderer.pickRoad(x, y);
      if (rid !== null) deps.demolishRoad(rid);
      return;
    }
    if (isBuildingTool(tool)) {
      const p = renderer.pickGround(x, y);
      if (p) deps.place(tool, p.x, p.z, donus(tool, p.x, p.z));
      return;
    }
    if (isRoadTool(tool)) return;
    const bid = renderer.pickBuilding(x, y);
    if (bid !== null) {
      deps.select({ kind: 'bina', id: bid });
      return;
    }
    const rid = renderer.pickRoad(x, y);
    deps.select(rid !== null ? { kind: 'yol', id: rid } : null);
  }

  /** Sağ tuş basışı: sürüklenmeden bırakılırsa araç/seçim iptal (sürükleme kamerayı döndürür). */
  let sagBasma: { x: number; y: number; id: number } | null = null;

  /** Esc ve sağ tıkın ortak davranışı: fırça → araç → seçim sırasıyla bırakılır. */
  function iptal(): void {
    const tool = deps.getTool();
    if (firca) {
      fircaIptal();
      deps.setTool(null);
    } else if (tool !== null) deps.setTool(null);
    else deps.select(null);
  }

  const onDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      sagBasma = { x: e.clientX, y: e.clientY, id: e.pointerId };
      return;
    }
    if (e.button !== 0) return;
    fare = { x: e.clientX, y: e.clientY };
    const tool = deps.getTool();
    if (isRoadTool(tool)) {
      const p = renderer.pickGround(e.clientX, e.clientY);
      if (!p) return;
      firca = { tur: tool, noktalar: [p], id: e.pointerId };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* yok say */
      }
      fircaGuncelle();
      return;
    }
    basma = { x: e.clientX, y: e.clientY, id: e.pointerId, kaydirdi: false };
  };

  const onUp = (e: PointerEvent): void => {
    if (e.button === 2) {
      const sb = sagBasma;
      sagBasma = null;
      if (sb && sb.id === e.pointerId && Math.hypot(e.clientX - sb.x, e.clientY - sb.y) < TIK_ESIGI) iptal();
      return;
    }
    if (e.button !== 0) return;
    if (firca && firca.id === e.pointerId) {
      const { tur, noktalar } = firca;
      fircaIptal();
      deps.placeRoad(tur, noktalar);
      return;
    }
    if (!basma || basma.id !== e.pointerId) return;
    const d = Math.hypot(e.clientX - basma.x, e.clientY - basma.y);
    const kaydirdi = basma.kaydirdi || renderer.isPanning();
    basma = null;
    fare = { x: e.clientX, y: e.clientY };
    if (!kaydirdi && d < TIK_ESIGI) tikla(e.clientX, e.clientY);
    // Kaydırma bitti: hayalet/vurgu ve imleç yeni kamera konumuna göre güncellensin.
    refresh();
  };

  const onMove = (e: PointerEvent): void => {
    fare = { x: e.clientX, y: e.clientY };
    if (firca && firca.id === e.pointerId) {
      const p = renderer.pickGround(e.clientX, e.clientY);
      const son = firca.noktalar[firca.noktalar.length - 1];
      if (p && Math.hypot(p.x - son.x, p.z - son.z) >= FIRCA_ADIMI) {
        firca.noktalar.push(p);
        fircaGuncelle();
      } else {
        etiket.style.left = `${e.clientX + 16}px`;
        etiket.style.top = `${e.clientY + 16}px`;
      }
      return;
    }
    if (renderer.isPanning()) {
      // Harita kaydırılıyor: tıklama sayılmaz, hover/hayalet güncellemesi atlanır.
      if (basma) basma.kaydirdi = true;
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (deps.getTool() !== null) refresh();
  };

  const onLeave = (): void => {
    if (firca) return; // yakalama sürüyor
    fare = null;
    basma = null;
    if (deps.getTool() !== null) refresh();
  };

  const onCancel = (e: PointerEvent): void => {
    if (firca && firca.id === e.pointerId) fircaIptal();
    basma = null;
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tool = deps.getTool();
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (!e.repeat) deps.togglePause();
        break;
      case 'Digit1': case 'Numpad1': deps.setSpeed(1); break;
      case 'Digit2': case 'Numpad2': deps.setSpeed(2); break;
      case 'Digit3': case 'Numpad3': deps.setSpeed(3); break;
      case 'KeyX':
        fircaIptal();
        deps.setTool(tool === 'yikim' ? null : 'yikim');
        break;
      case 'KeyQ':
      case 'KeyE':
        if (isBuildingTool(tool)) {
          ofset += e.code === 'KeyQ' ? DONUS_ADIMI : -DONUS_ADIMI;
          ofset = ((ofset % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          refresh();
        }
        break;
      case 'Escape':
        if (firca) fircaIptal();
        else iptal();
        break;
    }
  };
  // Boşluk, odaktaki bir HTML düğmesini tetiklemesin.
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') e.preventDefault();
  };

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  return {
    refresh() {
      if (firca && !isRoadTool(deps.getTool())) fircaIptal();
      refresh();
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      etiket.remove();
    },
  };
}
