/* YouTube Music Wrapped - arayüz */
(function () {
  'use strict';
  const S = window.YTMStats;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'ytm-wrapped-plays-v1';

  let plays = [];      // preparePlays çıktısı (zamana göre sıralı)
  let periods = [];    // ["2026", "2026-11", "2026-10", ...] (yıl ve aylar, yeniden eskiye)
  let monthKeys = [];  // sadece aylar, eskiden yeniye
  let current = null;

  // ---------- yardımcılar ----------
  const nf = new Intl.NumberFormat('tr-TR');
  const fmt = (n) => nf.format(Math.round(n));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hm = (min) => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${fmt(h)} sa ${m} dk` : `${m} dk`;
  };
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toLocaleUpperCase('tr');

  // ---------- veri yükleme ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plays.map((p) => [p.time, p.title, p.artist])));
    } catch (_) { /* depolama dolu ya da kapalı: sorun değil */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return false;
      setPlays(arr.map(([time, title, artist]) => ({ time, title, artist })), false);
      return true;
    } catch (_) { return false; }
  }

  function setPlays(raw, persist = true) {
    plays = S.preparePlays(raw);
    const months = S.groupByMonth(plays);
    monthKeys = [...months.keys()].sort();
    const years = [...new Set(monthKeys.map((k) => k.slice(0, 4)))].sort().reverse();
    periods = [];
    for (const y of years) {
      periods.push(y);
      monthKeys.filter((k) => k.startsWith(y)).reverse().forEach((k) => periods.push(k));
    }
    if (persist) save();
    buildSelect();
    showDashboard();
    render(monthKeys[monthKeys.length - 1]);
  }

  async function handleFiles(files) {
    const err = $('uploadError');
    err.classList.add('hidden');
    try {
      let all = [];
      for (const f of files) {
        if (/\.zip$/i.test(f.name)) throw new Error('Lütfen önce zip dosyasını açıp içindeki watch-history dosyasını seç.');
        const text = await f.text();
        all = all.concat(S.parseFileContent(f.name, text));
      }
      if (!all.length) {
        throw new Error('Dosyada YouTube Music kaydı bulunamadı. Takeout\'ta "YouTube ve YouTube Music → geçmiş" seçtiğinden emin ol.');
      }
      setPlays(all);
    } catch (e) {
      err.textContent = e.message || String(e);
      err.classList.remove('hidden');
    }
  }

  // ---------- görünüm ----------
  function showDashboard() {
    $('uploadView').classList.add('hidden');
    $('dashView').classList.remove('hidden');
    $('resetBtn').classList.remove('hidden');
  }

  function showUpload() {
    $('dashView').classList.add('hidden');
    $('resetBtn').classList.add('hidden');
    $('uploadView').classList.remove('hidden');
  }

  function buildSelect() {
    const sel = $('periodSelect');
    sel.innerHTML = periods.map((k) =>
      `<option value="${k}">${k.length === 4 ? '★ ' + k + ' yılının tamamı' : S.monthLabel(k)}</option>`).join('');
  }

  function periodPlays(key) {
    return plays.filter((p) => S.monthKey(p.time).startsWith(key));
  }

  function render(key) {
    current = key;
    const isYear = key.length === 4;
    const list = periodPlays(key);
    const start = list.length ? list[0].time : 0;
    const before = plays.filter((p) => p.time < start);
    const st = S.computeStats(list, before);
    const label = S.monthLabel(key);

    $('periodSelect').value = key;
    const idx = isYear ? -1 : monthKeys.indexOf(key);
    $('prevBtn').disabled = isYear ? !periods.includes(String(+key - 1)) : idx <= 0;
    $('nextBtn').disabled = isYear ? !periods.includes(String(+key + 1)) : idx >= monthKeys.length - 1;

    // Hero
    $('heroPeriod').textContent = label + (isYear ? ' özeti' : '');
    $('heroMinutes').textContent = fmt(st.minutes);
    $('heroSub').textContent = `≈ ${hm(st.minutes)} · günde ortalama ${fmt(st.minutes / Math.max(st.activeDays, 1))} dk (dinlediğin günlerde)`;
    const top = st.topArtists[0];
    $('heroTop').innerHTML = top
      ? `<div class="avatar">${esc(initials(top.name))}</div>
         <div class="who"><span class="muted small">Bu dönemin bir numarası</span><b>${esc(top.name)}</b>
         <span class="muted">${fmt(top.minutes)} dk · ${fmt(top.plays)} çalma · dinlemenin %${Math.round(top.minutes / st.minutes * 100)}'i</span></div>`
      : '<p class="empty">Bu dönemde kayıt yok.</p>';

    // Kartlar
    $('stPlays').textContent = fmt(st.plays);
    $('stArtists').textContent = fmt(st.uniqueArtists);
    $('stSongs').textContent = fmt(st.uniqueSongs);
    $('stDays').textContent = fmt(st.activeDays);
    $('stStreak').textContent = st.longestStreak + ' gün';
    $('stNew').textContent = st.newArtists === null ? '—' : fmt(st.newArtists) + ' sanatçı';

    // Listeler
    const maxA = top ? top.minutes : 1;
    $('topArtists').innerHTML = st.topArtists.map((a) =>
      `<li><span class="name">${esc(a.name)}<small>${a.songs} farklı şarkı</small></span>
       <span class="meta">${fmt(a.minutes)} dk</span>
       <span class="bar" style="width:${(a.minutes / maxA) * 100}%"></span></li>`).join('') || '<p class="empty">—</p>';
    const maxS = st.topSongs[0] ? st.topSongs[0].plays : 1;
    $('topSongs').innerHTML = st.topSongs.map((s) =>
      `<li><span class="name">${esc(s.title)}<small>${esc(s.artist)}</small></span>
       <span class="meta">${s.plays}×</span>
       <span class="bar" style="width:${(s.plays / maxS) * 100}%"></span></li>`).join('') || '<p class="empty">—</p>';

    // Saat / gün grafikleri
    renderBars($('hourChart'), st.byHour, (i) => (i % 3 === 0 ? String(i) : ''));
    renderBars($('weekChart'), st.byWeekday, (i) => S.WEEKDAYS_TR[i]);
    $('hourNote').textContent = st.peakHour === null ? '' :
      `En çok ${String(st.peakHour).padStart(2, '0')}:00–${String((st.peakHour + 1) % 24).padStart(2, '0')}:00 arası dinliyorsun.`;
    const wd = st.byWeekday.indexOf(Math.max(...st.byWeekday));
    const WD_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    $('weekNote').textContent = st.plays ? `En çok dinlediğin gün: ${WD_FULL[wd]}.` : '';

    // Takvim (sadece ay görünümünde)
    $('calendarCard').classList.toggle('hidden', isYear);
    if (!isYear) renderCalendar(key, st);

    renderTrend(isYear ? key : null);
    $('footTotal').textContent = fmt(plays.length);
    drawShareCard(label, st);
  }

  function renderBars(el, values, labelFn) {
    const max = Math.max(...values, 1);
    const peak = values.indexOf(Math.max(...values));
    el.innerHTML = values.map((v, i) =>
      `<div class="col${i === peak && v > 0 ? ' peak' : ''}" title="${fmt(v)} dk">
         <div class="fill" style="height:${(v / max) * 100}%"></div><span class="lbl">${labelFn(i)}</span></div>`).join('');
  }

  function renderCalendar(key, st) {
    const [y, m] = key.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const dim = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const max = Math.max(...st.byDay.values(), 1);
    let html = S.WEEKDAYS_TR.map((d) => `<span class="wd">${d}</span>`).join('');
    html += '<span></span>'.repeat(offset);
    for (let d = 1; d <= dim; d++) {
      const dk = `${key}-${String(d).padStart(2, '0')}`;
      const v = st.byDay.get(dk) || 0;
      const a = v ? 0.2 + 0.8 * (v / max) : 0;
      const style = v ? ` style="background:rgba(255,45,85,${a.toFixed(2)})"` : '';
      html += `<span class="day${v ? ' on' : ''}"${style} title="${d} ${S.MONTH_NAMES_TR[m - 1]}: ${fmt(v)} dk">${d}</span>`;
    }
    $('calendar').innerHTML = html;
    $('calNote').textContent = st.busiestDay
      ? `En yoğun gün: ${+st.busiestDay.day.slice(8)} ${S.MONTH_NAMES_TR[m - 1]} (${hm(st.busiestDay.minutes)}).`
      : '';
  }

  function renderTrend(year) {
    const months = S.groupByMonth(plays);
    const keys = year ? monthKeys.filter((k) => k.startsWith(year)) : monthKeys;
    const vals = keys.map((k) => months.get(k).reduce((s, p) => s + p.minutes, 0));
    const max = Math.max(...vals, 1);
    const el = $('trend');
    el.innerHTML = keys.map((k, i) => {
      const [yy, mm] = k.split('-');
      return `<button type="button" data-key="${k}" class="${k === current ? 'active' : ''}" title="${S.monthLabel(k)}: ${fmt(vals[i])} dk">
        <span class="val">${vals[i] >= 1000 ? (vals[i] / 1000).toFixed(1).replace('.', ',') + 'b' : fmt(vals[i])}</span>
        <span class="fill" style="height:${(vals[i] / max) * 80}%"></span>
        <span class="lbl">${S.MONTH_NAMES_TR[+mm - 1].slice(0, 3)} ${yy.slice(2)}</span></button>`;
    }).join('');
    const active = el.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ---------- paylaşım kartı ----------
  function drawShareCard(label, st) {
    const c = $('shareCanvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const font = (w, s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

    ctx.fillStyle = '#0b0b0f';
    ctx.fillRect(0, 0, W, H);
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100);
    g1.addColorStop(0, 'rgba(255,45,85,.75)'); g1.addColorStop(1, 'rgba(255,45,85,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W, H, 0, W, H, 1200);
    g2.addColorStop(0, 'rgba(139,92,246,.75)'); g2.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

    const fit = (text, max) => {
      let t = text;
      while (ctx.measureText(t).width > max && t.length > 1) t = t.slice(0, -2);
      return t === text ? t : t.trimEnd() + '…';
    };

    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(700, 44);
    ctx.fillText('▶  Music Wrapped', 90, 150);
    ctx.font = font(600, 56);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(label, 90, 300);

    ctx.fillStyle = '#fff';
    ctx.font = font(800, 220);
    ctx.fillText(fmt(st.minutes), 80, 520);
    ctx.font = font(600, 60);
    ctx.fillText('dakika müzik dinledin', 90, 610);

    ctx.font = font(600, 44);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText('En çok dinlediğin sanatçılar', 90, 790);
    st.topArtists.slice(0, 5).forEach((a, i) => {
      const y = 880 + i * 95;
      ctx.fillStyle = i === 0 ? '#ff8a3d' : 'rgba(255,255,255,.6)';
      ctx.font = font(800, 60);
      ctx.fillText(String(i + 1), 90, y);
      ctx.fillStyle = '#fff';
      ctx.font = font(700, 60);
      ctx.fillText(fit(a.name, 800), 170, y);
    });

    ctx.font = font(600, 44);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText('Bir numaralı şarkın', 90, 1470);
    const song = st.topSongs[0];
    ctx.fillStyle = '#fff';
    ctx.font = font(700, 64);
    ctx.fillText(fit(song ? song.title : '—', 900), 90, 1560);
    ctx.font = font(500, 46);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(fit(song ? `${song.artist} · ${song.plays} kez` : '', 900), 90, 1630);

    ctx.font = font(600, 40);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${fmt(st.plays)} çalma   ·   ${fmt(st.uniqueArtists)} sanatçı   ·   ${fmt(st.uniqueSongs)} şarkı`, 90, 1800);
  }

  function downloadCard() {
    const a = document.createElement('a');
    a.download = `music-wrapped-${current}.png`;
    a.href = $('shareCanvas').toDataURL('image/png');
    a.click();
  }

  // ---------- olaylar ----------
  const drop = $('dropZone');
  $('fileInput').addEventListener('change', (e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });

  $('demoBtn').addEventListener('click', () => setPlays(S.generateDemo(8), false));
  $('resetBtn').addEventListener('click', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* yoksay */ }
    showUpload();
  });
  $('periodSelect').addEventListener('change', (e) => render(e.target.value));
  $('trend').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (b) render(b.dataset.key);
  });
  const step = (dir) => {
    if (current.length === 4) render(String(+current + dir));
    else render(monthKeys[monthKeys.indexOf(current) + dir]);
  };
  $('prevBtn').addEventListener('click', () => step(-1));
  $('nextBtn').addEventListener('click', () => step(1));
  $('downloadBtn').addEventListener('click', downloadCard);

  restore();
})();
