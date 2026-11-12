import { describe, expect, it } from 'vitest';
import {
  circleSamples, circlesOverlap, closestOnPolyline, dist, polylineLength, resample,
} from '../src/logic/geometry';
import { heightAt, isLake, isLand } from '../src/logic/terrain';

describe('geometri', () => {
  it('mesafe', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(-1, -1, -1, -1)).toBe(0);
  });

  it('daire-daire çakışma, boşluk dahil', () => {
    expect(circlesOverlap(0, 0, 1, 2.5, 0, 1, 0.1)).toBe(false);
    expect(circlesOverlap(0, 0, 1, 2.05, 0, 1, 0.1)).toBe(true);
    expect(circlesOverlap(0, 0, 1, 1.5, 0, 1)).toBe(true);
  });

  it('daire örnekleri: merkez + 8 nokta', () => {
    const p = circleSamples(1, 1, 2);
    expect(p).toHaveLength(9);
    expect(p[0]).toEqual({ x: 1, z: 1 });
    for (const q of p.slice(1)) expect(dist(1, 1, q.x, q.z)).toBeCloseTo(2);
  });

  it('çoklu çizgiye en yakın nokta', () => {
    const line = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
    expect(closestOnPolyline(5, 3, line)).toEqual({ x: 5, z: 0, mesafe: 3 });
    expect(closestOnPolyline(12, 5, line)!.mesafe).toBe(2);
    expect(closestOnPolyline(-3, -4, line)!.mesafe).toBe(5);
    expect(closestOnPolyline(0, 0, [])).toBeNull();
  });

  it('yeniden örnekleme yay boyunca eşit aralıklı, uçlar korunur', () => {
    const pts = resample([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }], 0.75);
    expect(pts[0]).toEqual({ x: 0, z: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 3, z: 3 });
    expect(pts).toHaveLength(9);
    for (let i = 1; i < pts.length; i++) {
      expect(dist(pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z)).toBeLessThanOrEqual(0.75 + 1e-9);
    }
    expect(polylineLength(pts)).toBeCloseTo(6);
  });
});

describe('arazi', () => {
  it('göl içinde yükseklik < 0, tepe tepesinde > 1.5, oyun alanı dışı kara değil', () => {
    expect(heightAt(-22, 14)).toBeLessThan(0);
    expect(isLake(-22, 14)).toBe(true);
    expect(heightAt(14, -8)).toBeGreaterThan(1.5);
    expect(heightAt(-16, -20)).toBeGreaterThan(1.5);
    expect(isLand(0, 0)).toBe(true);
    expect(isLand(45, 45)).toBe(false); // yuvarlatılmış köşe
    expect(isLand(60, 0)).toBe(false);
    expect(heightAt(64, -5)).toBeGreaterThan(3); // dış dekoratif tepe: sınır dışında da tanımlı
  });
});
