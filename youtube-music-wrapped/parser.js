/*
 * YouTube Music Wrapped - veri ayrıştırma ve istatistik fonksiyonları.
 * Tarayıcıda global `YTMStats` olarak, Node'da `require` ile kullanılabilir.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YTMStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bir çalmanın süresi bilinmediğinde varsayılan (dakika)
  const DEFAULT_MINUTES = 3.5;
  // İki çalma arasındaki boşluk bundan uzunsa, şarkının tamamı dinlendi varsayılır
  const MAX_MINUTES = 8;

  const MONTH_ABBR = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    oca: 0, şub: 1, sub: 1, nis: 3, haz: 5, tem: 6, ağu: 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
  };

  const MONTH_NAMES_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
    'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  function decodeEntities(s) {
    return String(s)
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&amp;/g, '&');
  }

  function cleanTitle(t) {
    return decodeEntities(t || '')
      .replace(/^(Watched|Listened to)\s+/i, '')
      .replace(/\s+adlı (videoyu|içeriği) izlediniz$/i, '')
      .replace(/\s+(izlendi|izlediniz|dinlendi|dinlediniz)$/i, '')
      .trim();
  }

  function cleanArtist(a) {
    return decodeEntities(a || '')
      .replace(/\s+-\s+(Topic|Konu)$/i, '')
      .replace(/VEVO$/, '')
      .trim();
  }

  /** "Jan 5, 2024, 10:00:00 PM GMT+03:00" veya "5 Oca 2024 22:00:00 GMT+03:00" gibi tarihleri ayrıştırır. */
  function parseDateLoose(str) {
    if (!str) return null;
    let s = decodeEntities(str).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const iso = new Date(s);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(iso)) return iso;

    // Gün Ay Yıl Saat (TR ve bazı Avrupa formatları)
    let m = s.match(/^(\d{1,2})\.? ([A-Za-zÇĞİÖŞÜçğıöşü]+)\.? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?: (GMT|UTC)([+-]\d{1,2})(?::?(\d{2}))?| (TSİ|TRT))?/);
    if (m) {
      const mon = MONTH_ABBR[m[2].toLocaleLowerCase('tr').slice(0, 3)];
      if (mon !== undefined) return buildDate(+m[3], mon, +m[1], +m[4], +m[5], +(m[6] || 0), m[8], m[9], m[10]);
    }
    // Ay Gün, Yıl, Saat AM/PM (EN)
    m = s.match(/^([A-Za-z]+)\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)?(?: (GMT|UTC)([+-]\d{1,2})(?::?(\d{2}))?)?/i);
    if (m) {
      const mon = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
      if (mon !== undefined) {
        let h = +m[4];
        if (m[7]) {
          const pm = m[7].toUpperCase() === 'PM';
          if (pm && h < 12) h += 12;
          if (!pm && h === 12) h = 0;
        }
        return buildDate(+m[3], mon, +m[2], h, +m[5], +(m[6] || 0), m[9], m[10]);
      }
    }
    return isNaN(iso) ? null : iso;
  }

  function buildDate(y, mon, d, h, mi, sec, offH, offM, trt) {
    let offsetMin = null;
    if (offH !== undefined && offH !== null && offH !== '') {
      const sign = offH.startsWith('-') ? -1 : 1;
      offsetMin = sign * (Math.abs(+offH) * 60 + +(offM || 0));
    } else if (trt) {
      offsetMin = 180;
    }
    if (offsetMin === null) return new Date(y, mon, d, h, mi, sec);
    return new Date(Date.UTC(y, mon, d, h, mi, sec) - offsetMin * 60000);
  }

  function isMusicEntry(header, url) {
    return header === 'YouTube Music' || /music\.youtube\.com/.test(url || '');
  }

  /** Google Takeout watch-history.json içeriğini çalma listesine çevirir. */
  function parseJson(data) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!Array.isArray(data)) throw new Error('Beklenmeyen JSON formatı: dizi bekleniyordu.');
    const plays = [];
    for (const e of data) {
      if (!e || !isMusicEntry(e.header, e.titleUrl)) continue;
      const time = new Date(e.time);
      if (isNaN(time)) continue;
      const title = cleanTitle(e.title);
      if (!title || /^https?:\/\//.test(title)) continue; // silinmiş/erişilemeyen içerik
      const sub = Array.isArray(e.subtitles) && e.subtitles[0];
      plays.push({
        title,
        artist: sub ? cleanArtist(sub.name) : 'Bilinmeyen sanatçı',
        time: time.getTime(),
      });
    }
    return plays;
  }

  /** Google Takeout watch-history.html içeriğini çalma listesine çevirir. */
  function parseHtml(html) {
    const plays = [];
    const cells = html.split(/<div class="outer-cell/).slice(1);
    for (const cell of cells) {
      const headerMatch = cell.match(/mdl-typography--title">([^<]*)/);
      const header = headerMatch ? decodeEntities(headerMatch[1]).trim() : '';
      const contentMatch = cell.match(/content-cell[^"]*mdl-typography--body-1">([\s\S]*?)<\/div>/);
      if (!contentMatch) continue;
      const content = contentMatch[1];
      const links = [...content.matchAll(/<a href="([^"]*)">([\s\S]*?)<\/a>/g)];
      if (!links.length || !isMusicEntry(header, links[0][1])) continue;
      const parts = content.split(/<br\s*\/?>/).map((p) => p.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      const time = parseDateLoose(parts[parts.length - 1]);
      if (!time) continue;
      const title = cleanTitle(links[0][2].replace(/<[^>]+>/g, ''));
      if (!title || /^https?:\/\//.test(title)) continue;
      plays.push({
        title,
        artist: links[1] ? cleanArtist(links[1][2].replace(/<[^>]+>/g, '')) : 'Bilinmeyen sanatçı',
        time: time.getTime(),
      });
    }
    return plays;
  }

  function parseFileContent(name, text) {
    const t = text.trimStart();
    if (/\.json$/i.test(name) || t.startsWith('[')) return parseJson(t);
    return parseHtml(text);
  }

  /** Tekrarları siler, sıralar ve her çalmaya tahmini süre ekler. */
  function preparePlays(plays) {
    const seen = new Set();
    const list = [];
    for (const p of plays) {
      const key = p.time + '|' + p.title;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ ...p });
    }
    list.sort((a, b) => a.time - b.time);
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      const gap = next ? (next.time - list[i].time) / 60000 : Infinity;
      list[i].minutes = gap > 0 && gap <= MAX_MINUTES ? gap : DEFAULT_MINUTES;
    }
    return list;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function monthKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function dayKey(ts) { const d = new Date(ts); return monthKey(ts) + '-' + pad(d.getDate()); }

  function monthLabel(key) {
    const [y, m] = key.split('-');
    return m ? MONTH_NAMES_TR[+m - 1] + ' ' + y : y + ' Yılı';
  }

  /** Tüm çalmaları ay anahtarlarına göre gruplar ("2026-11"). */
  function groupByMonth(plays) {
    const map = new Map();
    for (const p of plays) {
      const k = monthKey(p.time);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    return map;
  }

  function topN(map, n, by = 'minutes') {
    const other = by === 'minutes' ? 'plays' : 'minutes';
    return [...map.values()].sort((a, b) => b[by] - a[by] || b[other] - a[other]).slice(0, n);
  }

  /**
   * Bir çalma kümesi için özet istatistikler.
   * @param plays  dönemin çalmaları (preparePlays çıktısından)
   * @param before dönemden önceki tüm çalmalar (yeni keşfedilen sanatçılar için)
   */
  function computeStats(plays, before = []) {
    const artists = new Map();
    const songs = new Map();
    const byHour = new Array(24).fill(0);
    const byWeekday = new Array(7).fill(0);
    const byDay = new Map();
    let minutes = 0;

    for (const p of plays) {
      minutes += p.minutes;
      const a = artists.get(p.artist) || { name: p.artist, plays: 0, minutes: 0, songs: new Set() };
      a.plays++; a.minutes += p.minutes; a.songs.add(p.title);
      artists.set(p.artist, a);

      const sk = p.title + '\u0000' + p.artist;
      const s = songs.get(sk) || { title: p.title, artist: p.artist, plays: 0, minutes: 0 };
      s.plays++; s.minutes += p.minutes;
      songs.set(sk, s);

      const d = new Date(p.time);
      byHour[d.getHours()] += p.minutes;
      byWeekday[(d.getDay() + 6) % 7] += p.minutes;
      const dk = dayKey(p.time);
      byDay.set(dk, (byDay.get(dk) || 0) + p.minutes);
    }

    const knownArtists = new Set(before.map((p) => p.artist));
    const newArtists = [...artists.keys()].filter((a) => !knownArtists.has(a));

    // En uzun ardışık dinleme serisi (gün)
    const days = [...byDay.keys()].sort();
    let streak = 0, best = 0, prev = null;
    for (const d of days) {
      const t = new Date(d + 'T12:00:00').getTime();
      streak = prev !== null && Math.round((t - prev) / 86400000) === 1 ? streak + 1 : 1;
      best = Math.max(best, streak);
      prev = t;
    }

    let busiestDay = null;
    for (const [d, m] of byDay) if (!busiestDay || m > busiestDay.minutes) busiestDay = { day: d, minutes: m };

    const peakHour = plays.length ? byHour.indexOf(Math.max(...byHour)) : null;

    return {
      plays: plays.length,
      minutes,
      uniqueArtists: artists.size,
      uniqueSongs: songs.size,
      topArtists: topN(artists, 10).map((a) => ({ name: a.name, plays: a.plays, minutes: a.minutes, songs: a.songs.size })),
      topSongs: topN(songs, 10, 'plays'),
      byHour,
      byWeekday,
      byDay,
      activeDays: byDay.size,
      longestStreak: best,
      busiestDay,
      peakHour,
      newArtists: before.length ? newArtists.length : null,
    };
  }

  /** Demo amaçlı rastgele dinleme geçmişi üretir. */
  function generateDemo(months = 6, seed = 42) {
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const catalog = {
      'Duman': ['Bu Akşam', 'Senden Daha Güzel', 'Her Şeyi Yak', 'Elleri Ellerime'],
      'Manga': ['Dursun Zaman', 'Bir Kadın Çizeceksin', 'Cevapsız Sorular'],
      'Sezen Aksu': ['Gidiyorum', 'Firuze', 'Kaybolan Yıllar', 'Sen Ağlama'],
      'Tarkan': ['Kuzu Kuzu', 'Dudu', 'Şımarık'],
      'Mor ve Ötesi': ['Bir Derdim Var', 'Cambaz', 'Araf'],
      'Arctic Monkeys': ['Do I Wanna Know?', '505', 'R U Mine?', 'Arabella'],
      'Radiohead': ['Creep', 'No Surprises', 'Karma Police'],
      'Daft Punk': ['Get Lucky', 'Instant Crush', 'One More Time'],
      'Ezhel': ['Geceler', 'Felaket', 'Olay'],
      'Model': ['Değmesin Ellerimiz', 'Pembe Mezarlık'],
      'Billie Eilish': ['Birds of a Feather', 'Bad Guy', 'Lovely'],
      'Hayko Cepkin': ['Yarası Saklı', 'Fırtınam'],
    };
    const names = Object.keys(catalog);
    const plays = [];
    const now = new Date();
    for (let m = months - 1; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const dim = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      // her ay farklı favoriler
      const fav = names.slice().sort(() => rnd() - 0.5).slice(0, 4);
      for (let d = 1; d <= dim; d++) {
        const day = new Date(start.getFullYear(), start.getMonth(), d);
        if (day > now || rnd() < 0.15) continue;
        const sessions = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < sessions; k++) {
          let t = new Date(day.getFullYear(), day.getMonth(), d, 8 + Math.floor(rnd() * 15), Math.floor(rnd() * 60)).getTime();
          const len = 3 + Math.floor(rnd() * 15);
          for (let i = 0; i < len; i++) {
            const artist = rnd() < 0.65 ? fav[Math.floor(rnd() * fav.length)] : names[Math.floor(rnd() * names.length)];
            const tracks = catalog[artist];
            plays.push({ title: tracks[Math.floor(rnd() * tracks.length)], artist, time: t });
            t += (rnd() < 0.15 ? 0.5 + rnd() : 2.5 + rnd() * 2.5) * 60000;
          }
        }
      }
    }
    return plays.filter((p) => p.time <= now.getTime());
  }

  return {
    DEFAULT_MINUTES, MAX_MINUTES, MONTH_NAMES_TR, WEEKDAYS_TR,
    cleanTitle, cleanArtist, parseDateLoose, parseJson, parseHtml, parseFileContent,
    preparePlays, groupByMonth, computeStats, monthKey, dayKey, monthLabel, generateDemo,
  };
});
