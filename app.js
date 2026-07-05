(() => {
  const API = 'https://api.spotify.com/v1';
  const TOKEN = 'record_dive_token';
  const VERIFIER = 'record_dive_code_verifier';
  const STATE = 'record_dive_auth_state';

  const ranges = {
    short_term: '4週間',
    medium_term: '6ヶ月',
    long_term: '全期間'
  };

  const demo = [
    ['Plastic Love', 'Mariya Takeuchi', 'VARIETY', 88, 22, 96, '1980s', ['city pop', 'night drive'], 'https://i.scdn.co/image/ab67616d0000b2730633e5b8b8a3f64f6528ad6d', 'https://open.spotify.com/search/Plastic%20Love%20Mariya%20Takeuchi'],
    ['Sparkle', 'Tatsuro Yamashita', 'FOR YOU', 84, 30, 92, '1980s', ['aor', 'summer'], 'https://i.scdn.co/image/ab67616d0000b2734ef7c8edc11f59f9995d0f45', 'https://open.spotify.com/search/Sparkle%20Tatsuro%20Yamashita'],
    ['Stay With Me', 'Miki Matsubara', 'Pocket Park', 91, 18, 89, '1970s', ['city pop', 'midnight'], 'https://i.scdn.co/image/ab67616d0000b273d5f8d5aa4a537c2f4c02acda', 'https://open.spotify.com/search/Stay%20With%20Me%20Miki%20Matsubara'],
    ['Sweet Soul Revue', 'Pizzicato Five', 'Bossa Nova 2001', 74, 44, 85, '1990s', ['shibuya-kei', 'groove'], 'https://i.scdn.co/image/ab67616d0000b273f0a627db1f953875ed2e9dc2', 'https://open.spotify.com/search/Sweet%20Soul%20Revue%20Pizzicato%20Five'],
    ['ばらの花', 'くるり', 'TEAM ROCK', 78, 38, 82, '2000s', ['japanese indie', 'rainy'], 'https://i.scdn.co/image/ab67616d0000b273352b935793bd162f02bd99c9', 'https://open.spotify.com/search/%E3%81%B0%E3%82%89%E3%81%AE%E8%8A%B1%20%E3%81%8F%E3%82%8B%E3%82%8A'],
    ['Imaginary Beats', 'Record Dive', 'Sample Crate', 69, 57, 81, '2000s', ['lofi', 'jazz hop'], 'https://i.scdn.co/image/ab67616d0000b2732c4c0a955156f3b9cce9bd2d', 'https://open.spotify.com/search/Nujabes']
  ].map((r, i) => ({
    id: `demo-${i}`,
    title: r[0],
    artist: r[1],
    album: r[2],
    rank: i + 1,
    popularity: r[3],
    rarity: r[4],
    diveScore: r[5],
    yearHint: r[6],
    genres: r[7],
    cover: r[8],
    spotifyUrl: r[9],
    previewUrl: null
  }));

  const state = {
    token: null,
    range: 'medium_term',
    query: '',
    records: [],
    visible: [],
    selected: null,
    endpoints: 0,
    audio: null,
    t: 0,
    cache: {}
  };

  const $ = (query, root = document) => root.querySelector(query);
  const $$ = (query, root = document) => Array.from(root.querySelectorAll(query));

  const el = {
    login: $('#login-btn'),
    logout: $('#logout-btn'),
    demo: $('#demo-btn'),
    auth: $('#auth-btn'),
    scroll: $('#scroll-btn'),
    status: $('#status-panel'),
    statusText: $('#status-text'),
    shelf: $('#record-shelf'),
    tpl: $('#record-card-template'),
    search: $('#record-search'),
    count: $('#crate-count'),
    insight: $('#insight-copy'),
    heroCover: $('#hero-cover'),
    vinylCover: $('#vinyl-cover'),
    sleeve: $('#floating-sleeve'),
    heroScore: $('#hero-score'),
    vinyl: $('#vinyl'),
    title: $('#now-title'),
    artist: $('#now-artist'),
    tags: $('#tag-row'),
    pop: $('#score-popularity'),
    rarity: $('#score-rarity'),
    dive: $('#score-dive'),
    preview: $('#preview-btn'),
    open: $('#open-spotify'),
    endpoints: $('#metric-endpoints'),
    recs: $('#metric-records'),
    mood: $('#metric-mood'),
    player: $('#metric-player'),
    viz: $('#audio-canvas')
  };

  const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const unique = values => [...new Set(values.filter(Boolean))];

  function cfg() {
    const c = window.RECORD_DIVE_CONFIG || {};
    return {
      clientId: c.CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID_HERE',
      auth: c.AUTH_URL || 'https://accounts.spotify.com/authorize',
      token: c.TOKEN_ENDPOINT || 'https://accounts.spotify.com/api/token',
      scopes: c.SCOPES || 'user-top-read user-read-private user-read-email',
      redirect: c.REDIRECT_URI || `${location.origin}${location.pathname}`
    };
  }

  function status(message, tone = 'neutral') {
    if (!el.statusText || !el.status) return;
    el.statusText.textContent = message;
    el.status.classList.toggle('is-ok', tone === 'ok');
    el.status.classList.toggle('is-error', tone === 'error');
  }

  function metrics() {
    if (el.endpoints) el.endpoints.textContent = state.endpoints;
    if (el.recs) el.recs.textContent = state.visible.length;
    if (el.player) el.player.textContent = state.audio && !state.audio.paused ? 'PLAY' : 'IDLE';
    if (el.mood) el.mood.textContent = mood(state.visible);
  }

  function mood(records) {
    if (!records.length) return '--';
    const popularity = avg(records.map(r => r.popularity));
    const rarity = avg(records.map(r => r.rarity));
    const genreText = records.flatMap(r => r.genres).join(' ');
    if (popularity > 78 && rarity < 35) return 'ANTHEM';
    if (rarity > 58) return 'DEEP';
    if (genreText.includes('city')) return 'CITY';
    if (genreText.includes('rock')) return 'ROCK';
    return 'MIXED';
  }

  async function randomString(length = 96) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return [...bytes].map(byte => chars[byte % chars.length]).join('');
  }

  async function sha256(value) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  }

  function base64Url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async function login() {
    const c = cfg();
    if (!c.clientId || c.clientId === 'YOUR_SPOTIFY_CLIENT_ID_HERE') {
      status('CLIENT_IDが未設定です。config.jsを確認してください。', 'error');
      return;
    }

    const verifier = await randomString();
    const challenge = base64Url(await sha256(verifier));
    const authState = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    sessionStorage.setItem(VERIFIER, verifier);
    sessionStorage.setItem(STATE, authState);

    const params = new URLSearchParams({
      client_id: c.clientId,
      response_type: 'code',
      redirect_uri: c.redirect,
      scope: c.scopes,
      state: authState,
      code_challenge_method: 'S256',
      code_challenge: challenge
    });

    location.href = `${c.auth}?${params}`;
  }

  async function callback() {
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const incomingState = url.searchParams.get('state');

    if (error) {
      status(`Spotify認証エラー: ${error}`, 'error');
      cleanAuthUrl();
      return false;
    }

    if (!code) return false;

    const verifier = sessionStorage.getItem(VERIFIER);
    const expectedState = sessionStorage.getItem(STATE);
    if (!verifier || expectedState !== incomingState) {
      status('Spotify認証の検証に失敗しました。もう一度ログインしてください。', 'error');
      cleanAuthUrl();
      return false;
    }

    const c = cfg();
    try {
      const res = await fetch(c.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: c.redirect,
          code_verifier: verifier
        })
      });

      if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);

      const token = await res.json();
      token.expires_at = Date.now() + token.expires_in * 1000;
      localStorage.setItem(TOKEN, JSON.stringify(token));
      state.token = token;
      cleanAuthUrl();
      status('Spotify接続完了。あなたのレコード棚を生成します。', 'ok');
      return true;
    } catch (error) {
      console.error(error);
      status('トークン取得に失敗しました。Spotify DashboardのRedirect URIを確認してください。', 'error');
      cleanAuthUrl();
      return false;
    }
  }

  function cleanAuthUrl() {
    history.replaceState({}, document.title, `${location.origin}${location.pathname}`);
    sessionStorage.removeItem(VERIFIER);
    sessionStorage.removeItem(STATE);
  }

  function restoreToken() {
    try {
      const token = JSON.parse(localStorage.getItem(TOKEN) || 'null');
      if (!token?.access_token || Date.now() > token.expires_at - 30000) {
        localStorage.removeItem(TOKEN);
        return null;
      }
      state.token = token;
      return token;
    } catch {
      localStorage.removeItem(TOKEN);
      return null;
    }
  }

  function authButtons() {
    const loggedIn = Boolean(state.token?.access_token);
    el.login?.classList.toggle('hidden', loggedIn);
    el.logout?.classList.toggle('hidden', !loggedIn);
    if (el.auth) el.auth.textContent = loggedIn ? '自分のSpotifyを再解析' : '自分のSpotifyを解析する';
  }

  async function api(path) {
    if (!state.token) throw new Error('not authed');
    state.endpoints += 1;
    metrics();

    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${state.token.access_token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN);
      state.token = null;
      authButtons();
      throw new Error('token expired');
    }

    if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
    return res.json();
  }

  async function loadSpotify(force = false) {
    if (!state.token) {
      await login();
      return;
    }

    if (state.cache?.[state.range] && !force) {
      apply(state.cache[state.range]);
      return;
    }

    status(`${ranges[state.range]}のSpotifyデータを取得中...`);

    try {
      const [me, tracks, artists] = await Promise.all([
        api('/me'),
        api(`/me/top/tracks?limit=36&time_range=${state.range}`),
        api(`/me/top/artists?limit=50&time_range=${state.range}`)
      ]);

      const genreMap = new Map();
      (artists.items || []).forEach(artist => {
        genreMap.set(artist.id, artist.genres || []);
        genreMap.set((artist.name || '').toLowerCase(), artist.genres || []);
      });

      const records = (tracks.items || []).map((track, index) => toRecord(track, index, genreMap));
      state.cache = { ...(state.cache || {}), [state.range]: records };
      apply(records);
      status(`${me.display_name || 'Spotify user'} のレコード棚を生成しました。`, 'ok');
    } catch (error) {
      console.error(error);
      status('Spotify API取得に失敗しました。デモ表示に切り替えます。', 'error');
      loadDemo();
    }
  }

  function toRecord(track, index, genreMap) {
    const artists = track.artists || [];
    const genres = unique(
      artists.flatMap(artist => genreMap.get(artist.id) || genreMap.get((artist.name || '').toLowerCase()) || [])
    ).slice(0, 4);

    const popularity = Number(track.popularity || 0);
    const rarity = clamp(100 - popularity + index * 1.25, 4, 99);
    const diveScore = Math.round(
      clamp(popularity * 0.48 + rarity * 0.28 + clamp(42 - index, 0, 42) + (genres.length ? 8 : 0), 0, 99)
    );

    const cover = track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || '';

    return {
      id: track.id || `track-${index}`,
      title: track.name || 'Unknown track',
      artist: artists.map(artist => artist.name).join(', ') || 'Unknown artist',
      album: track.album?.name || 'Unknown album',
      rank: index + 1,
      popularity,
      rarity: Math.round(rarity),
      diveScore,
      yearHint: era(track.album?.release_date),
      genres: genres.length ? genres : ['personal pick'],
      cover,
      spotifyUrl: track.external_urls?.spotify || '#',
      previewUrl: track.preview_url || null
    };
  }

  function era(date = '') {
    const year = Number(String(date).slice(0, 4));
    return year ? `${Math.floor(year / 10) * 10}s` : 'unknown era';
  }

  function apply(records) {
    state.records = records.length ? records : demo;
    filter();
    if (state.visible[0]) select(state.visible[0], { autoplay: false });
    metrics();
  }

  function loadDemo() {
    apply(demo);
  }

  function filter() {
    const query = state.query.trim().toLowerCase();
    state.visible = state.records.filter(record => {
      const target = [record.title, record.artist, record.album, record.yearHint, ...record.genres].join(' ').toLowerCase();
      return !query || target.includes(query);
    });

    render();
    if (el.count) el.count.textContent = `${state.visible.length}枚`;
    if (el.insight) el.insight.textContent = insight(state.visible);
    metrics();
  }

  function insight(records) {
    if (!records.length) return '該当するレコードがありません。検索条件を変えてください。';
    const counts = new Map();
    records.forEach(record => record.genres.forEach(genre => counts.set(genre, (counts.get(genre) || 0) + 1)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre]) => genre).join(' / ');
    return `${ranges[state.range] || 'デモ'}の棚は ${top || 'mixed'} 寄り。平均DIVE SCOREは${Math.round(avg(records.map(record => record.diveScore)))}。今日は${records[0].title}から聴くのが良さそうです。`;
  }

  function render() {
    if (!el.shelf || !el.tpl) return;
    el.shelf.innerHTML = '';

    state.visible.forEach(record => {
      const node = el.tpl.content.firstElementChild.cloneNode(true);
      const image = $('.record-cover', node);
      node.dataset.id = record.id;
      image.src = record.cover;
      image.alt = `${record.album} album artwork`;
      $('.record-rank', node).textContent = `#${record.rank}`;
      $('.record-caption strong', node).textContent = record.title;
      $('.record-caption small', node).textContent = record.artist;
      node.classList.toggle('is-selected', state.selected?.id === record.id);
      node.addEventListener('pointermove', event => tilt(event, node));
      node.addEventListener('pointerleave', () => reset(node));
      node.addEventListener('click', () => select(record, { autoplay: true }));
      el.shelf.appendChild(node);
    });
  }

  function tilt(event, node) {
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty('--tilt-y', `${x * 11}deg`);
    node.style.setProperty('--tilt-x', `${y * -11}deg`);
    node.style.setProperty('--mx', `${x * 120}px`);
    node.style.setProperty('--my', `${y * 120}px`);
  }

  function reset(node) {
    node.style.setProperty('--tilt-y', '0deg');
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--mx', '0px');
    node.style.setProperty('--my', '0px');
  }

  function select(record, options = {}) {
    state.selected = record;
    stopAudio({ resetButton: false });

    if (el.heroCover) el.heroCover.src = record.cover;
    if (el.vinylCover) el.vinylCover.src = record.cover;
    if (el.heroScore) el.heroScore.textContent = String(record.diveScore).padStart(2, '0');
    if (el.title) el.title.textContent = record.title;
    if (el.artist) el.artist.textContent = `${record.artist} — ${record.album}`;
    if (el.pop) el.pop.textContent = record.popularity;
    if (el.rarity) el.rarity.textContent = record.rarity;
    if (el.dive) el.dive.textContent = record.diveScore;
    if (el.open) el.open.href = record.spotifyUrl || '#';

    if (el.preview) {
      el.preview.disabled = !record.previewUrl;
      el.preview.classList.remove('is-playing');
      el.preview.textContent = record.previewUrl ? '試聴する' : 'プレビューなし';
    }

    if (el.tags) {
      el.tags.innerHTML = '';
      [record.yearHint, ...record.genres].slice(0, 5).forEach(tag => {
        const item = document.createElement('span');
        item.textContent = tag;
        el.tags.appendChild(item);
      });
    }

    $$('.record-card', el.shelf).forEach(card => {
      card.classList.toggle('is-selected', card.dataset.id === record.id);
    });

    if (el.sleeve) {
      el.sleeve.style.boxShadow = `0 30px 90px rgba(0,0,0,.42),0 0 90px rgba(29,185,84,.24)`;
    }

    metrics();

    if (options.autoplay && record.previewUrl) {
      playSelectedPreview({ fromUserSelection: true });
    }
  }

  async function playSelectedPreview({ fromUserSelection = false } = {}) {
    const record = state.selected;
    if (!record?.previewUrl) {
      stopAudio();
      return false;
    }

    if (state.audio && state.audio.src === record.previewUrl && !state.audio.paused) {
      stopAudio();
      return false;
    }

    stopAudio({ resetButton: false });

    const audio = new Audio(record.previewUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.82;
    state.audio = audio;

    try {
      await audio.play();
      el.vinyl?.classList.add('is-playing');
      if (el.preview) {
        el.preview.textContent = '停止する';
        el.preview.classList.add('is-playing');
      }
      metrics();
      audio.addEventListener('ended', () => stopAudio(), { once: true });
      return true;
    } catch (error) {
      console.warn('Preview play failed:', error);
      stopAudio();
      if (fromUserSelection) {
        status('このブラウザでは自動試聴が止められました。試聴するボタンを押してください。', 'error');
      }
      return false;
    }
  }

  function stopAudio({ resetButton = true } = {}) {
    if (state.audio) {
      state.audio.pause();
      state.audio.currentTime = 0;
      state.audio = null;
    }

    el.vinyl?.classList.remove('is-playing');
    el.preview?.classList.remove('is-playing');

    if (resetButton && el.preview) {
      el.preview.textContent = state.selected?.previewUrl ? '試聴する' : 'プレビューなし';
      el.preview.disabled = !state.selected?.previewUrl;
    }

    metrics();
  }

  function visualizer() {
    if (!el.viz) return;
    const canvas = el.viz;
    const ctx = canvas.getContext('2d');
    const isMobile = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
    if (isMobile) return;

    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    };
    addEventListener('resize', resize);
    resize();

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.t += 0.018;
      const record = state.selected || demo[0];
      const bars = 42;
      const cy = canvas.height * 0.72;
      for (let i = 0; i < bars; i += 1) {
        const x = canvas.width / (bars - 1) * i;
        const h = (Math.sin(state.t * 2 + i * 0.42) * 0.5 + 0.5) * (record.diveScore / 100) * canvas.height * 0.18 + 16;
        const gradient = ctx.createLinearGradient(x, cy - h, x, cy + h);
        gradient.addColorStop(0, 'rgba(29,185,84,0)');
        gradient.addColorStop(0.48, 'rgba(30,215,96,.26)');
        gradient.addColorStop(1, 'rgba(29,185,84,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 2, cy - h, 4, h * 2);
      }
      requestAnimationFrame(draw);
    }

    draw();
  }

  function bind() {
    if (el.login) el.login.onclick = login;
    if (el.auth) el.auth.onclick = () => state.token ? loadSpotify(true) : login();
    if (el.logout) {
      el.logout.onclick = () => {
        stopAudio();
        localStorage.removeItem(TOKEN);
        state.token = null;
        authButtons();
        loadDemo();
        status('ログアウトしました。デモ表示に戻します。');
      };
    }
    if (el.demo) el.demo.onclick = () => { stopAudio(); loadDemo(); };
    if (el.scroll) el.scroll.onclick = () => $('#feature-clarity')?.scrollIntoView({ behavior: 'smooth' });
    if (el.preview) el.preview.onclick = () => playSelectedPreview();
    if (el.search) {
      el.search.oninput = event => {
        state.query = event.target.value;
        filter();
        if (state.visible[0]) select(state.visible[0], { autoplay: false });
      };
    }

    $$('.filter-chip').forEach(button => {
      button.onclick = () => {
        stopAudio();
        $$('.filter-chip').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        state.range = button.dataset.range || 'medium_term';
        state.token ? loadSpotify() : loadDemo();
      };
    });

    document.addEventListener('pointermove', event => {
      if (!el.sleeve) return;
      const x = event.clientX / Math.max(innerWidth, 1) - 0.5;
      const y = event.clientY / Math.max(innerHeight, 1) - 0.5;
      el.sleeve.style.transform = `rotateX(${10 - y * 8}deg) rotateY(${-16 + x * 14}deg) rotateZ(${3 + x * 2}deg)`;
    }, { passive: true });
  }

  async function init() {
    bind();
    visualizer();
    await callback();
    restoreToken();
    authButtons();
    state.token ? await loadSpotify() : loadDemo();
  }

  init();
})();
