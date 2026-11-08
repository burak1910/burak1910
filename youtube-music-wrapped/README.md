# 🎧 YouTube Music Aylık Wrapped

Spotify Wrapped / YouTube Music Recap gibi, ama **sene sonunu beklemeden, her ay için**.
YouTube Music dinleme geçmişini yükle; o ay ne kadar müzik dinlediğini, kimi ve hangi şarkıları dinlediğini gör.

Tamamen tarayıcıda çalışır. Kurulum, sunucu, API anahtarı ya da giriş gerekmez; verin bilgisayarından çıkmaz.

## Özellikler

- 📅 **Aylık ve yıllık özet**: dönem seçici, önceki/sonraki ay geçişi
- ⏱️ **Toplam dinleme süresi** (tahmini dakika / saat) ve günlük ortalama
- 🎤 **En çok dinlenen 10 sanatçı** (dakika, çalma sayısı, farklı şarkı sayısı)
- 🎵 **En çok dinlenen 10 şarkı**
- 🕘 Günün saatlerine ve haftanın günlerine göre dinleme dağılımı
- 🗓️ Günlük dinleme takvimi (ısı haritası), en yoğun gün, en uzun dinleme serisi
- ✨ O ay **yeni keşfettiğin** sanatçı sayısı
- 📈 Aylara göre dinleme grafiği (tıklayınca o aya gider)
- 🖼️ Instagram hikâyesi boyutunda (1080×1920) **paylaşılabilir PNG kart**
- 💾 Yüklenen veri tarayıcıda (localStorage) hatırlanır, her seferinde yeniden yüklemen gerekmez
- 🧪 Dosyan yoksa "Demo verisiyle dene" butonu

## Kullanım

1. `index.html` dosyasını tarayıcıda aç (ya da GitHub Pages ile yayınla, aşağıya bak).
2. Google Takeout'tan aldığın `watch-history.json` (veya `.html`) dosyasını sürükleyip bırak.

### Geçmiş dosyasını alma (Google Takeout)

1. [takeout.google.com](https://takeout.google.com/) adresine git.
2. **Seçimlerin tümünü kaldır**, ardından yalnızca **YouTube ve YouTube Music**'i işaretle.
3. **Tüm YouTube verileri dahil** butonundan sadece **geçmiş**'i seç.
4. **Birden çok biçim** kısmında geçmiş için **JSON** seç (HTML de desteklenir).
5. Dışa aktarımı oluştur, zip'i aç ve
   `Takeout/YouTube ve YouTube Music/geçmiş/watch-history.json` dosyasını uygulamaya yükle.

> Her ay yeni bir Takeout alıp yükleyerek istatistiklerini güncelleyebilirsin. Google Takeout'ta
> "2 ayda bir, 1 yıl boyunca" otomatik dışa aktarım da ayarlanabilir.

## Dinleme süresi nasıl hesaplanıyor?

Takeout şarkı sürelerini vermediği için süre **tahmin edilir**:

- Art arda iki çalma arasındaki süre 8 dakikadan kısaysa, ilk şarkı o kadar dinlenmiş sayılır
  (şarkıyı atladıysan 20 saniye de olabilir).
- Aralık daha uzunsa (ara verdiysen) şarkı başına ortalama **3,5 dakika** sayılır.

Bu ayarlar `parser.js` içindeki `DEFAULT_MINUTES` ve `MAX_MINUTES` sabitleriyle değiştirilebilir.

## GitHub Pages ile yayınlama

Bu klasörü ayrı bir repoya taşıyıp (ör. `youtube-music-wrapped`) **Settings → Pages → Deploy from branch → main / root**
seçmen yeterli. Uygulama `https://<kullanıcı-adı>.github.io/youtube-music-wrapped/` adresinde açılır.

## Geliştirme

Bağımlılık yok: düz HTML, CSS ve JavaScript.

```
youtube-music-wrapped/
├── index.html          # arayüz
├── style.css           # tasarım
├── app.js              # arayüz mantığı, grafikler, paylaşım kartı
├── parser.js           # Takeout ayrıştırma + istatistik hesapları (Node'da da çalışır)
└── tests/parser.test.js
```

Testleri çalıştırmak için (Node 18+):

```bash
node --test tests/*.test.js
```
