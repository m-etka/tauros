# Mandi'nin Oyun Bahçesi

7-10 yaş için, internetsiz çalışan oyunlar. Hedef cihaz: **Samsung Galaxy Tab 3 Lite (SM-T110)** — Android 4.2, Chrome 71, 1 GB RAM, 1024×600.

## Oyunlar

- **Toplama** (1. sınıf, toplamı 20'yi geçmeyen): 8 seviye
  1. 5'e kadar, nesneleri sayarak
  2. 10'a kadar, nesneleri sayarak
  3. Sayı doğrusunda zıplayan kurbağa
  4. Onluk kutu
  5. Yalnızca sayılarla (10'a kadar)
  6. Gizli sayı (3 + ? = 7)
  7. İki onluk kutuyla 20'ye kadar
  8. Şampiyon: sayılarla 20'ye kadar

Her seviye 8 sorudur. Hatasız bitirilen sorulara göre 1-3 yıldız verilir ve bir sonraki seviye açılır. Çocuk nesnelere dokunarak sayabilir. Yanlış cevapta Mandi nesneleri birlikte sayar.

## Tablete kurulum

1. Tablet internetteyken Chrome'da site adresini açın.
2. Menü → **Ana ekrana ekle**.
3. Ana sayfanın altında "İnternetsiz oynanabilir" yazısı görününce internet artık gerekmez.

Güncellemeler: tablet internete bağlıyken oyunu bir kez açıp kapatmak yeterli.

## Yayın

`master` dalına her push, GitHub Actions ile Cloudflare Pages'e (`mandi-oyun` projesi) yayınlanır. Gerekli repo secret'ları:

- `CLOUDFLARE_API_TOKEN` — izin: *Account → Cloudflare Pages → Edit*
- `CLOUDFLARE_ACCOUNT_ID`

## Geliştirme kuralları (cihaz uyumu)

- JavaScript yalnızca **ES5** (let/const/ok fonksiyonu yok); kütüphane yok.
- CSS'te flex `gap`, `clamp()`, `min()`, `aspect-ratio`, `inset` yok.
- Animasyonlar yalnızca `transform` ve `opacity` ile.
- Emoji yok (Android 4.2 renkli emoji göstermiyor); simgeler SVG.
- Yeni dosya eklenirse `public/sw.js` içindeki `FILES` listesine de eklenmeli.
