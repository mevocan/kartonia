# Kartonia

Kağıttan maket görünümlü, sakin bir 3D kasaba kurma oyunu. Tarayıcıda oynanır; kurulum yok.
Yol çiz, yol kenarına evler kur, evlere su ve yemek götür, sakinlerini mutlu et.

*A calm 3D town-building game that looks like a papercraft model. Plays in the browser, no install.
Available in Turkish and English.*

## Oyna

Oyun GitHub Pages'te yayınlanır: depo sayfasının sağındaki **Deployments → github-pages** bağlantısı.

Fare ve klavye için tasarlandı; en iyi bilgisayar tarayıcısında oynanır. Kasaba tarayıcıda (`localStorage`) kendiliğinden kaydedilir.

## Geliştirme

[Node.js](https://nodejs.org) 20.19+ ya da 22.12+ gerekir.

```sh
npm install
npm run dev        # geliştirme sunucusu
npm test           # birim testleri (Vitest)
npm run build      # tip kontrolü + dist/ klasörüne üretim derlemesi
npm run preview    # derlenmiş sürümü yerelde aç
```

Araçlar: Vite, TypeScript (strict), Three.js, Vitest. Başka bağımlılık yok. Bütün modeller ve sesler kodla üretilir; görsel ya da ses dosyası yoktur.

- `src/logic/` oyun kuralları (saf TypeScript, birim testli)
- `src/render/` Three.js çizimi
- `src/ui/` arayüz, `src/audio/` Web Audio sesleri
- `src/lang/` dil dosyaları (`tr.json`, `en.json`)

Ayrıntılı kurallar ve mimari: [CLAUDE.md](CLAUDE.md), oyunun tam rehberi: [OYUN-REHBERI.md](OYUN-REHBERI.md).

### Yeni dil eklemek

1. `src/lang/en.json` dosyasını `src/lang/<kod>.json` olarak kopyalayıp çevir.
2. `src/ui/i18n.ts` içindeki `Dil` tipine ve `DILLER` listesine kodu ekle.
3. `npm test`: eksik ya da fazla anahtar varsa test gösterir.

## Yayın

`main` dalına her push'ta GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) testleri çalıştırır, oyunu derler ve GitHub Pages'te yayınlar.
