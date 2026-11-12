// Öğretici: yalnızca ilk oyunda, atlanabilir, beş adım. Her adım oyuncunun eylemiyle ilerler; oyunu durdurmaz.
// Adımlar ekranın kenarında kağıt not olarak görünür. "Gösterildi" bilgisi localStorage'da ayrı anahtarda
// durur, oyun kaydına girmez.
import { el } from './dom';
import { t, type Anahtar } from './i18n';

export const OGRETICI_ANAHTARI = 'kagit-kasaba-ogretici';

/** Main'in bildirdiği olaylar. */
export type OgreticiOlayi = 'yol' | 'ev' | 'cesme' | 'gunSonu';

interface Adim {
  /** Dil dosyasında `ogretici.<n>.baslik` ve `ogretici.<n>.metin`. */
  baslik: Anahtar;
  metin: Anahtar;
  /** Bu olay gelince adım tamamlanır; yoksa "Tamam" düğmesiyle. */
  olay?: OgreticiOlayi;
}

const ADIMLAR: Adim[] = [
  { baslik: 'ogretici.1.baslik', metin: 'ogretici.1.metin', olay: 'yol' },
  { baslik: 'ogretici.2.baslik', metin: 'ogretici.2.metin', olay: 'ev' },
  { baslik: 'ogretici.3.baslik', metin: 'ogretici.3.metin', olay: 'cesme' },
  { baslik: 'ogretici.4.baslik', metin: 'ogretici.4.metin', olay: 'gunSonu' },
  { baslik: 'ogretici.5.baslik', metin: 'ogretici.5.metin' },
];

export interface Tutorial {
  /** Öğreticiyi başlatır (yalnızca daha önce gösterilmediyse). */
  baslat(): void;
  olay(o: OgreticiOlayi): void;
  aktif(): boolean;
}

function gosterildi(): boolean {
  try {
    return localStorage.getItem(OGRETICI_ANAHTARI) === '1';
  } catch {
    return true; // depolama yoksa her açılışta göstermeyelim
  }
}

function isaretle(): void {
  try {
    localStorage.setItem(OGRETICI_ANAHTARI, '1');
  } catch {
    /* yok say */
  }
}

export function createTutorial(root: HTMLElement): Tutorial {
  const box = el('div', 'kagit bant');
  box.id = 'ogretici';
  const sayac = el('div', 'sayac');
  const baslik = el('h4');
  const metin = el('p');
  const dugmeler = el('div', 'dugmeler');
  const tamam = el('button', 'dugme', t('ogretici.tamam'));
  const atla = el('button', 'dugme ikincil', t('ogretici.atla'));
  dugmeler.append(tamam, atla);
  box.append(sayac, baslik, metin, dugmeler);
  root.appendChild(box);

  let acik = false;
  /** Sırası gelmeden yapılan eylemler de sayılır (ör. önce ev konduysa 2. adım hemen geçer). */
  const yapilan = new Set<OgreticiOlayi>();
  let adim = 0;

  function bitir(): void {
    acik = false;
    box.style.display = 'none';
    isaretle();
  }

  function goster(): void {
    // Olayı zaten gerçekleşmiş adımları atla.
    while (adim < ADIMLAR.length && ADIMLAR[adim].olay && yapilan.has(ADIMLAR[adim].olay!)) adim++;
    if (adim >= ADIMLAR.length) {
      bitir();
      return;
    }
    const a = ADIMLAR[adim];
    sayac.textContent = t('ogretici.sayac', { adim: adim + 1, toplam: ADIMLAR.length });
    baslik.textContent = t(a.baslik);
    metin.textContent = t(a.metin);
    tamam.style.display = a.olay ? 'none' : 'inline-block';
    tamam.textContent = t(adim === ADIMLAR.length - 1 ? 'ogretici.bitir' : 'ogretici.tamam');
    box.classList.remove('ilerledi');
    void box.offsetWidth; // kısa vurgu animasyonunu yeniden başlat
    box.classList.add('ilerledi');
    box.style.display = 'block';
  }

  tamam.addEventListener('click', () => {
    adim++;
    goster();
  });
  atla.addEventListener('click', bitir);

  return {
    baslat() {
      if (gosterildi()) return;
      acik = true;
      adim = 0;
      yapilan.clear();
      goster();
    },
    olay(o) {
      if (!acik) return;
      yapilan.add(o);
      if (ADIMLAR[adim]?.olay === o) {
        adim++;
        goster();
      }
    },
    aktif: () => acik,
  };
}
