import { createGame } from '../src/logic/game';
import type { Building, BuildingType, GameState, Road, RoadType, Vec2 } from '../src/logic/types';

/** Kural kontrolü yapmadan doğrudan bina ekler (test kurulumu için). */
export function add(s: GameState, type: BuildingType, x: number, z: number, seviye = 1): Building {
  const b: Building = { id: s.sonrakiId++, type, x, z, rot: 0, seviye, iyiGun: 0, kotuGun: 0 };
  s.binalar.push(b);
  return b;
}

/** Kural kontrolü yapmadan doğrudan yol ekler. */
export function addRoad(s: GameState, tur: RoadType, noktalar: Vec2[]): Road {
  const r: Road = { id: s.sonrakiId++, tur, noktalar };
  s.yollar.push(r);
  return r;
}

/** Ağaçsız ve yolsuz başlangıç durumu (ekonomi testleri için). */
export function blank(): GameState {
  const s = createGame();
  s.binalar = [];
  s.yollar = [];
  return s;
}
