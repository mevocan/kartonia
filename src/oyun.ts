// Oyun: kayıt, oyun döngüsü ve katmanların birbirine bağlanması. main.ts dil dosyasını yükledikten sonra açar.
import type { BuildingType, DayReport, GameState, Good, RoadType, Vec2 } from './logic/types';
import { buildingPins, type SonGun } from './logic/pins';
import { igneGorunumu } from './ui/ikonlar';
import {
  canPlace, canUpgrade, createGame, upgradeBuilding, demolish, demolishRoad, deserialize, getBuildingInfo, getRoadInfo, GOALS, KASABA_TAMAM_HEDEFI, placeBuilding,
  placeRoad, planRoad, serialize, tick, mevsim, monumentStage, canAdvanceMonument, advanceMonument,
  tuccarVarMi, tuccarGeldiMi, tuccarKalisGunu, tuccarKonumu, buyGood, sellGood, canBuy, canSell, checkRequest, deliverFeast,
  bekleyenSecim, kartCek, kartSec, kartBul, secimGunu, toplamSecim,
  anlikGoruntu, geriAl, geriAlEkle, geriAlinabilir, geriAlTemizle, geriAlYigini, type GeriAlTur,
} from './logic/game';
import type { Gazete } from './logic/types';
import { createJournal, createNewspaper, gazeteGosterilsin } from './ui/gunluk';
import { BALANCE, BUILDINGS } from './data/buildings';
import { createRenderer } from './render/renderer';
import type { GameRenderer } from './render/api';
import { createHud, MEVSIM_GORUNUM } from './ui/hud';
import { createTitleScreen } from './ui/titleScreen';
import { createBuildMenu, type Tool } from './ui/buildMenu';
import { createInfoPanel } from './ui/infoPanel';
import {
  createToasts, istekAd, type ToastKind, istekTamamMetni, mevsimBildirimi, yerlestirmeSebebi,
} from './ui/toast';
import { createAlertList, createGoalCard, createLeftColumn, createRequestCard } from './ui/solPanel';
import { createTradePanel } from './ui/tradePanel';
import { createCardPicker } from './ui/cardPicker';
import { createCardList } from './ui/cardList';
import { createTutorial } from './ui/tutorial';
import { createAudio } from './audio/index';
import type { SesKanali } from './audio/api';
import { createInput, type Selection } from './ui/input';
import { el } from './ui/dom';
import { binaAd, dilKaydet, evSeviyeAd, hedefMetni, kartMetni, kucuk, t } from './ui/i18n';

const KAYIT_ANAHTARI = 'kagit-kasaba-kayit';
/** Ses ayarı (oyun kaydından ayrı): {acik, genel, muzik}. */
const SES_ANAHTARI = 'kagit-kasaba-ses';
const ALTIN = '#d9a13b';
const KIRMIZI = '#c9544a';

/** Kayıt yoksa ya da okunamıyorsa (ör. eski sürüm) yeni oyun. `yeni` true ise ilk açılış ipucu gösterilir. */
function kayitYukle(): { s: GameState; yeni: boolean } {
  try {
    const json = localStorage.getItem(KAYIT_ANAHTARI);
    if (json) return { s: deserialize(json), yeni: false };
  } catch (err) {
    console.warn('Kayıt okunamadı, yeni oyun başlıyor.', err);
  }
  return { s: createGame(rastgeleTohum()), yeni: true };
}

/** Her yeni oyunda farklı harita. */
function rastgeleTohum(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function kaydet(s: GameState): void {
  try {
    localStorage.setItem(KAYIT_ANAHTARI, serialize(s));
  } catch (err) {
    console.warn('Kayıt yazılamadı.', err);
  }
}

/** Çoklu çizginin yay uzunluğuna göre orta noktası (uçan sayı için). */
function ortaNokta(n: Vec2[]): Vec2 {
  let toplam = 0;
  for (let i = 1; i < n.length; i++) toplam += Math.hypot(n[i].x - n[i - 1].x, n[i].z - n[i - 1].z);
  let kalan = toplam / 2;
  for (let i = 1; i < n.length; i++) {
    const l = Math.hypot(n[i].x - n[i - 1].x, n[i].z - n[i - 1].z);
    if (l > 0 && l >= kalan) {
      const t = kalan / l;
      return { x: n[i - 1].x + (n[i].x - n[i - 1].x) * t, z: n[i - 1].z + (n[i].z - n[i - 1].z) * t };
    }
    kalan -= l;
  }
  return n[0] ?? { x: 0, z: 0 };
}

function startGame(container: HTMLElement, ui: HTMLElement): void {
  const yuklenen = kayitYukle();
  let s = yuklenen.s;
  const renderer: GameRenderer = createRenderer(container);

  let hiz = 1;
  let duraklamadanOnce = 1;
  let arac: Tool = null;
  let secili: Selection | null = null;
  /** Son gün sonunun üretim sorunları ve evlerin stok eksikleri (harita iğneleri, bilgi paneli). Yeni oyunda ve kayıt yüklenince yok. */
  let sonGun: SonGun | null = null;

  // ---- Arayüz parçaları ----
  // Ses: dosya yok, Web Audio ile üretilir. İlk tıklama / tuşta başlar (tarayıcı kuralı). Ayar ayrı anahtarda.
  const ses = createAudio();
  const sesKilidiAc = (): void => ses.unlock();
  window.addEventListener('pointerdown', sesKilidiAc);
  window.addEventListener('keydown', sesKilidiAc);
  const hud = createHud(
    ui, (v) => setSpeed(v), () => setSpeed(hiz === 0 ? duraklamadanOnce : 0),
    () => (tuccar.isOpen() ? tuccarKapat() : tuccarAc()),
    () => sesAyarla(!ses.isEnabled()),
    (kanal, v) => sesDuzeyi(kanal, v),
    () => geriAlYap(),
    () => (gunlukP.isOpen() ? pencereKapat() : gunlukAc()),
  );
  /** Geri al yığını: aynı gün içindeki son oyuncu eylemleri (gün sonunda boşalır). */
  const geriAlY = geriAlYigini();
  /** Binayı seçer ve kamerayı ona götürür (istek kartı, uyarılar). */
  function binayaGit(id: number): void {
    setTool(null);
    select({ kind: 'bina', id });
    const b = s.binalar.find((x) => x.id === id);
    if (b) renderer.focusOn(b.x, b.z); // ev ekran dışındaysa kamera oraya kayar
  }
  const solSutun = createLeftColumn(ui);
  const goal = createGoalCard(solSutun);
  const istekKarti = createRequestCard(solSutun, () => senlik(), (id) => binayaGit(id));
  const uyariListesi = createAlertList(solSutun, (id) => binayaGit(id));
  const tuccar = createTradePanel(ui, (g, n) => ticaret(g, n, true), (g, n) => ticaret(g, n, false), () => tuccarKapat());
  const secici = createCardPicker(ui, (id) => kartSecildi(id));
  const kasabaYolu = createCardList(ui);
  const gunlukP = createJournal(ui, () => pencereKapat(), (g) => gazeteAc(g));
  const gazeteP = createNewspaper(ui, () => pencereKapat());
  // Olumsuz bildirimler (yapılamayan işlem, küçülen ev, borç) kısa bir hata sesiyle gelir.
  const toastlar = createToasts(ui);
  const toasts = {
    show(text: string, kind?: ToastKind): void {
      if (kind === 'kotu') ses.play('hata');
      toastlar.show(text, kind);
    },
  };
  const ogretici = createTutorial(ui);
  {
    // Kayıtlı ses ayarı: {acik, genel, muzik} (eski biçim: '0' kapalı, '1' açık).
    let ayar: { acik?: unknown; genel?: unknown; muzik?: unknown } = {};
    try {
      const ham = localStorage.getItem(SES_ANAHTARI);
      if (ham === '0' || ham === '1') ayar = { acik: ham === '1' };
      else if (ham) ayar = JSON.parse(ham) as typeof ayar;
    } catch {
      /* yok say */
    }
    const sayi = (v: unknown, d: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    ses.setEnabled(ayar.acik !== false);
    ses.setVolume('genel', sayi(ayar.genel, 1));
    ses.setVolume('muzik', sayi(ayar.muzik, 1));
    hud.setSound(ses.isEnabled(), ses.getVolume('genel'), ses.getVolume('muzik'));
  }
  const menu = createBuildMenu(ui, (t) => setTool(t), (t) => renderer.buildingThumbnail(t));
  const info = createInfoPanel(
    ui, (id) => yik(id), (id) => yolYik(id), () => select(null), (id) => yukselt(id),
    (id, r) => {
      const b = s.binalar.find((x) => x.id === id);
      if (!b) return;
      if (r === null) input.refresh();
      else renderer.showRange(b.x, b.z, r);
    },
    (id) => anitIlerlet(id),
    (tur) => renderer.buildingThumbnail(tur),
  );

  // Sağ üst: giriş ekranını (menü) açar; yeni kasaba oradan başlatılır.
  const menuDugme = el('button', 'kagit', t('genel.menu'));
  menuDugme.id = 'yeniOyun';
  menuDugme.addEventListener('click', () => menuAc());
  ui.appendChild(menuDugme);

  // ---- Giriş ekranı ----
  /** Oyuncu giriş ekranından bir kez oyuna girdi mi (ilk ipucu, öğretici, iflas kartı o zaman gösterilir). */
  let girildi = false;
  /** Menü açılmadan önceki hız: "Devam et" bu hızla sürdürür. */
  let menuOncesiHiz = 1;
  const giris = createTitleScreen(ui, {
    devam: () => oyunaDon(),
    yeni: () => yeniKasaba(),
    dilDegistir: (d) => {
      // Yeni ve hiç girilmemiş kasaba kaydedilmez (dil değişince yeni harita gelir).
      if (girildi || !yuklenen.yeni) kaydet(s);
      dilKaydet(d);
      location.reload();
    },
    sesDegistir: () => {
      sesAyarla(!ses.isEnabled());
      giris.setSound(ses.isEnabled());
    },
    resim: (t) => renderer.buildingThumbnail(t),
  });

  function menuAc(): void {
    if (giris.isOpen()) return;
    if (girildi && hiz > 0) menuOncesiHiz = hiz;
    else if (tuccar.isOpen()) menuOncesiHiz = tuccarOncesiHiz; // takas menüsü açıkken duraklıydı
    else if (pencereAcik()) menuOncesiHiz = pencereOncesiHiz;
    setTool(null);
    tuccar.close();
    gunlukP.hide();
    gazeteP.hide();
    setSpeed(0);
    // Yeni (kaydedilmemiş, hiç girilmemiş) kasabada "Devam et" yok: oyuncu "Yeni kasaba" ile başlar.
    const ozet = yuklenen.yeni && !girildi
      ? null
      : { gun: s.gun, nufus: s.nufus, mevsim: MEVSIM_GORUNUM[mevsim(s.gun)].ad, bitti: s.bitti };
    giris.show(ozet, ses.isEnabled());
  }

  function oyunaDon(): void {
    giris.hide();
    if (!girildi) {
      girildi = true;
      if (s.bitti) bitisGoster();
      else if (yuklenen.yeni) {
        toasts.show(t('genel.ipucu'), 'bilgi');
        ogretici.baslat(); // yalnızca ilk oyunda (localStorage'da gösterildiyse başlamaz)
      }
    }
    if (!s.bitti) setSpeed(menuOncesiHiz);
    kartSecimiAc(); // bekleyen kart seçimi varsa
  }

  function yeniKasaba(): void {
    // İlk açılışta arkada görünen harita zaten yeni: onu kullan.
    if (!girildi && yuklenen.yeni) {
      oyunaDon();
      return;
    }
    giris.hide();
    girildi = true;
    menuOncesiHiz = 1;
    sifirla();
  }

  const son = el('div');
  son.id = 'sonEkran';
  const sonKart = el('div', 'kagit');
  son.appendChild(sonKart);
  ui.appendChild(son);

  // Düğmeye tıklayınca odak düğmede kalmasın (Boşluk tuşu onu tetiklemesin).
  ui.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b) b.blur();
  });

  const input = createInput({
    renderer,
    ui,
    getState: () => s,
    getTool: () => arac,
    setTool: (t) => setTool(t),
    getSelected: () => secili,
    select: (sel) => select(sel),
    place: (t, x, z, rot) => yerlestir(t, x, z, rot),
    placeRoad: (tur, noktalar) => yolCiz(tur, noktalar),
    demolish: (id) => yik(id),
    demolishRoad: (id) => yolYik(id),
    setSpeed: (v) => setSpeed(v),
    togglePause: () => setSpeed(hiz === 0 ? duraklamadanOnce : 0),
  });

  // ---- Durum değiştiren işlemler ----
  /** Ses ayarı: aç/kapa ve düzeyler. Ses katmanına, HUD paneline ve localStorage'a yazar. */
  function sesKaydet(): void {
    hud.setSound(ses.isEnabled(), ses.getVolume('genel'), ses.getVolume('muzik'));
    try {
      localStorage.setItem(SES_ANAHTARI, JSON.stringify({
        acik: ses.isEnabled(), genel: ses.getVolume('genel'), muzik: ses.getVolume('muzik'),
      }));
    } catch {
      /* yok say */
    }
  }

  function sesAyarla(on: boolean): void {
    ses.setEnabled(on);
    sesKaydet();
  }

  function sesDuzeyi(kanal: SesKanali, v: number): void {
    ses.setVolume(kanal, v);
    if (v > 0 && !ses.isEnabled()) ses.setEnabled(true); // sürgüyü açmak sesi de açar
    sesKaydet();
  }

  function setSpeed(v: number): void {
    // Kart seçilene, menü kapanana, takas menüsü kapanana kadar oyun duraklı.
    if (v > 0 && (secici.isOpen() || giris.isOpen() || tuccar.isOpen() || pencereAcik())) return;
    if (v > 0) duraklamadanOnce = v;
    hiz = v;
    hud.setSpeed(v);
  }

  function setTool(t: Tool): void {
    if (t !== null && ((t !== 'yikim' && s.bitti) || giris.isOpen())) return;
    arac = t;
    if (t !== null) {
      secili = null;
      info.show(null);
    }
    menu.setSelected(t);
    input.refresh();
  }

  function select(sel: Selection | null): void {
    if (sel && (sel.kind !== secili?.kind || sel.id !== secili?.id)) ses.play('secim');
    if (sel) menu.hideDetail(); // bilgi paneli bina kartıyla aynı yerde açılır
    secili = sel;
    bilgiYenile();
    input.refresh();
  }

  function bilgiYenile(): void {
    if (secili?.kind === 'yol') {
      const ri = getRoadInfo(s, secili.id);
      if (ri) {
        info.showRoad(ri);
        return;
      }
      secili = null;
    }
    const bi = secili?.kind === 'bina' ? getBuildingInfo(s, secili.id) : null;
    if (!bi) secili = null;
    info.show(bi, s.para, s.stok, bi ? sonGun?.uretimSorunlari.find((p) => p.id === bi.id)?.neden : undefined);
  }

  function yukselt(id: number): void {
    const c = canUpgrade(s, id);
    if (!c.ok) {
      const m = c.sebep === 'para' ? t('bildirim.yukseltmeParaYok') : c.sebep === 'tas' ? yerlestirmeSebebi('tas')
        : t('bildirim.yukseltilemez');
      toasts.show(m, 'kotu');
      return;
    }
    const onceki = anlikGoruntu(s);
    const m = upgradeBuilding(s, id);
    const b = s.binalar.find((x) => x.id === id);
    if (m === null || !b) return;
    geriAlKaydet(onceki, 'yukseltme', b.type);
    renderer.setBuildingLevel(id, b.seviye);
    renderer.floatText(b.x, b.z, `−${m}`, KIRMIZI);
    toasts.show(t('bildirim.yukseldi', { bina: binaAd(b.type), seviye: b.seviye }), 'iyi');
    bilgiYenile();
    arayuzYenile();
    input.refresh();
  }

  // ---- Karar kartları ----
  /** Duraklatmadan önceki hız: seçim bitince oyun bu hızla devam eder. */
  let secimOncesiHiz = 1;

  /** Bekleyen kart seçimi varsa oyunu duraklatır ve üç kartı gösterir. */
  function kartSecimiAc(): void {
    const h = bekleyenSecim(s);
    if (h === null || s.bitti) return;
    if (!secici.isOpen()) secimOncesiHiz = hiz > 0 ? hiz : duraklamadanOnce;
    setTool(null);
    tuccar.close();
    setSpeed(0);
    const n = Math.min(h, toplamSecim() - 1); // eski kayıtta hedef numarası kalmış olabilir
    secici.show(t('kart.secimBaslik', { gun: secimGunu(n), sira: n + 1, toplam: toplamSecim() }), kartCek(s, h));
  }

  function kartSecildi(id: string): void {
    if (!kartSec(s, id)) return;
    geriAlSifirla();
    const k = kartBul(id);
    if (k) {
      const km = kartMetni(k);
      toasts.show(t('kart.secildi', { ikon: k.ikon, ad: km.ad, arti: km.arti, eksi: kucuk(km.eksi) }), 'bilgi');
    }
    ses.play('hedef');
    secici.hide();
    kaydet(s);
    bilgiYenile();
    arayuzYenile();
    if (bekleyenSecim(s) !== null) kartSecimiAc(); // aynı gün birden çok kart hedefi
    else setSpeed(secimOncesiHiz);
  }

  // ---- Günlük ve gazete: açıkken oyun durur, kapanınca önceki hızla (duraklıysa duraklı) sürer ----
  let pencereOncesiHiz = 1;
  const pencereAcik = (): boolean => gunlukP.isOpen() || gazeteP.isOpen();

  function pencereDurdur(): void {
    if (!pencereAcik()) pencereOncesiHiz = hiz;
    setTool(null);
    tuccarKapat();
    setSpeed(0);
  }

  function gunlukAc(): void {
    if (giris.isOpen() || secici.isOpen()) return;
    pencereDurdur();
    gazeteP.hide();
    gunlukP.show(s);
    ses.play('secim');
  }

  function gazeteAc(g: Gazete): void {
    if (giris.isOpen()) return;
    pencereDurdur();
    gunlukP.hide();
    gazeteP.show(g);
    ses.play('hedef');
  }

  function pencereKapat(): void {
    if (!pencereAcik()) return;
    gunlukP.hide();
    gazeteP.hide();
    setSpeed(pencereOncesiHiz);
    kartSecimiAc(); // gazete yıl sonunda açıldıysa bekleyen kart seçimi sonra gelir
  }

  // ---- Geri al ----
  /** Geri al düğmesinin durumu ve başlığı (ne geri alınacak). */
  function geriAlGuncelle(): void {
    const k = geriAlY.kayitlar[geriAlY.kayitlar.length - 1];
    hud.setUndo(!!k && !s.bitti, k ? t('hud.geriAl', { ne: geriAlAdi(k.tur, k.binaTur) }) : t('hud.geriAlYok'));
  }

  function geriAlAdi(tur: GeriAlTur, binaTur?: BuildingType): string {
    const bina = binaTur ? binaAd(binaTur) : '';
    switch (tur) {
      case 'bina': return t('geriAl.bina', { bina });
      case 'yikim': return t('geriAl.yikim', { bina });
      case 'yukseltme': return t('geriAl.yukseltme', { bina });
      case 'yol': return t('geriAl.yol');
      case 'yolYikim': return t('geriAl.yolYikim');
    }
  }

  /** Geri alınamayan eylem (takas, kart, istek teslimi, anıt aşaması) ve gün sonu yığını boşaltır. */
  function geriAlSifirla(): void {
    geriAlTemizle(geriAlY);
    geriAlGuncelle();
  }

  /** Eylem başarılı oldu: eylemden önceki durum yığına girer. */
  function geriAlKaydet(onceki: GameState, tur: GeriAlTur, binaTur?: BuildingType): void {
    geriAlEkle(geriAlY, onceki, tur, binaTur);
    geriAlGuncelle();
  }

  function geriAlYap(): void {
    if (s.bitti || giris.isOpen() || secici.isOpen() || !geriAlinabilir(geriAlY)) return;
    const r = geriAl(geriAlY, s);
    if (!r) return;
    const eski = s;
    s = r.durum;
    sahneFarkiniUygula(eski, s);
    ses.play('kurulum');
    toasts.show(t('bildirim.geriAlindi', { ne: geriAlAdi(r.kayit.tur, r.kayit.binaTur) }), 'bilgi');
    geriAlGuncelle();
    bilgiYenile();
    arayuzYenile();
    input.refresh();
  }

  /** Geri alınan durumla sahne arasındaki farkı çizer: giden binalar yıkılır, gelenler kurulur, seviye ve patikalar güncellenir. */
  function sahneFarkiniUygula(eski: GameState, yeni: GameState): void {
    const eskiB = new Map(eski.binalar.map((b) => [b.id, b]));
    const yeniB = new Set(yeni.binalar.map((b) => b.id));
    for (const b of eski.binalar) if (!yeniB.has(b.id)) renderer.removeBuilding(b.id);
    for (const b of yeni.binalar) {
      const o = eskiB.get(b.id);
      if (!o) {
        renderer.addBuilding(b.id, b.type, b.x, b.z, b.rot, b.seviye, true, b.baglanti ?? null);
        if (b.insaat) renderer.setMonumentStage(b.id, monumentStage(b), false);
        continue;
      }
      if (o.seviye !== b.seviye) renderer.setBuildingLevel(b.id, b.seviye);
      if (JSON.stringify(o.baglanti ?? null) !== JSON.stringify(b.baglanti ?? null)) renderer.setBuildingLink(b.id, b.baglanti ?? null);
    }
    const yeniY = new Set(yeni.yollar.map((r) => r.id));
    const eskiY = new Set(eski.yollar.map((r) => r.id));
    for (const r of eski.yollar) if (!yeniY.has(r.id)) renderer.removeRoad(r.id);
    for (const r of yeni.yollar) if (!eskiY.has(r.id)) renderer.addRoad(r.id, r.tur, r.noktalar);
  }

  /** Takas menüsü açılmadan önceki hız: menü kapanınca oyun bu hızla sürer. */
  let tuccarOncesiHiz = 1;

  /** Takas menüsünü açar ve oyunu durdurur (tüccar kasabadaysa; HUD'daki 🛒 düğmesi). */
  function tuccarAc(): void {
    if (!tuccarVarMi(s.gun) || tuccar.isOpen() || s.bitti) return;
    tuccarOncesiHiz = hiz > 0 ? hiz : duraklamadanOnce;
    setTool(null);
    setSpeed(0);
    tuccar.open();
    tuccar.update(s);
    ses.play('secim');
  }

  /** Takas menüsünü kapatır; oyun önceki hızıyla sürer. Tüccar kalış günleri boyunca kasabada kalır. */
  function tuccarKapat(): void {
    if (!tuccar.isOpen()) return;
    tuccar.close();
    setSpeed(tuccarOncesiHiz);
  }

  /** Gezgin tüccarla takas (panel düğmeleri). */
  function ticaret(g: Good, miktar: number, alim: boolean): void {
    const c = alim ? canBuy(s, g, miktar) : canSell(s, g, miktar);
    if (!c.ok) {
      const m = t(c.sebep === 'kota' ? 'bildirim.kotaDoldu' : c.sebep === 'para' ? 'bildirim.paraYok'
        : c.sebep === 'stok' ? 'bildirim.stokYok' : c.sebep === 'depo' ? 'bildirim.depoDolu' : 'bildirim.tuccarYok');
      toasts.show(m, 'kotu');
      return;
    }
    if (alim) buyGood(s, g, miktar);
    else sellGood(s, g, miktar);
    geriAlSifirla();
    istekKontrol(); // ör. kış hazırlığı için odun alındı
    bilgiYenile();
    arayuzYenile();
  }

  /** Şenlik isteği: stoktan yemeği teslim et. */
  function senlik(): void {
    const r = deliverFeast(s);
    if (!r) {
      toasts.show(t('bildirim.senlikYemekYok'), 'kotu');
      return;
    }
    geriAlSifirla();
    toasts.show(istekTamamMetni(r), 'iyi');
    bilgiYenile();
    arayuzYenile();
  }

  /** Oyuncu eyleminden sonra istek tamamlandı mı (ödül hemen verilir). */
  function istekKontrol(): void {
    const r = checkRequest(s);
    if (r) toasts.show(istekTamamMetni(r), 'iyi');
  }

  /** Anıt (Saat Kulesi): bilgi panelindeki "Malzeme gönder" düğmesi. */
  function anitIlerlet(id: number): void {
    const c = canAdvanceMonument(s, id);
    if (!c.ok) {
      const m = c.sebep === 'para' ? t('bildirim.asamaParaYok') : c.sebep === 'tas' || c.sebep === 'odun' || c.sebep === 'mobilya'
        ? yerlestirmeSebebi(c.sebep) : t('bildirim.zatenTamam');
      toasts.show(m, 'kotu');
      return;
    }
    const m = advanceMonument(s, id);
    const b = s.binalar.find((x) => x.id === id);
    if (m === null || !b) return;
    geriAlSifirla();
    const asama = monumentStage(b);
    renderer.setMonumentStage(id, asama);
    ses.play(asama >= 4 ? 'hedef' : 'seviye');
    renderer.floatText(b.x, b.z, `−${m}`, KIRMIZI);
    bilgiYenile();
    arayuzYenile();
    input.refresh();
  }

  function yerlestir(tur: BuildingType, x: number, z: number, rot: number): void {
    const c = canPlace(s, tur, x, z);
    if (!c.ok) {
      toasts.show(yerlestirmeSebebi(c.sebep ?? 'cakisiyor'), 'kotu');
      return;
    }
    const onceki = anlikGoruntu(s);
    const b = placeBuilding(s, tur, x, z, rot);
    if (!b) return;
    geriAlKaydet(onceki, 'bina', tur);
    renderer.addBuilding(b.id, b.type, b.x, b.z, b.rot, b.seviye, true, b.baglanti ?? null);
    ses.play('kurulum');
    if (tur === 'ev' || tur === 'cesme') ogretici.olay(tur);
    if (b.insaat) renderer.setMonumentStage(b.id, 0); // anıt: yalnızca taban + iskele kurulur
    renderer.floatText(b.x, b.z, `−${BUILDINGS[tur].maliyet}`, KIRMIZI);
    istekKontrol(); // ağaçlandırma, susuz ev
    arayuzYenile();
    input.refresh();
  }

  function yik(id: number): void {
    const b = s.binalar.find((x) => x.id === id);
    if (!b) return;
    const { x, z } = b;
    const odun = b.dogal ? getBuildingInfo(s, id)?.kesimOdun ?? 0 : 0;
    const onceki = anlikGoruntu(s);
    const iade = demolish(s, id);
    if (iade === null) {
      if (b.dogal) toasts.show(t('bildirim.agacParaYok'), 'kotu');
      return;
    }
    geriAlKaydet(onceki, 'yikim', b.type);
    renderer.removeBuilding(id);
    if (iade < 0) renderer.floatText(x, z, `−${-iade} 💰  +${odun} 🪵`, KIRMIZI);
    else if (odun > 0) renderer.floatText(x, z, `+${odun} 🪵`, ALTIN);
    else if (iade > 0) renderer.floatText(x, z, `+${iade}`, ALTIN);
    if (secili?.kind === 'bina' && secili.id === id) secili = null;
    istekKontrol(); // ör. susuz ev yıkıldıysa istek kalkar
    bilgiYenile();
    arayuzYenile();
    input.refresh();
  }

  function yolCiz(tur: RoadType, noktalar: Vec2[]): void {
    const plan = planRoad(s, tur, noktalar);
    if (!plan.ok) {
      toasts.show(yerlestirmeSebebi(plan.sebep ?? 'kisa'), 'kotu');
      return;
    }
    const onceki = anlikGoruntu(s);
    const r = placeRoad(s, tur, noktalar);
    if (!r) return;
    geriAlKaydet(onceki, 'yol');
    renderer.addRoad(r.id, r.tur, r.noktalar);
    ses.play('yol');
    ogretici.olay('yol');
    const m = ortaNokta(r.noktalar);
    renderer.floatText(m.x, m.z, `−${plan.maliyet}`, KIRMIZI);
    arayuzYenile();
    input.refresh();
  }

  function yolYik(id: number): void {
    const r = s.yollar.find((x) => x.id === id);
    if (!r) return;
    const m = ortaNokta(r.noktalar);
    const eskiBag = new Map(s.binalar.map((b) => [b.id, b.baglanti?.yol]));
    const onceki = anlikGoruntu(s);
    const iade = demolishRoad(s, id);
    if (iade === null) {
      toasts.show(t('bildirim.yolBagli'), 'kotu');
      return;
    }
    geriAlKaydet(onceki, 'yolYikim');
    renderer.removeRoad(id);
    // Bağlı olduğu yol yıkılan binaların patikası en yakın kalan yola taşınır.
    for (const b of s.binalar) {
      if (eskiBag.get(b.id) !== b.baglanti?.yol) renderer.setBuildingLink(b.id, b.baglanti ?? null);
    }
    renderer.floatText(m.x, m.z, `+${iade}`, ALTIN);
    if (secili?.kind === 'yol' && secili.id === id) secili = null;
    bilgiYenile();
    arayuzYenile();
    input.refresh();
  }

  /** Şu an iğnesi olan binalar: artık sorunu olmayanın iğnesi kalkar. */
  let ignesiOlanlar = new Set<number>();

  /** Harita iğneleri: evde karşılanmayan ihtiyaç (anlık), üretim binasında son günün sorunu. */
  function uyarilariGuncelle(): void {
    const yeni = new Set<number>();
    for (const p of buildingPins(s, sonGun)) {
      if (yeni.has(p.id)) continue;
      yeni.add(p.id);
      renderer.setPin(p.id, igneGorunumu(p));
    }
    for (const id of ignesiOlanlar) if (!yeni.has(id)) renderer.setPin(id, null);
    ignesiOlanlar = yeni;
  }

  function arayuzYenile(): void {
    uyarilariGuncelle();
    hud.update(s);
    menu.update(s);
    goal.update(s);
    istekKarti.update(s);
    uyariListesi.update(s);
    kasabaYolu.update(s);
    tuccar.update(s);
  }

  /** Kayıt yükleme / yeni oyun: sahneyi animasyonsuz kurar (ormanlar ve başlangıç yolu dahil). */
  function sahneyiKur(): void {
    renderer.clearBuildings();
    renderer.clearRoads();
    for (const r of s.yollar) renderer.addRoad(r.id, r.tur, r.noktalar, false);
    for (const b of s.binalar) {
      renderer.addBuilding(b.id, b.type, b.x, b.z, b.rot, b.seviye, false, b.baglanti ?? null);
      if (b.insaat) renderer.setMonumentStage(b.id, monumentStage(b), false); // yarım anıt
    }
    renderer.setPopulation(s.nufus);
    ignesiOlanlar = new Set(); // sahne yeniden kuruldu: eski iğneler binalarla gitti
    uyarilariGuncelle();
  }

  function gunSonu(r: DayReport): void {
    if (r.vergi > 0) ses.play('vergi');
    geriAlSifirla(); // ekonomi işlendi: bugünün eylemleri artık geri alınamaz
    ogretici.olay('gunSonu');
    hud.setReport(r);
    sonGun = { uretimSorunlari: r.uretimSorunlari, evStokEksikleri: r.evStokEksikleri, mutsuzEvler: r.mutsuzEvler };
    renderer.setPopulation(s.nufus);
    for (const v of r.binaVergileri) {
      const b = s.binalar.find((x) => x.id === v.id);
      if (b && v.miktar > 0) renderer.floatText(b.x, b.z, `+${v.miktar}`, ALTIN);
    }

    let buyuyen = 0;
    let kuculen = 0;
    let enYeni = 0;
    for (const c of r.seviyeDegisimleri) {
      renderer.setBuildingLevel(c.id, c.yeni);
      if (c.yeni > c.eski) {
        buyuyen++;
        enYeni = Math.max(enYeni, c.yeni);
      } else kuculen++;
    }
    if (buyuyen > 0) ses.play('seviye');
    if (buyuyen === 1) toasts.show(t('bildirim.evOldu', { seviye: kucuk(evSeviyeAd(enYeni)) }), 'iyi');
    else if (buyuyen > 1) toasts.show(t('bildirim.evlerBuyudu', { n: buyuyen }), 'iyi');
    if (kuculen === 1) toasts.show(t('bildirim.evKuculdu'), 'kotu');
    else if (kuculen > 1) toasts.show(t('bildirim.evlerKuculdu', { n: kuculen }), 'kotu');

    if (r.yeniHedefler.length > 0) ses.play('hedef');
    // Tamamlanan hedefi kart kutlar (aynı gün birden çoksa sonuncusu); büyük dönüm noktaları ayrıca bildirilir.
    const sonHedef = r.yeniHedefler[r.yeniHedefler.length - 1];
    if (sonHedef !== undefined && GOALS[sonHedef]) goal.kutla(hedefMetni(sonHedef).ad, r.hedefOdulu);
    for (const i of r.yeniHedefler) {
      if (i === KASABA_TAMAM_HEDEFI) toasts.show(t('bildirim.kasabaTamam'), 'iyi');
      if (i === GOALS.length - 1) toasts.show(t('bildirim.efsane'), 'iyi');
    }
    for (const tur of r.yeniAcilanlar) toasts.show(t('bildirim.yeniBina', { bina: binaAd(tur) }), 'iyi');
    if (r.tamamlananIstek) toasts.show(istekTamamMetni(r.tamamlananIstek), 'iyi');
    if (r.yeniIstek) toasts.show(t('bildirim.yeniIstek', { ad: istekAd(r.yeniIstek) }), 'bilgi');
    if (tuccarGeldiMi(s.gun)) toasts.show(t('bildirim.tuccarGeldi', { gun: BALANCE.ticaret.kalis }), 'bilgi');
    else if (tuccarKalisGunu(s.gun) === 1) toasts.show(t('bildirim.tuccarGidiyor'), 'bilgi');
    const mb = mevsimBildirimi(s.gun);
    if (mb) toasts.show(mb.metin, mb.tur);

    if (!r.oyunBitti && s.borcGunu > 0) {
      toasts.show(t('bildirim.borc', { sinir: BALANCE.borcSiniri, gun: s.borcGunu, toplam: BALANCE.borcGunSiniri }), 'kotu');
    }

    bilgiYenile();
    arayuzYenile();
    input.refresh();
    kaydet(s);
    if (r.oyunBitti || s.bitti) bitisGoster();
    else if (r.gazete && gazeteGosterilsin()) gazeteAc(r.gazete); // kart seçimi gazete kapanınca
    else {
      if (r.gazete) toasts.show(t('bildirim.gazete', { yil: r.gazete.yil }), 'bilgi');
      kartSecimiAc();
    }
  }

  function bitisGoster(): void {
    setTool(null);
    const evler = s.binalar.filter((b) => b.type === 'ev');
    const enYuksek = evler.reduce((m, b) => Math.max(m, b.seviye), 0);
    sonKart.replaceChildren();
    sonKart.append(el('div', 'son-ikon', '🏚️'), el('h2', '', t('son.baslik')), el('p', '', t('son.metin')));
    const kutular = el('div', 'son-kutular');
    for (const [ikon, v, a] of [
      ['📅', String(s.gun), t('son.gun')],
      ['👥', String(s.nufus), t('son.nufus')],
      ['🏠', enYuksek > 0 ? evSeviyeAd(enYuksek) : '—', t('son.enYuksekEv')],
    ]) {
      const k = el('div', 'kutu');
      k.append(el('div', 'deger', `${ikon} ${v}`), el('div', 'etiket', a));
      kutular.appendChild(k);
    }
    sonKart.appendChild(kutular);
    const b = el('button', 'dugme birincil', t('son.yeni'));
    b.addEventListener('click', sifirla);
    sonKart.appendChild(b);
    son.style.display = 'flex';
  }

  function sifirla(): void {
    try {
      localStorage.removeItem(KAYIT_ANAHTARI);
    } catch {
      /* yok say */
    }
    s = createGame(rastgeleTohum());
    sonGun = null;
    geriAlSifirla();
    gunlukP.hide();
    gazeteP.hide();
    hud.setReport(null);
    renderer.rebuildTerrain();
    secili = null;
    arac = null;
    menu.setSelected(null);
    info.show(null);
    son.style.display = 'none';
    sahneyiKur();
    renderer.setSeason(mevsim(s.gun), true);
    renderer.setMerchant(tuccarVarMi(s.gun) ? tuccarKonumu() : null, true);
    tuccar.close();
    arayuzYenile();
    input.refresh();
    setSpeed(1);
    toasts.show(t('genel.ipucu'), 'bilgi');
    secici.hide();
    ogretici.baslat();
  }

  // ---- Başlangıç ----
  sahneyiKur();
  renderer.setSeason(mevsim(s.gun), true);
  renderer.setMerchant(tuccarVarMi(s.gun) ? tuccarKonumu() : null, true);
  arayuzYenile();
  input.refresh();
  // Oyun giriş ekranıyla, duraklı açılır; ilk ipucu, öğretici ve bekleyen kart seçimi oyuna girince gelir.
  menuAc();
  document.getElementById('yukleme')?.classList.add('bitti');
  window.setTimeout(() => document.getElementById('yukleme')?.remove(), 600);

  window.addEventListener('resize', () => renderer.resize());
  // Ctrl+Z / Cmd+Z: geri al. Esc: günlük / gazete penceresini kapatır.
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyZ') {
      e.preventDefault();
      if (!e.repeat) geriAlYap();
    } else if (e.code === 'Escape' && pencereAcik()) pencereKapat();
  });
  // Gün ortasında kapatılırsa son yerleştirmeler kaybolmasın.
  // Hiç girilmemiş yeni kasaba kaydedilmez: oyuncu başlamadan çıkarsa "Devam et" çıkmasın.
  window.addEventListener('pagehide', () => {
    if (girildi || !yuklenen.yeni) kaydet(s);
  });

  let onceki = performance.now();
  const kare = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - onceki) / 1000));
    onceki = now;
    if (giris.isOpen()) renderer.orbit(dt * 0.05); // menünün arkasında kasaba yavaşça döner
    if (!s.bitti && hiz > 0) {
      const r = tick(s, dt * hiz);
      if (r) gunSonu(r);
    }
    renderer.setDayProgress(s.gunIlerleme);
    renderer.setSeason(mevsim(s.gun)); // aynı mevsimde bir şey yapmaz; değişince yumuşak geçiş
    renderer.setMerchant(tuccarVarMi(s.gun) ? tuccarKonumu() : null);
    ses.setAmbience(mevsim(s.gun), renderer.getZoom01());
    ses.setPaused(hiz === 0);
    hud.setDayProgress(s.gunIlerleme);
    renderer.update(dt);
    requestAnimationFrame(kare);
  };
  requestAnimationFrame(kare);
}

/** main.ts dil dosyasını yükledikten sonra çağırır. */
export async function oyunuBaslat(): Promise<void> {
  const container = document.getElementById('sahne');
  const ui = document.getElementById('arayuz');
  if (!container || !ui) throw new Error('#sahne ya da #arayuz bulunamadı');

  if (new URLSearchParams(location.search).has('preview')) {
    const mods = import.meta.glob('./render/preview.ts');
    const yukle = mods['./render/preview.ts'];
    if (yukle) {
      const m = (await yukle()) as { runPreview?: (c: HTMLElement) => void };
      if (m.runPreview) {
        m.runPreview(container);
        return;
      }
    }
    console.warn('src/render/preview.ts bulunamadı, oyun başlıyor.');
  }

  startGame(container, ui);
}
