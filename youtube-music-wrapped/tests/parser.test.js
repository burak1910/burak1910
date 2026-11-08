// Çalıştırmak için: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../parser.js');

test('JSON: sadece YouTube Music kayıtlarını alır ve başlıkları temizler', () => {
  const data = [
    { header: 'YouTube Music', title: 'Watched Bu Akşam', titleUrl: 'https://music.youtube.com/watch?v=a',
      subtitles: [{ name: 'Duman - Topic' }], time: '2026-10-01T10:00:00.000Z' },
    { header: 'YouTube Music', title: 'Firuze adlı videoyu izlediniz', titleUrl: 'https://music.youtube.com/watch?v=b',
      subtitles: [{ name: 'Sezen Aksu' }], time: '2026-10-01T10:04:00.000Z' },
    { header: 'YouTube', title: 'Watched Some Vlog', titleUrl: 'https://www.youtube.com/watch?v=c',
      subtitles: [{ name: 'Vlogger' }], time: '2026-10-01T11:00:00.000Z' },
    { header: 'YouTube Music', title: 'Watched https://music.youtube.com/watch?v=d', time: '2026-10-01T12:00:00.000Z' },
  ];
  const plays = S.parseJson(data);
  assert.equal(plays.length, 2);
  assert.deepEqual(plays.map((p) => [p.title, p.artist]), [['Bu Akşam', 'Duman'], ['Firuze', 'Sezen Aksu']]);
});

test('HTML: İngilizce ve Türkçe Takeout formatlarını ayrıştırır', () => {
  const cell = (body, header = 'YouTube Music') =>
    `<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell mdl-cell"><p class="mdl-typography--title">${header}<br></p></div>` +
    `<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">${body}</div></div></div>`;
  const html = '<html><body>' +
    cell('Watched <a href="https://music.youtube.com/watch?v=x">Do I Wanna Know?</a><br><a href="https://www.youtube.com/channel/1">Arctic Monkeys - Topic</a><br>Jan 5, 2024, 10:00:00 PM GMT+03:00<br>') +
    cell('<a href="https://music.youtube.com/watch?v=y">Geceler &amp; Gündüzler</a> izlendi<br><a href="https://www.youtube.com/channel/2">Ezhel</a><br>5 Oca 2024 22:00:00 GMT+03:00<br>') +
    cell('Watched <a href="https://www.youtube.com/watch?v=z">Vlog</a><br>Jan 5, 2024, 9:00:00 PM GMT+03:00', 'YouTube') +
    '</body></html>';
  const plays = S.parseHtml(html);
  assert.equal(plays.length, 2);
  assert.equal(plays[0].title, 'Do I Wanna Know?');
  assert.equal(plays[0].artist, 'Arctic Monkeys');
  assert.equal(plays[1].title, 'Geceler & Gündüzler');
  assert.equal(new Date(plays[0].time).toISOString(), '2024-01-05T19:00:00.000Z');
  assert.equal(new Date(plays[1].time).toISOString(), '2024-01-05T19:00:00.000Z');
});

test('Süre tahmini: kısa aralık gerçek süre, uzun aralık varsayılan', () => {
  const base = Date.UTC(2026, 9, 1, 10);
  const plays = S.preparePlays([
    { title: 'A', artist: 'X', time: base },
    { title: 'B', artist: 'X', time: base + 4 * 60000 },   // A: 4 dk
    { title: 'C', artist: 'Y', time: base + 4.5 * 60000 }, // B: 0.5 dk (atlandı)
    { title: 'C', artist: 'Y', time: base + 4.5 * 60000 }, // tekrar - silinir
    { title: 'D', artist: 'Y', time: base + 60 * 60000 },  // C: varsayılan
  ]);
  assert.equal(plays.length, 4);
  assert.deepEqual(plays.map((p) => p.minutes), [4, 0.5, S.DEFAULT_MINUTES, S.DEFAULT_MINUTES]);
});

test('İstatistik: en çok dinlenenler, seri ve yeni sanatçılar', () => {
  const t = (d, h) => new Date(2026, 9, d, h).getTime();
  const plays = S.preparePlays([
    { title: 'A', artist: 'X', time: t(1, 10) },
    { title: 'A', artist: 'X', time: t(2, 10) },
    { title: 'B', artist: 'Y', time: t(3, 10) },
    { title: 'A', artist: 'X', time: t(5, 21) },
  ]);
  const before = [{ title: 'Z', artist: 'Y', time: new Date(2026, 8, 1).getTime() }];
  const st = S.computeStats(plays, before);
  assert.equal(st.plays, 4);
  assert.equal(st.topArtists[0].name, 'X');
  assert.equal(st.topSongs[0].title, 'A');
  assert.equal(st.topSongs[0].plays, 3);
  assert.equal(st.longestStreak, 3);
  assert.equal(st.activeDays, 4);
  assert.equal(st.newArtists, 1);
  assert.equal(st.peakHour, 10);
});

test('Demo verisi üretilir ve aylara bölünür', () => {
  const plays = S.preparePlays(S.generateDemo(3));
  assert.ok(plays.length > 100);
  const months = S.groupByMonth(plays);
  assert.ok(months.size >= 2 && months.size <= 3);
  assert.equal(S.monthLabel('2026-11'), 'Kasım 2026');
});
