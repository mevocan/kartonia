// Sağdaki kağıt not kartı: seçili binanın ya da yolun bilgileri.
import type { BuildingInfo, Good, Need, RoadInfo } from '../logic/types';
import { BUILDINGS, HOUSE_LEVELS, ROADS } from '../data/buildings';
import { el } from './dom';
import {
  binaAciklama, binaAd, bonusMetni, bonusSarti, evSeviyeAd, ihtiyacAd, malAdKucuk, t, yolAciklama, yolAd, type Anahtar,
} from './i18n';

function yuvarla(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export interface InfoPanel {
  /** null → gizle. `para` yükseltme düğmesinin etkinliği için. */
  show(info: BuildingInfo | null, para?: number, stok?: Partial<Record<Good, number>>): void;
  showRoad(info: RoadInfo): void;
}

const MAL_IKON: Record<Good, string> = {
  bugday: '🌾', un: '🥣', yemek: '🍽️', odun: '🪵', tas: '🪨', mobilya: '🪑', yun: '🧶', kumas: '🧵', bal: '🍯',
};

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
): InfoPanel {
  const box = el('div', 'kagit raptiye');
  box.id = 'bilgi';
  root.appendChild(box);

  const gunluk = (n: number): string => `${n} ${t('genel.gun')}`;

  function bas(baslik: string, alt: string): HTMLTableElement {
    box.replaceChildren();
    const kapat = el('button', 'kapat', '×');
    kapat.title = t('genel.kapatEsc');
    kapat.addEventListener('click', onClose);
    box.append(kapat, el('h3', '', baslik), el('div', 'alt', alt));
    const tablo = el('table');
    box.appendChild(tablo);
    box.style.display = 'block';
    return tablo;
  }

  function satir(tablo: HTMLTableElement, a: string, v: string): void {
    const tr = el('tr');
    tr.append(el('td', '', a), el('td', '', v));
    tablo.appendChild(tr);
  }

  return {
    show(info, para = Infinity, stok = {}) {
      const tas = stok.tas ?? Infinity;
      if (!info) {
        box.style.display = 'none';
        return;
      }
      const d = BUILDINGS[info.type];
      const ev = info.type === 'ev';
      const tablo = info.dogal
        ? bas(t('bilgi.ormanAgaci'), t('bilgi.ormanAgaciMetin'))
        : bas(
          ev ? evSeviyeAd(info.seviye) || binaAd(info.type) : binaAd(info.type),
          ev ? t('bilgi.seviyeAlt', { n: info.seviye, max: HOUSE_LEVELS.length }) : binaAciklama(info.type),
        );

      if (info.nufus !== undefined) satir(tablo, t('bilgi.nufus'), String(info.nufus));
      if (info.mutluluk !== undefined) satir(tablo, t('bilgi.mutluluk'), String(Math.round(info.mutluluk)));
      if (info.tahminiVergi !== undefined) satir(tablo, t('bilgi.tahminiVergi'), gunluk(info.tahminiVergi));
      if (ev) satir(tablo, t('bilgi.yol'), info.yol ? yolAd(info.yol) : t('genel.yok'));
      if (info.isciOrani !== undefined) satir(tablo, t('bilgi.isci'), t('bilgi.yuzde', { n: Math.round(info.isciOrani * 100) }));
      if (info.kisinDurdu) satir(tablo, t('bilgi.uretim'), t('bilgi.kisinDurdu'));
      if (info.agacSayisi !== undefined) satir(tablo, t('bilgi.agac'), String(info.agacSayisi));
      if (info.etki > 0) satir(tablo, t('bilgi.etki'), yuvarla(info.etki));
      satir(tablo, t('bilgi.gider'), info.gider > 0 ? gunluk(info.gider) : t('genel.yok'));
      if (d.yukseltilebilir) satir(tablo, t('bilgi.seviye'), `${info.seviye} / 3`);
      if (info.komsuluk && info.komsuluk.length > 0) {
        const aktif = info.komsuluk.filter((k) => k.aktif);
        // Bonus yoksa şartı göster: oyuncu neyi kaçırdığını görsün.
        const metin = aktif.length > 0
          ? aktif.map(bonusMetni).join(', ')
          : `${t('genel.yok')} (${info.komsuluk.map(bonusSarti).join('; ')})`;
        satir(tablo, t('bilgi.bonus'), metin);
      }

      if (info.ihtiyaclar && info.ihtiyaclar.length > 0) {
        const mevcut = new Set<Need>(HOUSE_LEVELS[info.seviye - 1]?.ihtiyaclar ?? []);
        box.appendChild(el('h4', '', t('bilgi.ihtiyaclar')));
        const ul = el('ul');
        for (const n of info.ihtiyaclar) {
          const li = el('li', n.karsilandi ? 'ok' : 'yok', `${n.karsilandi ? '✓' : '✗'} ${ihtiyacAd(n.ihtiyac)} `);
          if (!mevcut.has(n.ihtiyac)) li.appendChild(el('span', 'ust', t('bilgi.ustSeviye')));
          ul.appendChild(li);
        }
        box.appendChild(ul);
      }

      if (info.anit) {
        const a = info.anit;
        satir(tablo, t('bilgi.insaat'), a.sonraki ? `${a.asama} / ${a.toplam}` : t('bilgi.tamamlandi'));
        if (a.sonraki) {
          const n = a.sonraki;
          const mallar = (Object.entries(n.mal) as [Good, number][]);
          const fiyat = [`🪙 ${n.para}`, ...mallar.map(([g, m]) => `${MAL_IKON[g]} ${m}`)].join(' · ');
          box.appendChild(el('div', 'alt', t('bilgi.anitNot')));
          const gb = el('button', 'dugme', t('bilgi.malzemeGonder', { fiyat }));
          if (a.asama <= 3) gb.title = t('bilgi.siradakiAsama', { asama: t(`bilgi.asama${a.asama}` as Anahtar) });
          const eksik = mallar.filter(([g, m]) => (stok[g] ?? Infinity) < m).map(([g]) => malAdKucuk(g));
          if (para < n.para || eksik.length > 0) gb.disabled = true;
          if (para < n.para) box.appendChild(el('div', 'alt', t('bilgi.paraYetmiyor')));
          if (eksik.length > 0) box.appendChild(el('div', 'alt', t('bilgi.yetmiyor', { liste: eksik.join(', ') })));
          gb.addEventListener('click', () => onAdvanceMonument(info.id));
          box.appendChild(gb);
        }
      }

      if (info.yukseltme !== undefined) {
        const y = info.yukseltme;
        if (y === null) {
          box.appendChild(el('h4', '', t('bilgi.enUst')));
        } else {
          const fiyat = `🪙 ${y.maliyet}${y.tas > 0 ? ` · 🪨 ${y.tas}` : ''}`;
          const ub = el('button', 'dugme', t('bilgi.yukselt', { fiyat }));
          ub.title = t('bilgi.yukseltIpucu', {
            eskiEtki: yuvarla(info.etki), yeniEtki: yuvarla(y.etki), eskiGider: info.gider, yeniGider: y.gider,
          });
          box.appendChild(el('div', 'alt', t('bilgi.sonrakiSeviye', { etki: yuvarla(y.etki), gider: y.gider })));
          if (para < y.maliyet || tas < y.tas) ub.disabled = true;
          if (tas < y.tas) box.appendChild(el('div', 'alt', t('bilgi.tasYetmiyor')));
          ub.addEventListener('click', () => onUpgrade(info.id));
          ub.addEventListener('mouseenter', () => onUpgradeHover(info.id, y.etki));
          ub.addEventListener('mouseleave', () => onUpgradeHover(info.id, null));
          box.appendChild(ub);
        }
      }

      const yik = info.dogal
        ? el('button', 'dugme tehlike', t('bilgi.agacKes', { para: info.kesimMaliyeti ?? 0, odun: info.kesimOdun ?? 0 }))
        : el('button', 'dugme tehlike', t('bilgi.yik', { iade: info.yikimIadesi }));
      yik.addEventListener('click', () => onDemolish(info.id));
      box.appendChild(yik);
    },

    showRoad(info) {
      const d = ROADS[info.tur];
      const tablo = bas(yolAd(info.tur), yolAciklama(info.tur));
      satir(tablo, t('bilgi.uzunluk'), info.uzunluk.toFixed(1));
      satir(tablo, t('bilgi.gider'), info.gider > 0 ? gunluk(info.gider) : t('genel.yok'));
      if (d.mutluluk !== 0) satir(tablo, t('bilgi.kenardakiEvler'), t('bilgi.mutlulukArti', { n: d.mutluluk }));
      const yik = el('button', 'dugme tehlike', t('bilgi.yik', { iade: info.yikimIadesi }));
      if (info.silinebilir) {
        yik.addEventListener('click', () => onDemolishRoad(info.id));
      } else {
        yik.disabled = true;
        yik.title = t('bilgi.yolBagli');
        box.appendChild(el('h4', '', t('bilgi.yolBagliUzun')));
      }
      box.appendChild(yik);
    },
  };
}
