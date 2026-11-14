import { describe, expect, it } from 'vitest';
import {
  advanceMonument, anlikGoruntu, createGame, demolish, deserialize, endDay, geriAl, geriAlEkle, geriAlinabilir,
  geriAlTemizle, geriAlYigini, placeBuilding, serialize, upgradeBuilding, YIL_GUN, yilNo, yilSonuMu,
} from '../src/logic/game';
import { GERI_AL_SINIR } from '../src/logic/undo';
import { GUNLUK_SINIR, gunlukYaz } from '../src/logic/gunluk';
import type { GameState } from '../src/logic/types';
import { add, blank } from './helpers';

const gorunen = (s: GameState) => (s.gunluk ?? []).filter((k) => !k.gizli);

describe('yıl', () => {
  it('yıl 18 gün; yılın son günü kışın son günü', () => {
    expect(YIL_GUN).toBe(18);
    expect(yilNo(1)).toBe(1);
    expect(yilNo(18)).toBe(1);
    expect(yilNo(19)).toBe(2);
    expect(yilSonuMu(17)).toBe(false);
    expect(yilSonuMu(18)).toBe(true);
    expect(yilSonuMu(36)).toBe(true);
  });
});

describe('kasaba günlüğü', () => {
  it('ilk ev, ilk yemek, nüfus eşiği ve ev seviyesi bir kez, o günün tarihiyle yazılır', () => {
    const s = blank();
    s.gunluk = [];
    for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 0);
    endDay(s); // gün 1
    expect(gorunen(s).map((k) => [k.gun, k.tur])).toEqual([[1, 'ilkEv'], [1, 'hedef']]);
    s.toplamYemek = 5;
    endDay(s); // gün 2
    endDay(s);
    expect(gorunen(s).filter((k) => k.tur === 'ilkEv' || k.tur === 'ilkYemek').map((k) => [k.gun, k.tur]))
      .toEqual([[1, 'ilkEv'], [2, 'ilkYemek']]);

    for (let i = 0; i < 4; i++) add(s, 'ev', 20 + i * 3, 20, 3); // +40 nüfus
    endDay(s);
    expect(gorunen(s).some((k) => k.tur === 'nufus' && k.veri === 50)).toBe(true);
    endDay(s);
    expect(gorunen(s).filter((k) => k.tur === 'nufus')).toHaveLength(1);
  });

  it('kart seçimi, kule aşaması ve kule bitişi eylemde yazılır', () => {
    const s = blank();
    s.gunluk = [];
    s.para = 5000;
    s.stok.tas = 200;
    s.stok.odun = 200;
    s.stok.mobilya = 200;
    const k = add(s, 'saatKulesi', 0, 0);
    k.insaat = 4;
    for (let i = 0; i < 4; i++) advanceMonument(s, k.id);
    expect(gorunen(s).map((x) => [x.tur, x.veri])).toEqual([['kule', 1], ['kule', 2], ['kule', 3], ['kuleTamam', undefined]]);
  });

  it('sınır aşılınca tekrarlanan en eski kayıt düşer, "ilk" kayıtlar kalır', () => {
    const s = blank();
    s.gunluk = [];
    gunlukYaz(s, 'ilkEv');
    for (let i = 0; i < GUNLUK_SINIR + 5; i++) gunlukYaz(s, 'senlik');
    expect(s.gunluk).toHaveLength(GUNLUK_SINIR);
    expect(s.gunluk![0].tur).toBe('ilkEv');
  });

  it('günlüksüz eski kayıt: olmuş anlar gizli işaretlenir, ilk gün sonunda yeniden yazılmaz', () => {
    const s = blank();
    s.gun = 40;
    s.nufus = 120;
    s.toplamYemek = 300;
    add(s, 'ev', 0, 0, 3);
    delete s.gunluk;
    const y = deserialize(serialize(s));
    expect(gorunen(y).map((k) => k.tur)).toEqual(['gunlukBasladi']);
    expect(y.gunluk!.filter((k) => k.gizli).map((k) => k.tur)).toEqual(
      ['ilkEv', 'ilkYemek', 'ilkTuccar', 'ilkKis', 'nufus', 'nufus', 'evSeviye'],
    );
    endDay(y);
    expect(gorunen(y).some((k) => k.tur === 'ilkEv' || k.tur === 'ilkYemek')).toBe(false);
  });
});

describe('Kartonia Postası (yıl sonu gazetesi)', () => {
  it('yılın son günü gazete çıkar: yılın sayıları, manşet, en mutlu ev; sayaçlar yeni yıla sıfırlanır', () => {
    const s = createGame();
    s.binalar = [];
    s.para = 1000;
    s.gunluk = [];
    // Yolsuz test: kural denetimi olmadan ekle, sayaca elle yaz (placeBuilding yol ister).
    for (let i = 0; i < 4; i++) add(s, 'ev', i * 3, 30);
    s.yil = { yil: 1, nufusBasi: 0, kurulanBina: 4, vergi: 0, yemek: 0 };
    let gazete;
    for (let g = 1; g <= YIL_GUN; g++) {
      const r = endDay(s);
      if (g < YIL_GUN) expect(r.gazete).toBeUndefined();
      else gazete = r.gazete;
    }
    expect(gazete).toBeDefined();
    expect(gazete!.yil).toBe(1);
    expect(gazete!.gun).toBe(YIL_GUN);
    expect(gazete!.nufusSon).toBe(12);
    expect(gazete!.kurulanBina).toBe(4);
    expect(gazete!.vergi).toBeGreaterThan(0);
    expect(gazete!.manset?.tur).toBe('ilkKis'); // ilk ev, ilk kış … içinde en büyüğü
    expect(gazete!.enMutluEv?.seviye).toBe(1);
    expect(s.gazeteler).toHaveLength(1);
    expect(s.yil).toBeUndefined();
    expect(gorunen(s).some((k) => k.tur === 'gazete' && k.veri === 1)).toBe(true);
    // Yeni yılın ilk günü sayaç baştan başlar.
    endDay(s);
    expect(s.yil).toMatchObject({ yil: 2, kurulanBina: 0 });
  });

  it('ağaç ve çiçek kurulan bina sayılmaz', () => {
    const s = blank();
    s.para = 1000;
    placeBuilding(s, 'agac', 10, 10, 0);
    expect(s.yil?.kurulanBina ?? 0).toBe(0);
  });
});

describe('geri al', () => {
  it('koy → geri al: para, binalar, istek ilerlemesi birebir eski hal; gün ilerlemesi korunur', () => {
    const s = createGame(42);
    s.para = 500;
    s.istek = { tur: 'agaclandirma', baslangicGun: 1, ilerleme: 2 };
    const y = geriAlYigini();
    const once = serialize(s);
    const anlik = anlikGoruntu(s);
    const b = placeBuilding(s, 'agac', 0, 0, 0);
    expect(b).not.toBeNull();
    geriAlEkle(y, anlik, 'bina', 'agac');
    expect(geriAlinabilir(y)).toBe(true);
    s.gunIlerleme = 0.7;
    const r = geriAl(y, s)!;
    expect(r.kayit).toMatchObject({ tur: 'bina', binaTur: 'agac' });
    expect(r.durum.gunIlerleme).toBe(0.7);
    r.durum.gunIlerleme = JSON.parse(once).durum.gunIlerleme;
    expect(serialize(r.durum)).toBe(once);
    expect(geriAlinabilir(y)).toBe(false);
    expect(geriAl(y, s)).toBeNull();
  });

  it('yıkım ve yükseltme de geri alınır; sırayla (son eylem önce)', () => {
    const s = blank();
    s.para = 1000;
    s.stok.tas = 50;
    const c = add(s, 'cesme', 0, 0);
    const y = geriAlYigini();
    let a = anlikGoruntu(s);
    upgradeBuilding(s, c.id);
    geriAlEkle(y, a, 'yukseltme', 'cesme');
    a = anlikGoruntu(s);
    demolish(s, c.id);
    geriAlEkle(y, a, 'yikim', 'cesme');
    expect(s.binalar).toHaveLength(0);
    let r = geriAl(y, s)!;
    expect(r.durum.binalar[0].seviye).toBe(2);
    r = geriAl(y, r.durum)!;
    expect(r.durum.binalar[0].seviye).toBe(1);
    expect(r.durum.para).toBe(1000);
    expect(r.durum.stok.tas).toBe(50);
  });

  it('en fazla 20 eylem; temizle yığını boşaltır', () => {
    const s = blank();
    const y = geriAlYigini();
    for (let i = 0; i < GERI_AL_SINIR + 5; i++) geriAlEkle(y, anlikGoruntu(s), 'yol');
    expect(y.kayitlar).toHaveLength(GERI_AL_SINIR);
    geriAlTemizle(y);
    expect(geriAlinabilir(y)).toBe(false);
  });
});
