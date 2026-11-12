// Sağdaki kağıt not kartı: seçili binanın ya da yolun bilgileri.
import type { BuildingInfo, Good, Need, RoadInfo } from '../logic/types';
import { BUILDINGS, HOUSE_LEVELS, ROADS } from '../data/buildings';
import { el } from './dom';
import { bonusText } from '../logic/adjacency';

function yuvarla(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export interface InfoPanel {
  /** null → gizle. `para` yükseltme düğmesinin etkinliği için. */
  show(info: BuildingInfo | null, para?: number, stok?: Partial<Record<Good, number>>): void;
  showRoad(info: RoadInfo): void;
}

const IHTIYAC_AD: Record<Need, string> = {
  su: 'Su', yemek: 'Yemek (fırın / pazar)', odun: 'Odun', pazar: 'Pazar', okul: 'Okul', mobilya: 'Mobilya', saglik: 'Sağlık',
};

const EV_AD = ['', 'Kulübe', 'Ev', 'İki katlı ev'];

const MAL_IKON: Record<Good, string> = { bugday: '🌾', un: '🥣', yemek: '🍽️', odun: '🪵', tas: '🪨', mobilya: '🪑' };
const MAL_AD: Record<Good, string> = { bugday: 'buğday', un: 'un', yemek: 'yemek', odun: 'odun', tas: 'taş', mobilya: 'mobilya' };
/** Anıtın sıradaki aşamasında görünen kısım (indeks = tamamlanan aşama). */
const ANIT_ASAMA = ['gövdenin alt yarısı', 'gövdenin üst yarısı', 'saat ve balkon', 'çatı ve bayrak'];

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

  function bas(baslik: string, alt: string): HTMLTableElement {
    box.replaceChildren();
    const kapat = el('button', 'kapat', '×');
    kapat.title = 'Kapat (Esc)';
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
        ? bas('Orman ağacı', 'Ormanın doğal ağacı. Kesilirse odun verir.')
        : bas(ev ? EV_AD[info.seviye] ?? d.ad : d.ad, ev ? `Seviye ${info.seviye} / 3` : d.aciklama);

      if (info.nufus !== undefined) satir(tablo, 'Nüfus', String(info.nufus));
      if (info.mutluluk !== undefined) satir(tablo, 'Mutluluk', String(Math.round(info.mutluluk)));
      if (info.tahminiVergi !== undefined) satir(tablo, 'Tahmini vergi', `${info.tahminiVergi} /gün`);
      if (ev) satir(tablo, 'Yol', info.yol ? ROADS[info.yol].ad : 'yok');
      if (info.isciOrani !== undefined) satir(tablo, 'İşçi', `%${Math.round(info.isciOrani * 100)}`);
      if (info.kisinDurdu) satir(tablo, 'Üretim', '❄️ kışın üretmez');
      if (info.agacSayisi !== undefined) satir(tablo, 'Ağaç', String(info.agacSayisi));
      if (info.etki > 0) satir(tablo, 'Etki yarıçapı', yuvarla(info.etki));
      satir(tablo, 'Gider', info.gider > 0 ? `${info.gider} /gün` : 'yok');
      if (d.yukseltilebilir) satir(tablo, 'Seviye', `${info.seviye} / 3`);
      if (info.komsuluk && info.komsuluk.length > 0) {
        const aktif = info.komsuluk.filter((k) => k.aktif);
        // Bonus yoksa şartı göster: oyuncu neyi kaçırdığını görsün.
        const metin = aktif.length > 0
          ? aktif.map(bonusText).join(', ')
          : `yok (${info.komsuluk.map((k) => `${k.etiket}: ${k.sart}`).join('; ')})`;
        satir(tablo, 'Bonus', metin);
      }

      if (info.ihtiyaclar && info.ihtiyaclar.length > 0) {
        const mevcut = new Set<Need>(HOUSE_LEVELS[info.seviye - 1]?.ihtiyaclar ?? []);
        box.appendChild(el('h4', '', 'İhtiyaçlar'));
        const ul = el('ul');
        for (const n of info.ihtiyaclar) {
          const li = el('li', n.karsilandi ? 'ok' : 'yok', `${n.karsilandi ? '✓' : '✗'} ${IHTIYAC_AD[n.ihtiyac]} `);
          if (!mevcut.has(n.ihtiyac)) li.appendChild(el('span', 'ust', '(üst seviye)'));
          ul.appendChild(li);
        }
        box.appendChild(ul);
      }

      if (info.anit) {
        const a = info.anit;
        satir(tablo, 'İnşaat', a.sonraki ? `${a.asama} / ${a.toplam}` : 'tamamlandı');
        if (a.sonraki) {
          const n = a.sonraki;
          const mallar = (Object.entries(n.mal) as [Good, number][]);
          const metin = [`🪙 ${n.para}`, ...mallar.map(([g, m]) => `${MAL_IKON[g]} ${m}`)].join(' · ');
          box.appendChild(el('div', 'alt', 'Aura, gider ve hedef kule tamamlanınca başlar.'));
          const gb = el('button', 'dugme', `Malzeme gönder (${metin})`);
          gb.title = `Sıradaki aşama: ${ANIT_ASAMA[a.asama] ?? ''}`;
          const eksik = mallar.filter(([g, m]) => (stok[g] ?? Infinity) < m).map(([g]) => MAL_AD[g]);
          if (para < n.para || eksik.length > 0) gb.disabled = true;
          if (para < n.para) box.appendChild(el('div', 'alt', 'Para yetmiyor.'));
          if (eksik.length > 0) box.appendChild(el('div', 'alt', `Yetmiyor: ${eksik.join(', ')}.`));
          gb.addEventListener('click', () => onAdvanceMonument(info.id));
          box.appendChild(gb);
        }
      }

      if (info.yukseltme !== undefined) {
        const y = info.yukseltme;
        if (y === null) {
          box.appendChild(el('h4', '', 'En üst seviyede.'));
        } else {
          const ub = el('button', 'dugme', `Yükselt (🪙 ${y.maliyet}${y.tas > 0 ? ` · 🪨 ${y.tas}` : ''})`);
          ub.title = `Etki yarıçapı ${yuvarla(info.etki)} → ${yuvarla(y.etki)}, gider ${info.gider} → ${y.gider} /gün`;
          box.appendChild(el('div', 'alt', `Sonraki seviye: yarıçap ${yuvarla(y.etki)}, gider ${y.gider} /gün`));
          if (para < y.maliyet || tas < y.tas) ub.disabled = true;
          if (tas < y.tas) box.appendChild(el('div', 'alt', 'Taş yetmiyor: taş ocağı kur.'));
          ub.addEventListener('click', () => onUpgrade(info.id));
          ub.addEventListener('mouseenter', () => onUpgradeHover(info.id, y.etki));
          ub.addEventListener('mouseleave', () => onUpgradeHover(info.id, null));
          box.appendChild(ub);
        }
      }

      const yik = info.dogal
        ? el('button', 'dugme tehlike', `Ağacı kes (−${info.kesimMaliyeti ?? 0} para, +${info.kesimOdun ?? 0} odun)`)
        : el('button', 'dugme tehlike', `Yık (+${info.yikimIadesi})`);
      yik.addEventListener('click', () => onDemolish(info.id));
      box.appendChild(yik);
    },

    showRoad(info) {
      const d = ROADS[info.tur];
      const tablo = bas(d.ad, d.aciklama);
      satir(tablo, 'Uzunluk', info.uzunluk.toFixed(1));
      satir(tablo, 'Gider', info.gider > 0 ? `${info.gider} /gün` : 'yok');
      if (d.mutluluk !== 0) satir(tablo, 'Kenardaki evlere', `+${d.mutluluk} mutluluk`);
      const yik = el('button', 'dugme tehlike', `Yık (+${info.yikimIadesi})`);
      if (info.silinebilir) {
        yik.addEventListener('click', () => onDemolishRoad(info.id));
      } else {
        yik.disabled = true;
        yik.title = 'Bu yola bağlı binalar var';
        box.appendChild(el('h4', '', 'Bu yola bağlı binalar var, yıkılamaz.'));
      }
      box.appendChild(yik);
    },
  };
}
