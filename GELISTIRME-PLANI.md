# Kağıt Kasaba: Geliştirme Planı

Bu dosya `kagit-kasaba/` kök klasöründe, `CLAUDE.md` ve `OYUN-REHBERI.md` ile yan yana durur. Claude Code her aşamada önce bu dosyayı, sonra rehberin ilgili bölümünü okur.

## Amaç

Oyun şu an "kur ve bekle" hissi veriyor. Sebep özellik azlığı değil, karar azlığı:

- Mutluluk kendiliğinden tavana vuruyor (tam hizmetli 3. seviye ev: 50 + 16 + 15 + 5 + 28 = 114, sınır 100).
- Para birikiyor, harcanacak yer yok.
- Binayı nereye koyduğun birkaç yarıçap dışında fark etmiyor.
- Her kasaba ve her gün birbirinin aynısı.

Hedef: daha çok sistem değil, **daha çok anlamlı karar**. Kağıt maket hissi ve sadelik korunur.

## Çalışma kuralları

1. Bir seferde yalnızca **bir aşama** yapılır. Kullanıcı onayı olmadan sonraki aşamaya geçilmez.
2. Koda dokunmadan önce o aşamanın "Dosyalar" satırındaki dosyalar okunur.
3. Bütün kurallar `src/logic/` içinde, saf TypeScript olarak yazılır. Mantık Three.js'e ve DOM'a dokunmaz.
4. Bütün yeni sayılar `src/data/buildings.ts` (`BUILDINGS`, `BALANCE`) içine girer. Mantık dosyasına sabit sayı yazılmaz.
5. Bütün yeni renkler `palette.ts` içine girer.
6. Yeni bağımlılık eklenmez. Görsel, model ve ses dosyası eklenmez; her şey kodla üretilir.
7. Her şey deterministik kalır. Rastgelelik gerekiyorsa `makeRng` ile tohumdan ve gün sayısından türetilir. `haritaUret` içindeki çekim sırasına dokunulmaz.
8. Eski kayıtlar açılmaya devam eder. Yeni durum alanları isteğe bağlı (`?`) eklenir, `deserialize` eksik alanı varsayılanla doldurur.
9. Her yeni kural için Vitest testi yazılır. Sayı beklediği için kırılan eski testler güncellenir ve raporda tek tek listelenir.
10. Aşama sonunda `npm run typecheck` ve `npm test` çalıştırılır, `OYUN-REHBERI.md` içindeki ilgili bölümler güncellenir.
11. Aşamada yazmayan hiçbir özellik eklenmez. Fikir varsa raporda "öneri" olarak yazılır, uygulanmaz.

**Aşama sonu raporu:** ne değişti, hangi dosyalar, hangi testler eklendi ya da güncellendi, test sonucu, bilinen sorunlar, denge için ayar önerileri.

## YAPMA listesi

Mevcut liste geçerlidir: gökdelen, apartman, iki kattan yüksek ev, ızgara, yol ağı bağlantı analizi (BFS), köprü, tünel, rastgele afet, savaş, çok oyunculu mod, sunucu, listede olmayan bağımlılık.

Bu plana özel ekler:

- Bireysel vatandaş simülasyonu (kimlik, meslek, ev-iş ataması). `life.ts` yalnızca görsel kalır.
- Bölge / mahalle sistemi.
- Yeni mal ve yeni üretim zinciri (kıyafet, demir, alet vb.).
- Malların çürümesi.
- Çöp, kirlilik, temizlik binası.
- Ayrı ekranda açılan mini oyunlar.
- Yeni oyun modları (yaratıcı, senaryo).
- Yaz kuraklığı ya da kış dışında mevsim cezası.
- Dördüncü ev seviyesi.
- İstek başarısız olunca ceza.

---

## Aşama 1: Denge ve gelir-gider dökümü

**Amaç:** Mutluluk ve para yeniden anlam kazansın. Yeni mekanik yok.

**Dosyalar:** `data/buildings.ts`, `logic/economy.ts`, `logic/types.ts`, `ui/hud.ts`, `tests/economy.test.ts`

### 1a. Mutluluk ölçeği

- [x] `BALANCE` içine mutluluk sabitlerini taşı (şu an formülde gömülü olanlar dahil).
- [x] Başlangıç değerleri:

| Sabit | Eski | Yeni |
|---|---|---|
| Taban mutluluk | 50 | 45 |
| Karşılanan ihtiyaç başına | 4 | 2 |
| Ağaç toplamı tavanı | 15 | 9 |

- [x] Bina auraları, asfalt (+5) ve gürültü değerleri değişmez.

Beklenen sonuç:

| Ev | Eski | Yeni | Vergi (eski → yeni) |
|---|---|---|---|
| 1. seviye, çeşme + ağaçlar | 67 | 56 | 3 → 3 |
| 2. seviye, çeşme + hal + ağaçlar | 77 | 62 | 7 → 6 |
| 3. seviye, tam hizmet + ağaç + asfalt | 100 (114) | 89 | 15 → 13 |
| Aynı ev, Saat Kulesi alanında | 100 | 100 | 15 → 15 |

- [x] Test: tam hizmetli 3. seviye ev Saat Kulesi olmadan 100'e ulaşmaz.
- [x] Hedef 7 (mutluluk ≥ 70) ve hedef 13 (mutluluk ≥ 75) eşikleri yeni ölçekle hâlâ ulaşılabilir mi, raporda belirt.

### 1b. Para: önce ölç, sonra ayarla

- [x] `tests/` altına başsız bir denge ölçümü yaz: elle kurulmuş üç referans kasaba (≈50, ≈150, ≈300 nüfus) için günlük vergi, gider ve net geliri hesaplayıp yazdırsın.
- [x] Raporda üç kasabanın net gelirini ver. **Bu adımda sayı değiştirme.**
- [x] Hedef: 300 nüfuslu kasabada net günlük gelir, en pahalı tek harcamanın (Aşama 4'teki anıt aşaması, ≈200 para) yarısını geçmesin. Yani büyük bir harcama en az iki gün biriktirme istesin.
- [x] Hedef tutmuyorsa şu kaldıraçlardan öneri getir, kullanıcı seçsin: (1) Pazar, Okul, Hastane günlük gideri, (2) yükseltme maliyet çarpanları, (3) 3. seviye ev için vergi katsayısı.
  - Seçilen: (3) + (1). 3. seviye ev vergi çarpanı 0.6, Pazar/Okul/Hastane gideri 3 katı (9/12/15). Ölçüm: net 29 / 61 / 109 (50 / 150 / 300 nüfus).

### 1c. Gelir-gider dökümü

- [x] `DayReport` içine `vergiToplam`, `binaGider`, `yolGider`, `net` alanlarını ekle.
- [x] HUD'da Para'nın üstüne gelince küçük kağıt kart açılsın: dünkü vergi, bina gideri, yol gideri, net.

**Oynama kontrolü:** Evleri mutlu etmek için uğraşmak gerekiyor mu? Ağaç dikmek hâlâ değerli mi? İlk 10 gün eskisinden yavaş mı?

---

## Aşama 2: Komşuluk bonusu

**Amaç:** Binayı nereye koyduğun üretimi değiştirsin. Her yerleştirme küçük bir bulmaca olsun.

**Dosyalar:** yeni `logic/adjacency.ts`, `data/buildings.ts`, `logic/economy.ts`, `logic/game.ts`, `ui/input.ts`, `ui/infoPanel.ts`, `render/renderer.ts`, yeni `tests/adjacency.test.ts`

### Kurallar (başlangıç değerleri)

| Bina | Şart | Bonus |
|---|---|---|
| Tarla | Taban kenarı bir göle ≤ 4 birim | Buğday +%25 (sulama) |
| Değirmen | Merkezde `heightAt` ≥ 1.0 | Un +%25 (rüzgâr) |
| Fırın | 6 birim içinde Değirmen var | Yemek +%25 (taze un) |
| Marangoz | 6 birim içinde Oduncu var | Mobilya +%25 |
| Ev | Merkez bir göle ≤ 5 birim | Mutluluk +3 (göl manzarası) |

Bu kurallar bilinçli olarak çatışır: göl kıyısını tarla, ev ve balıkçı paylaşır; fırını değirmene yaklaştırmak değirmen gürültüsünü (−6) evlere yaklaştırır.

### Yapılacaklar

- [x] `BUILDINGS` tanımına isteğe bağlı `komsuluk` alanı ekle (kaynak türü, mesafe, oran, etiket metni). Sayılar burada durur.
- [x] `adjacencyBonus(s, tür, x, z)` saf fonksiyonu: etkin bonusları ve toplam oranı döndürür. Bonus saklanmaz, her seferinde hesaplanır.
- [x] `runProduction`: çıktı = `üretilen × f × (1 + bonus)`. Girdi tüketimi değişmez (`gereken × f`). Stok sınırı denetimi bonuslu çıktıyla yapılır.
- [x] `houseHappiness`: göl manzarası bonusunu ekle.
- [x] Göle uzaklık için `placement.ts` içindeki `golYok` denetiminin yaklaşımını genelle; yeni geometri kütüphanesi yazma.
- [x] Yerleştirme sırasında hayalet binanın üstünde canlı etiket: bonus varsa `+%25 sulama`, kural var ama şart tutmuyorsa soluk `bonus yok`. Yol fırçasındaki maliyet etiketinin kodunu yeniden kullan.
- [x] Bilgi panelinde etkin bonuslar satırı.
- [x] `getBuildingInfo` tahmini bonusu içersin.
- [x] Testler: her kural için var/yok durumu, kaynak bina yıkılınca bonusun kalkması, girdinin fazla tüketilmemesi.

**Oynama kontrolü:** Bina koymadan önce yer arıyor musun? Göl kıyısı için karar vermek zorunda kalıyor musun? Bonus fazla mı güçlü, fazla mı önemsiz?

---

## Aşama 3: Kış

**Amaç:** Günler birbirinden farklı olsun. Stoklamak ve Ambar anlam kazansın. Baskı öngörülebilir olsun, sürpriz ceza olmasın.

**Dosyalar:** yeni `logic/season.ts`, `data/buildings.ts`, `logic/economy.ts`, `ui/hud.ts`, `ui/toast.ts`, `render/scene.ts`, `render/terrain.ts`, `render/palette.ts`, `render/paper.ts`, yeni `tests/season.test.ts`

### Kurallar

- Yıl 18 gündür: İlkbahar 5, Yaz 5, Sonbahar 5, Kış 3 (`BALANCE.mevsim`). Oyun ilkbaharda başlar, ilk kış 16–18. günlerdedir.
- Mevsim `gun` değerinden saf fonksiyonla türetilir (`mevsim(gun)`). **Yeni durum alanı yoktur**, kayıt biçimi değişmez.
- Kışın:
  - Tarla üretmez.
  - 3. seviye evlerin odun tüketimi 2 katına çıkar.
  - Başka hiçbir şey değişmez. Balıkçı, Değirmen (stoktaki buğdayla) ve Fırın çalışır.
- İlkbahar, yaz ve sonbaharın mekanik etkisi yoktur; yalnızca görseldir.

### Yapılacaklar

- [x] `mevsim(gun)` ve `kisaKalanGun(gun)` fonksiyonları.
- [x] `runProduction` ve ev tüketiminde kış kuralları.
- [x] HUD'da gün sayacının yanında mevsim simgesi ve "kışa X gün" yazısı.
- [x] Sonbaharın ilk gününde bildirim: "Kış 5 gün sonra. Yemek ve odun biriktir."
- [x] Bilgi paneli: kışın Tarla'da "kışın üretmez" notu.
- [x] Görsel (hepsi kodla, renkler `palette.ts`'de):
  - [x] Sonbahar: ağaç yaprakları hardal ve terrakota tonlarına geçer.
  - [x] Kış: zemin rengi beyaza kayar, ağaçlar yapraksız/açık renkli, göl yüzeyi mat buz rengi.
  - [x] Kış: düşen beyaz kağıt parçaları, tek `InstancedMesh` ile.
  - [x] Mevsim geçişi birkaç saniyede yumuşakça olur.
- [x] Testler: mevsim sınır günleri, kışın tarla çıktısı 0, kışın odun tüketimi 2 kat, eski kaydın sorunsuz açılması.

**Oynama kontrolü:** İlk kış çok mu erken ya da çok mu sert geliyor? Sonbaharda hazırlık yapma ihtiyacı duyuyor musun? Kış 3 gün yeterli mi?

---

## Aşama 4: Saat Kulesi anıt projesi

**Amaç:** Para, taş, odun ve mobilya için büyük bir harcama yeri. Geç oyunda uzun soluklu bir hedef.

**Dosyalar:** `data/buildings.ts`, `logic/types.ts`, `logic/placement.ts`, `logic/economy.ts`, `logic/goals.ts`, `logic/save.ts`, `ui/infoPanel.ts`, `render/models/civic.ts`, `render/fold.ts`, `render/renderer.ts`, `tests/upgrade.test.ts` ya da yeni `tests/monument.test.ts`

### Kurallar

Saat Kulesi artık tek seferde kurulmaz. Yerleştirince iskele kurulur, dört aşamada tamamlanır:

| Aşama | Para | Mal | Görünen |
|---|---|---|---|
| Yerleştirme | 100 | — | Taban ve iskele |
| 1 | 100 | 20 taş | Gövdenin alt yarısı |
| 2 | 100 | 30 odun | Gövdenin üst yarısı |
| 3 | 150 | 20 mobilya | Saat ve balkon |
| 4 | 200 | 30 taş + 20 mobilya | Çatı ve bayrak |

- Mutluluk aurası (+12), günlük gider ve hedef 5 şartı yalnızca **tamamlanmış** kule için geçerlidir.
- Aşama ilerletme, bilgi panelindeki **Malzeme gönder** düğmesiyle yapılır. Para ya da mal yetmiyorsa düğme nedenini gösterir (Yükselt düğmesiyle aynı davranış).

### Yapılacaklar

- [x] `Building` içine isteğe bağlı `insaat?: number` alanı (kalan aşama sayısı). Alan yoksa bina tamamdır; böylece eski kayıtlardaki kuleler tamamlanmış sayılır.
- [x] `BALANCE.anit` içinde aşama maliyetleri.
- [x] `canAdvanceMonument` / `advanceMonument` fonksiyonları, `canUpgrade` ile aynı hata nedenleri (`para`, `tas`, yeni `odun`, `mobilya`).
- [x] Yıkım iadesi: harcanan paranın %50'si, mallar geri gelmez.
- [x] Model: `civic.ts` içindeki kule, aşamaya göre parça gruplarını gösterir. Her aşamada yeni parçalar mevcut katlanma animasyonuyla kurulur, son aşamada konfeti.
- [x] Bilgi panelinde aşama ilerlemesi (`2 / 4`) ve sıradaki maliyet.
- [x] Testler: aşama maliyetleri, yarım kulenin aura vermemesi ve hedef 5'i tamamlamaması, eski kayıttaki kulenin tamam sayılması, iade.

**Oynama kontrolü:** Kuleyi bitirmek için bilerek taş ve mobilya biriktiriyor musun? Toplam maliyet (650 para) geç oyun gelirine göre az mı, çok mu?

---

## Aşama 5: Gezgin tüccar ve sakin istekleri

**Amaç:** Fazla malın bir çıkışı, eksik malın bir çaresi olsun. Oyuncuya kısa vadeli küçük hedefler gelsin.

**Dosyalar:** yeni `logic/trade.ts`, yeni `logic/requests.ts`, `data/buildings.ts`, `logic/types.ts`, `logic/economy.ts`, `logic/save.ts`, `ui/toast.ts`, yeni `ui/tradePanel.ts`, `render/life.ts`, yeni testler

### 5a. Gezgin tüccar

- Her 6 günde bir, başlangıç yolunun kenar ucuna gelir ve o gün boyunca kalır. İlk geliş 6. gün.
- Fiyatlar sabittir (`BALANCE.ticaret`). Satış fiyatı alış fiyatından belirgin düşüktür; tüccar para basma yolu değil, takas ve acil durum aracıdır.

| Mal | Sen satarsın | Sen alırsın |
|---|---|---|
| Buğday | 1 | 3 |
| Un | 2 | 5 |
| Yemek | 2 | 6 |
| Odun | 2 | 5 |
| Taş | 3 | 8 |
| Mobilya | 6 | 15 |

- Ziyaret başına alım ve satım toplamı 40 birimle sınırlıdır.

- [x] `tuccarVarMi(gun)` saf fonksiyonu; durum alanı gerekmez. Ziyaret başına kullanılan kota için tek sayaç alanı (`tuccarKota?`).
- [x] `buyGood` / `sellGood`: para, stok, stok sınırı ve kota denetimi.
- [x] Tüccar geldiğinde bildirim ve HUD'da küçük düğme; tıklayınca kağıt kart panel (6 mal, al/sat düğmeleri, kalan kota).
- [x] Görsel: `life.ts`'deki el arabası modelinden türetilmiş, yol ucunda duran bir tüccar arabası.
- [x] Testler: geliş günleri, fiyatlar, kota, stok sınırı.

### 5b. Sakin istekleri

- Nüfus 10'u geçtikten sonra, aynı anda en fazla **bir** istek olur. Bir istek bittikten 3 gün sonra yenisi gelir.
- İstek türü tohum ve gün sayısından `makeRng` ile seçilir (deterministik).
- Süre 4 gündür. Süre dolarsa istek sessizce kalkar, **ceza yoktur**.

| İstek | Şart | Ödül |
|---|---|---|
| Şenlik | Stoktan 30 yemek teslim et (düğmeyle) | 3 gün boyunca bütün evlere +5 mutluluk |
| Ağaçlandırma | 5 ağaç dik | 40 para |
| Kış hazırlığı (yalnız sonbaharda) | Stokta 40 odun bulunsun | 60 para |
| Susuz ev (yalnız susuz ev varsa) | O ev su erişimine kavuşsun | 30 para |

- [x] Durum: `istek?: { tur, baslangicGun, ilerleme, hedefBinaId? }` ve `geciciMutluluk?: { deger, bitisGun }`.
- [x] `houseHappiness` geçici mutluluğu ekler.
- [x] Hedef kartının altında ikinci, daha küçük bir istek kartı: metin, ilerleme, kalan gün.
- [x] İstek geldiğinde ve tamamlandığında bildirim.
- [x] Testler: tek istek kuralı, her türün şartı ve ödülü, süre dolunca cezasız kalkma, aynı tohumda aynı istek sırası.

**Oynama kontrolü:** Tüccarı kullanıyor musun, yoksa görmezden mi geliyorsun? İstekler dikkat dağıtıyor mu, yön mü veriyor? Ödüller uğraşmaya değiyor mu?

---

## Aşama 6: Karar kartları

**Amaç:** Her kasaba farklı bir yöne gitsin. Oyuncu kasabasının karakterini seçsin.

**Dosyalar:** yeni `logic/cards.ts`, `data/buildings.ts` (ya da yeni `data/cards.ts`), `logic/goals.ts`, `logic/economy.ts`, `logic/types.ts`, `logic/save.ts`, yeni `ui/cardPicker.ts`, `main.ts`, yeni `tests/cards.test.ts`

### Kurallar

- 1, 3, 5, 7 ve 10 numaralı hedefler tamamlanınca oyun duraklar ve üç kart gösterilir. Oyuncu birini seçer. Seçim kalıcıdır.
- Üç kart, tohum ve hedef numarasından deterministik çekilir. Daha önce seçilen kart tekrar gelmez.
- Her kartın bir artısı ve bir eksisi vardır.

Başlangıç havuzu:

| Kart | Artı | Eksi |
|---|---|---|
| Balıkçı kasabası | Balıkçı +2 yemek | Tarla −1 buğday |
| Odun tasarrufu | Evlerin odun tüketimi −%30 | Bütün evlere −5 mutluluk |
| Ağır vergi | Vergi +%15 | Seviye atlama 2 yerine 3 gün ister |
| Taş ustaları | Yükseltmelerin taş maliyeti −%40 | Taş Ocağı gürültüsü −4 yerine −8 |
| Yeşil kasaba | Ağaç mutluluk tavanı +6 | Oduncu üretimi −%25 |
| Tüccar dostu | Tüccar kotası 40 yerine 70 | Pazar gideri 2 katı |
| Sessiz değirmen | Değirmen gürültüsü 0 | Değirmen −1 un |
| Büyük ambar | Ambar +100 yerine +200 | Ambar gideri 1 yerine 3 |

### Yapılacaklar

- [x] Durum: `kararlar?: string[]`. Eski kayıtta boş dizi.
- [x] Kart tanımları tek veri dosyasında: ad, açıklama, etkilediği değerler.
- [x] Tek bir `ayar(s, anahtar)` fonksiyonu: taban değeri `BALANCE` / `BUILDINGS`'ten alır, seçili kartların etkisini uygular. Ekonomi kodu etkilenen değerleri doğrudan değil bu fonksiyonla okur. Karta özel `if` blokları ekonomi koduna dağıtılmaz.
- [x] `GOAL_LIST` öğelerine `kart?: true` işareti.
- [x] Seçim ekranı: üç kağıt kart, artı yeşil, eksi kırmızı satır. Seçilene kadar oyun duraklar.
- [x] HUD'da seçilmiş kartların küçük simgeleri; üstüne gelince açıklama.
- [x] Testler: her kartın artı ve eksi etkisi, aynı tohumda aynı çekim, seçilen kartın tekrar gelmemesi, kayıt/yükleme.

**Oynama kontrolü:** Kart seçerken düşünüyor musun, yoksa biri hep bariz mi? İki ayrı kasaba gerçekten farklı oynanıyor mu?

---

## Aşama 7: Ses ve öğretici

**Amaç:** Oyun his olarak tamamlansın, yeni oyuncu ilk beş dakikada kaybolmasın.

**Dosyalar:** yeni `audio/` klasörü (`src/audio/`), `main.ts`, `ui/hud.ts`, yeni `ui/tutorial.ts`

### 7a. Ses

Ses dosyası kullanılmaz; hepsi Web Audio API ile kodla üretilir.

- [x] Efektler: bina kurulurken kağıt hışırtısı (filtrelenmiş gürültü), yol serilirken kısa sürtünme, bina seçimi, hata, gün sonu vergi sesi, hedef tamamlama, seviye atlama.
- [x] Ortam: ilkbahar-yaz kuş sesleri, kışın rüzgâr; kamera uzaklaştıkça kısılır.
- [x] HUD'da ses aç/kapa düğmesi. Ayar `localStorage`'da ayrı bir anahtarda durur.
- [x] Ses, ilk kullanıcı tıklamasından sonra başlar (tarayıcı kuralı).
- [x] Ses katmanı mantığa dokunmaz; `main.ts` olayları ses katmanına bildirir (çizim katmanıyla aynı desen).

> **Kullanıcı kararı (verildi): müzik olsun** (seçenek 2, kodla üretilen pentatonik melodi). Müzik. Seçenekler: (1) müzik yok, yalnızca ortam sesi; (2) kodla üretilen basit, yavaş pentatonik melodi. Ses dosyası eklemek "her şey kodla" ilkesini bozar. Bu karar verilmeden müzik yazılmaz.

### 7b. Öğretici

- [x] Yalnızca ilk oyunda, atlanabilir, beş adım. Her adım oyuncunun eylemiyle ilerler:
  1. Yol aracını seç ve başlangıç yolundan bir yol çiz.
  2. Yol kenarına bir ev koy.
  3. Bir Çeşme kur.
  4. Gün sonunu bekle ve vergiyi gör.
  5. Hedef kartına bak.
- [x] Adımlar ekranın kenarında kağıt not olarak görünür, oyunu durdurmaz.
- [x] "Gösterildi" bilgisi `localStorage`'da ayrı anahtarda durur, oyun kaydına girmez.

**Oynama kontrolü:** Ses yorucu mu, eksikliği hissediliyor mu? Oyunu hiç görmemiş biri öğreticiyle ilk evini kurabiliyor mu?

---

## Sonraya bırakılanlar

Yukarıdaki yedi aşama bitip oynandıktan sonra, ihtiyaç görülürse değerlendirilir. Şimdi yapılmaz.

- Kaynak tükenmesi: oduncunun ağacı kesmesi ve yeniden dikim, göl başına balık kapasitesi.
- Haritada "verimli toprak" bölgeleri.
- Harita türleri, tohum girme ve paylaşma.
- Hizmet kapsaması ve mutluluk için katman görünümü.
- Fotoğraf modu.
- Kozmetik gece ve fenerler.
- Dokunmatik kontrol.
- Binaya bağlı, birkaç saniyelik isteğe bağlı etkileşimler (balık tutma, hasat).
- İkinci bir anıt.
