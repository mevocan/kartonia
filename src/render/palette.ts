// Kağıt Kasaba paleti. Bütün renkler burada; başka dosyada renk kodu yazılmaz.
// Pastel, sıcak, doygun: kağıt beyazı, krem, terrakota, adaçayı, gök mavisi, hardal, gül.

export const PALETTE = {
  // Masa ve arka plan
  arkaUst: '#f7e9d4',
  arkaAlt: '#e6c7a2',
  masa: '#dcb38a',
  masaDamar: '#c08f63',

  // Mukavva zemin
  cimen: '#b6dd96',
  mukavva: '#c4955f',
  mukavvaKoyu: '#a87a48',
  mukavvaAcik: '#d9b07c',

  // Arazi
  cimenAcik: '#d3eaa6',
  ormanZemin: '#93c47d',
  kum: '#f3dfae',
  golYatak: '#d9c79a',
  kesitAstar: '#f4e3c3',
  kesitAlt: '#e9d2a8',
  dalga: '#ffffff',
  cimenDis: '#a3c98a',
  ormanDis: '#7fae72',
  sis: '#dfe6c4',
  sinirSerit: '#fff6e0',
  sinirKazik: '#e9d3a8',

  // Yollar
  toprak: '#d9b27c',
  toprakIz: '#c49a63',
  patika: '#ecd3a2',
  asfalt: '#6f6a6b',
  kaldirim: '#efe4cf',
  yolCizgi: '#fff1c9',

  // Kağıtlar
  kagit: '#fffaf0',
  krem: '#f6e7c8',
  seftali: '#f9c9a0',
  pembe: '#f8cdd5',
  gul: '#ef8fa6',
  lavanta: '#c3b3e6',
  gokAcik: '#c4e6f5',
  gok: '#86c5e8',
  su: '#9fdcf2',
  adacayiAcik: '#cfe3bf',
  adacayi: '#9cc28a',
  yesil: '#76b46c',
  koyuYesil: '#559a5c',
  zeytin: '#b3bb5c',
  hardal: '#f1bf4a',
  bugday: '#f5d77e',
  bugdayKoyu: '#e3b75a',
  terrakota: '#e27b5e',
  kiremit: '#cc5c45',
  arduvaz: '#7f9fbe',
  teal: '#6fb7ae',
  tas: '#d3cbc0',
  tasKoyu: '#ada296',
  ahsap: '#a8744d',
  ahsapAcik: '#d0a273',
  kutuk: '#e8c89a',
  murekkep: '#3f302a',
  beyaz: '#fffdf8',

  // Etkileşim
  kenar: '#4a3a30',
  secim: '#ffc93c',
  yikim: '#ff5a4a',
  yikimTon: '#ffb0a6',
  secimKenar: '#d69a00',
  yikimKenar: '#c62f22',
  olukKoyu: '#cdbba6',
  olukAstar: '#fff8ee',
  beyazIsik: '#ffffff',
  vergiYazi: '#3f8f4a',
  hayalet: '#fff4e0',
  hayaletKotu: '#ff7a6a',
  halka: '#fff6e2',
  uyari: '#ffd166',
  uyariYazi: '#c0392b',
  etiketKagit: '#fffaf0',
  etiketKenar: '#d8c4a6',

  // Işık
  gunesOgle: '#fff6e8',
  gunesSicak: '#ffcf9a',
  gokIsik: '#fff1dc',
  yerIsik: '#c9a27c',
  // Gece-gündüz (render/scene.ts): akşam turuncusu, ay ışığı, gece göğü, yanan pencere
  gunesAksam: '#ffab6b',
  ayIsik: '#a9bce8',
  geceGok: '#7d8fc4',
  geceYer: '#4a4a6e',
  geceSis: '#3c4670',
  pencereIsik: '#ffc56a',

  // Mevsimler (render/season.ts)
  yaprakHardal: '#e9b23c',
  yaprakTuruncu: '#e58e4a',
  yaprakTerrakota: '#d4684c',
  cimenSonbahar: '#d6cf86',
  karYaprak: '#dfe9e6',
  karZemin: '#dfe8f4',
  karKum: '#e3e3df',
  karTane: '#ffffff',
  buz: '#d3e7ee',
  sisKis: '#e9ede9',
  sisSonbahar: '#ece2c0',

  // Anıt inşaatı (Saat Kulesi iskelesi ve bayrağı)
  iskele: '#d9ab78',
  iskeleKoyu: '#b98656',
  iskeleTahta: '#ecc994',
  bayrak: '#e2504a',

  // Gezgin tüccar arabası (render/merchant.ts)
  tuccarTente: '#e8604c',
  tuccarTenteAcik: '#fff1dc',
  tuccarKasa: '#5aa9a0',
  tuccarKasaKoyu: '#3e877f',
  tuccarKiyafet: '#7d5bb0',
  tuccarSapka: '#b8473a',
  tuccarKusak: '#f1bf4a',
  kumasMor: '#a98bd8',
  kumasTuruncu: '#f2a55a',
  kumasMavi: '#79b8e0',
} as const;

/** Ev duvar / çatı çeşitleri (id'ye göre deterministik seçilir). */
export const EV_DUVAR = [PALETTE.krem, PALETTE.pembe, PALETTE.gokAcik, PALETTE.adacayiAcik, PALETTE.seftali] as const;
export const EV_CATI = [PALETTE.terrakota, PALETTE.arduvaz, PALETTE.kiremit, PALETTE.teal, PALETTE.gul] as const;

/** Konfeti renkleri. */
export const KONFETI = [PALETTE.gul, PALETTE.hardal, PALETTE.gok, PALETTE.adacayi, PALETTE.lavanta, PALETTE.terrakota, PALETTE.kagit] as const;
