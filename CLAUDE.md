# Kartonia — CLAUDE.md

Oyunun adı **Kartonia** (eski çalışma adı Kağıt Kasaba). Klasör, paket adı ve `localStorage` anahtarları (`kagit-kasaba-*`) eski adla kalır; anahtarı değiştirmek oyuncuların kayıtlarını siler.

Bu klasör bağımsız bir oyundur. Üst klasördeki `sehir/CLAUDE.md` (Mini Şehir kart oyunu) bu projeye **uygulanmaz**; tek geçerli belge budur.

Bilgisayar tarayıcısında oynanan, 3D, kağıttan maket görünümlü bir kasaba kurma oyunu. Oyuncu yuvarlak bir karton zeminin üstüne serbestçe (ızgarasız) kağıt binalar koyar. Sakinler vergi öder, vergiyle yeni binalar kurulur. Küçük bir üretim zinciri vardır. Gökdelen, apartman yok: en büyük yapı iki katlı ev ve saat kulesidir.

## His

- Ekranın tamamı arazi: masa, kenar ya da boşluk görünmez. Arazi kağıt maket dokusunda (katlanmış kağıt tepeler, kağıt ağaçlar).
- Binalar düz renkli kağıttan katlanmış gibi: düz gölgelendirme (flat shading), hafif kağıt dokusu, koyu ince kenar çizgileri, yumuşak gölgeler, sıcak ışık.
- Ağaçlar karton ayak üstünde duran kesik kağıt siluetler.
- Bina konunca kağıt maket gibi parça parça katlanarak kurulur (aşağıya bak).
- Renkler pastel ve sıcak. Palet tek dosyada: `src/render/palette.ts`.

## Arazi

- Harita `src/data/map.ts`: oynanabilir alan ~96×96 yuvarlatılmış kare (`ADA_KENAR`), dışında `DIS_SINIR` (85) yarı genişliğe kadar dekoratif arazi: yoğun orman ve tepeler, bina/yol konmaz. Sınır zeminde kağıt çit/şeritle belli. Sorgular `src/logic/terrain.ts` (heightAt, isLand, isLake).
- **Rastgele harita:** Her yeni oyunda oynanabilir alanın içeriği (3–5 göl, 6–8 tepe, 7–9 orman, 2–4 taşlık, rastgele bir kenardan merkeze giren hazır toprak yol) bir tohumdan üretilir (`haritaUret`). Tohum `GameState.haritaTohum` olarak kaydedilir, aynı tohum hep aynı haritayı verir. Merkez çevresi boş kalır; yol karada, göl ve orman dışındadır. Tohumsuz eski kayıtlar elle yapılmış `KLASIK_HARITA` ile açılır. Etkin harita `HARITA` nesnesidir; `createGame` ve `deserialize` onu ayarlar, çizim `rebuildTerrain()` ile yeniden üretir. Sınır dışı dekor her haritada aynıdır.
- Kamera hedefi oynanabilir alanda kalır; yakınlaşma ve açı sınırları ekranda hiçbir zaman çizilen arazinin dışı görünmeyecek şekilde ayarlıdır.
- Göle bina ve yol konmaz. Bina tabanındaki yükseklik farkı `egimSiniri`'ni aşamaz.
- Ormanlar oyun başında doğal ağaçlarla dolar (`dogal: true` ağaç binaları, deterministik tohum). Doğal ağaç kesilebilir: para öder, odun verir. Oduncu doğal ağaçları da sayar.

## Yollar

- İki tür: Toprak (ucuz, baştan açık) ve Asfalt (pahalı, günlük gider, 35 nüfusta açılır, kenarındaki evlere +mutluluk). Tanımlar `ROADS` (`src/data/buildings.ts`).
- Serbest fırça: sol tuşla sürükleyerek çizilir. Noktalar yeniden örneklenir, uçlar yakın yollara kenetlenir. En az bir ucu mevcut bir yola kenetlenmeli. Maliyet uzunlukla orantılı.
- Yol ada dışına, göle ya da bir binanın/ağacın üstüne geçemez. Yollar birbirini kesebilir.
- Ağaç dışındaki her bina bir yolun kenarında olmalı (`yolYakinlik`). Bina yol kenarına konurken önü otomatik yola döner (Q/E ile ince ayar).
- Bina konunca kapısından en yakın yol noktasına kısa bir kağıt patika kendiliğinden çizilir (`Building.baglanti`, ücretsiz, yalnızca görsel). Bağlı yol yıkılırsa patika kalan en yakın yola taşınır.
- Yol yıkılabilir (%50 iade), ama bir bina yakınlığını yalnızca o yoldan alıyorsa yıkılamaz.

## Canlılık

Kasaba yaşıyor gibi görünür (yalnızca çizim, mantığa etkisi yok): nüfusa göre yollarda yürüyen kağıt insanlar (evden işe/pazara/okula gidip gelir), tarlada çiftçi, pazarda kalabalık, bacalardan kağıt duman, göllerde ördek, gökyüzünde kuş sürüleri, yolda ara sıra el arabası. Kod: `src/render/life.ts`.

Binaların altında daire/kaide yoktur; bina araziye gömülerek oturur.

## Kurulma animasyonu

Bina kağıt maket gibi kurulur: önce düz bir kağıt açınım (taban izi) yere serilir, duvarlar sırayla alt kenarlarından menteşe gibi kalkar, çatı yarıları katlanarak kapanır, en son küçük detaylar (pencere, baca, tente) yerine oturur. Yol kağıt şerit gibi baştan sona açılarak serilir. Yıkımda tersi.

## Zaman

- Gerçek zamanlı. 1 gün = 15 saniye (1x hızda). Hız: duraklat / 1x / 2x / 3x.
- Her gün sonunda ekonomi işlenir (`endDay`).
- **Mevsimler** (`logic/season.ts`, `BALANCE.mevsim`): yıl 18 gün = İlkbahar 5, Yaz 5, Sonbahar 5, Kış 3. Mevsim `gun`dan türetilir, durumda alan yok. Kışın Tarla üretmez (`kisinUretmez`), 3. seviye evlerin odun tüketimi 2 katı; başka hiçbir şey değişmez. Diğer mevsimler yalnızca görsel. HUD'da mevsim + "kışa X gün", sonbaharın ilk günü uyarı. Çizim: `GameRenderer.setSeason(m, anlik?)` (`render/season.ts`): sonbaharda yapraklar hardal/terrakota, kışın karlı zemin, buzlu göl, açık renkli ağaçlar, düşen kağıt kar (tek InstancedMesh), 3 sn yumuşak geçiş.
- **Gezgin tüccar** (`logic/trade.ts`, `BALANCE.ticaret`): her 8 günde bir gelir ve 3 gün kalır (8–10, 16–18, ...; `aralik`, `kalis`), başlangıç yolunun kenar ucunda durur. Sabit fiyatlar (satış < alış), ziyaret başına 40 birim kota (bütün ziyaret için; `tuccarKota`, ziyaret bitince silinir). HUD'da 🛒 düğmesi → takas paneli (`ui/tradePanel.ts`). Çizim: `GameRenderer.setMerchant(konum, anlik?)`.
- **Sakin istekleri** (`logic/requests.ts`, `BALANCE.istek`): nüfus > 10 iken en fazla bir istek, biri bitince 3 gün sonra yenisi, süre 4 gün, dolarsa cezasız kalkar. Tür tohum + günden deterministik. Şenlik (30 yemek → 3 gün +5 mutluluk), Ağaçlandırma (5 ağaç → 40 para), Kış hazırlığı (sonbaharda 40 odun → 60 para), Susuz ev (bir ev suya kavuşsun → 30 para). Hedef kartının altında istek kartı.
- **Karar kartları** (`data/cards.ts`, `logic/cards.ts`): 50, 100 ve 150. günlerin sonunda (`BALANCE.kartSecimi`, `kartGunSonu`; toplam 3 kart) oyun duraklar, tohum + seçim numarasından deterministik üç kart (seçilen tekrar gelmez); seçim kalıcı (`kararlar`), bekleyen seçim `bekleyenKararlar`. 8 kart, her birinin artısı ve eksisi var. Kartların etkilediği değerler ekonomide `ayar(s, anahtar)` ile okunur (taban + kart etkileri); karta özel `if` yazılmaz. Seçim ekranı `ui/cardPicker.ts`; seçilen kartlar sol alt köşedeki "Kasabanın yolu" kartında hep yazar (`ui/cardList.ts`).
- **Öğretici** (`ui/tutorial.ts`): yalnızca ilk oyunda, atlanabilir, beş adım; eylemle ilerler, oyunu durdurmaz. Gösterildi bilgisi `localStorage` `kagit-kasaba-ogretici` (kayıttan ayrı).
- **Giriş ekranı** (`ui/titleScreen.ts`): oyun her açılışta duraklı olarak bunu gösterir; arkada kasaba yavaşça döner (`GameRenderer.orbit`), oyun arayüzü gizlidir (`#arayuz.menude`). Kayıt varsa "Devam et" (gün · mevsim · nüfus) ve "Yeni kasaba" (onay kartıyla), yoksa yalnızca "Yeni kasaba" (arkadaki yeni harita kullanılır). Ayrıca "Nasıl oynanır" kartı ve ses aç/kapa. Dokunmatik cihazda "fare ve klavye için tasarlandı" notu. Oyun içinde sağ üstteki ☰ Menü düğmesi aynı ekranı açar. İlk ipucu, öğretici ve bekleyen kart seçimi oyuna girince gelir. Yükleme ekranı (`#yukleme`) `index.html` içinde düz HTML'dir, menü hazır olunca kalkar.
- **Dil** (`src/lang/tr.json`, `src/lang/en.json`, yükleyici `ui/i18n.ts`): oyuncunun gördüğü bütün metinler bu dosyalardadır; kodda metin yazılmaz. Anahtarlar düz ve noktalıdır (`"hud.para"`), yer tutucular `{ad}` biçimindedir: `t('bildirim.yeniBina', { bina })`. Anahtar tipi `tr.json`'dan türetilir, olmayan anahtar derlemede hata verir. Bina, yol, mal, ihtiyaç, mevsim, kart, hedef ve komşuluk metinleri de buradadır (`binaAd`, `kartMetni`, `hedefMetni` …); `data/` ve `logic/` içindeki Türkçe `ad`/`aciklama` alanlarını arayüz göstermez. Yeni metin: önce `tr.json`'a, sonra aynı anahtarla her dil dosyasına. `tests/lang.test.ts` her dil dosyasında anahtarların ve yer tutucuların `tr.json` ile aynı olduğunu denetler. Yeni dil: `lang/<kod>.json` + `i18n.ts`'teki `Dil` ve `DILLER`. Yalnızca seçili dilin dosyası yüklenir: `main.ts` başlatıcıdır, `dilYukle()` bitince oyunu (`oyun.ts`) dinamik olarak açar. Dil açılışta bir kez belirlenir (`localStorage` `kagit-kasaba-dil`, yoksa tarayıcı dili; tr değilse en). Giriş ekranındaki dil düğmeleri kaydedip sayfayı yeniler. `index.html`'deki küçük betik, JS gelmeden yükleme ekranını ve sayfa başlığını aynı kuralla çevirir.
- **Ses** (`src/audio/`, sözleşme `audio/api.ts`): dosya yok, Web Audio ile efekt, ortam (mevsime göre, kamera uzaklaştıkça kısılır) ve yavaş pentatonik müzik. İlk tıklamada başlar. HUD 🔊 düğmesi ses panelini açar: aç/kapa, Genel ve Müzik düzeyi sürgüleri; ayar `localStorage` `kagit-kasaba-ses` = `{acik, genel, muzik}`. Ses katmanı mantığa ve çizime dokunmaz, main olay bildirir.

## Göstergeler

Para (başlangıç 150), Nüfus, Mutluluk (0–100, nüfusa göre ağırlıklı ortalama), ve 6 mal stoğu: Buğday, Un, Yemek, Odun, Taş, Mobilya. Her malın sınırı 200, her Ambar +100 ekler (`stockLimit`).

## Binalar

Tanımlar `src/data/buildings.ts` içindedir; denge değerleri orada ayarlanır.

| Bina | Ne yapar |
|---|---|
| Ev | Sakin barındırır, vergi öder. Seviye 1–3 (kulübe → ev → iki katlı ev). |
| Ağaç | Yakındaki evlere mutluluk. Oduncunun hammaddesi. |
| Tarla | Buğday üretir. |
| Çeşme | Etki alanındaki evlere su sağlar. |
| Değirmen | Buğday → un. Yakın evlere gürültü (−mutluluk). |
| Fırın | 4 un → 8 yemek (ekmek). Etki alanındaki evlere yemek satar. |
| Oduncu | Etki alanındaki ağaç başına odun üretir. Gürültü. |
| Pazar | Etki alanındaki evlere pazar erişimi; stoktaki yemeği evlere satar (Hal kaldırıldı, eski kayıtlarda Hal → Pazar). |
| Okul | Etki alanındaki evlere okul erişimi, mutluluk. |
| Saat Kulesi | Anıt: 100 paraya iskele, sonra bilgi panelindeki "Malzeme gönder" ile 4 aşama (100+20 taş, 100+30 odun, 150+20 mobilya, 200+30 taş+20 mobilya; `BALANCE.anit`). `Building.insaat` = kalan aşama; alan yoksa tamam (eski kayıtlar). Aura, gider ve hedef 5 yalnızca tamamlanınca. Yıkımda harcanan paranın yarısı, mallar dönmez. |
| Hastane | Etki alanındaki evlere sağlık, mutluluk. Yükseltilebilir. |
| Ambar | Bütün mal stoklarının sınırını 100 artırır. |
| Balıkçı | Göl kıyısına kurulur (`golKiyisi`), 3 yemek (balık) üretir: fırından az ama zincirsiz. |
| Taş Ocağı | Yalnızca haritadaki taşlık alanlara kurulur, taş çıkarır. Gürültü. |
| Marangoz | Odun → mobilya. Biraz gürültü. |

## Ekonomi kuralları

- **Yerleştirme:** Her binanın dairesel bir taban yarıçapı var. Bina tamamen adanın içinde olmalı ve başka binayla çakışmamalı (aralarında en az 0.1 boşluk). Döndürme serbesttir, çakışmayı etkilemez. Para yetmeli ve bina açılmış olmalı.
- **Yıkma:** Maliyetin (yükseltmelere harcanan dahil) %50'si geri gelir.
- **Yükseltme:** Çeşme, Pazar, Okul ve Hastane bilgi panelinden yerinde 3. seviyeye kadar yükseltilir. Taban değişmez; etki yarıçapı ×1 / ×1.4 / ×1.8, gider ×1 / ×1.5 / ×2 (yuvarlanır). Seviye 2 maliyeti kurulumun %60'ı + 10 taş, seviye 3 maliyeti kurulumun %100'ü + 25 taş (`BALANCE.yukseltme`). Her seviyede modele küçük bir ek gelir (kat eklenmez).
- **Açılma:** Binalar nüfus eşiğine göre açılır (`acilmaNufus`).
- **İşçi:** Üretim binaları işçi ister. Toplam işçi ihtiyacı nüfustan fazlaysa bütün üretim `nüfus / ihtiyaç` oranında düşer.
- **Üretim sırası:** Tarla → Değirmen → Fırın → Oduncu → Balıkçı → Taş Ocağı → Marangoz. Girdi stokta yoksa üretim girdiyle orantılı düşer. Çıktı stok sınırına dayanırsa üretim de o oranda düşer.
- **Ev ihtiyaçları:**
  - Seviye 1 (3 kişi): ihtiyaç yok.
  - Seviye 2 (6 kişi): su + yemek.
  - Seviye 3 (10 kişi): su + yemek + odun + pazar + okul + mobilya + sağlık.
  - Su/pazar/okul: evin merkezi o binanın etki yarıçapı içindeyse karşılanır.
  - **Yemek** tek bir ortak stoktur. Yemek binaları (Fırın, Balıkçı) aynı `yemek` malını farklı miktarlarda üretir; yeni bir yemek türü eklemek için `yemek` üreten yeni bir bina eklemek yeter. Ev kişi başı günlük 0.25 yemek yer, ama yalnızca bir satış yerinin (Fırın, Pazar; `yemekSatar`) etki alanındaysa. Odun/mobilya global stoktan tüketilir (seviye 3 için kişi başı odun 0.2, mobilya 0.1). Eski kayıtlardaki ekmek ve balık stokları yemeğe aktarılır.
  - Bir üst seviyenin bütün ihtiyaçları 2 gün üst üste karşılanırsa ev 1 seviye atlar. Mevcut seviyenin ihtiyaçları 2 gün üst üste karşılanmazsa 1 seviye düşer.
- **Mutluluk (ev başına):** 45 + etki alanında evi kapsayan binaların `mutluluk` değerleri toplamı (ağaçlar en fazla +9 sayılır) + en iyi yakın yol (asfalt +5) + karşılanan ihtiyaç başına +2, 0–100 sınırlı. Sabitler `BALANCE` içinde (`mutlulukTaban`, `agacMutlulukSinir`, `ihtiyacMutluluk`, `mutlulukMin/Max`). Saat Kulesi olmadan hiçbir ev 100 olmaz.
- **Komşuluk bonusu** (`logic/adjacency.ts`, kurallar `BUILDINGS[t].komsuluk`): Tarla kenarı göle ≤ 4 → buğday +%25; Değirmen merkezde yükseklik ≥ 1 → un +%25; Fırın 6 birim içinde Değirmen → yemek +%25; Marangoz 6 birim içinde Oduncu → mobilya +%25; Ev merkezi göle ≤ 5 → +3 mutluluk. Bonus saklanmaz, her seferinde hesaplanır; yalnızca çıktıyı artırır, girdi aynı. Yerleştirirken hayalet üstünde canlı etiket, bilgi panelinde Bonus satırı.
- **Gelir-gider dökümü:** `DayReport` vergi, `binaGider`, `yolGider`, `net` taşır; HUD'da Para'nın üstüne gelince görünür.
- **Vergi:** Her ev için `floor(nüfus × (0.5 + mutluluk/100) × seviye çarpanı)`; çarpan 1. ve 2. seviyede 1, 3. seviyede 0.6 (`BALANCE.vergiSeviyeCarpani`). Pazar, Okul ve Hastane gideri 9, 12, 15.
- **Gider:** Her binanın günlük gideri (yükseltilmiş binada seviyeye göre).
- **Borç:** Para 3 gün üst üste −50'nin altında biterse oyun biter.
- **Hedefler** (sırayla, tamamlanınca bildirim; sayılabilenlerde kartta ilerleme görünür): 10 nüfus → ilk yemek → 50 nüfus → ilk 3. seviye ev → 150 nüfus ve Saat Kulesi ("Kasaba tamamlandı", yeni hedefler açılır) → bir Çeşme 3. seviye → 200 nüfus ve mutluluk ≥ 70 → 10 tane 3. seviye ev → bir Pazar ve bir Okul 3. seviye → aynı anda 150 yemek ve 100 odun → kasada 1000 para → 300 nüfus → 400 nüfus ve mutluluk ≥ 75 ("Kasaba efsanesi", oyun devam eder).

## Kontroller (masaüstü)

- Sol tık: seçili binayı koy / binayı seç (bilgi paneli).
- Sol sürükle (boş alanda) / WASD / ok tuşları: haritada kaydır. Sağ sürükle: kamerayı döndür. Tekerlek: yakınlaş. Yol aracında sol sürükleme yol çizer.
- Alttaki menü kategorilidir (Yollar, Konut, Üretim, Hizmet + Yık), her kategorinin kendi rengi vardır: kategoriye tıklayınca üstünde binaları açılır. Bina kartları renk değil binanın kendi modelinden üretilmiş resmini gösterir (`src/render/thumbnails.ts`); yol kartlarında kağıt yol çizimi vardır.
- Sağ tık (sürüklemeden): seçili aracı bırakır, araç yoksa seçimi kapatır (Esc ile aynı).
- Q / E: yerleştirilecek binayı döndür. Esc: seçimi bırak. X: yıkma aracı. Boşluk ya da ⏸/▶ düğmesi: duraklat / devam. 1/2/3: hız.

## Teknik mimari

- **Araçlar:** Vite + TypeScript (strict) + Three.js + Vitest. Başka bağımlılık yok. UI framework yok.
- **Mantık** `src/logic/`: saf TypeScript. Three.js, DOM, `window` yok. Bütün kurallar burada ve birim testli. Durum düz veridir, fonksiyonlar durumu yerinde değiştirir.
- **Çizim** `src/render/`: Three.js. Bütün modeller kodla üretilir; görsel varlık dosyası yok (kağıt dokusu canvas ile üretilir). Mantığa yalnızca `types.ts` ve `data/` üzerinden bağlıdır. Dışarıya `src/render/api.ts` içindeki `GameRenderer` arayüzünü verir.
- **Arayüz** `src/ui/` + `src/oyun.ts` (`src/main.ts` yalnızca dili yükleyip oyunu açar): HUD, bina menüsü, bilgi paneli, hedefler, hız düğmeleri düz HTML/CSS. Sol tık ve klavye girişi, oyun döngüsü (`requestAnimationFrame`), kayıt (`localStorage`, her gün sonu otomatik).

```
src/
  data/buildings.ts, map.ts
  logic/   types.ts, geometry.ts, terrain.ts, placement.ts, roads.ts, economy.ts, game.ts, goals.ts, save.ts
  render/  api.ts, palette.ts, paper.ts, scene.ts, terrain.ts, roads.ts, camera.ts, models/*.ts, anim.ts, renderer.ts
  ui/      hud.ts, buildMenu.ts, infoPanel.ts, toast.ts, input.ts, titleScreen.ts, i18n.ts
  lang/    tr.json, en.json
  main.ts  (başlatıcı), oyun.ts
tests/
```

## Yayın

GitHub'da herkese açık depo. `main`'e her push'ta `.github/workflows/deploy.yml` testleri ve `npm run build`'i çalıştırır, `dist/`'i GitHub Pages'te yayınlar (`vite.config.ts` `base: './'` alt klasörde çalışmayı sağlar). Depoya kişisel bilgi (yerel klasör yolu, e-posta) yazılmaz.

## YAPMA listesi

- Gökdelen, apartman, 2 kattan yüksek ev.
- Izgara, kare/altıgen tahta. Yerleşim serbesttir.
- Yol ağı bağlantı analizi (BFS). Bağlantı yalnızca "uç bir yola kenetlenmeli" ve "bina yol kenarında" kurallarıyla sağlanır.
- Köprü, tünel.
- Rastgele afetler, savaş, çok oyunculu, backend.
- Listede olmayan bağımlılıklar.
