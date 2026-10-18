# Mandi'nin Oyun Bahçesi

7-10 yaş için, internetsiz çalışan oyunlar. Hedef cihaz: **Samsung Galaxy Tab 3 Lite (SM-T110)** — Android 4.2, Chrome 71, 1 GB RAM, 1024×600.

## Oyunlar

Ana sayfa konu başlıkları (Matematik, Türkçe, Hayat Bilgisi, Akıl Oyunları) altında oyun kartları gösterir. Yeni oyun: `app.js` içinde `GAMES` ve `SUBJECTS`'e eklenir.


- **Mandi Otobüsü** (`bus.js`, sonradan yüklenir): Bakkal Mandi 12 yıldızla açılır. 3 seviye — bilet parası say, yolcu say (binen/inen), para üstü ver. Yandan görünüş sürüş: katmanlar `translate3d` ile kayar, Gaz/Fren basılı tutulur (klavyede oklar). `window.Mandi` arayüzü ve `GAMES.x.impl = {setup, next}` ile app.js'e bağlanır.
- **Mangala** (`mangala.js`, sonradan yüklenir, Akıl Oyunları): Türk Mangalası kuralları. 4 kilitsiz seviye (`free: true`) — Kolay Mandi (ipuçlu), Orta, Zor (minimax, derinlik 6), İki kişi (`solo`: Devam zincirine girmez). Kurallar `window.MangalaRules.applyMove` ile test edilebilir.
- **Trafik Kahramanı** (Hayat Bilgisi, trafikte güvenlik): 8 seviye — trafik/yaya ışığı, doğru mu (sahne), soru-cevap, levhalar, hangisi güvenli, arabada kemer/kask. Sahneler SVG (`SCENES`), cevaptan sonra açıklama notu (`.tr-note`).
- **Hece Treni** (Türkçe, 1. sınıf heceleme; sessiz): 8 seviye — resmi bul, heceleri vagonlara diz, eksik hece, kaç hece; 37 SVG resimli kelime (`WORDS`/`PIC` in app.js).
- **Büyük mü, Küçük mü?** (1. sınıf karşılaştırma): 8 seviye — çok/az tabak, timsah ağzı ile >, <, =, 99'a kadar, en büyük/en küçük.
- **Örüntü Treni** (1. sınıf örüntüler): 8 seviye — renk/şekil/renk+şekil örüntüleri, eksik vagon, ritmik sayma (2-5-10), ileri-geri sayı örüntüleri.
- **Bakkal Mandi** (1. sınıf paralarımız, 20 TL'ye kadar): 8 seviye — sayma, tam para ödeme (+1/+5/+10/+20), neyi alabilirim, para üstü. Paralar sade çizim (`moneySVG`).
- **Şekil Avcısı** (1. sınıf geometri): 8 seviye — şekli bul, adı ne, hangisi farklı (döndürülmüş), kaç köşe/kenar, şekil say, etrafımızda (nesne → şekil).
- **Saat** (1. sınıf, tam ve yarım saat): 8 seviye — okuma, akrep/yelkovanı sürükleyerek kurma (içte akrep, dışta yelkovan), dijital eşleştirme, kaç saat sonra.
- **Onluk ve Birlik** (1. sınıf, 100'e kadar basamak değeri): 8 seviye — çubuk/küp okuma, +10/+1 ile sayı kurma (10 küp = 1 çubuk), kaç onluk/birlik.
- **Çıkarma** (1. sınıf, 20'ye kadar onluk bozmadan): 8 seviye — nesneler çizilir, kurbağa geri zıplar, onluk kutuda pullar silinir, gizli sayı.
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

Yeni cihazların neredeyse tamamında çalışır. Denenen eski cihazlar: iPad 3 (iOS 9.3.5, Safari — internetsiz dahil; gizli modda çalışmaz), Samsung Galaxy Tab 3 Lite (SM-T110, Android 4.2, Chrome).

Güncellemeler: tablet internete bağlıyken oyunu bir kez açıp kapatmak yeterli.

## Yayın

`master` dalına her push, GitHub Actions ile Cloudflare Pages'e (`mandi-oyun` projesi) yayınlanır ve **mandi.etka.org** adresine bağlanır. Gerekli repo secret'ları:

- `CLOUDFLARE_API_TOKEN` — izinler: *Account → Cloudflare Pages → Edit*, *Zone (etka.org) → DNS → Edit*
- `CLOUDFLARE_ACCOUNT_ID`

## Geliştirme kuralları (cihaz uyumu)

- JavaScript yalnızca **ES5** (let/const/ok fonksiyonu yok); kütüphane yok.
- CSS'te **değişken (`var(--x)`) yok** — tabletteki eski Chrome desteklemiyor; flex `gap`, `clamp()`, `min()`, `aspect-ratio`, `inset` de yok.
- Animasyonlar yalnızca `transform` ve `opacity` ile.
- Emoji yok (Android 4.2 renkli emoji göstermiyor); simgeler SVG.
- Ağır oyunlar ayrı dosyada (`lazy: 'x.js'`), ana sayfa açıldıktan ~1,5 sn sonra yüklenir.
- Yeni dosya eklenirse `public/sw.js` içindeki `FILES` listesine ve `public/offline.appcache`'e de eklenmeli.
- Çevrimdışı: Service Worker; desteklemeyen eski tarayıcılarda AppCache yedeği. Yeni sürüm ana sayfadayken kendiliğinden yüklenir, oyun ortasında bölmez. Ana sayfadaki sürüm yazısına dokunmak elle kontrol eder.

## Arama motorları ve yapay zekâ

- `index.html`: başlık, açıklama, canonical, Open Graph (`og.jpg`) ve schema.org `WebApplication` + `LearningResource` verisi.
- "Ebeveyn ve öğretmenler için" ekranı: arama motorlarının da okuduğu gerçek açıklama metni.
- `robots.txt` (AI botlarına da izin verir), `sitemap.xml`, `llms.txt`, `404.html`.
- `_headers`: `*.pages.dev` kopyası `noindex`; asıl adres mandi.etka.org.
