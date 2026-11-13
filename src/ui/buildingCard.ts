// Bina kartı: alt menüde bir karta tıklanınca sağda açılan detay. Binanın ne işe yaradığını, maliyetini,
// yer şartını ve yerleşim bonusunu (komşuluk kuralları) düz cümleyle anlatır; oyuncunun binayı haritada
// gezdirip denemesi gerekmez. Araç seçili kaldıkça açık durur. Kilitli kart da açılır (yalnızca önizleme).
import type { BuildingType, Good, RoadType } from '../logic/types';
import { BUILDINGS, HOUSE_LEVELS, ROADS } from '../data/buildings';
import { el, panelAc, panelKapat } from './dom';
import {
  binaAciklama, binaAd, evSeviyeAd, ihtiyacAd, komsulukEtiket, komsulukSart, malAdKucuk, t, yolAciklama, yolAd,
} from './i18n';

export type KartTuru = BuildingType | RoadType | 'yikim';

export interface BuildingCard {
  /** Kartı gösterir; `kilitli` ise açılma eşiği yazar. `resim` binanın küçük resmi (yoksa null). */
  show(tur: KartTuru, kilitli: boolean, resim: string | null): void;
  hide(): void;
}

const isRoad = (k: KartTuru): k is RoadType => k === 'toprak' || k === 'asfalt';
const isaretli = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
/** Komşuluk kaynağının simgesi. */
const KAYNAK_IKON: Record<string, string> = { gol: '🌊', tepe: '⛰️' };

function malListesi(m: Partial<Record<Good, number>>): string {
  return (Object.keys(m) as Good[]).map((g) => `${m[g]} ${malAdKucuk(g)}`).join(', ');
}

function uretimMetni(tur: BuildingType): string | null {
  const d = BUILDINGS[tur];
  const gun = t('genel.gun');
  if (d.agacBasinaOdun) return t('menu.agacBasina', { n: d.agacBasinaOdun });
  if (!d.uretim) return null;
  const girdi = malListesi(d.uretim.girdi);
  const cikti = malListesi(d.uretim.cikti);
  return girdi ? `${girdi} → ${cikti} ${gun}` : `${cikti} ${gun}`;
}

export function createBuildingCard(root: HTMLElement, onClose: () => void): BuildingCard {
  const box = el('div', 'kagit raptiye');
  box.id = 'binaKarti';
  root.appendChild(box);

  function bas(baslik: string, alt: string, resim: string | null): HTMLTableElement {
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
    ust.appendChild(el('h3', '', baslik));
    box.append(kapat, ust, el('p', 'alt', alt));
    const tablo = el('table');
    box.appendChild(tablo);
    return tablo;
  }

  function satir(tablo: HTMLTableElement, a: string, v: string): void {
    const tr = el('tr');
    tr.append(el('td', '', a), el('td', '', v));
    tablo.appendChild(tr);
  }

  function bina(tur: BuildingType, kilitli: boolean, resim: string | null): void {
    const d = BUILDINGS[tur];
    const tablo = bas(binaAd(tur), binaAciklama(tur), resim);
    const yok = t('genel.yok');
    satir(tablo, t('menu.maliyet'), `🪙 ${d.maliyet}`);
    satir(tablo, t('menu.gider'), d.gider > 0 ? `${d.gider} ${t('genel.gun')}` : yok);
    if (d.isci > 0) satir(tablo, t('menu.isci'), String(d.isci));
    if (d.etki > 0) satir(tablo, t('menu.etki'), String(d.etki));
    if (d.mutluluk !== 0) {
      satir(tablo, t('menu.mutluluk'), d.mutluluk < 0 ? `${isaretli(d.mutluluk)} (${t('detay.gurultu')})` : isaretli(d.mutluluk));
    }
    const u = uretimMetni(tur);
    if (u) satir(tablo, t('menu.uretimSatir'), u);
    if (d.yer === 'gol') satir(tablo, t('menu.yer'), t('menu.golKiyisi'));
    if (d.yer === 'taslik') satir(tablo, t('menu.yer'), t('menu.taslik'));
    if (d.depo) satir(tablo, t('menu.stokSiniri'), `+${d.depo}`);

    // Ev: seviyeler ve ihtiyaçlar (oyuncu evin neden büyümediğini buradan anlar).
    if (tur === 'ev') {
      box.appendChild(el('h4', '', t('detay.evBuyume')));
      const ul = el('ul');
      for (const sv of HOUSE_LEVELS) {
        const ihtiyac = sv.ihtiyaclar.length > 0 ? sv.ihtiyaclar.map(ihtiyacAd).join(', ') : t('detay.ihtiyacYok');
        ul.appendChild(el('li', '', t('detay.evSeviye', { ad: evSeviyeAd(sv.seviye), kisi: sv.nufus, ihtiyac })));
      }
      box.append(ul, el('p', 'not', t('detay.evNot')));
    }

    // Yerleşim bonusu: kural, şart ve etkisi.
    if (d.komsuluk && d.komsuluk.length > 0) {
      box.appendChild(el('h4', '', t('detay.bonusBaslik')));
      const ul = el('ul', 'bonus');
      const mal = d.uretim ? (Object.keys(d.uretim.cikti)[0] as Good | undefined) : undefined;
      for (const k of d.komsuluk) {
        const etki = k.oran
          ? t('detay.bonusOran', { n: Math.round(k.oran * 100), mal: mal ? malAdKucuk(mal) : '' }).trim()
          : t('detay.bonusMutluluk', { n: k.mutluluk ?? 0 });
        const li = el('li');
        li.append(
          `${KAYNAK_IKON[k.kaynak] ?? '📍'} `,
          el('strong', '', komsulukEtiket(tur)),
          `: ${komsulukSart(tur)} → `,
          el('span', 'etki', etki),
        );
        ul.appendChild(li);
      }
      box.append(ul, el('p', 'not', t('detay.bonusIpucu')));
    }

    if (d.yukseltilebilir) box.appendChild(el('p', 'not', t('detay.yukseltilebilir')));
    if (kilitli) box.appendChild(el('p', 'kilit', t('detay.kilitli', { n: d.acilmaNufus })));
  }

  function yol(tur: RoadType, kilitli: boolean, resim: string | null): void {
    const d = ROADS[tur];
    const tablo = bas(yolAd(tur), yolAciklama(tur) + t('menu.yolCiz'), resim);
    satir(tablo, t('menu.maliyet'), `🪙 ${d.birimMaliyet} ${t('genel.birimBasi')}`);
    satir(tablo, t('menu.gider'), d.birimGider > 0 ? `${d.birimGider} ${t('genel.birimGun')}` : t('genel.yok'));
    satir(tablo, t('menu.mutluluk'), d.mutluluk !== 0 ? `${isaretli(d.mutluluk)} ${t('menu.kenarEvler')}` : t('genel.yok'));
    if (kilitli) box.appendChild(el('p', 'kilit', t('detay.kilitli', { n: d.acilmaNufus })));
  }

  return {
    show(tur, kilitli, resim) {
      if (tur === 'yikim') {
        bas(t('menu.yikimBaslik'), t('menu.yikimMetin'), null).remove();
      } else if (isRoad(tur)) {
        yol(tur, kilitli, resim);
      } else {
        bina(tur, kilitli, resim);
      }
      box.classList.toggle('kilitli', kilitli);
      panelAc(box);
    },
    hide() {
      panelKapat(box);
    },
  };
}
