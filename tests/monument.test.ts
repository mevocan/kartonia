import { describe, expect, it } from 'vitest';
import { BALANCE, BUILDINGS } from '../src/data/buildings';
import {
  advanceMonument, buildingUpkeep, canAdvanceMonument, demolish, deserialize, effectRadius, getBuildingInfo,
  monumentStage, placeBuilding, serialize,
} from '../src/logic/game';
import { evaluateNeeds, houseHappiness } from '../src/logic/economy';
import { checkGoals, KASABA_TAMAM_HEDEFI } from '../src/logic/goals';
import type { GameState } from '../src/logic/types';
import { add, addRoad, blank } from './helpers';

/** Yol kenarına konmuş, 110 nüfuslu kasabada yerleştirilmiş kule. */
function kuleKur(): { s: GameState; id: number } {
  const s = blank();
  s.nufus = 110;
  s.para = 10000;
  addRoad(s, 'toprak', [{ x: -5, z: 2.6 }, { x: 5, z: 2.6 }]);
  const b = placeBuilding(s, 'saatKulesi', 0, 0, 0);
  if (!b) throw new Error('kule konamadı');
  return { s, id: b.id };
}

/** Bütün aşamalar için bol mal. */
function malDoldur(s: GameState): void {
  s.stok.tas = 100;
  s.stok.odun = 100;
  s.stok.mobilya = 100;
}

describe('anıt: aşama maliyetleri', () => {
  it('yerleştirme 100 para, iskeleyle 4 aşama kalır', () => {
    expect(BUILDINGS.saatKulesi.maliyet).toBe(100);
    expect(BALANCE.anit.asamalar.map((a) => a.para)).toEqual([100, 100, 150, 200]);
    const { s, id } = kuleKur();
    const b = s.binalar.find((x) => x.id === id)!;
    expect(s.para).toBe(10000 - 100);
    expect(b.insaat).toBe(4);
    expect(monumentStage(b)).toBe(0);
  });

  it('her aşama parasını ve malını düşer; 4. aşamadan sonra tamam (insaat alanı kalkar)', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    const b = s.binalar.find((x) => x.id === id)!;
    expect(advanceMonument(s, id)).toBe(100);
    expect(s.stok.tas).toBe(80);
    expect(advanceMonument(s, id)).toBe(100);
    expect(s.stok.odun).toBe(70);
    expect(advanceMonument(s, id)).toBe(150);
    expect(s.stok.mobilya).toBe(80);
    expect(monumentStage(b)).toBe(3);
    expect(advanceMonument(s, id)).toBe(200);
    expect(s.stok.tas).toBe(50);
    expect(s.stok.mobilya).toBe(60);
    expect('insaat' in b).toBe(false);
    expect(monumentStage(b)).toBe(4);
    expect(s.para).toBe(10000 - 100 - 100 - 100 - 150 - 200);
    expect(canAdvanceMonument(s, id).sebep).toBe('kilitli'); // tamam
    expect(advanceMonument(s, id)).toBeNull();
  });

  it('para ya da mal yetmezse nedenini verir ve hiçbir şey düşmez', () => {
    const { s, id } = kuleKur();
    expect(canAdvanceMonument(s, id).sebep).toBe('tas');
    s.stok.tas = 20;
    s.para = 50;
    expect(canAdvanceMonument(s, id).sebep).toBe('para');
    expect(advanceMonument(s, id)).toBeNull();
    expect(s.stok.tas).toBe(20);
    s.para = 1000;
    expect(advanceMonument(s, id)).toBe(100);
    expect(canAdvanceMonument(s, id).sebep).toBe('odun');
    s.stok.odun = 30;
    advanceMonument(s, id);
    expect(canAdvanceMonument(s, id).sebep).toBe('mobilya');
  });

  it('anıt olmayan binada ilerletme yok', () => {
    const s = blank();
    const c = add(s, 'cesme', 0, 0);
    expect(canAdvanceMonument(s, c.id).sebep).toBe('kilitli');
    expect(getBuildingInfo(s, c.id)!.anit).toBeUndefined();
  });
});

describe('anıt: yarım kule', () => {
  it('aura, etki ve gider yalnızca tamamlanınca', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    const kule = s.binalar.find((x) => x.id === id)!;
    const h = add(s, 'ev', 6, 0);
    const m = () => houseHappiness(s, h, evaluateNeeds(s, h));
    const taban = m();
    expect(effectRadius(kule)).toBe(0);
    expect(buildingUpkeep(kule)).toBe(0);
    for (let i = 0; i < 3; i++) advanceMonument(s, id);
    expect(m()).toBe(taban); // 3 / 4: hâlâ aura yok
    advanceMonument(s, id);
    expect(m()).toBe(taban + BUILDINGS.saatKulesi.mutluluk);
    expect(effectRadius(kule)).toBe(BUILDINGS.saatKulesi.etki);
    expect(buildingUpkeep(kule)).toBe(BUILDINGS.saatKulesi.gider);
  });

  it('yarım kule "Kasaba tamamlandı" hedefini tamamlamaz', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    s.hedef = KASABA_TAMAM_HEDEFI;
    s.nufus = 200;
    for (let i = 0; i < 3; i++) advanceMonument(s, id);
    expect(checkGoals(s)).toEqual([]);
    advanceMonument(s, id);
    expect(checkGoals(s)).toContain(KASABA_TAMAM_HEDEFI);
  });

  it('bilgi paneli aşama ilerlemesini ve sıradaki maliyeti verir', () => {
    const { s, id } = kuleKur();
    expect(getBuildingInfo(s, id)!.anit).toEqual({ asama: 0, toplam: 4, sonraki: { para: 100, mal: { tas: 20 } } });
    malDoldur(s);
    advanceMonument(s, id);
    advanceMonument(s, id);
    expect(getBuildingInfo(s, id)!.anit).toEqual({ asama: 2, toplam: 4, sonraki: { para: 150, mal: { mobilya: 20 } } });
    expect(getBuildingInfo(s, id)!.etki).toBe(0);
    advanceMonument(s, id);
    advanceMonument(s, id);
    expect(getBuildingInfo(s, id)!.anit).toEqual({ asama: 4, toplam: 4, sonraki: null });
  });
});

describe('anıt: kayıt ve yıkım', () => {
  it('eski kayıttaki kule (insaat alanı yok) tamam sayılır', () => {
    const s = blank();
    const k = add(s, 'saatKulesi', 0, 0); // eski kayıt biçimi
    const y = deserialize(serialize(s));
    const kule = y.binalar.find((b) => b.id === k.id)!;
    expect(monumentStage(kule)).toBe(4);
    expect(effectRadius(kule)).toBe(BUILDINGS.saatKulesi.etki);
  });

  it('yarım kule kayıtta aşamasını korur', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    advanceMonument(s, id);
    const y = deserialize(serialize(s));
    expect(monumentStage(y.binalar.find((b) => b.id === id)!)).toBe(1);
  });

  it('yıkımda harcanan paranın yarısı döner, mallar dönmez', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    advanceMonument(s, id); // 100
    advanceMonument(s, id); // 100
    const para = s.para;
    const stok = { ...s.stok };
    expect(getBuildingInfo(s, id)!.yikimIadesi).toBe((100 + 100 + 100) / 2);
    expect(demolish(s, id)).toBe(150);
    expect(s.para).toBe(para + 150);
    expect(s.stok).toEqual(stok);
  });

  it('tamamlanmış kulenin iadesi: (100 + 550) / 2', () => {
    const { s, id } = kuleKur();
    malDoldur(s);
    for (let i = 0; i < 4; i++) advanceMonument(s, id);
    expect(getBuildingInfo(s, id)!.yikimIadesi).toBe(325);
  });
});
