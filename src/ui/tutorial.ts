// Öğretici: yalnızca ilk oyunda, atlanabilir, beş adım. Her adım oyuncunun eylemiyle ilerler; oyunu durdurmaz.
// Adımlar ekranın kenarında kağıt not olarak görünür. "Gösterildi" bilgisi localStorage'da ayrı anahtarda
// durur, oyun kaydına girmez.
import { el } from './dom';

export const OGRETICI_ANAHTARI = 'kagit-kasaba-ogretici';

/** Main'in bildirdiği olaylar. */
export type OgreticiOlayi = 'yol' | 'ev' | 'cesme' | 'gunSonu';

interface Adim {
  baslik: string;
  metin: string;
  /** Bu olay gelince adım tamamlanır; yoksa "Tamam" düğmesiyle. */
  olay?: OgreticiOlayi;
}

const ADIMLAR: Adim[] = [
  {
    baslik: '1. Bir yol çiz',
    metin: 'Alttaki menüden Yollar → Toprak Yol\'u seç. Başlangıç yolunun yanından sol tuşla sürükleyerek yeni bir yol çiz: yolun bir ucu mevcut bir yola değmeli.',
    olay: 'yol',
  },
  {
    baslik: '2. Yol kenarına bir ev koy',
    metin: 'Konut → Ev\'i seç ve bir yolun hemen kenarına tıkla. Binalar yalnızca yol kenarına kurulur; ev önünü kendiliğinden yola çevirir.',
    olay: 'ev',
  },
  {
    baslik: '3. Bir Çeşme kur',
    metin: 'Hizmet → Çeşme\'yi evlerin yakınına kur. Zemindeki halka çeşmenin etki alanıdır: içindeki evlere su gider. Su ve yemek alan ev büyür.',
    olay: 'cesme',
  },
  {
    baslik: '4. Gün sonunu bekle',
    metin: 'Bir gün 15 saniye sürer (üstteki çubuk). Gün bitince her ev vergi öder: evlerin üstünden altın sayılar yükselir. Para\'nın üstüne gelince günün dökümünü görürsün.',
    olay: 'gunSonu',
  },
  {
    baslik: '5. Hedef kartına bak',
    metin: 'Sol üstteki kart sıradaki hedefini gösterir. Hedefleri tamamladıkça yeni binalar ve kasabana yön veren kartlar açılır. İyi eğlenceler!',
  },
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
  const tamam = el('button', 'dugme', 'Tamam');
  const atla = el('button', 'dugme ikincil', 'Öğreticiyi atla');
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
    sayac.textContent = `Öğretici · ${adim + 1} / ${ADIMLAR.length}`;
    baslik.textContent = a.baslik;
    metin.textContent = a.metin;
    tamam.style.display = a.olay ? 'none' : 'inline-block';
    tamam.textContent = adim === ADIMLAR.length - 1 ? 'Bitir' : 'Tamam';
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
