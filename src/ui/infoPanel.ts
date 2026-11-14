// Sağdaki bilgi paneli: haritada seçili bina ya da yol. İçerik binanın türüne göre değişir:
//   ev      → nüfus / mutluluk / vergi kutucukları, büyüme durumu, bu seviyenin ve sonraki seviyenin ihtiyaçları
//   üretim  → durum (çalışıyor, girdi yok, depo dolu…), girdi → çıktı akışı, işçi ve bonus
//   hizmet  → etki alanı, kapsadığı evler, sağladığı ihtiyaç, yükseltme
//   anıt    → inşaat aşaması ve malzeme gönderme;  doğa → kesme / sökme
import type { BuildingInfo, BuildingType, Good, Need, RoadInfo, UretimSorunu } from '../logic/types';
import { BALANCE, BUILDINGS, HOUSE_LEVELS, ROADS } from '../data/buildings';
import { el, panelAc, panelKapat, tr } from './dom';
import { IHTIYAC_IKON, MAL_IKON } from './ikonlar';
import {
  binaAciklama, binaAd, bonusMetni, bonusSarti, evSeviyeAd, ihtiyacAd, malAdKucuk, t, yolAciklama, yolAd, type Anahtar,
} from './i18n';

function yuvarla(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export interface InfoPanel {
  /**
   * null → gizle. `para` ve `stok` düğmelerin etkinliği için; `sorun` binanın son gün sonundaki üretim sorunu.
   */
  show(info: BuildingInfo | null, para?: number, stok?: Partial<Record<Good, number>>, sorun?: UretimSorunu['neden']): void;
  showRoad(info: RoadInfo): void;
}

type Durum = { ikon: string; metin: string; tur: 'iyi' | 'uyari' | 'kotu' | 'notr' };

const KARAKTER_IKON = { carsi: '🧺', bahceli: '🌳', zanaat: '🔨' } as const;

export function createInfoPanel(
  root: HTMLElement,
  onDemolish: (id: number) => void,
  onDemolishRoad: (id: number) => void,
  onClose: () => void,
  onUpgrade: (id: number) => void,
  /** Yükselt düğmesinin üstündeyken yeni etki halkasını göstermek için (r null → mevcut halkaya dön). */
  onUpgradeHover: (id: number, r: number | null) => void,
  /** Anıt: "Malzeme gönder" (sıradaki aşama). */
  onAdvanceMonument: (id: number) => void,
  /** Binanın küçük resmi (yoksa null). */
  binaResmi: (t: BuildingType) => string | null = () => null,
  /** Meydan: mahalle karakteri seç. */
  onCharacter: (id: number, k: 'carsi' | 'bahceli' | 'zanaat') => void = () => {},
): InfoPanel {
  const box = el('div', 'kagit');
  box.id = 'bilgi';
  root.appendChild(box);

  const gunluk = (n: number): string => `${tr(n)} ${t('genel.gun')}`;

  /** Başlık: resim, ad, alt yazı; altında isteğe bağlı durum çipi. */
  function bas(baslik: string, alt: string, resim: string | null, durum?: Durum | null): void {
    box.replaceChildren();
    const kapat = el('button', 'kapat', '×');
    kapat.title = t('genel.kapatEsc');
    kapat.addEventListener('click', onClose);
    const ust = el('div', 'ust');
    if (resim) {
      const img = el('img', 'resim');
      img.src = resim;
      img.alt = '';
      img.draggable = false;
      ust.appendChild(img);
    }
    const ad = el('div', 'ad');
    ad.append(el('h3', '', baslik), el('div', 'alt', alt));
    ust.appendChild(ad);
    box.append(kapat, ust);
    if (durum) {
      const c = el('div', `durum ${durum.tur}`);
      c.append(el('span', 'ikon', durum.ikon), el('span', '', durum.metin));
      box.appendChild(c);
    }
    panelAc(box);
  }

  function bolum(baslik: string): void {
    box.appendChild(el('h4', '', baslik));
  }

  function tablo(): HTMLTableElement {
    const tb = el('table');
    box.appendChild(tb);
    return tb;
  }

  function satir(tb: HTMLTableElement, a: string, v: string, sinif = ''): void {
    const r = el('tr', sinif);
    r.append(el('td', '', a), el('td', '', v));
    tb.appendChild(r);
  }

  /** Büyük sayı kutucukları (ev, hizmet). */
  function kutucuklar(liste: { ikon: string; deger: string; etiket: string }[]): void {
    const k = el('div', 'kutucuklar');
    for (const o of liste) {
      const d = el('div', 'kutucuk');
      d.append(el('div', 'deger', `${o.ikon} ${o.deger}`), el('div', 'etiket', o.etiket));
      k.appendChild(d);
    }
    box.appendChild(k);
  }

  function ihtiyacCipleri(liste: { ihtiyac: Need; karsilandi: boolean }[]): void {
    const w = el('div', 'cipler');
    for (const n of liste) {
      const c = el('span', `cip ${n.karsilandi ? 'ok' : 'yok'}`);
      c.append(el('span', 'ikon', IHTIYAC_IKON[n.ihtiyac]), el('span', '', ihtiyacAd(n.ihtiyac)), el('span', 'isaret', n.karsilandi ? '✓' : '✗'));
      w.appendChild(c);
    }
    box.appendChild(w);
  }

  function bonusSatiri(tb: HTMLTableElement, info: BuildingInfo): void {
    if (!info.komsuluk || info.komsuluk.length === 0) return;
    const aktif = info.komsuluk.filter((k) => k.aktif);
    // Bonus yoksa şartı göster: oyuncu neyi kaçırdığını görsün.
    const metin = aktif.length > 0
      ? aktif.map(bonusMetni).join(', ')
      : `${t('genel.yok')} (${info.komsuluk.map(bonusSarti).join('; ')})`;
    satir(tb, t('bilgi.bonus'), metin, aktif.length > 0 ? 'arti' : '');
  }

  // ---- Türler ----

  function ev(info: BuildingInfo): void {
    const g = info.evGun;
    const enUst = info.seviye >= HOUSE_LEVELS.length;
    let durum: Durum | null = null;
    if (g && g.kotu > 0) durum = { ikon: '📉', metin: t('bilgi.durumKuculuyor', { n: g.kotu, esik: g.kuculmeEsik }), tur: 'kotu' };
    else if (info.mutsuz) durum = { ikon: '😟', metin: t('bilgi.durumMutsuz'), tur: 'uyari' };
    else if (g && g.iyi > 0 && !enUst) durum = { ikon: '📈', metin: t('bilgi.durumBuyuyor', { n: g.iyi, esik: g.buyumeEsik }), tur: 'iyi' };
    else if (enUst) durum = { ikon: '⭐', metin: t('bilgi.durumEnUst'), tur: 'notr' };
    bas(evSeviyeAd(info.seviye) || binaAd(info.type), t('bilgi.seviyeAlt', { n: info.seviye, max: HOUSE_LEVELS.length }), binaResmi('ev'), durum);
    kutucuklar([
      { ikon: '👥', deger: String(info.nufus ?? 0), etiket: t('bilgi.nufus') },
      { ikon: '🙂', deger: String(Math.round(info.mutluluk ?? 0)), etiket: t('bilgi.mutluluk') },
      { ikon: '💰', deger: `+${info.tahminiVergi ?? 0}`, etiket: t('bilgi.vergiGun') },
    ]);
    if (info.mutsuz) box.appendChild(el('div', 'not', t('bilgi.mutsuzNot', { esik: BALANCE.buyumeMutluluk })));
    const tb = tablo();
    satir(tb, t('bilgi.yol'), info.yol ? yolAd(info.yol) : t('genel.yok'));
    bonusSatiri(tb, info);
    if (info.mahalle) satir(tb, t('meydan.mahalle'), `${KARAKTER_IKON[info.mahalle]} ${t(`meydan.${info.mahalle}.ad` as Anahtar)}`, 'arti');

    const st = info.ihtiyaclar ?? [];
    const mevcut = new Set<Need>(HOUSE_LEVELS[info.seviye - 1]?.ihtiyaclar ?? []);
    const buSeviye = st.filter((n) => mevcut.has(n.ihtiyac));
    if (buSeviye.length > 0) {
      bolum(t('bilgi.buSeviye'));
      ihtiyacCipleri(buSeviye);
    }
    const sonraki = HOUSE_LEVELS[info.seviye];
    if (sonraki) {
      // Yalnızca üst seviyede yeni gelen ihtiyaçlar (mevcut olanlar yukarıda).
      bolum(t('bilgi.buyumekIcin', { ad: evSeviyeAd(sonraki.seviye), kisi: sonraki.nufus }));
      const yeni = st.filter((n) => !mevcut.has(n.ihtiyac));
      if (yeni.length > 0) ihtiyacCipleri(yeni);
      else box.appendChild(el('div', 'not', t('bilgi.buyumekIcinAyni')));
    }
  }

  function uretimDurumu(info: BuildingInfo, sorun?: UretimSorunu['neden']): Durum {
    if (info.kisinDurdu) return { ikon: '❄️', metin: t('bilgi.kisinDurdu'), tur: 'notr' };
    if (sorun === 'depo') return { ikon: '📦', metin: t('bilgi.durumDepo'), tur: 'uyari' };
    if (sorun === 'agac') return { ikon: '🌳', metin: t('bilgi.durumAgacYok'), tur: 'kotu' };
    if (sorun) return { ikon: MAL_IKON[sorun], metin: t('bilgi.durumGirdiYok', { mal: malAdKucuk(sorun) }), tur: 'kotu' };
    if ((info.isciOrani ?? 1) < 1) return { ikon: '👷', metin: t('bilgi.durumIsci', { n: Math.round((info.isciOrani ?? 1) * 100) }), tur: 'uyari' };
    return { ikon: '✓', metin: t('bilgi.durumCalisiyor'), tur: 'iyi' };
  }

  function uretim(info: BuildingInfo, sorun?: UretimSorunu['neden']): void {
    bas(binaAd(info.type), binaAciklama(info.type), binaResmi(info.type), uretimDurumu(info, sorun));
    const u = info.uretimTahmini;
    if (u) {
      bolum(t('bilgi.gunlukUretim'));
      const akis = el('div', 'akis');
      const parca = (mal: Good, miktar: number, eksik = false): HTMLSpanElement => {
        const p = el('span', `mal${eksik ? ' eksik' : ''}`);
        p.title = malAdKucuk(mal);
        p.append(el('span', 'ikon', MAL_IKON[mal]), el('span', '', yuvarla(miktar)));
        return p;
      };
      for (const g of u.girdi) akis.appendChild(parca(g.mal, g.miktar, g.stok < g.miktar - 1e-9));
      if (u.girdi.length > 0) akis.appendChild(el('span', 'ok', '→'));
      for (const c of u.cikti) akis.appendChild(parca(c.mal, c.miktar));
      box.appendChild(akis);
      const eksik = u.girdi.filter((g) => g.stok < g.miktar - 1e-9);
      if (eksik.length > 0) box.appendChild(el('div', 'not uyari', t('bilgi.girdiAz', { liste: eksik.map((g) => malAdKucuk(g.mal)).join(', ') })));
    }
    const tb = tablo();
    if (info.isciOrani !== undefined) satir(tb, t('bilgi.isci'), t('bilgi.yuzde', { n: Math.round(info.isciOrani * 100) }), info.isciOrani < 1 ? 'eksi' : '');
    if (info.agacSayisi !== undefined) satir(tb, t('bilgi.agac'), String(info.agacSayisi));
    bonusSatiri(tb, info);
    if (info.mahalle) satir(tb, t('meydan.mahalle'), `${KARAKTER_IKON[info.mahalle]} ${t(`meydan.${info.mahalle}.ad` as Anahtar)}`, 'arti');
    if (info.mevsimCarpani !== undefined) {
      satir(tb, t('bilgi.mevsimEtkisi'), t('bilgi.yuzdeArti', { n: Math.round((info.mevsimCarpani - 1) * 100) }), 'arti');
    }
    if (info.etki > 0) satir(tb, t('bilgi.etki'), yuvarla(info.etki));
    if (info.kapsananEv !== undefined && BUILDINGS[info.type].mutluluk < 0) {
      satir(tb, t('bilgi.gurultuEv'), String(info.kapsananEv), info.kapsananEv > 0 ? 'eksi' : '');
    }
    satir(tb, t('bilgi.gider'), info.gider > 0 ? gunluk(info.gider) : t('genel.yok'));
  }

  function hizmet(info: BuildingInfo): void {
    const d = BUILDINGS[info.type];
    bas(binaAd(info.type), binaAciklama(info.type), binaResmi(info.type));
    const k: { ikon: string; deger: string; etiket: string }[] = [];
    if (info.etki > 0) k.push({ ikon: '📏', deger: yuvarla(info.etki), etiket: t('bilgi.etki') });
    if (info.kapsananEv !== undefined) k.push({ ikon: '🏠', deger: String(info.kapsananEv), etiket: t('bilgi.kapsananEv') });
    k.push({ ikon: '💸', deger: info.gider > 0 ? `−${info.gider}` : '0', etiket: t('bilgi.giderGun') });
    kutucuklar(k);
    const tb = tablo();
    if (d.saglar) satir(tb, t('bilgi.sagladigi'), `${IHTIYAC_IKON[d.saglar]} ${ihtiyacAd(d.saglar)}`);
    if (d.yemekSatar && d.saglar !== 'yemek') satir(tb, t('bilgi.sagladigi'), `${IHTIYAC_IKON.yemek} ${ihtiyacAd('yemek')}`);
    if (d.mutluluk !== 0) satir(tb, t('bilgi.mutluluk'), `${d.mutluluk > 0 ? '+' : '−'}${Math.abs(d.mutluluk)}`, d.mutluluk > 0 ? 'arti' : 'eksi');
    if (d.depo) satir(tb, t('menu.stokSiniri'), `+${d.depo}`);
    if (d.yukseltilebilir) satir(tb, t('bilgi.seviye'), `${info.seviye} / 3`);
    bonusSatiri(tb, info);
    if (info.mahalle) satir(tb, t('meydan.mahalle'), `${KARAKTER_IKON[info.mahalle]} ${t(`meydan.${info.mahalle}.ad` as Anahtar)}`, 'arti');
  }

  /** Meydan: karakter, kapsadığı binalar ve üç karakter düğmesi (seçili olan işaretli). */
  function meydan(info: BuildingInfo, para: number): void {
    const m = info.meydan!;
    const durum: Durum | null = m.karakter
      ? { ikon: KARAKTER_IKON[m.karakter], metin: t(`meydan.${m.karakter}.ad` as Anahtar), tur: 'iyi' }
      : { ikon: '❔', metin: t('meydan.secilmedi'), tur: 'uyari' };
    bas(binaAd(info.type), binaAciklama(info.type), binaResmi(info.type), durum);
    const tb = tablo();
    satir(tb, t('bilgi.etki'), yuvarla(info.etki));
    satir(tb, t('meydan.kapsanan'), String(m.kapsananBina));
    bolum(m.karakter ? t('meydan.degistir', { para: m.degisim }) : t('meydan.sec'));
    for (const k of ['carsi', 'bahceli', 'zanaat'] as const) {
      const secili = m.karakter === k;
      const d = el('button', `dugme karakter${secili ? ' secili' : ''}`);
      d.append(el('span', 'ad', `${KARAKTER_IKON[k]} ${t(`meydan.${k}.ad` as Anahtar)}`), el('span', 'alt', t(`meydan.${k}.etki` as Anahtar)));
      d.disabled = secili || (m.degisim > 0 && para < m.degisim);
      d.addEventListener('click', () => onCharacter(info.id, k));
      box.appendChild(d);
    }
  }

  function anit(info: BuildingInfo, para: number, stok: Partial<Record<Good, number>>): void {
    bas(binaAd(info.type), binaAciklama(info.type), binaResmi(info.type));
    const a = info.anit!;
    const tb = tablo();
    satir(tb, t('bilgi.insaat'), a.sonraki ? `${a.asama} / ${a.toplam}` : t('bilgi.tamamlandi'));
    if (info.etki > 0) satir(tb, t('bilgi.etki'), yuvarla(info.etki));
    if (info.kapsananEv !== undefined && !a.sonraki) satir(tb, t('bilgi.kapsananEv'), String(info.kapsananEv));
    satir(tb, t('bilgi.gider'), info.gider > 0 ? gunluk(info.gider) : t('genel.yok'));
    if (!a.sonraki) return;
    const n = a.sonraki;
    const mallar = Object.entries(n.mal) as [Good, number][];
    const fiyat = [`🪙 ${n.para}`, ...mallar.map(([g, m]) => `${MAL_IKON[g]} ${m}`)].join(' · ');
    box.appendChild(el('div', 'not', t('bilgi.anitNot')));
    const gb = el('button', 'dugme birincil', t('bilgi.malzemeGonder', { fiyat }));
    if (a.asama <= 3) gb.title = t('bilgi.siradakiAsama', { asama: t(`bilgi.asama${a.asama}` as Anahtar) });
    const eksik = mallar.filter(([g, m]) => (stok[g] ?? Infinity) < m).map(([g]) => malAdKucuk(g));
    if (para < n.para || eksik.length > 0) gb.disabled = true;
    if (para < n.para) box.appendChild(el('div', 'not uyari', t('bilgi.paraYetmiyor')));
    if (eksik.length > 0) box.appendChild(el('div', 'not uyari', t('bilgi.yetmiyor', { liste: eksik.join(', ') })));
    gb.addEventListener('click', () => onAdvanceMonument(info.id));
    box.appendChild(gb);
  }

  function yukseltme(info: BuildingInfo, para: number, tas: number): void {
    if (info.yukseltme === undefined) return;
    const y = info.yukseltme;
    if (y === null) {
      box.appendChild(el('div', 'not', t('bilgi.enUst')));
      return;
    }
    const fiyat = `🪙 ${y.maliyet}${y.tas > 0 ? ` · 🪨 ${y.tas}` : ''}`;
    const ub = el('button', 'dugme birincil', t('bilgi.yukselt', { fiyat }));
    ub.title = t('bilgi.yukseltIpucu', {
      eskiEtki: yuvarla(info.etki), yeniEtki: yuvarla(y.etki), eskiGider: info.gider, yeniGider: y.gider,
    });
    box.appendChild(el('div', 'not', t('bilgi.sonrakiSeviye', { etki: yuvarla(y.etki), gider: y.gider })));
    if (para < y.maliyet || tas < y.tas) ub.disabled = true;
    if (tas < y.tas) box.appendChild(el('div', 'not uyari', t('bilgi.tasYetmiyor')));
    ub.addEventListener('click', () => onUpgrade(info.id));
    ub.addEventListener('mouseenter', () => onUpgradeHover(info.id, y.etki));
    ub.addEventListener('mouseleave', () => onUpgradeHover(info.id, null));
    box.appendChild(ub);
  }

  return {
    show(info, para = Infinity, stok = {}, sorun) {
      if (!info) {
        panelKapat(box);
        return;
      }
      const d = BUILDINGS[info.type];
      if (info.dogal) {
        const cicek = info.type === 'cicek';
        bas(t(cicek ? 'bilgi.kirCicegi' : 'bilgi.ormanAgaci'), t(cicek ? 'bilgi.kirCicegiMetin' : 'bilgi.ormanAgaciMetin'), binaResmi(info.type));
      } else if (info.type === 'ev') ev(info);
      else if (info.anit) anit(info, para, stok);
      else if (info.meydan) meydan(info, para);
      else if (info.isciOrani !== undefined) uretim(info, sorun);
      else if (info.type === 'agac' || info.type === 'cicek') {
        bas(binaAd(info.type), binaAciklama(info.type), binaResmi(info.type));
        const tb = tablo();
        satir(tb, t('bilgi.etki'), yuvarla(info.etki));
        satir(tb, t('bilgi.mutluluk'), `+${d.mutluluk}`, 'arti');
      } else hizmet(info);

      yukseltme(info, para, stok.tas ?? Infinity);

      const yik = info.dogal
        ? el('button', 'dugme tehlike', info.type === 'cicek' ? t('bilgi.cicekSok') : t('bilgi.agacKes', { para: info.kesimMaliyeti ?? 0, odun: info.kesimOdun ?? 0 }))
        : el('button', 'dugme tehlike', t('bilgi.yik', { iade: info.yikimIadesi }));
      yik.addEventListener('click', () => onDemolish(info.id));
      box.appendChild(yik);
    },

    showRoad(info) {
      const d = ROADS[info.tur];
      bas(yolAd(info.tur), yolAciklama(info.tur), null);
      const tb = tablo();
      satir(tb, t('bilgi.uzunluk'), info.uzunluk.toFixed(1));
      satir(tb, t('bilgi.gider'), info.gider > 0 ? gunluk(info.gider) : t('genel.yok'));
      if (d.mutluluk !== 0) satir(tb, t('bilgi.kenardakiEvler'), t('bilgi.mutlulukArti', { n: d.mutluluk }), 'arti');
      const yik = el('button', 'dugme tehlike', t('bilgi.yik', { iade: info.yikimIadesi }));
      if (info.silinebilir) {
        yik.addEventListener('click', () => onDemolishRoad(info.id));
      } else {
        yik.disabled = true;
        yik.title = t('bilgi.yolBagli');
        box.appendChild(el('div', 'not uyari', t('bilgi.yolBagliUzun')));
      }
      box.appendChild(yik);
    },
  };
}
