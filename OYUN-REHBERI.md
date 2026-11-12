# Kağıt Kasaba: Oyunun Tam Rehberi

Bu belge oyunu iki açıdan anlatır:

1. **Oyun olarak:** nasıl oynanır, kurallar, binalar, sayılar ve stratejiler.
2. **Yazılım olarak:** her parçanın nasıl yapıldığı, hangi dosyada durduğu, nasıl değiştirileceği ve genişletileceği.

Belgedeki bütün sayılar koddan alınmıştır (`src/data/buildings.ts`, `src/data/map.ts`, `src/logic/*.ts`). Denge değeri değişirse önce o dosyalara bakın.

---

## İçindekiler

1. [Oyunun özeti](#1-oyunun-özeti)
2. [Çalıştırma, derleme, test](#2-çalıştırma-derleme-test)
3. [Kontroller](#3-kontroller)
4. [Ekran ve arayüz](#4-ekran-ve-arayüz)
5. [Harita ve arazi](#5-harita-ve-arazi)
6. [Yollar](#6-yollar)
7. [Binalar (tam liste ve sayılar)](#7-binalar)
8. [Bina yerleştirme kuralları](#8-bina-yerleştirme-kuralları)
9. [Zaman ve gün sonu](#9-zaman-ve-gün-sonu)
10. [Ekonomi: üretim, mallar, stok](#10-ekonomi-üretim-mallar-stok)
11. [Evler: seviye, ihtiyaçlar, yemek](#11-evler-seviye-ihtiyaçlar-yemek)
12. [Mutluluk, vergi, gider, borç](#12-mutluluk-vergi-gider-borç)
13. [Hizmet binası yükseltmeleri](#13-hizmet-binası-yükseltmeleri)
    - [Saat Kulesi anıt projesi](#13b-saat-kulesi-anıt-projesi)
    - [Gezgin tüccar ve sakin istekleri](#13c-gezgin-tüccar-ve-sakin-istekleri)
    - [Karar kartları](#13d-karar-kartları)
    - [Öğretici ve ses](#13e-öğretici-ve-ses)
14. [Hedefler](#14-hedefler)
15. [Kayıt sistemi](#15-kayıt-sistemi)
16. [Strateji ve örnek hesaplar](#16-strateji-ve-örnek-hesaplar)
17. [Yazılım mimarisi](#17-yazılım-mimarisi)
18. [Mantık katmanı nasıl yapıldı](#18-mantık-katmanı-nasıl-yapıldı)
19. [Çizim katmanı nasıl yapıldı](#19-çizim-katmanı-nasıl-yapıldı)
20. [Arayüz katmanı nasıl yapıldı](#20-arayüz-katmanı-nasıl-yapıldı)
21. [Testler](#21-testler)
22. [Nasıl genişletilir (tarifler)](#22-nasıl-genişletilir-tarifler)
23. [Bilinçli kararlar ve yapılmayanlar](#23-bilinçli-kararlar-ve-yapılmayanlar)

---

## 1. Oyunun özeti

**Kağıt Kasaba**, bilgisayar tarayıcısında oynanan, tek oyunculu, 3D bir kasaba kurma oyunudur. Her şey kağıttan yapılmış bir maket gibi görünür. Binalar düz renkli kağıttan katlanmıştır, ağaçlar karton ayak üstündeki kesik kağıt siluetlerdir, arazi katlanmış kağıt tepelerden oluşur.

Temel döngü:

1. Yol çizilir, yol kenarına evler kurulur.
2. Evlerde sakinler yaşar ve her gün **vergi** öder.
3. Vergiyle yeni binalar kurulur: su (Çeşme), yemek (Tarla → Değirmen → Fırın, Balıkçı; Fırın ve Pazar evlere satar), odun, mobilya, pazar, okul, sağlık.
4. İhtiyaçları karşılanan evler **büyür** (kulübe → ev → iki katlı ev). Büyüyen ev daha çok insan barındırır ve daha çok vergi öder.
5. Nüfus arttıkça yeni binalar **açılır** ve sıradaki **hedefler** tamamlanır.
6. Para üst üste 3 gün −50'nin altında kalırsa kasaba **iflas eder** ve oyun biter.

Izgara yoktur, binalar serbestçe konur. Gökdelen ve apartman yoktur; en büyük yapılar iki katlı ev ve saat kulesidir.

---

## 2. Çalıştırma, derleme, test

Proje klasörü: `C:\Users\mc.dag\Projects\Oyun\sehir\kagit-kasaba`

| Komut | Ne yapar |
|---|---|
| `npm install` | Bağımlılıkları kurar (ilk seferde). |
| `npx vite --port 5173` ya da `npm run dev` | Geliştirme sunucusunu açar. Oyun: **http://localhost:5173** |
| `npm run build` | Önce `tsc` ile tip denetimi yapar, sonra `vite build` ile `dist/` klasörüne yayın sürümünü üretir. |
| `npm run preview` | `dist/` içindeki yayın sürümünü yerelde sunar. |
| `npm test` ya da `npx vitest run` | Bütün birim testlerini çalıştırır. |
| `npm run typecheck` | Yalnızca tip denetimi yapar. |

`vite.config.ts` içinde `base: './'` vardır. Bu yüzden `dist/` klasörü herhangi bir alt dizinden de çalışır.

**Önizleme modu:** Adres çubuğuna `http://localhost:5173/?preview` yazılırsa oyun yerine `src/render/preview.ts` açılır. Bu ekranda binalar sırayla katlanarak kurulur. Modelleri ve animasyonları görsel olarak denemek için kullanılır.

**Bağımlılıklar:** Yalnızca `three` (+ `@types/three`), `vite`, `typescript` ve `vitest` kullanılır. UI framework'ü, oyun motoru ve animasyon kütüphanesi yoktur.

---

## 3. Kontroller

### Fare

| Hareket | Etki |
|---|---|
| Sol tık | Seçili binayı koyar. Araç seçili değilse tıklanan binayı ya da yolu seçer ve bilgi panelini açar. |
| Sol sürükleme (boş alanda) | Haritada kaydırır. 5 pikselden kısa hareket tıklama sayılır. |
| Sol sürükleme (yol aracı seçiliyken) | Yol çizer (fırça). |
| Sağ sürükleme | Kamerayı döndürür. |
| Sağ tık (sürüklemeden) | Seçili aracı bırakır. Araç yoksa seçimi kapatır (Esc ile aynı). |
| Orta tuş / Shift + sağ sürükleme | Kaydırır. |
| Tekerlek | Yakınlaştırır / uzaklaştırır. |

### Klavye

| Tuş | Etki |
|---|---|
| W A S D / ok tuşları | Haritada kaydırır. |
| Q / E | Yerleştirilecek binayı döndürür. |
| Esc | Seçimi ya da aracı bırakır. |
| X | Yıkma aracını seçer. |
| Boşluk | Duraklatır / devam ettirir. |
| 1 / 2 / 3 | Oyun hızı 1x / 2x / 3x. |

---

## 4. Ekran ve arayüz

- **Üst şerit (HUD):** Gün ve günün ilerleme çubuğu, Para (üstüne gelince dünkü vergi, bina gideri, yol gideri ve net), Nüfus, Mutluluk, altı mal stoğu (🌾 Buğday, 🥣 Un, 🍽️ Yemek, 🪵 Odun, 🪨 Taş, 🪑 Mobilya) ve hız düğmeleri. ⏸ düğmesi duraklatınca ▶'ye döner. Şerit hedef kartının sağından başlar; 1500 pikselden dar pencerede mal adları gizlenir (simge kalır, tam ad fareyle görünür), yine sığmazsa şerit iki satıra kayar.
- **Sol üst hedef kartı:** Sıradaki hedef. Sayılabilen hedeflerde ilerleme `(x / y)` olarak görünür.
- **Alt bina menüsü:** Kategoriler **Yollar**, **Konut**, **Üretim**, **Hizmet** ve **Yık**. Her kategorinin kendi rengi vardır. Kategoriye tıklayınca üstünde kartlar açılır. Bina kartlarında binanın oyundaki 3D modelinden üretilmiş resim, yol kartlarında kağıt yol çizimi vardır. Yeni açılan kartlarda "yeni" noktası görünür. Kilitli kartlar açılma nüfusunu gösterir.
- **Sağdaki bilgi paneli:** Seçili binanın ya da yolun bilgileri:
  - **Ev:** nüfus, mutluluk, tahmini vergi, mevcut ve bir üst seviyenin ihtiyaçları (✓/✗), yakındaki yol türü.
  - **Üretim binası:** işçi oranı. Oduncuda etki alanındaki ağaç sayısı.
  - **Hizmet binası:** etki yarıçapı, gider, **Yükselt** düğmesi. Düğmenin üstüne gelince yeni etki alanının önizlemesi zeminde çizilir.
  - **Doğal ağaç:** kesim maliyeti ve verdiği odun.
  - **Hepsinde:** günlük gider, yıkım iadesi ve Yık düğmesi.
- **Bildirimler (toast):** Kağıt şerit şeklinde. Evlerin büyümesi ya da küçülmesi, tamamlanan hedefler, açılan binalar, borç uyarıları ve yerleştirme hataları burada görünür.
- **Uyarı işareti:** İhtiyaçları karşılanmayan evlerin üstünde küçük bir işaret çıkar.
- **Uçan sayılar:** Gün sonunda her evin üstünden altın renkli `+vergi` yazısı yükselir.
- **İflas ekranı:** Oyun bitince gün, nüfus ve en yüksek ev seviyesi gösterilir. "Yeni kasaba" düğmesi yeni bir rastgele harita açar.

---

## 5. Harita ve arazi

### Boyutlar

- **Oynanabilir alan:** yarı genişliği **48** olan, köşeleri yuvarlatılmış (köşe yarıçapı 9), kenarı hafif dalgalı bir kare (`ADA_KENAR`, 160 noktalı çokgen). Bina ve yol yalnızca buraya konur. `isLand(x, z)` bu çokgene bakar.
- **Dekoratif dış arazi:** `DIS_SINIR` = **85** yarı genişliğe kadar uzanır. Burada yoğun orman ve 12 sabit dış tepe (`DIS_TEPELER`) vardır. Buraya bir şey konmaz. Sınır zeminde kağıt şerit ve kazıklarla işaretlidir.
- Kamera hiçbir zaman çizilen arazinin dışını göstermez. Ufuk görünmez, uzak kenarı sis örter.

### Yükseklik

`heightAt(x, z)` (`src/logic/terrain.ts`):

- Tepeler Gauss toplamıdır: her tepe için `h · exp(−(d/r)²)`.
- Göllerde yumuşak bir çukur açılır: göl yatağı `GOL_DERINLIK` = 0.45 kadar aşağıdadır, su yüzeyi `SU_SEVIYESI` = −0.15'tedir. Çukur göl kenarının 1.2 birim ötesine kadar yumuşakça (smoothstep) iner.

### Rastgele harita

Her yeni oyunda harita bir **tohumdan** üretilir (`haritaUret(tohum)`, `src/data/map.ts`). Aynı tohum her zaman aynı haritayı verir. Tohum `GameState.haritaTohum` olarak kayda yazılır.

Sözde rastgele üreteç `makeRng` (mulberry32 türü) kullanılır. Üretim ayarları `HARITA_URETIM` içindedir:

| Öğe | Sayı | Yarıçap | Kurallar |
|---|---|---|---|
| Başlangıç yolu | 1 | — | Rastgele bir yönden kenardan (45.5) merkeze (1) uzanan, sinüsle hafifçe kıvrılan 8 noktalı toprak yol. |
| Göl | 3–5 | 3.5–7 | Kenara en az 4 pay bırakır, merkezin 13 birim çevresine girmez, yola en az 3 uzak durur, göller arasında en az 8 boşluk kalır. Kenarı iki sinüs terimiyle dalgalıdır. |
| Tepe | 6–8 | 6–9 (yükseklik 1.5–3) | Merkezden uzak, tepeler arasında en az 12 mesafe. |
| Orman | 7–9 | 4.5–8 | Göl, yol, merkez ve başka ormanlardan uzak. Ağaç sayısı ≈ r² × 0.9. |
| Taşlık | 2–4 | 3.5–5.5 | Göl, orman, yol ve merkezden uzak. Taşlıklar arasında en az 10 boşluk kalır. Taş Ocağı yalnızca buraya kurulur. |

Önemli ayrıntı: Ağaç tohumu (`agacTohum`) taşlıklardan **önce** çekilir. Böylece taşlık özelliği eklendiğinde eski tohumların ormanları değişmedi.

**Klasik harita:** Tohumsuz eski kayıtlar elle yapılmış `KLASIK_HARITA` ile açılır. Bu haritada 4 göl ve 3 taşlık vardır: (22, 2, r 4.5), (−26, −3, r 4) ve (−2, −20, r 4.5).

**Etkin harita:** `HARITA` nesnesi o an oynanan haritadır. Mantık ve çizim her seferinde buradan okur, dizileri kendine kopyalamaz. Harita yalnızca `haritayiAyarla(tohum)` ile değişir. Bu fonksiyon göl kenar çokgenlerini (`golKenarlari`) ve iç + dış tepe listesini (`tumTepeler`) bir kez hesaplar.

### Doğal ormanlar

Oyun başında `fillForests` her ormanın içini **doğal ağaçlarla** doldurur. Bunlar `dogal: true` olan normal `agac` binalarıdır. Yerleri ağaç tohumundan diskin içinde düzgün dağılımla seçilir (`r = √rng · R`). Yer bulunamazsa ağaç başına en fazla 4 deneme yapılır.

Doğal ağaç **kesilebilir**: **2 para** öder, **2 odun** kazandırır. Oduncu doğal ağaçları da sayar.

---

## 6. Yollar

| Yol | Birim maliyet | Birim gider/gün | Genişlik | Mutluluk | Açılma |
|---|---|---|---|---|---|
| Toprak Yol | 1 | 0 | 1.0 | 0 | baştan |
| Asfalt Yol | 3 | 0.1 | 1.4 | +5 (kenarındaki evlere) | 35 nüfus |

**Çizim (fırça):**

1. Sol tuşla sürüklenir. Fare noktaları toplanır.
2. Noktalar yay uzunluğu boyunca **0.75** aralıkla yeniden örneklenir (`resample`).
3. İki uç, **1.5** mesafedeki en yakın yolun orta çizgisine **kenetlenir**.
4. Doğrulama sırası: oyun bitti mi → yol açık mı → uzunluk ≥ 1.5 (`kisa`) → tüm noktalar karada mı (`disarida`) → göle girmiyor mu (`gol`) → bir binanın üstünden geçmiyor mu (`cakisiyor`) → en az bir ucu kenetlendi mi (`baglantisiz`) → para yetiyor mu.
5. **Maliyet** = `ceil(uzunluk × birimMaliyet)`, **gider** = `floor(uzunluk × birimGider)`.

Yollar birbirini kesebilir. Hiç yol kalmadıysa kenetlenme şartı aranmaz.

**Yıkma:** İade, maliyetin %50'sidir. Bir bina yol yakınlığını **yalnızca** o yoldan alıyorsa yol yıkılamaz (`silinebilir: false`).

**Bina–yol bağlantısı (patika):** Ağaç dışındaki her bina kurulunca kapısından en yakın yol noktasına kısa bir kağıt patika çizilir (`Building.baglanti`). Patika ücretsizdir ve yalnızca görseldir. Bağlı yol yıkılırsa patika kalan en yakın yola taşınır.

---

## 7. Binalar

Tanımlar `src/data/buildings.ts` → `BUILDINGS` içindedir. "Taban", çakışma hesabındaki dairesel yarıçaptır. "Etki", hizmetin ve mutluluğun ulaştığı yarıçaptır.

| Bina | Kategori | Maliyet | Gider/gün | Taban | Etki | Mutluluk | İşçi | Açılma nüfusu | Ne yapar |
|---|---|---|---|---|---|---|---|---|---|
| Ev | Konut | 20 | 0 | 1.1 | — | — | 0 | 0 | Sakin barındırır, vergi öder. Seviye 1–3. |
| Ağaç | Konut | 5 | 0 | 0.5 | 4 | +3 | 0 | 0 | Yakın evlere mutluluk verir, oduncunun hammaddesidir. Yol kenarı şartı yoktur. |
| Tarla | Üretim | 25 | 1 | 2.2 | — | — | 2 | 0 | **6 buğday** üretir. |
| Çeşme | Hizmet | 30 | 1 | 0.8 | 7 | +2 | 0 | 0 | **Su** sağlar. Yükseltilebilir. |
| Değirmen | Üretim | 50 | 2 | 1.4 | 4 | −6 | 2 | 12 | **6 buğday → 6 un**. Gürültülüdür. |
| Fırın | Üretim | 45 | 2 | 1.2 | 6 | 0 | 2 | 12 | **4 un → 8 yemek**. Etki alanındaki evlere yemek satar. |
| Balıkçı | Üretim | 35 | 1 | 1.0 | — | — | 2 | 10 | Göl kıyısına kurulur, girdi istemeden **3 yemek** üretir. |
| Ambar | Üretim | 60 | 1 | 1.6 | — | — | 1 | 25 | Her malın stok sınırını **+100** artırır. |
| Taş Ocağı | Üretim | 45 | 2 | 1.5 | 5 | −4 | 3 | 30 | Yalnızca taşlık alana kurulur, **4 taş** çıkarır. Gürültülüdür. |
| Oduncu | Üretim | 40 | 2 | 1.2 | 6 | −5 | 2 | 35 | Etki alanındaki **ağaç başına 1 odun** toplar. Gürültülüdür. |
| Pazar | Hizmet | 70 | 9 | 1.8 | 8 | +3 | 3 | 35 | **Pazar** erişimi sağlar ve stoktaki **yemeği evlere satar**. Yükseltilebilir. (Eski Hal binası kaldırıldı; eski kayıtlarda Hal binaları Pazar olur.) |
| Marangoz | Üretim | 55 | 2 | 1.3 | 4 | −2 | 2 | 45 | **4 odun → 4 mobilya**. |
| Okul | Hizmet | 90 | 12 | 1.8 | 9 | +5 | 3 | 60 | **Okul** erişimi ve mutluluk sağlar. Yükseltilebilir. |
| Hastane | Hizmet | 120 | 15 | 1.9 | 9 | +4 | 4 | 80 | **Sağlık** ve mutluluk sağlar. Yükseltilebilir. |
| Saat Kulesi | Hizmet | 100 + aşamalar | 5 | 1.3 | 12 | +12 | 1 | 110 | Kasabanın simgesi. İskeleyle başlar, 4 aşamada tamamlanır (bkz. 13b); aura ve gider yalnızca bitince. |

Menüdeki sıra `BUILDING_ORDER` dizisindedir: ev, ağaç, tarla, çeşme, değirmen, fırın, oduncu, balıkçı, taş ocağı, marangoz, ambar, pazar, okul, hastane, saat kulesi.

**Nüfusa göre açılma sırası:**

| Nüfus | Açılanlar |
|---|---|
| 0 | Ev, Ağaç, Tarla, Çeşme, Toprak Yol |
| 10 | Balıkçı |
| 12 | Değirmen, Fırın |
| 25 | Ambar |
| 30 | Taş Ocağı |
| 35 | Oduncu, Pazar, Asfalt Yol |
| 45 | Marangoz |
| 60 | Okul |
| 80 | Hastane |
| 110 | Saat Kulesi |

---

## 8. Bina yerleştirme kuralları

`canPlace(s, tür, x, z)` önce oyunun bitip bitmediğine, sonra kilide (`kilitli`) ve paraya (`para`) bakar. Ardından `checkSite` yeri **şu sırayla** denetler. İlk başarısız kural, hata nedeni olarak döner:

1. **`disarida`:** Taban dairesinin merkezi ve çevresindeki 8 nokta oynanabilir alanın içinde olmalı.
2. **`gol`:** Bu noktaların hiçbiri gölde olmamalı.
3. **`egim`:** Bu noktalardaki en yüksek ve en alçak arazi farkı **0.6**'yı (`egimSiniri`) aşmamalı.
4. **`taslikYok`:** Taş Ocağı'nın merkezi bir taşlığın içinde olmalı.
5. **`golYok`:** Balıkçının taban kenarından en fazla **1.5** (`golKiyisi`) uzakta göl olmalı. Göle uzaklık `lakeDistance` ile göl kenar çokgenine göre ölçülür.
6. **`cakisiyor`:** Başka bir binayla arasında en az **0.1** boşluk kalmalı (iki dairenin merkez mesafesi < r1 + r2 + 0.1 ise çakışır).
7. **`yol`:** Bina bir yolun üstüne taşmamalı.
8. **`yolYok`:** Ağaç dışındaki her bina bir yolun kenarında olmalı. Bina kenarı ile yol kenarı arasındaki mesafe ≤ **1.0** (`yolYakinlik`) olmalı.

Döndürme serbesttir ve çakışmayı etkilemez, çünkü taban dairedir. Bina yol kenarına götürülünce önü otomatik olarak yola döner, Q/E ile ince ayar yapılır.

**Yıkma:** Kurulum maliyetinin ve yükseltmelere harcanan paranın **%50**'si geri gelir (aşağı yuvarlanır). Doğal ağaçta iade yoktur. Kesim 2 para öder ve 2 odun verir.

Hata nedenlerinin Türkçe metinleri `src/ui/toast.ts` → `YERLESTIRME_SEBEP` içindedir.

---

## 9. Zaman ve gün sonu

- Oyun gerçek zamanlıdır. **1 gün = 15 saniye** (1x hızda). Hız: duraklat, 1x, 2x, 3x.
- Ana döngü (`requestAnimationFrame`) her karede `tick(s, dt × hız)` çağırır. Kare süresi en fazla 0.1 sn sayılır, böylece sekme arka plandan dönünce günler bir anda akıp gitmez.
- `gunIlerleme` 0'dan 1'e ilerler. 1'e ulaşınca `endDay` çalışır. Bir karede en fazla bir gün geçer.
- Gün içinde güneş doğudan batıya yay çizer: sabah ve akşam ışığı sıcak, öğlen nötr renktedir. Gece yoktur.


### Mevsimler ve kış

Yıl **18 gündür**: İlkbahar 5, Yaz 5, Sonbahar 5, Kış 3 (`BALANCE.mevsim.gunler`). Oyun 1. gün ilkbaharda başlar; ilk kış 16–18. günlerdir, 19. gün yeniden ilkbahardır.

- Mevsim gün sayısından saf fonksiyonla türetilir: `mevsim(gun)`, `mevsimGunu(gun)`, `kisaKalanGun(gun)` (`src/logic/season.ts`). Durumda mevsim alanı yoktur, kayıt biçimi değişmedi.
- **Kışın:**
  - Tarla üretmez (`kisinUretmez`). Değirmen stoktaki buğdayla, Fırın, Balıkçı ve diğerleri çalışır.
  - 3. seviye evlerin odun tüketimi **2 katına** çıkar (`kisOdunCarpani`): kişi başı 0.4, ev başına 4.
  - Başka hiçbir şey değişmez.
- İlkbahar, yaz ve sonbaharın mekanik etkisi yoktur; yalnızca görseldir.
- Gün sonu, biten günün (`s.gun`) mevsimiyle işlenir: 16, 17 ve 18. günlerin sonu kış kurallarıyla hesaplanır.
- **Ekranda:** üst şeritte gün sayacının yanında mevsim simgesi ve adı, altında "kışa X gün" (kışta "kışın X. günü"); sonbaharda bu yazı kırmızı. Sonbaharın ilk günü bildirim: "Kış 5 gün sonra. Yemek ve odun biriktir." Kışın Tarla'nın bilgi panelinde "kışın üretmez" satırı.
- **Hazırlık:** kış 3 gün sürer. 10 tane 3. seviye evli bir kasaba kışta günde 40 odun yakar ve tarlalar durduğu için buğday stoğuyla idare eder. Sonbaharda buğday, un, yemek ve odun biriktirmek, gerekirse Ambar kurmak gerekir.
### `endDay` sırası (`src/logic/economy.ts`)

1. **Üretim:** İşçi oranı önceki günün nüfusuyla hesaplanır.
2. **Evler:** Her ev için id sırasıyla (eski ev önce beslenir) ihtiyaçlar değerlendirilir, yemek/odun/mobilya tüketilir, mutluluk ve vergi hesaplanır. Vergi, seviye değişmeden **önceki** nüfusla hesaplanır.
3. **Seviye atlama/düşme:** 2 gün kuralı uygulanır.
4. **Para:** `net = vergi − (binaGider + yolGider)`, `para += net`. Döküm gün raporuna yazılır.
5. **Toplamlar:** Nüfus ve nüfus-ağırlıklı ortalama mutluluk yeni seviyelerle hesaplanır. Ev yoksa mutluluk taban değerdir (45).
6. **Borç:** Para < −50 ise `borcGunu` 1 artar, değilse sıfırlanır. 3 olursa oyun biter.
7. **Hedefler ve açılan binalar** denetlenir.
8. Gün sayacı 1 artar. Ekrandaki gösterimler güncellenir ve oyun otomatik kaydedilir.

**Nüfus ve mutluluk yalnızca gün sonunda değişir.** Bina koymak ya da yıkmak bunları hemen değiştirmez. Bilgi paneli ise tahmini değerleri anında gösterir.

---

## 10. Ekonomi: üretim, mallar, stok

### Mallar

`Good = 'bugday' | 'un' | 'yemek' | 'odun' | 'tas' | 'mobilya'`

| Mal | Kim üretir | Kim kullanır |
|---|---|---|
| Buğday | Tarla | Değirmen |
| Un | Değirmen | Fırın |
| **Yemek** | Fırın (8), Balıkçı (3) | Seviye 2–3 evler (Fırın ya da Pazar yakınındaysa) |
| Odun | Oduncu, doğal ağaç kesimi | Seviye 3 evler, Marangoz |
| Taş | Taş Ocağı | Hizmet binası yükseltmeleri |
| Mobilya | Marangoz | Seviye 3 evler |

### Stok sınırı

Her malın sınırı **200**'dür. Her Ambar sınırı **+100** artırır (`stockLimit(s)`).

### İşçi oranı

Bütün binaların `isci` toplamı ihtiyaçtır. İhtiyaç nüfustan fazlaysa oran `nüfus / ihtiyaç` olur, değilse 1'dir. Pazar ve okul gibi binaların işçisi de ihtiyaca sayılır, ama oran yalnızca **üretimi** düşürür.

### Üretim (`runProduction`)

Binalar şu sırayla çalışır: **Tarla → Değirmen → Fırın → Oduncu → Balıkçı → Taş Ocağı → Marangoz**. Bu sıra sayesinde aynı gün üretilen buğday aynı gün una, un da aynı gün yemeğe dönüşebilir. Marangoz, oduncunun aynı gün kestiği odunu kullanabilir.

Her binanın üretim katsayısı `f` şöyle bulunur:

```
f = işçi oranı
her girdi için:  f = min(f, stok[girdi] / gereken)
her çıktı için:  f = min(f, (stokSınırı − stok[çıktı]) / üretilen)
```

Girdiden `gereken × f` düşülür, çıktıya `üretilen × f` eklenir. Yani stokta yarım girdi varsa yarım üretim yapılır. Çıktı stok sınırına dayanırsa üretim de o oranda düşer ve girdi boşa harcanmaz.

**Oduncu:** `etki alanındaki ağaç sayısı × 1 × işçi oranı` kadar odun üretir, stok sınırını aşmaz. Aynı ağaç iki oduncunun alanındaysa ikisi de sayar.

### Komşuluk bonusları

Bazı binalar yerlerine göre daha çok üretir; ev de göl kenarında daha mutlu olur. Kurallar `BUILDINGS[t].komsuluk` içindedir, hesap `src/logic/adjacency.ts` → `adjacencyBonus(s, tür, x, z)`.

| Bina | Şart | Bonus |
|---|---|---|
| Tarla | Taban kenarı bir göle ≤ 4 birim | Buğday +%25 (sulama) |
| Değirmen | Merkezde arazi yüksekliği ≥ 1.0 | Un +%25 (rüzgâr) |
| Fırın | 6 birim içinde Değirmen (merkezden merkeze) | Yemek +%25 (taze un) |
| Marangoz | 6 birim içinde Oduncu | Mobilya +%25 (yakın odun) |
| Ev | Merkezi bir göle ≤ 5 birim | Mutluluk +3 (göl manzarası) |

- Bonus **saklanmaz**, her gün konumdan yeniden hesaplanır. Kaynak bina (ör. Fırın'ın yanındaki Değirmen) yıkılınca bonus kendiliğinden kalkar.
- Bonus yalnızca **çıktıyı** artırır: çıktı = `üretilen × f × (1 + bonus)`. Girdi tüketimi aynıdır (`gereken × f`). Stok sınırı bonuslu çıktıyla denetlenir.
- Göle uzaklık `lakeDistance(x, z)` ile ölçülür (`src/logic/terrain.ts`): göl kenar çokgenine en yakın nokta, göl içinde 0. Balıkçının kıyı şartı da aynı ölçüyü kullanır.
- Kurallar bilerek çatışır: göl kıyısını tarla, ev ve balıkçı paylaşır; fırını değirmene yaklaştırmak değirmenin gürültüsünü (−6) evlere yaklaştırır.
- **Yerleştirirken** hayalet binanın üstünde canlı bir etiket çıkar: şart tutuyorsa yeşil `+%25 sulama`, kural var ama şart tutmuyorsa soluk `bonus yok`. Kuralı olmayan binada etiket çıkmaz.
- **Bilgi panelinde** "Bonus" satırı etkin bonusları, bonus yoksa kuralın şartını gösterir.

---

## 11. Evler: seviye, ihtiyaçlar, yemek

### Seviyeler

| Seviye | Görünüm | Nüfus | İhtiyaçlar |
|---|---|---|---|
| 1 | Kulübe | 3 | yok |
| 2 | Bacalı ev | 6 | su, yemek |
| 3 | İki katlı ev | 10 | su, yemek, odun, pazar, okul, mobilya, sağlık |

### İhtiyaçlar nasıl karşılanır

- **Su, pazar, okul, sağlık (hizmet):** Evin merkezi ilgili binanın (Çeşme, Pazar, Okul, Hastane) **etki yarıçapı** içindeyse karşılanır. Stok tüketmez.
- **Yemek:** İki şartı vardır:
  1. Evin merkezi bir **yemek satış yerinin** (Fırın ya da Pazar, `yemekSatar: true`) etki alanında olmalı.
  2. Ortak stokta yeterli yemek olmalı: **kişi başı günde 0.25** (seviye 2 ev: 1.5, seviye 3 ev: 2.5).
- **Odun:** Global stoktan **kişi başı 0.2** (seviye 3 ev: 2). Yer şartı yoktur.
- **Mobilya:** Global stoktan **kişi başı 0.1** (seviye 3 ev: 1). Yer şartı yoktur.

**Tek ortak Yemek stoğu:** Ekmek ve balık ayrı mallar değildir. Fırın ve Balıkçı aynı `yemek` malını farklı miktarlarda üretir. Fırın zincir ister ama çok verir (8). Balıkçı zincirsizdir ama az verir (3). Yeni bir yemek türü eklemek için `yemek` üreten yeni bir bina tanımlamak yeter (bkz. [Bölüm 22](#22-nasıl-genişletilir-tarifler)).

**Tüketim kuralı:** Ev, yalnızca **mevcut** seviyesinin stok ihtiyaçlarını tüketir. Bir **üst** seviyenin ihtiyacına (ör. seviye 1 evin yemeğine) yalnızca bakılır: stokta üst seviyenin nüfusu kadar pay varsa ✓ sayılır ama tüketilmez. Evler id sırasıyla beslenir, stok yetmezse sonradan kurulan evler aç kalır.

### Büyüme ve küçülme (2 gün kuralı)

- Bir üst seviyenin **bütün** ihtiyaçları **2 gün üst üste** karşılanırsa ev **1 seviye atlar**.
- Mevcut seviyenin ihtiyaçları **2 gün üst üste** karşılanmazsa ev **1 seviye düşer** (en az 1).
- Her seviye değişiminde sayaçlar sıfırlanır. Model yeni seviyeyle katlanarak yeniden kurulur.

---

## 12. Mutluluk, vergi, gider, borç

### Ev mutluluğu (`houseHappiness`)

```
mutluluk = 45                                   (BALANCE.mutlulukTaban)
         + evi etki alanında tutan (ev olmayan, ağaç olmayan) binaların "mutluluk" değerleri
         + min(ağaçların toplamı, 9)            (BALANCE.agacMutlulukSinir)
         + yakındaki en iyi yolun mutluluğu (asfalt +5)
         + mevcut seviyede karşılanan ihtiyaç sayısı × 2   (BALANCE.ihtiyacMutluluk)
         + göl manzarası (merkez göle ≤ 5 birim) +3        (BUILDINGS.ev.komsuluk)
sınır: 0 – 100                                  (BALANCE.mutlulukMin / mutlulukMax)
```

Bütün mutluluk sabitleri `BALANCE` içindedir, formülde sayı yoktur.

Gürültülü binalar eksi değer verir: Değirmen −6, Oduncu −5, Taş Ocağı −4, Marangoz −2. Bunları evlerden uzağa kurmak gerekir.

Örnek evler (yeni ölçek; testli):

| Ev | Mutluluk | Vergi |
|---|---|---|
| 1. seviye, çeşme + 3 ağaç | 56 | 3 |
| 2. seviye, çeşme + pazar + 3 ağaç | 63 | 6 |
| 3. seviye, tam hizmet (çeşme, pazar, okul, hastane) + 3 ağaç + asfalt | 87 | 8 |
| Aynı ev, Saat Kulesi alanında | 99 | 8 |

Saat Kulesi olmadan hiçbir ev 100'e ulaşmaz.

**Kasaba mutluluğu**, ev mutluluklarının **nüfus-ağırlıklı ortalamasıdır**. Ev yokken 45'tir.

### Vergi

Her ev için:

```
vergi = floor(nüfus × (0.5 + mutluluk / 100) × seviye çarpanı)
seviye çarpanı: 1. ve 2. seviye 1, 3. seviye 0.6   (BALANCE.vergiTaban, BALANCE.vergiSeviyeCarpani)
```

Örnek: 6 kişilik (2. seviye), mutluluğu 70 olan ev → `floor(6 × 1.2)` = **7** para/gün. 10 kişilik (3. seviye), mutluluğu 90 olan ev → `floor(10 × 1.4 × 0.6)` = **8** para/gün.

3. seviye ev kalabalıktır ama kişi başı daha az vergi öder (Aşama 1 dengesi). Onu büyütmenin değeri vergiden çok nüfus, hedefler ve mutluluktur.

### Gider

Binaların günlük gideri (yükseltilmiş hizmet binasında seviyeye göre artar) ile yolların `floor(uzunluk × birimGider)` giderinin toplamıdır.

Gün raporu (`DayReport`) geliri ve gideri ayrı ayrı taşır: `vergi` (bütün evlerin toplamı), `binaGider`, `yolGider`, `gider` (ikisinin toplamı) ve `net` (vergi − gider). HUD'da Para'nın üstüne gelince bu döküm küçük bir kağıt kartta görünür.

### Para dengesi ölçümü

`tests/denge.test.ts` elle kurulmuş üç referans kasabanın bir günlük gelir-giderini yazdırır (`npx vitest run tests/denge.test.ts --silent=false`). Hedef: 300 nüfuslu kasabada net, 200 paralık büyük bir harcamanın yarısını (100) geçmesin.

İlk ölçüm (Aşama 1b, eski sayılarla):

| Kasaba | Nüfus | Mutluluk | Vergi | Bina gideri | Yol gideri | Net |
|---|---|---|---|---|---|---|
| ≈50 | 51 | 60.4 | 51 | 16 | 0 | 35 |
| ≈150 | 151 | 84.4 | 191 | 42 | 4 | 145 |
| ≈300 | 300 | 85.2 | 384 | 80 | 8 | 296 |

Ayardan sonra (3. seviye ev vergisi ×0.6; Pazar, Okul, Hastane gideri 3 katı: 9, 12, 15):

| Kasaba | Nüfus | Mutluluk | Vergi | Bina gideri | Yol gideri | Net |
|---|---|---|---|---|---|---|
| ≈50 | 51 | 60.4 | 51 | 22 | 0 | 29 |
| ≈150 | 151 | 84.4 | 131 | 66 | 4 | 61 |
| ≈300 | 300 | 85.2 | 252 | 135 | 8 | 109 |

### Borç ve iflas

Gün sonunda para **−50**'nin altındaysa borç sayacı artar. **3 gün üst üste** böyle biterse kasaba iflas eder. Uyarı bildirimi `(1/3 gün)` gibi sayar.

### Başlangıç

Para **150**, nüfus 0, mutluluk 45, bütün stoklar 0.

---

## 13. Hizmet binası yükseltmeleri

Yükseltilebilenler: **Çeşme, Pazar, Okul, Hastane**. Yükseltme bilgi panelindeki **Yükselt** düğmesiyle yapılır, en fazla 3. seviyeye kadar. Taban değişmez, dolayısıyla yükseltme çakışma yaratmaz.

`BALANCE.yukseltme`:

| Seviye | Etki yarıçapı | Gider | Para maliyeti | Taş |
|---|---|---|---|---|
| 1 | ×1 | ×1 | (kurulum) | 0 |
| 2 | ×1.4 | ×1.5 | kurulumun %60'ı | 10 |
| 3 | ×1.8 | ×2 | kurulumun %100'ü | 25 |

Gider yuvarlanır. Örnek, **Okul** (90 para, gider 12, etki 9):

- Seviye 2: 54 para + 10 taş → etki 12.6, gider 18.
- Seviye 3: 90 para + 25 taş → etki 16.2, gider 24.

Yükseltme yapılamıyorsa nedeni gösterilir: `para`, `tas` (taş yetmiyor), `kilitli` (yükseltilemez ya da son seviyede) ya da `bitti`.

Her seviyede modele küçük bir ek gelir, kat eklenmez:

- **Çeşme:** orta kat çanak, saksılar ve altın top.
- **Pazar / Okul:** tezgah, bayrak ve çatı ekleri.
- **Hastane:** seviye 2'de bahçe bankları ve fidanlar, seviye 3'te arkada ek koğuş.

---

## 13b. Saat Kulesi anıt projesi

Saat Kulesi tek seferde kurulmaz. Yerleştirince (100 para) iskele kurulur, kule dört aşamada tamamlanır. Aşamalar bilgi panelindeki **Malzeme gönder** düğmesiyle ilerler (`advanceMonument`). Para ya da mal yetmezse düğme kapanır ve neyin eksik olduğu yazılır.

| Aşama | Para | Mal | Görünen |
|---|---|---|---|
| Yerleştirme | 100 | — | Taban ve iskele |
| 1 | 100 | 20 taş | Gövdenin alt yarısı |
| 2 | 100 | 30 odun | Gövdenin üst yarısı |
| 3 | 150 | 20 mobilya | Saat ve balkon |
| 4 | 200 | 30 taş + 20 mobilya | Çatı ve bayrak |

- Toplam 650 para, 50 taş, 30 odun, 40 mobilya. Sayılar `BALANCE.anit.asamalar` içinde; anıt binası `anit: true` ile işaretli.
- Durumda `Building.insaat` alanı **kalan aşama sayısıdır**. Alan yoksa bina tamamdır; eski kayıtlardaki kuleler bu yüzden tamam sayılır. Son aşamada alan silinir.
- Mutluluk aurası (+12), etki yarıçapı, günlük gider (5) ve "Kasaba tamamlandı" hedefi yalnızca **tamamlanmış** kule için geçerlidir (`effectRadius` ve `buildingUpkeep` inşaattaki anıtta 0 döner).
- Yıkım iadesi: yerleştirme + tamamlanan aşamalara harcanan paranın yarısı; mallar geri gelmez.
- Bilgi panelinde "İnşaat 2 / 4" satırı ve sıradaki aşamanın maliyeti görünür.
- Çizim: `GameRenderer.setMonumentStage(id, asama, anim?)`; her aşamada yeni parçalar katlanarak kurulur, sonuncusunda konfeti.

## 13c. Gezgin tüccar ve sakin istekleri

### Gezgin tüccar (`logic/trade.ts`)

- Her **6 günde bir** gelir (6, 12, 18, ... günler) ve o gün kalır. Araba başlangıç yolunun kenar ucunda, sınırdan bir nokta içeride durur (`tuccarKonumu`); gelirken yuvarlanır, tente açılır, tüccar figürü çıkar (`render/merchant.ts`). Geliş günleri gün sayısından türetilir (`tuccarVarMi(gun)`); durumda yalnızca ziyaretteki kota sayacı (`tuccarKota`) saklanır, gün sonunda silinir.
- Geldiği gün bildirim çıkar ve üst şeritte **🛒 Tüccar** düğmesi görünür. Düğme takas panelini açar: 6 mal, stok, satış ve alış fiyatı, her tıklamada 5 birimlik **−** (sat) ve **+** (al) düğmeleri, kalan takas hakkı.
- Fiyatlar sabittir (`BALANCE.ticaret.fiyat`). Satış alıştan belirgin düşüktür; tüccar para basma yolu değil, takas ve acil durum aracıdır.

| Mal | Sen satarsın | Sen alırsın |
|---|---|---|
| Buğday | 1 | 3 |
| Un | 2 | 5 |
| Yemek | 2 | 6 |
| Odun | 2 | 5 |
| Taş | 3 | 8 |
| Mobilya | 6 | 15 |

- Ziyaret başına alım + satım toplamı **40 birim** (`kota`). Alımda para ve depo sınırı (`stockLimit`), satışta stok denetlenir (`canBuy`, `canSell`, `buyGood`, `sellGood`).

### Sakin istekleri (`logic/requests.ts`)

- Nüfus 10'u geçince istekler başlar. Aynı anda en fazla **bir** istek olur; biri bittikten (tamamlanma ya da süre dolması) **3 gün** sonra yenisi gelir (`sonrakiIstekGunu`).
- İstek türü harita tohumu ve gün sayısından `makeRng` ile seçilir: aynı tohumda hep aynı sıra.
- Süre **4 gündür**. Süre dolarsa istek sessizce kalkar, **ceza yoktur**.

| İstek | Şart | Ödül |
|---|---|---|
| 🎉 Şenlik | Stoktan 30 yemek teslim et (karttaki düğme) | 3 gün (bugün dahil) bütün evlere +5 mutluluk |
| 🌳 Ağaçlandırma | İstek sırasında 5 ağaç dik | 40 para |
| 🪵 Kış hazırlığı (yalnız sonbaharda, odun henüz 40'ın altındaysa) | Stokta 40 odun bulunsun | 60 para |
| 💧 Susuz ev (yalnız suya erişimi olmayan bir ev varsa) | O ev suya kavuşsun | 30 para |

- Ödül şart tuttuğu anda verilir: oyuncu eyleminden sonra ve gün sonunda `checkRequest` denetler. Hedef ev yıkılırsa istek cezasız kalkar.
- Durum: `istek?: { tur, baslangicGun, ilerleme, hedefBinaId? }`, `geciciMutluluk?: { deger, bitisGun }`, `sonrakiIstekGunu?`. Hepsi isteğe bağlı; eski kayıtlar etkilenmez.
- **Ekranda:** hedef kartının altında küçük istek kartı: başlık, açıklama, ilerleme, kalan gün. Şenlik'te "Yemeği teslim et", Susuz ev'de "Evi göster" düğmesi (evi seçer, vurgular ve kamerayı oraya kaydırır: `renderer.focusOn`). Yeni istek ve tamamlanma bildirimle duyurulur.

## 13d. Karar kartları

Her kasaba farklı bir yöne gitsin diye bazı hedefler tamamlanınca **oyun duraklar ve üç kart gösterilir**. Oyuncu birini seçer, seçim kalıcıdır.

- Kart hedefleri: **1, 3, 5, 7 ve 10** (Küçük köy, Kasaba, Kasaba tamamlandı, Mutlu kasaba, Dolu ambar; `GOAL_LIST` içinde `kart: true`).
- Üç kart harita tohumu ve hedef numarasından deterministik çekilir (`kartCek`); daha önce seçilen kart tekrar gelmez.
- Hedef tamamlanınca seçim `bekleyenKararlar` kuyruğuna girer. Seçilene kadar oyun duraklıdır ve hız düğmeleri çalışmaz; kayıt kapatılıp açılırsa seçim ekranı yeniden gelir. Aynı gün iki kart hedefi biterse seçimler sırayla gelir.
- Seçilen kartlar `kararlar` dizisinde durur. Üst şeritte simgeleri görünür; üstüne gelince adı, artısı ve eksisi.

| Kart | Artı | Eksi |
|---|---|---|
| 🐟 Balıkçı kasabası | Balıkçı +2 yemek | Tarla −1 buğday |
| 🔥 Odun tasarrufu | Evlerin odun tüketimi −%30 | Bütün evlere −5 mutluluk |
| 💰 Ağır vergi | Vergi +%15 | Evler 2 yerine 3 iyi günde büyür |
| ⚒️ Taş ustaları | Yükseltmelerin taş maliyeti −%40 | Taş Ocağı gürültüsü −4 yerine −8 |
| 🌳 Yeşil kasaba | Ağaç mutluluk tavanı +6 | Oduncu üretimi −%25 |
| 🛒 Tüccar dostu | Tüccar takas hakkı 40 yerine 70 | Pazar gideri 2 katı |
| 🤫 Sessiz değirmen | Değirmen gürültüsü 0 | Değirmen −1 un |
| 🏚️ Büyük ambar | Ambar +100 yerine +200 | Ambar gideri 1 yerine 3 |

**Nasıl yapıldı:** Kartlar `src/data/cards.ts` içinde veri olarak durur; her etki bir `ayar` anahtarı, bir işlem (`ekle` / `carp`) ve bir değerdir. Ekonomi kartların değiştirebildiği değerleri doğrudan `BALANCE` / `BUILDINGS`'ten değil `ayar(s, anahtar)` ile okur (`src/logic/cards.ts`): taban değer + seçilmiş kartların etkileri. Ekonomi kodunda karta özel `if` yoktur. Anahtarlar: `uretim.<bina>.<mal>`, `mutluluk.<bina>`, `gider.<bina>`, `depo.<bina>`, `odunKisiBasi`, `evMutluluk`, `vergiCarpani`, `seviyeAtlamaGun`, `yukseltmeTasCarpani`, `agacMutlulukSinir`, `oduncuCarpani`, `ticaretKota`. Yeni kart eklemek için `KARTLAR` dizisine bir kayıt yetir; yeni bir değer etkilenecekse önce `AyarAnahtari`'na ve `tabanDeger`'e eklenir, ekonomi o değeri `ayar` ile okur.

## 13e. Öğretici ve ses

### Öğretici (`ui/tutorial.ts`)

Yalnızca ilk oyunda (kayıt yokken) ve daha önce gösterilmediyse açılır. Sağ altta kağıt not olarak durur, oyunu durdurmaz, "Öğreticiyi atla" ile kapanır. Beş adım, her biri oyuncunun eylemiyle ilerler:

1. Yol aracını seç ve başlangıç yolundan bir yol çiz (yol konunca).
2. Yol kenarına bir ev koy (ev konunca).
3. Bir Çeşme kur (çeşme konunca).
4. Gün sonunu bekle ve vergiyi gör (ilk gün sonunda).
5. Hedef kartına bak ("Bitir" düğmesiyle).

Sırası gelmeden yapılan eylem de sayılır: önce ev konduysa 2. adım sırası gelince hemen geçer. "Gösterildi" bilgisi `localStorage`'da `kagit-kasaba-ogretici` anahtarında durur, oyun kaydına girmez. Yeniden görmek için tarayıcı konsolunda `localStorage.removeItem('kagit-kasaba-ogretici')` çalıştırıp yeni kasaba başlatın.

### Ses (`src/audio/`)

Ses dosyası yoktur; efektler, ortam sesi ve müzik Web Audio API ile kodla üretilir. Ses katmanı mantığa ve çizime dokunmaz: main olayları bildirir (`GameAudio`, `src/audio/api.ts`).

- **Efektler:** bina kurulumu (kağıt hışırtısı), yol (sürtünme), seçim (tık), hata (olumsuz her bildirimde), gün sonu vergisi (bozuk para), hedef / kart / anıtın bitmesi (yükselen arpej), ev büyümesi ve anıt aşaması (ding).
- **Ortam:** ilkbahar ve yazda kuş sesleri, sonbaharda rüzgâr ve seyrek kuş, kışın daha güçlü rüzgâr (kuş yok). Mevsim değişince 3 saniyede geçer. Kamera uzaklaştıkça kısılır, en uzakta %30 (`renderer.getZoom01()`).
- **Müzik:** Sol majör pentatonik, 66 BPM. Dört akor (Sol, Mi minör, La sus, Re sus) arasında rastgele dolaşan yumuşak pad ve bas, üstünde küçük adımlarla yürüyen sinüs melodi; 4 ölçülük cümlelerden sonra kısa sessizlikler, hafif yankı. Kışın biraz daha mat.
- **Seviyeler:** ana 0.8 → efekt 0.8, ortam 0.45, müzik 0.22, sonunda bir sınırlayıcı (kırpılma yok). Aynı efekt 70 ms içinde tekrar çalmaz. Ayar noktaları: `SEVIYE` (`audio/engine.ts`), `AYAR` (`audio/ambience.ts`), efektlerdeki `tepe` değerleri (`audio/effects.ts`).
- Ses ilk tıklama ya da tuştan sonra başlar (tarayıcı kuralı). Oyun duraklıyken ortam ve müzik hafifçe kısılır.
- Üst şeritteki 🔊 / 🔇 düğmesi sesi açar / kapar. Ayar `localStorage`'da `kagit-kasaba-ses` anahtarında durur, oyun kaydından ayrıdır.

## 14. Hedefler

Hedefler `src/logic/goals.ts` içindedir ve **sırayla** tamamlanır. Aynı gün birden fazla hedef bitebilir.

| # | Ad | Şart |
|---|---|---|
| 1 | Küçük köy | 10 nüfus |
| 2 | İlk yemek | Fırında ya da balıkçıda ilk yemeği üret (`toplamYemek > 0`) |
| 3 | Kasaba | 50 nüfus |
| 4 | İki katlı ev | Bir evi 3. seviyeye çıkar |
| 5 | **Kasaba tamamlandı** | 150 nüfus + **tamamlanmış** Saat Kulesi. Ardından yeni hedefler açılır. |
| 6 | Gürül gürül çeşme | Bir Çeşme 3. seviye |
| 7 | Mutlu kasaba | 200 nüfus ve mutluluk ≥ 70 |
| 8 | İki katlı mahalle | 10 tane 3. seviye ev |
| 9 | Pazar yeri ve mektep | Bir Pazar ve bir Okul 3. seviye |
| 10 | Dolu ambar | Aynı anda 150 yemek ve 100 odun |
| 11 | Zengin kasaba | Kasada 1000 para |
| 12 | Kalabalık kasaba | 300 nüfus |
| 13 | **Kasaba efsanesi** | 400 nüfus ve mutluluk ≥ 75. Oyun bundan sonra da devam eder. |

Sayılabilen hedeflerde kartta ilerleme görünür (`goalProgress`). Hedef tamamlanınca 🎯 bildirimi çıkar. "Kasaba tamamlandı" ve son hedef için ayrıca 🏆 bildirimi gösterilir.

---

## 15. Kayıt sistemi

- Oyun yalnızca tarayıcının **`localStorage`**'ında, `kagit-kasaba-kayit` anahtarıyla saklanır. Sunucu ve hesap yoktur.
- **Ne zaman kaydedilir:** Her gün sonunda ve sayfa kapanırken (`pagehide`).
- **Biçim:** `{ "surum": 2, "durum": GameState }` (`src/logic/save.ts`). Sürüm 1 (yolların olmadığı eski sürüm) reddedilir ve yeni oyun başlar.
- **Doğrulama:** `deserialize` JSON'u, sürümü, zorunlu alanları (gün, para, binalar, yollar, stok) ve harita tohumunun tipini denetler. Bozuk kayıtta hata fırlatır; `main.ts` bunu yakalar ve yeni oyun açar.
- **Eski kayıt uyumu (göç):**
  - Ayrı `ekmek` ve `balik` stokları toplanıp `yemek`'e aktarılır.
  - `toplamEkmek` sayacı `toplamYemek` olur.
  - Sonradan eklenen mallar (taş, mobilya) 0 ile başlar.
  - Tohumu olmayan kayıt klasik haritayla açılır.
- **Yeni kasaba:** İflas ekranındaki düğme kaydı siler ve yeni bir rastgele tohumla oyun kurar.

---

## 16. Strateji ve örnek hesaplar

### Yemek zinciri oranları

- 1 Tarla = 6 buğday → 1 Değirmen'i tam besler (6 → 6 un).
- 1 Değirmen = 6 un → 1.5 Fırın'ı besler (Fırın 4 un ister).
- 1 Fırın = 8 yemek/gün.
- Seviye 2 ev 1.5, seviye 3 ev 2.5 yemek yer.
  - 1 Fırın ≈ 5 tane seviye 2 ev ya da 3 tane seviye 3 ev besler.
  - 1 Balıkçı (3 yemek) = 2 tane seviye 2 ev.

### Açılış önerisi

1. Başlangıç yolunun yanına birkaç ev ve yakına bir Çeşme kur. Toprak yollar ucuzdur.
2. 10 nüfusta bir göl kıyısı varsa **Balıkçı** kur; yemeği evlere satmak için 12 nüfusta açılan **Fırın** (ya da 35'te Pazar) gerekir.
3. 12 nüfusta **Tarla → Değirmen → Fırın** zincirini kur. Değirmeni evlerden uzağa koy (−6 mutluluk). Fırını evlerin ortasına koy, çünkü yemek satış yeri de odur.
4. Ağaçlar evlere ucuz mutluluk verir (en fazla +9, yani 3 ağaç).
5. 35 nüfustan sonra Oduncu (ormanın yanına), Pazar ve asfalt yol. 45'te Marangoz, 60'ta Okul, 80'de Hastane. Bunlarla seviye 3 evler mümkün olur.
6. Stok 200'e dayanıyorsa Ambar kur.
7. Taş Ocağı'nı taşlık alana kur ve taş biriktir: hizmet yükseltmeleri 10 ve 25 taş ister.

### Dikkat

- İşçi yetmezse bütün üretim aynı oranda düşer. Çok bina kurup nüfusu geride bırakmamak gerekir.
- Komşuluk bonusları için yer seç: tarlayı göle, değirmeni tepeye, fırını değirmenin yanına (ama değirmeni evlerden uzağa), marangozu oduncunun yanına koy.
- Gider kalemleri birikir. Kasayı sürekli eksi yapan bir kasaba 3 günde iflas eder.

---

## 17. Yazılım mimarisi

### Katmanlar

```
┌──────────────────────────────────────────────────────────────┐
│ src/main.ts  — giriş: kayıt, oyun döngüsü, katmanları bağlar │
├───────────────────────┬──────────────────────────────────────┤
│ src/ui/   (HTML/CSS)  │ src/render/   (Three.js)             │
│ HUD, menü, panel,     │ sahne, arazi, modeller, animasyon,   │
│ bildirim, giriş       │ canlılık; dışa: GameRenderer (api.ts)│
├───────────────────────┴──────────────────────────────────────┤
│ src/logic/  — saf TypeScript, bütün kurallar, birim testli   │
├──────────────────────────────────────────────────────────────┤
│ src/data/   — denge değerleri (buildings.ts), harita (map.ts)│
└──────────────────────────────────────────────────────────────┘
```

- **Mantık** (`src/logic/`) Three.js'e, DOM'a ve `window`'a dokunmaz. Durum düz veridir (`GameState`), fonksiyonlar durumu yerinde değiştirir. Bütün kurallar burada durur ve Vitest ile sınanır.
- **Çizim** (`src/render/`) mantığa yalnızca `types.ts`, `data/` ve saf arazi fonksiyonları (`heightAt`) üzerinden bağlıdır. Dışarıya yalnızca `GameRenderer` arayüzünü verir (`src/render/api.ts`).
- **Arayüz** (`src/ui/`) düz HTML/CSS ve DOM kodudur, framework kullanılmaz.
- **`types.ts`** üç katman arasındaki sözleşmedir. Değiştirirken bütün katmanlar düşünülür.

### Dosya haritası

```
index.html              Bütün CSS (kağıt kart görünümü, renk değişkenleri), #sahne ve #arayuz
src/
  main.ts               Kayıt yükle/yaz, oyun döngüsü, olayları katmanlara bağlama, gün sonu bildirimleri
  data/
    buildings.ts        BUILDINGS, BUILDING_ORDER, HOUSE_LEVELS, ROADS, BALANCE (bütün denge)
    cards.ts            Karar kartları (KARTLAR) ve ayar anahtarları
    map.ts              Oynanabilir alan, dış tepeler, klasik harita, rastgele üretici, etkin HARITA
  logic/
    types.ts            Ortak tipler ve API sözleşmesi
    geometry.ts         Mesafe, daire çakışması, çoklu çizgi en yakın nokta, yeniden örnekleme
    terrain.ts          heightAt, isLand, isLake (nokta-çokgen testi)
    placement.ts        Yer denetimi, yerleştirme, yıkma, yükseltme, stok sınırı, bağlantı noktası
    roads.ts            Yol planlama/kenetleme, yerleştirme, yıkma, en yakın yol
    economy.ts          İşçi oranı, üretim, ihtiyaçlar, mutluluk, vergi, endDay
    adjacency.ts        Komşuluk bonusları (konuma göre üretim / mutluluk artışı)
    season.ts           Mevsimler: mevsim(gun), mevsimGunu, kisaKalanGun
    trade.ts            Gezgin tüccar: geliş günleri, fiyatlar, kota, al/sat
    requests.ts         Sakin istekleri: seçim, ilerleme, ödül, şenlik
    cards.ts            Karar kartları: ayar(s, anahtar), kart çekme, seçim
    goals.ts            Hedef listesi ve denetimi
    save.ts             serialize / deserialize + eski kayıt göçü
    game.ts             Tek giriş noktası: createGame, tick, getBuildingInfo + yeniden dışa aktarımlar
  render/
    api.ts              GameRenderer arayüzü
    renderer.ts         createRenderer: bütün çizimi yöneten ana sınıf
    scene.ts            Sahne, ışıklar, gölge, sis, gün ilerlemesi
    terrain.ts          Kağıt arazi ağı, göller, sınır şeridi, dekor orman, taşlık kayaları
    camera.ts           Elle yazılmış yörünge kamerası
    paper.ts            Canvas ile üretilen kağıt/oluklu mukavva/ahşap dokuları, malzeme önbelleği
    palette.ts          Bütün renkler
    fold.ts             Kağıt maket kurulma animasyonu
    season.ts           Mevsim görünümü: ağaç/zemin/göl renk geçişi (shader), kar
    anim.ts             Easing, tween yöneticisi, konfeti, uçan etiketler
    roads.ts            Yol şeridi geometrisi ve açılarak serilme
    life.ts             Yürüyen insanlar, duman, ördek, kuş, el arabası
    thumbnails.ts       Menü kartları için bina resimleri
    preview.ts          ?preview görsel deneme ekranı
    models/
      builder.ts        Prosedürel model kurucu (parça, menteşe, birleştirme)
      index.ts          Şablon önbelleği (tür, seviye, çeşit)
      house.ts          Ev (3 seviye, çeşitli renk)
      nature.ts         Ağaç, tarla, dekor ağaç
      production.ts     Değirmen, Fırın, Oduncu
      civic.ts          Çeşme, Pazar, Okul, Saat Kulesi
      extra.ts          Hastane, Ambar, Balıkçı, Taş Ocağı, Marangoz
  ui/
    hud.ts              Üst şerit
    buildMenu.ts        Kategorili alt menü
    infoPanel.ts        Bilgi paneli + Yükselt
    toast.ts            Bildirimler, hedef kartı, istek kartı, hata metinleri
    tradePanel.ts       Gezgin tüccar paneli
    cardPicker.ts       Karar kartı seçim ekranı
    tutorial.ts         Öğretici (ilk oyun, beş adım)
    input.ts            Sol tık, yol fırçası, klavye
    dom.ts              el(), flash(), tr() yardımcıları
  audio/
    api.ts              GameAudio sözleşmesi (main olay bildirir)
    index.ts            createAudio: AudioContext, kilit açma, zamanlayıcı
    engine.ts           Ses zinciri ve seviyeler (SEVIYE)
    synth.ts            Gürültü tamponları, zarf, kısa ton yardımcıları
    effects.ts          Yedi efekt
    music.ts            Pentatonik müzik üreticisi
    ambience.ts         Kuşlar ve rüzgâr
tests/                  Vitest birim testleri
```

### Teknik ayarlar

TypeScript `strict` açıktır. Ayrıca `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` ve `erasableSyntaxOnly` açıktır, bu yüzden `enum` ve parametre özellikleri kullanılmaz. Hedef sürüm ES2023'tür.

---

## 18. Mantık katmanı nasıl yapıldı

### Durum (`GameState`)

```ts
{
  gun, gunIlerleme,            // gün sayısı ve 0..1 ilerleme
  para, nufus, mutluluk,
  stok: Record<Good, number>,
  binalar: Building[],         // {id, type, x, z, rot, seviye, iyiGun, kotuGun, dogal?, baglanti?}
  yollar: Road[],              // {id, tur, noktalar: Vec2[]}
  sonrakiId,                   // bina ve yollar ortak sayaç
  borcGunu, bitti, hedef, toplamYemek,
  haritaTohum?
}
```

Bütün durum düz JSON'dur, bu yüzden kayıt yalnızca `JSON.stringify` ile yapılır.

### Geometri

- **Serbest yerleşim:** Her bina bir **dairedir** (merkez + taban yarıçapı). Çakışma, iki daire arası mesafe ile yapılır, döndürmeden bağımsızdır.
- **Arazi denetimi:** Daire merkezi ve çevresindeki 8 nokta ile örneklenir (`circleSamples`).
- **Karada mı / gölde mi:** Işın atma yöntemiyle nokta-çokgen testi (`pointInPolygon`) yapılır. Göl kenarları blob çokgenleridir (56 nokta).
- **Yollar:** Çoklu çizgidir (polyline). Bina–yol ilişkisi `closestOnPolyline` ile bulunur. Yol kenarı boşluğu = merkez mesafesi − taban − yol yarı genişliği.
- **Yeniden örnekleme:** Fareden gelen düzensiz noktalar yay uzunluğu boyunca eşit aralıklara dağıtılır. Son nokta korunur, çok yakınsa uca taşınır.
- **Yol çakışma hızlandırması:** Yol planlanırken önce sınır kutusu dışındaki binalar atlanır, sonra segment bazlı en yakın nokta testi yapılır. Böylece örnek noktaları arasında kalan küçük binalar da yakalanır.

### API

`src/logic/game.ts` tek giriş noktasıdır:

```
createGame(tohum?)        tick(s, dt)          endDay(s)
canPlace / placeBuilding  demolish             canUpgrade / upgradeBuilding
planRoad / placeRoad      demolishRoad         getRoadInfo / nearestRoad
getBuildingInfo           housesInRange        stockLimit / effectRadius / buildingUpkeep
serialize / deserialize   GOALS / goalProgress heightAt / isLand / isLake
```

`getBuildingInfo` bilgi paneli için tahmin üretir. Ev ihtiyaçlarını **tüketmeden** değerlendirir (`evaluateNeeds` çağrısına `tuketim` verilmez), diğer evlerin payını da düşmez.

### Belgelenmiş kararlar

Kodda `// Karar:` yorumlarıyla işaretlidir:

- İşçi ihtiyacına bütün binalar sayılır, ama oran yalnızca üretimi düşürür.
- Bir ağaç iki oduncunun alanındaysa ikisine de sayılır.
- Çıktı stok sınırına dayanırsa girdi de o oranda az tüketilir.
- Üst seviyenin stok ihtiyacına bakılır ama tüketilmez.
- Vergi, seviye değişiminden önceki nüfusla hesaplanır.
- Nüfus ve mutluluk yalnızca gün sonunda güncellenir.
- Hiç yol kalmadıysa yeni yolda kenetlenme şartı aranmaz.

---

## 19. Çizim katmanı nasıl yapıldı

Bütün görseller **kodla** üretilir. Görsel ya da model dosyası yoktur.

### Kağıt görünümü (`paper.ts`, `palette.ts`)

- **Kağıt dokusu:** 256×256 bir canvas'a piksel piksel ince gren basılır, üstüne 260 kısa, kıvrık "lif" çizilir. Lifler kenarlardan taşınca karşı kenardan da çizilir, böylece doku dikişsiz tekrar eder. Doku neredeyse beyazdır ve malzeme rengini çarpar. Zemin için daha güçlü ve büyük ölçekli bir sürümü vardır. Oluklu mukavva ve ahşap dokuları da aynı yöntemle çizilir.
- **Malzemeler:** `MeshStandardMaterial` kullanılır, `flatShading` ile her yüz düz renkli görünür (katlanmış kağıt etkisi). Malzemeler önbelleğe alınır. Ağaç malzemesi rüzgarda hafifçe sallanır (`ruzgar` uniform'u).
- **Kenar çizgileri:** `EdgesGeometry` ile 25°'den keskin kenarlara koyu ince çizgiler eklenir (`paperEdges`). Bu, maket kenarı etkisi verir.
- **Renkler:** Pastel ve sıcaktır (krem, terrakota, adaçayı, gök mavisi, hardal, gül). Hepsi `palette.ts`'de durur, başka dosyada renk kodu yazılmaz. Evlerin duvar ve çatı rengi id'den türetilen çeşide göre seçilir.

### Sahne, ışık, gölge, sis (`scene.ts`)

- **Işık:** Bir `HemisphereLight` (gök/yer ışığı) ve gölge veren bir `DirectionalLight` (güneş). Gölge yumuşaktır, `bias` ve `normalBias` ile çizgilenme önlenir.
- **Gölge kamerası** kamera hedefini izler ve texel ızgarasına kenetlenir. Böylece kamera kayarken gölgeler titremez.
- **Sis**, kamera mesafesine göre ayarlanır ve çizilen arazinin kenarı görünmeden önce örter.
- **Gün ilerlemesi:** Güneş yönü ve rengi gün boyunca değişir.

### Arazi (`render/terrain.ts`)

- ±85 birimlik kare, hafifçe **sarsılmış ızgara üçgenlerinden** oluşur. Bu, low-poly katlanmış kağıt görünümü verir. Her tepe noktasının yüksekliği `heightAt`'ten gelir, rengi konuma göre (`colorAt`) seçilir: çimen tonları, göl kıyısında kum şeridi, taşlıkta gri zemin.
- **Göller:** Parlak kağıt su yüzeyidir.
- **Sınır:** Oynanabilir alan kenarında kağıt şerit ve kazıklar vardır.
- **Dış orman** ve **taşlık kayaları**, `InstancedMesh` ile çizilir (çok sayıda kopya tek çizim çağrısında). Kayalar ikosahedrondur.
- **Fare ile seçim:** `rayTerrain` ekrandan atılan ışını arazi yüzeyiyle kesiştirir.
- Harita değişince (`rebuildTerrain`) arazi baştan üretilir, göl ördekleri sıfırlanır.

### Prosedürel modeller (`models/`)

- **`ModelBuilder`:** Kutu, prizma, silindir ve paneller gibi parçaları **parça grupları** (piece) hâlinde toplar. Her grubun bir **rolü** vardır (taban, duvar, gövde, çatı, detay) ve isteğe bağlı bir **menteşesi** (dönme noktası ve açık konumdaki açı) olabilir.
- **Yardımcılar:** `windowAt`, `doorAt`, `panelBox` ve `houseShell` sık kullanılan parçaları üretir.
- Model bitince parçalar **pişirilir** (baked). Kurulma animasyonu için ayrı ayrı geometri, animasyon bittikten sonra kullanılmak üzere **tek birleşik geometri** üretilir. Bu, çizim çağrısı sayısını düşürür.
- **Şablon önbelleği** (`models/index.ts`): Her (tür, seviye, çeşit) için model bir kez üretilir, sahnedeki bütün kopyalar geometriyi paylaşır. Evler ve yükseltilebilir binalar seviyeye göre ayrı şablon alır. `variantFor(tür, id)` ve `sizeFor(tür, id)` her binaya id'den türetilen sabit bir çeşit ve boy verir.
- **Dönen parçalar:** Değirmen kanadı gibi parçalar `spinners` olarak ayrıca döndürülür.
- Bütün parçalar taban yarıçapının içinde kalır ve binanın önü +z yönüne (yola) bakar.
- **Eğim:** Eğimli arazide alçak tarafın boşluğunu duvar renginde bir **temel kutusu** kapatır. Bina araziye gömülerek oturur, altında kaide yoktur.

### Saat Kulesi aşamaları (`civic.ts`, `renderer.ts`)

- `buildClockTower(asama)` kuleyi beş görünümde üretir: 0 taban + iskele, 1 gövdenin alt yarısı, 2 üst yarısı, 3 saat ve balkon, 4 çatı ve bayrak (iskele kalkar). `ModelBuilder.grup` her parçaya bir grup etiketi verir, `keep` pişirirken grupları süzer. Atılan parçalar da üretilir, böylece ortak parçalar her aşamada birebir aynı kalır.
- Şablon anahtarı aşamayı içerir (`saatKulesi-1-0-a2`); aşama 4 eski anahtarı kullanır, menü resmi ve hayalet tam kuledir.
- `setMonumentStage(id, asama, anim)`: yalnızca yeni parçalar katlanır, öncekiler `createFold(tpl, mat, { fixed })` ile kurulu hâlde durur. İskele dururken (aşama 1–3) yeni duvarlar menteşeyle dışarıdan kalkmaz, yerinde büyür (`menteseYok`), böylece iskeleyi kesmez. 3→4 geçişinde önce iskele geri katlanarak sökülür, sonra çatı ve bayrak iner, konfeti saçılır. `addBuilding` ardından hemen `setMonumentStage(id, 0)` gelirse ilk kurulum yalnızca taban ve iskeleyi katlar.
- Deneme: `?preview&anit` (beş aşama yan yana), `?preview&anit=dongu` (bir kule sırayla ilerler), `?preview&anit=kare&asama=N&t=S` (geçişin sabit bir anı).

### Kurulma animasyonu (`fold.ts`)

Bina kağıt maket gibi kurulur:

1. **Taban** düz bir kağıt açınım gibi yere serilir (`spread`).
2. **Duvarlar ve gövdeler** sırayla, alt kenarlarındaki menteşeden kalkar (`hinge`).
3. **Çatı yarıları** katlanarak kapanır.
4. **Detaylar** (pencere, baca, tente) zıplayarak yerine oturur (`drop` / `grow`).

Toplam süre yaklaşık 1.2 saniyedir (`KURULUM_HIZI`). Animasyon `time ∈ [0, dur]` ile sürülür, bu yüzden tersine oynatılınca **yıkım** animasyonu olur (bina katlanıp yatar). Animasyon bitince parça mesh'leri atılır ve birleşik mesh'e geçilir. Kurulum bitince binanın üstünden renkli kağıt **konfeti**, tabanından kraft kağıdı kırıntıları saçılır.

### Yollar (`render/roads.ts`)

- Yol, arazi yüksekliğini izleyen bir **kağıt şerittir**. Her noktada normal yönünde sol ve sağ kenar hesaplanır, katmanlar (kenar, iç yüzey, çizgiler) **segment segment** sıralanır.
- Bu sıralama sayesinde `drawRange` ile şerit baştan sona **açılarak serilir** (`revealRoad`), yıkımda geri sarılır.
- Bina patikaları aynı kodla (`'patika'` türü) çizilir.

### Mevsim görünümü (`render/season.ts`)

`GameRenderer.setSeason(m, anlik?)` mevsimi çizime bildirir. Main her karede `setSeason(mevsim(s.gun))` çağırır; aynı mevsimde bir şey olmaz. Oyun açılışında, kayıt yüklemede ve yeni oyunda `anlik=true` ile geçişsiz uygulanır.

- İki shader ağırlığı vardır: `uSonbahar` ve `uKis`. Hedefler: ilkbahar/yaz [0, 0], sonbahar [1, 0], kış [0, 1]. Her kare hedefe doğru yürür, tam geçiş **3 saniye** (`MEVSIM_GECIS`), smoothstep ile yumuşatılır.
- **Ağaçlar** (`treeMaterial`; oyuncunun ağaçları, orman ve dekor ormanı): shader yalnızca yeşil tonları değiştirir. Sonbaharda her ağaç konumuna göre hardal, turuncu ya da terrakota olur, yaklaşık %10'u yeşil kalır. Kışın açık, karlı gri-yeşil. Kurulma animasyonundaki ağaç da aynı rengi kullanır (`createFold(tpl, mat)`).
- **Zemin:** `onBeforeCompile` ile mevsim rengi karışır, tepe renkleri yeniden hesaplanmaz. Sonbaharda hafif sararır, kışın kırık beyaz kar olur.
- **Göl ve kum:** kışın göl mat buz rengi olur, dalgalar söner, kum karlanır. Sis ve arka plan rengi de hafifçe kayar.
- **Kar:** 520 beyaz kağıt parçası, tek `InstancedMesh`, gölgesiz. Kamera hedefinin çevresinde düşer, salınır, takla atar. Görünen sayı kış ağırlığıyla orantılıdır, kış dışında hiç çizilmez.
- Renkler `palette.ts` içindedir (`yaprakHardal`, `yaprakTuruncu`, `yaprakTerrakota`, `cimenSonbahar`, `karYaprak`, `karZemin`, `karKum`, `karTane`, `buz`, `sisKis`, `sisSonbahar`).
- Menü resimleri mevsimden etkilenmez. Yeni harita (`rebuildTerrain`) mevcut mevsim görünümünü korur.
- Deneme: `?preview&mevsim=kis` (ya da `sonbahar`, `yaz`, `ilkbahar`); `mevsim=dongu` 6 saniyede bir sıradaki mevsime geçer.
- Kışın ördekler göl buz tutarken küçülerek gider, ilkbaharda döner. Yerleştirme önizlemesindeki hayalet ağaç da mevsim renginde görünür (`treeGhostMaterial`).
- Bilinen küçük eksik: bazı ağaç çeşitlerindeki hardal vurgu kışın da kalır (kuru yaprak gibi durur).

### Canlılık (`life.ts`)

Yalnızca görseldir, mantığa etkisi yoktur.

- **Yürüyen kağıt insanlar:** Sayısı `min(ceil(nüfus × 0.6), 120)`. Yol ağı üzerinde, sağ şeritte yürürler. Evden işe, pazara ya da okula gider, binada 4–14 sn kalıp döner. Hedef seçme olasılığı %70'tir. Yolların birbirine bağlı olup olmadığı nokta yakınlığıyla bulunur.
- **Diğer hareketler:** tarlada çiftçi, pazarda kalabalık, okul çocukları, bacalardan yükselen ve rüzgarla kayan kağıt duman (ev ve fırın), göllerde 2–4 ördek, 15–30 sn arayla kuş sürüleri, yolda ara sıra el arabası.
- **Performans:** Her figür türü tek bir `InstancedMesh` ile çizilir, görünür örnekler her kare baştan paketlenir. Kameradan uzak kişiler seyrek güncellenir. Kamera çok uzaktayken gölge diskleri çizilmez.

### Kamera (`camera.ts`)

Elle yazılmış bir yörünge kamerasıdır: hedef nokta, mesafe, yatay ve dikey açı. Hareketler yumuşatılır. Hedef oynanabilir alanda kalır. Açı ve mesafe sınırları, ekranın üst kenarından geçen ışının bile hep yere bakmasını sağlar, bu yüzden ufuk hiç görünmez.

### Önizleme ve vurgular

- **Hayalet bina:** Yerleştirme sırasında yarı saydam görünür, geçersiz yerde kırmızımsıdır.
- **Etki halkası:** Zeminde kesikli kağıt halka (`showRange`).
- **Seçim:** sarı, **yıkım:** kırmızı vurgu.
- **Uyarı işareti:** sprite. **Uçan sayılar:** kağıt etiket (`FloatLabels`).

### Menü resimleri (`thumbnails.ts`)

Ayrı ve geçici bir `WebGLRenderer` ile her binanın 1. seviye modeli sabit bir açıdan, şeffaf arka planla bir kez çizilir. Sonuç PNG data URL olarak önbelleğe alınır. Bu yüzden menüdeki resim her zaman oyundaki modelle aynıdır.

---

## 20. Arayüz katmanı nasıl yapıldı

- **Görünüm:** `index.html` içindeki CSS kağıt kart görünümünü verir: krem arka plan, ince gren deseni, yumuşak gölgeler, yapışkan bant şeritleri, el yazısı fontu (Segoe Print ve benzerleri). Renkler CSS değişkenleridir (`--kagit`, `--murekkep`, `--altin` …).
- **Katmanlar:** `#sahne` (Three.js canvas) ve onun üstünde `#arayuz` (HTML). Arayüz katmanı tıklamaları geçirir, yalnızca kendi öğeleri tıklanır.
- **`el()`** küçük bir DOM oluşturma yardımcısıdır. **`flash()`** bir öğeye kısa vurgu animasyonu uygular. **`tr()`** sayıları Türkçe biçimler.
- **`buildMenu.ts`:** Her kategorinin rengi `--kat` CSS değişkeniyle karta geçer. Yol kartlarının resmi 2D canvas'a çizilir. Yeni açılan binalar "yeni" noktasıyla işaretlenir.
- **`input.ts`:**
  - Sol tık ile yerleştirme ve seçim yapılır.
  - Yol aracında sol sürükleme fırça olur. Bu sırada kameranın sol sürükleme ile kaydırması kapatılır (`setLeftDragPan(false)`). Fırça etiketi canlı maliyeti gösterir.
  - Sağ tık sürüklemeden bırakılırsa iptal sayılır, sürüklenirse kamera döner.
  - Bina yol kenarına götürülünce önü otomatik yola döner.
- **`main.ts`** her şeyi bağlar:
  - Kullanıcı eylemleri (yerleştir, yık, yükselt, yol çiz) önce mantık fonksiyonunu çağırır. Başarılı olursa çizime bildirir (`addBuilding`, `removeBuilding` …), başarısız olursa nedeni bildirim olarak gösterir.
  - Gün sonu raporuyla (`DayReport`) uçan sayılar, seviye değişimleri, bildirimler, uyarı işaretleri ve kayıt yapılır.

---

## 21. Testler

Testler `tests/` klasöründedir ve Vitest ile çalışır. Son çalıştırmada **194 testin hepsi geçti**. `tests/helpers.ts` boş bir klasik harita durumu (`blank()`), bina ekleme (`add`) ve yol ekleme (`addRoad`) yardımcıları verir.

| Dosya | Kapsam |
|---|---|
| `economy.test.ts` | İşçi oranı, üretim, ihtiyaçlar, seviye atlama/düşme, mutluluk, vergi/gider, borç, açılan binalar, bilgi paneli, yol mutluluğu |
| `game.test.ts` | Başlangıç durumu, `tick`, hedefler, kayıt |
| `geometry.test.ts` | Geometri yardımcıları, arazi sorguları |
| `placement.test.ts` | Yerleştirme kuralları, yıkım |
| `roads.test.ts` | `createGame` yolları, `planRoad`, yol yerleştirme/yıkma |
| `link.test.ts` | Bina–yol patika bağlantısı |
| `mapgen.test.ts` | Rastgele harita garantileri (yol karada, göl ve orman dışında, merkez boş, aynı tohum = aynı harita) |
| `newBuildings.test.ts` | Ambar, Balıkçı, ortak yemek stoğu ve satış yeri şartı, Taş Ocağı ve taşlıklar, Marangoz/mobilya/hastane, eski kayıt göçü |
| `upgrade.test.ts` | Hizmet binası yükseltmesi (maliyet, taş, etki, gider, iade) |
| `cards.test.ts` | Karar kartları: havuz ve kart hedefleri, her kartın artı ve eksisi, deterministik çekiliş, seçilenin tekrar gelmemesi, seçim sırası, kayıt |
| `trade.test.ts` | Gezgin tüccar: geliş günleri, fiyatlar, alım/satım, kota ve sıfırlanması, para/stok/depo sınırı, kayıt |
| `requests.test.ts` | Sakin istekleri: nüfus eşiği, tek istek, 4 günlük süre ve cezasız kalkma, 3 gün bekleme, deterministik seçim, her türün şartı ve ödülü, kayıt |
| `monument.test.ts` | Saat Kulesi anıtı: aşama maliyetleri, eksik para/mal nedenleri, yarım kulenin aura/gider/hedef vermemesi, bilgi paneli, eski kayıttaki kulenin tamam sayılması, yarım kulenin kayıtta korunması, iade |
| `season.test.ts` | Mevsim takvimi ve sınır günleri, kışa kalan gün, kışın tarla çıktısı 0, kışın odun tüketimi 2 kat, bilgi paneli işareti, kayıt biçiminin değişmemesi |
| `adjacency.test.ts` | Komşuluk bonusları: her kuralın var/yok durumu, göl mesafesi, kaynak yıkılınca bonusun kalkması, girdinin fazla tüketilmemesi, stok sınırı, bilgi paneli ve önizleme metni |
| `denge.test.ts` | Denge ölçümü: üç referans kasabanın (≈50, ≈150, ≈300 nüfus) günlük vergi, gider ve neti; sayı denetlemez, yazdırır |

Not: `roads.test.ts` içindeki "createGame 50 ms'den kısa sürer" zaman testi yavaş makinelerde ara sıra başarısız olabilir.

---

## 22. Nasıl genişletilir (tarifler)

### Denge değiştirmek

Sayıların neredeyse hepsi `src/data/buildings.ts` içindedir:

- Bina başına değerler `BUILDINGS` içinde: maliyet, gider, etki, mutluluk, işçi, üretim, açılma nüfusu.
- Genel kurallar `BALANCE` içinde: başlangıç parası, gün süresi, kişi başı tüketim, yükseltme çarpanları, stok sınırı, borç sınırı.

Değiştirdikten sonra `npx vitest run` çalıştırın. Bazı testler belirli sayıları bekler.

### Yeni bir yemek türü eklemek (ör. "Çiftlik")

1. `src/logic/types.ts` → `BuildingType`'a `'ciftlik'` ekleyin.
2. `src/data/buildings.ts` → `BUILDINGS`'e tanımı ekleyin: `uretim: { girdi: {}, cikti: { yemek: 5 } }` ve istenirse `yemekSatar: true`. `BUILDING_ORDER` dizisine de ekleyin.
3. `src/logic/economy.ts` → `URETIM_SIRASI` dizisine ekleyin.
4. `src/render/models/` altında bir `buildFarm()` modeli yazın ve `models/index.ts` içindeki şablon seçimine bağlayın.
5. `src/ui/buildMenu.ts` → binayı bir kategoriye koyun. İsterseniz `src/render/life.ts` → `LIFE.hedefTurleri` listesine ekleyin.
6. Test ekleyin.

Ev tarafında hiçbir şey değişmez, çünkü evler ortak `yemek` stoğundan yer.

### Yeni bir mal eklemek

1. `Good` tipine ekleyin.
2. `emptyGoods()` (economy.ts) içine 0 değeriyle ekleyin.
3. HUD'daki mal listesine (`src/ui/hud.ts`) ekleyin.

Kayıt göçü eksik malları otomatik 0 yapar.

### Yeni bir ihtiyaç eklemek

1. `Need` tipine ekleyin.
2. `HOUSE_LEVELS`'te ilgili seviyeye yazın.
3. Hizmet ihtiyacıysa sağlayan binaya `saglar` alanını verin. Stok ihtiyacıysa `isStockNeed` ve `perCapita` fonksiyonlarını güncelleyin.
4. Bilgi panelindeki ihtiyaç adını (`infoPanel.ts`) ekleyin.

### Yeni bir hedef eklemek

`src/logic/goals.ts` → `GOAL_LIST` dizisine `{ ad, aciklama, check, ilerleme? }` ekleyin. Sıra önemlidir. "Kasaba tamamlandı" hedefinin indeksi `KASABA_TAMAM_HEDEFI` (4) sabitinde durur. Önüne hedef eklenirse bu sabit de güncellenmelidir.

### Haritayı ayarlamak

`src/data/map.ts` → `HARITA_URETIM` içindeki sayıları (göl sayısı, yarıçaplar, orman yoğunluğu, merkez boşluğu) değiştirin.

Dikkat: Üretim sırasına yeni bir rastgele çekim eklemek eski tohumların haritalarını değiştirir. Yeni çekimleri `agacTohum`'dan **sonra** ekleyin.

### Kaydı sıfırlamak

Tarayıcı konsolunda `localStorage.removeItem('kagit-kasaba-kayit')` çalıştırıp sayfayı yenileyin.

---

## 23. Bilinçli kararlar ve yapılmayanlar

Proje kuralları `kagit-kasaba/CLAUDE.md` dosyasındadır. Üst klasördeki `sehir/CLAUDE.md` (Mini Şehir kart oyunu) bu projeye uygulanmaz.

**Yapılmayanlar (YAPMA listesi):**

- Gökdelen, apartman, iki kattan yüksek ev.
- Izgara ya da kare/altıgen tahta. Yerleşim serbesttir.
- Yol ağı bağlantı analizi (BFS). Bağlantı yalnızca "yol ucu bir yola kenetlenmeli" ve "bina yol kenarında olmalı" kurallarıyla sağlanır.
- Köprü, tünel.
- Rastgele afetler, savaş, çok oyunculu mod, sunucu.
- Listede olmayan bağımlılıklar.

**Tasarım ilkeleri:**

- **Ekrandaki his önemlidir.** Kağıt maket görünümü, katlanarak kurulma ve canlılık bunun için var.
- **Mantık ile çizim ayrıdır.** Kurallar test edilebilir, çizim istenirse tamamen değiştirilebilir.
- **Bütün sayılar tek yerdedir** (`buildings.ts`, `map.ts`, `palette.ts`, `LIFE`), böylece denge ayarı kolaydır.
- **Her şey deterministiktir.** Aynı tohum aynı haritayı, aynı id aynı bina çeşidini verir.
