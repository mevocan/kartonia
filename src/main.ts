// Başlatıcı: önce seçili dilin metinleri (src/lang/<dil>.json) yüklenir, sonra oyun.
// Arayüz modülleri metinleri içe aktarılırken okur; bu yüzden oyun dinamik olarak, dil hazır olunca yüklenir.
import './ui/stil.css';
import { dilYukle } from './ui/i18n';

async function main(): Promise<void> {
  await dilYukle();
  const { oyunuBaslat } = await import('./oyun');
  await oyunuBaslat();
}

void main();
