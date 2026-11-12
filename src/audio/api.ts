// Ses katmanının main'e verdiği sözleşme. Uygulaması: src/audio/index.ts → createAudio().
// Ses dosyası yoktur: efektler, ortam sesi ve müzik Web Audio API ile kodla üretilir.
// Ses katmanı mantığa ve çizime dokunmaz; main olayları bildirir (çizim katmanıyla aynı desen).
import type { Mevsim } from '../logic/season';

/** Kısa efektler. */
export type SesEfekti =
  | 'kurulum' // bina kurulurken kağıt hışırtısı (filtrelenmiş gürültü)
  | 'yol' // yol serilirken kısa sürtünme
  | 'secim' // bina / yol seçimi, panel düğmesi
  | 'hata' // yerleştirme / işlem yapılamadı
  | 'vergi' // gün sonu vergisi (bozuk para şıngırtısı)
  | 'hedef' // hedef tamamlandı, kart seçildi
  | 'seviye'; // ev büyüdü / anıt aşaması

export interface GameAudio {
  /**
   * Tarayıcı kuralı: ses ilk kullanıcı etkileşiminden sonra başlar. Main bunu ilk pointerdown / keydown'da
   * çağırır (birden çok çağrı zararsız). Bundan önce gelen play/setAmbience çağrıları sessizce yok sayılır.
   */
  unlock(): void;
  play(e: SesEfekti): void;
  /** Ana aç/kapa: efekt, ortam ve müzik birlikte. Kapatma/açma kısa bir yumuşak geçişle olur. */
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  /**
   * Ortam sesi: ilkbahar ve yazda kuş sesleri (seyrek cıvıltılar), sonbaharda hafif rüzgâr + seyrek kuş,
   * kışın rüzgâr. zoom01: 0 kamera en yakın, 1 en uzak; uzaklaştıkça ortam sesi kısılır.
   * Main her karede çağırır; değişiklikler yumuşakça uygulanır.
   */
  setAmbience(m: Mevsim, zoom01: number): void;
  /** Oyun duraklatıldı mı: duraklıyken ortam ve müzik hafifçe kısılır (efektler çalar). */
  setPaused(paused: boolean): void;
  dispose(): void;
}

// createAudio(): GameAudio  — src/audio/index.ts içinde.
