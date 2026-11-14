// Giriş ekranı: oyun açılınca ve HUD'daki ☰ Menü düğmesiyle görünür. Arkada kasaba yavaşça döner, oyun duraklıdır.
// Bölümler: ana kart (Devam et / Yeni kasaba / Nasıl oynanır / Ses), yeni kasaba onayı, nasıl oynanır kartı.
// Sağ üstte dil seçimi (değişince main kaydedip sayfayı yeniden yükler).
import { el } from './dom';
import { DIL, DILLER, t, type Anahtar, type Dil } from './i18n';

export interface KayitOzeti {
  gun: number;
  nufus: number;
  mevsim: string;
  bitti: boolean;
  /** Kasaba unvanı (Mezra … Efsane kasaba). */
  unvan?: string;
}

export interface TitleScreen {
  /** ozet null: devam edilecek kasaba yok (ilk açılış). */
  show(ozet: KayitOzeti | null, sesAcik: boolean): void;
  hide(): void;
  isOpen(): boolean;
  setSound(acik: boolean): void;
}

export interface TitleDeps {
  devam(): void;
  yeni(): void;
  sesDegistir(): void;
  dilDegistir(d: Dil): void;
  /** Kapaktaki küçük kağıt binaların resimleri. */
  resim(tur: 'ev' | 'agac' | 'saatKulesi' | 'degirmen'): string | null;
}

/** Dil düğmelerinin üstüne gelince görünen ad: her dil kendi dilinde yazılır, çevrilmez. */
const DIL_ADI: Record<Dil, string> = { tr: 'Türkçe', en: 'English' };

/** Kontrol tablosu: [tuş, ne yapar]. Q / E ve X her dilde aynıdır. */
const kontroller = (): [string, string][] => [
  [t('giris.tus.solTik'), t('giris.is.koy')],
  [t('giris.tus.solSurukle'), t('giris.is.gez')],
  [t('giris.tus.sagSurukle'), t('giris.is.dondur')],
  [t('giris.tus.tekerlek'), t('giris.is.yakinlas')],
  ['Q / E', t('giris.is.binaDondur')],
  ['X', t('giris.is.yikim')],
  [t('giris.tus.esc'), t('giris.is.birak')],
  [t('giris.tus.bosluk'), t('giris.is.hiz')],
];

const ADIMLAR: Anahtar[] = ['giris.adim1', 'giris.adim2', 'giris.adim3', 'giris.adim4', 'giris.adim5'];

export function createTitleScreen(ui: HTMLElement, deps: TitleDeps): TitleScreen {
  const kok = el('div');
  kok.id = 'giris';

  // ---- Dil seçimi ----
  const dilKutu = el('div', 'kagit dil-secim');
  for (const d of DILLER) {
    const b = el('button', d === DIL ? 'secili' : '', d.toUpperCase());
    b.title = DIL_ADI[d];
    b.addEventListener('click', () => {
      if (d !== DIL) deps.dilDegistir(d);
    });
    dilKutu.appendChild(b);
  }

  // ---- Kapak: kağıt binalar + başlık ----
  const kapak = el('div', 'kapak');
  const binalar = el('div', 'kapak-binalar');
  for (const tur of ['agac', 'ev', 'saatKulesi', 'degirmen', 'agac'] as const) {
    const src = deps.resim(tur);
    if (!src) continue;
    const img = el('img', `kapak-bina ${tur}`);
    img.src = src;
    img.alt = '';
    img.draggable = false;
    binalar.appendChild(img);
  }
  const baslik = el('h1', 'kapak-baslik');
  // "Karton" krem kağıt, "ia" kırmızı kağıt; harfler sırayla düşer.
  const kelime = el('span', 'kelime');
  [...'Kartonia'].forEach((harf, i) => {
    const h = el('span', i >= 6 ? 'harf kirmizi' : 'harf', harf);
    h.style.animationDelay = `${0.3 + i * 0.07}s`;
    kelime.appendChild(h);
  });
  baslik.appendChild(kelime);
  kapak.append(binalar, baslik, el('p', 'kapak-alt', t('giris.altBaslik')));

  // ---- Ana kart ----
  const ana = el('div', 'kagit giris-kart ana');
  const devamDugme = el('button', 'giris-dugme birincil');
  const devamAlt = el('span', 'alt');
  const devamUst = el('span', 'ust');
  devamDugme.append(devamUst, devamAlt);
  const yeniDugme = el('button', 'giris-dugme', t('giris.yeni'));
  const nasilDugme = el('button', 'giris-dugme', t('giris.nasil'));
  const sesDugme = el('button', 'giris-dugme kucuk');
  ana.append(devamDugme, yeniDugme, nasilDugme, sesDugme);

  // ---- Yeni kasaba onayı ----
  const onay = el('div', 'kagit giris-kart onay');
  onay.append(el('h3', '', t('giris.onayBaslik')), el('p', '', t('giris.onayMetin')));
  const onayEvet = el('button', 'giris-dugme tehlike', t('giris.onayEvet'));
  const onayHayir = el('button', 'giris-dugme kucuk', t('giris.vazgec'));
  onay.append(onayEvet, onayHayir);

  // ---- Nasıl oynanır ----
  const nasil = el('div', 'kagit giris-kart nasil');
  nasil.appendChild(el('h3', '', t('giris.nasilBaslik')));
  const ol = el('ol');
  for (const a of ADIMLAR) ol.appendChild(el('li', '', t(a)));
  nasil.appendChild(ol);
  nasil.appendChild(el('h4', '', t('giris.kontroller')));
  const tablo = el('table');
  for (const [tus, ne] of kontroller()) {
    const tr = el('tr');
    const td = el('td');
    td.appendChild(el('kbd', '', tus));
    tr.append(td, el('td', '', ne));
    tablo.appendChild(tr);
  }
  nasil.appendChild(tablo);
  const nasilGeri = el('button', 'giris-dugme kucuk', t('giris.geri'));
  nasil.appendChild(nasilGeri);

  // ---- Alt bilgi ----
  const alt = el('div', 'giris-altbilgi');
  const dokunmatik = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  if (dokunmatik) alt.appendChild(el('div', 'kagit uyari', t('giris.dokunmatik')));
  alt.appendChild(el('div', 'surum', t('giris.kayitNotu')));

  const kartlar = el('div', 'giris-kartlar');
  kartlar.append(ana, onay, nasil);
  kok.append(dilKutu, kapak, kartlar, alt);
  ui.appendChild(kok);

  let acik = false;
  let kayitVar = false;

  function bolum(b: 'ana' | 'onay' | 'nasil'): void {
    ana.classList.toggle('gorunur', b === 'ana');
    onay.classList.toggle('gorunur', b === 'onay');
    nasil.classList.toggle('gorunur', b === 'nasil');
  }

  function setSound(on: boolean): void {
    sesDugme.textContent = t(on ? 'giris.sesAcik' : 'giris.sesKapali');
  }

  devamDugme.addEventListener('click', () => deps.devam());
  yeniDugme.addEventListener('click', () => (kayitVar ? bolum('onay') : deps.yeni()));
  onayEvet.addEventListener('click', () => deps.yeni());
  onayHayir.addEventListener('click', () => bolum('ana'));
  nasilDugme.addEventListener('click', () => bolum('nasil'));
  nasilGeri.addEventListener('click', () => bolum('ana'));
  sesDugme.addEventListener('click', () => deps.sesDegistir());

  return {
    show(ozet, sesAcik) {
      kayitVar = ozet !== null;
      if (ozet) {
        devamUst.textContent = t(ozet.bitti ? 'giris.kasabayaBak' : 'giris.devam');
        devamAlt.textContent = ozet.bitti
          ? t('giris.iflasOzet', { gun: ozet.gun })
          : `${ozet.unvan ? `${ozet.unvan} · ` : ''}${t('giris.ozet', { gun: ozet.gun, mevsim: ozet.mevsim, nufus: ozet.nufus })}`;
        devamDugme.style.display = '';
        yeniDugme.classList.remove('birincil');
      } else {
        devamDugme.style.display = 'none';
        yeniDugme.classList.add('birincil');
      }
      setSound(sesAcik);
      bolum('ana');
      acik = true;
      ui.classList.add('menude');
      kok.classList.remove('kapaniyor');
      kok.style.display = 'flex';
    },
    hide() {
      if (!acik) return;
      acik = false;
      ui.classList.remove('menude');
      kok.classList.add('kapaniyor');
      window.setTimeout(() => {
        if (!acik) kok.style.display = 'none';
      }, 260);
    },
    isOpen: () => acik,
    setSound,
  };
}
