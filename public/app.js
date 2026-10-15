/* Mandi'nin Oyun Bahçesi
 * Hedef cihaz: Samsung SM-T110 (Android 4.2, Chrome <= 71, 1 GB RAM).
 * Bu yüzden: yalnızca ES5 sözdizimi, kütüphane yok, küçük DOM, transform/opacity animasyonları.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var QUESTIONS_PER_LEVEL = 8;
  var STORE_KEY = 'mandi.v1';
  var APP_VERSION = '1.7.0';
  var BUILD = '__BUILD__'; // yayında commit kısaltmasıyla değiştirilir
  var SIZE_KB = '__SIZE__'; // yayında internetsiz paketin toplam boyutu (KB) yazılır

  /* ------------------------------------------------------------------ */
  /* Yardımcılar                                                         */
  /* ------------------------------------------------------------------ */
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svgUse(id, cls, color) {
    return '<svg class="' + (cls || '') + '"' + (color ? ' style="color:' + color + '"' : '') +
      '><use xlink:href="#' + id + '"/></svg>';
  }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  var timers = [];
  function clearTimers() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers = []; }
  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // yeniden akış: animasyonu baştan başlat
    node.classList.add(cls);
  }

  /* ------------------------------------------------------------------ */
  /* Kayıt                                                               */
  /* ------------------------------------------------------------------ */
  // stars: toplama (eski kayıtlarla uyumlu), games: diğer oyunlar
  var save = { stars: {}, games: {}, sound: true };
  try {
    var raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        save.stars = parsed.stars || {};
        save.games = parsed.games || {};
        save.sound = parsed.sound !== false;
      }
    }
  } catch (e) { /* depolama yoksa da oyun çalışır */ }
  function persist() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (e) { }
  }

  /* ------------------------------------------------------------------ */
  /* Ses (Web Audio ile sentez: dosya yok, bellek dostu)                 */
  /* ------------------------------------------------------------------ */
  var Snd = {
    ctx: null,
    unlock: function () {
      if (Snd.ctx) { if (Snd.ctx.state === 'suspended' && Snd.ctx.resume) Snd.ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { Snd.ctx = new AC(); } catch (e) { Snd.ctx = null; }
    },
    tone: function (freq, at, dur, type, vol) {
      var c = Snd.ctx;
      if (!c || !save.sound) return;
      var t0 = c.currentTime + (at || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    tap: function () { Snd.tone(660, 0, 0.08, 'triangle', 0.15); },
    right: function () { Snd.tone(784, 0, 0.16, 'triangle', 0.3); Snd.tone(1175, 0.09, 0.28, 'triangle', 0.28); },
    wrong: function () { Snd.tone(220, 0, 0.18, 'sine', 0.3); Snd.tone(185, 0.12, 0.25, 'sine', 0.25); },
    count: function (n) { Snd.tone(440 + n * 40, 0, 0.1, 'triangle', 0.18); },
    hop: function () { Snd.tone(500, 0, 0.12, 'sine', 0.18); },
    win: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) Snd.tone(notes[i], i * 0.12, 0.3, 'triangle', 0.28);
      Snd.tone(1319, 0.5, 0.5, 'triangle', 0.25);
    }
  };
  // Eski Chrome sürümlerinde ses ancak bir dokunuştan sonra açılabilir
  document.addEventListener('touchstart', Snd.unlock, true);
  document.addEventListener('touchend', Snd.unlock, true);
  document.addEventListener('click', Snd.unlock, true);

  /* ------------------------------------------------------------------ */
  /* Maskot: Mandi (mandalina)                                           */
  /* ------------------------------------------------------------------ */
  var MOUTH = {
    smile: 'M46 76 Q60 89 74 76',
    happy: 'M44 74 Q60 96 76 74 Z',
    sad: 'M48 84 Q60 75 72 84',
    oh: 'M54 80 Q60 72 66 80 Q60 88 54 80 Z'
  };
  function mascotSVG() {
    return '<svg class="masc" viewBox="0 0 120 120">' +
      '<path d="M58 22C50 6 33 7 36 21z" fill="#3bb273"/>' +
      '<path d="M62 22C70 6 87 7 84 21z" fill="#26874f"/>' +
      '<ellipse cx="60" cy="68" rx="47" ry="45" fill="#ff8a3d"/>' +
      '<ellipse cx="44" cy="40" rx="10" ry="6" fill="#fff" opacity=".35" transform="rotate(-25 44 40)"/>' +
      '<ellipse cx="60" cy="86" rx="27" ry="19" fill="#ffb877"/>' +
      '<g class="m-eye"><ellipse cx="44" cy="60" rx="9" ry="11" fill="#fff"/><circle cx="46" cy="62" r="5.5" fill="#2b2d42"/><circle cx="48" cy="59" r="2" fill="#fff"/></g>' +
      '<g class="m-eye"><ellipse cx="76" cy="60" rx="9" ry="11" fill="#fff"/><circle cx="78" cy="62" r="5.5" fill="#2b2d42"/><circle cx="80" cy="59" r="2" fill="#fff"/></g>' +
      '<ellipse cx="32" cy="76" rx="6" ry="4" fill="#ef476f" opacity=".45"/>' +
      '<ellipse cx="88" cy="76" rx="6" ry="4" fill="#ef476f" opacity=".45"/>' +
      '<path class="m-mouth" d="' + MOUTH.smile + '" stroke="#2b2d42" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '</svg>';
  }
  function Mascot(host) {
    this.wrap = el('div', 'masc-wrap idle', mascotSVG());
    host.innerHTML = '';
    host.appendChild(this.wrap);
    this.mouth = this.wrap.querySelector('.m-mouth');
    this.t = null;
  }
  Mascot.prototype.face = function (kind, ms) {
    var self = this;
    this.mouth.setAttribute('d', MOUTH[kind] || MOUTH.smile);
    this.mouth.setAttribute('fill', kind === 'smile' || kind === 'sad' ? 'none' : '#b8324f');
    this.wrap.className = 'masc-wrap';
    void this.wrap.offsetWidth;
    this.wrap.className = 'masc-wrap ' + (kind === 'happy' ? 'happy' : kind === 'sad' ? 'sad' : 'idle');
    clearTimeout(this.t);
    if (ms) {
      this.t = setTimeout(function () { self.face('smile'); }, ms);
    }
  };

  var homeMascot = new Mascot($('home-mascot'));
  var playMascot = new Mascot($('play-mascot'));
  var resultMascot = new Mascot($('result-mascot'));

  var bubbleEl = $('bubble');
  function say(text) {
    bubbleEl.innerHTML = text;
    restartAnim(bubbleEl, 'say');
  }

  var PRAISE = ['Harika!', 'Süpersin!', 'Aferin!', 'Bravo!', 'Çok güzel!', 'Mükemmel!', 'Doğru!', 'Yaşasın!'];
  var RETRY = ['Bir daha dene!', 'Az kaldı!', 'Tekrar bak!', 'Hadi bir daha!'];

  /* ------------------------------------------------------------------ */
  /* Seviyeler (1. sınıf: toplamı 20'yi geçmeyen toplama)               */
  /* ------------------------------------------------------------------ */
  var LEVELS_ADD = [
    { name: "5'e kadar", sub: 'Say ve topla', color: '#ef476f', kind: 'objects', max: 5 },
    { name: "10'a kadar", sub: 'Say ve topla', color: '#ff8a3d', kind: 'objects', max: 10 },
    { name: 'Kurbağa', sub: 'Sayı doğrusu', color: '#3bb273', kind: 'line', max: 10 },
    { name: 'Onluk kutu', sub: '10 kutucuk', color: '#3a86ff', kind: 'frame', max: 10 },
    { name: 'Sayılarla', sub: "10'a kadar", color: '#8e7dff', kind: 'plain', max: 10 },
    { name: 'Gizli sayı', sub: '3 + ? = 7', color: '#e0a800', kind: 'missing', max: 10 },
    { name: "20'ye kadar", sub: 'İki onluk kutu', color: '#ef476f', kind: 'frame20', max: 20 },
    { name: 'Şampiyon', sub: "20'ye kadar", color: '#26874f', kind: 'plain', max: 20 }
  ];

  // 1. sınıf çıkarma: 20'ye kadar, onluk bozmadan
  var LEVELS_SUB = [
    { name: "5'ten çıkar", sub: 'Kalanı say', color: '#ef476f', kind: 'objects', max: 5 },
    { name: "10'dan çıkar", sub: 'Kalanı say', color: '#ff8a3d', kind: 'objects', max: 10 },
    { name: 'Kurbağa', sub: 'Geri zıpla', color: '#3bb273', kind: 'line', max: 10 },
    { name: 'Onluk kutu', sub: '10 kutucuk', color: '#3a86ff', kind: 'frame', max: 10 },
    { name: 'Sayılarla', sub: "10'a kadar", color: '#8e7dff', kind: 'plain', max: 10 },
    { name: 'Gizli sayı', sub: '8 – ? = 5', color: '#e0a800', kind: 'missing', max: 10 },
    { name: "20'ye kadar", sub: 'İki onluk kutu', color: '#ef476f', kind: 'frame20', max: 20 },
    { name: 'Şampiyon', sub: "20'ye kadar", color: '#26874f', kind: 'plain', max: 20 }
  ];

  var MINUS = '\u2013'; // eski Android yazı tiplerinde kesin bulunan çizgi
  var GAMES = {
    add: { id: 'add', title: 'Toplama', icon: '2+3', color: '#ff8a3d', op: '+', levels: LEVELS_ADD },
    sub: { id: 'sub', title: 'Çıkarma', icon: '5' + MINUS + '2', color: '#3a86ff', op: MINUS, levels: LEVELS_SUB }
  };
  // Onluk ve birlik (basamak değeri, 100'e kadar)
  var LEVELS_PV = [
    { name: 'Onluk nedir?', sub: '11-19', color: '#3a86ff', kind: 'read', min: 11, max: 19 },
    { name: 'Onlukları say', sub: '10, 20, 30...', color: '#ff8a3d', kind: 'tens', min: 10, max: 90 },
    { name: 'Sayıyı oku', sub: "50'ye kadar", color: '#3bb273', kind: 'read', min: 20, max: 50 },
    { name: 'Sayıyı kur', sub: "30'a kadar", color: '#8e7dff', kind: 'build', min: 11, max: 30 },
    { name: 'Kaç onluk?', sub: 'Basamaklar', color: '#e0a800', kind: 'digits', min: 21, max: 98 },
    { name: 'Sayıyı oku', sub: "99'a kadar", color: '#ef476f', kind: 'read', min: 51, max: 99 },
    { name: 'Sayıyı kur', sub: "99'a kadar", color: '#3a86ff', kind: 'build', min: 31, max: 99 },
    { name: 'Şampiyon', sub: 'Karışık', color: '#26874f', kind: 'mix', min: 11, max: 99 }
  ];
  GAMES.pv = { id: 'pv', title: 'Onluk ve Birlik', iconHTML: 'pv', color: '#3bb273', levels: LEVELS_PV };

  // Saat: tam ve yarım saatler (1. sınıf)
  var LEVELS_CLOCK = [
    { name: 'Tam saat', sub: 'Saat kaç?', color: '#8e7dff', kind: 'full' },
    { name: 'Tam saat kur', sub: 'Akrebi çevir', color: '#ef476f', kind: 'setfull' },
    { name: 'Buçuk', sub: 'Yarım saatler', color: '#3a86ff', kind: 'half' },
    { name: 'Dijital saat', sub: 'Eşini bul', color: '#3bb273', kind: 'match' },
    { name: 'Buçuk kur', sub: 'İki ibre', color: '#ff8a3d', kind: 'sethalf' },
    { name: 'Karışık', sub: 'Tam ve buçuk', color: '#e0a800', kind: 'readmix' },
    { name: 'Kaç saat sonra?', sub: '1-3 saat', color: '#ef476f', kind: 'later' },
    { name: 'Şampiyon', sub: 'Hepsi', color: '#26874f', kind: 'mix' }
  ];
  GAMES.clock = { id: 'clock', title: 'Saat', iconHTML: 'clock', color: '#8e7dff', levels: LEVELS_CLOCK };

  // Hece Treni (Türkçe, sessiz): heceleri vagonlara diz, resmi bul
  var LEVELS_HECE = [
    { name: 'Resmi bul', sub: 'Heceli kelime', color: '#ef476f', kind: 'read', syl: [2], split: true },
    { name: 'Treni kur', sub: '2 hece', color: '#ff8a3d', kind: 'build', syl: [2], extra: 1 },
    { name: 'Eksik hece', sub: 'Vagonu bul', color: '#3bb273', kind: 'missing', syl: [2, 3] },
    { name: 'Kaç hece?', sub: 'Hecele ve say', color: '#3a86ff', kind: 'count', syl: [1, 2, 3, 4] },
    { name: 'Resmi bul', sub: 'Kelimeyi oku', color: '#8e7dff', kind: 'read', syl: [2, 3] },
    { name: 'Treni kur', sub: '3-4 hece', color: '#e0a800', kind: 'build', syl: [3, 4], extra: 1 },
    { name: 'Uzun tren', sub: 'Karışık vagon', color: '#ef476f', kind: 'build', syl: [2, 3, 4], extra: 2 },
    { name: 'Şampiyon', sub: 'Hepsi', color: '#26874f', kind: 'mix', syl: [1, 2, 3, 4] }
  ];
  // Büyük mü, küçük mü? (karşılaştırma, timsah ağzı)
  var LEVELS_CMP = [
    { name: 'Çok olan', sub: 'Hangi tabak?', color: '#ef476f', kind: 'more', max: 10 },
    { name: 'Az olan', sub: 'Hangi tabak?', color: '#ff8a3d', kind: 'less', max: 10 },
    { name: 'Timsah', sub: '> < =', color: '#3bb273', kind: 'signobj', max: 10 },
    { name: 'Sayılarla', sub: "20'ye kadar", color: '#3a86ff', kind: 'sign', max: 20 },
    { name: 'Eşit mi?', sub: "20'ye kadar", color: '#8e7dff', kind: 'sign', max: 20, eq: 0.35 },
    { name: 'Büyük sayılar', sub: "99'a kadar", color: '#e0a800', kind: 'sign', max: 99 },
    { name: 'En büyük', sub: 'En küçük', color: '#ef476f', kind: 'extreme', max: 99 },
    { name: 'Şampiyon', sub: 'Hepsi', color: '#26874f', kind: 'mix', max: 99 }
  ];
  GAMES.cmp = { id: 'cmp', title: 'Büyük mü, Küçük mü?', icon: '3&lt;7', color: '#14a3a3', levels: LEVELS_CMP };

  // Örüntü Treni: renk, şekil ve sayı örüntüleri (ritmik sayma)
  var LEVELS_PAT = [
    { name: 'Renkler', sub: 'kırmızı, mavi...', color: '#ef476f', kind: 'color', units: ['AB'] },
    { name: 'Renk dizisi', sub: 'AAB, ABC', color: '#ff8a3d', kind: 'color', units: ['AAB', 'ABB', 'ABC'] },
    { name: 'Şekiller', sub: 'daire, kare...', color: '#3a86ff', kind: 'shape', units: ['AB', 'ABC', 'AAB'] },
    { name: 'Renk ve şekil', sub: 'İkisine bak', color: '#8e7dff', kind: 'both', units: ['AB', 'ABC', 'ABB'] },
    { name: 'Eksik vagon', sub: 'Ortadaki ?', color: '#e0a800', kind: 'hole', units: ['AB', 'ABB', 'ABC', 'AAB'] },
    { name: 'Ritmik sayma', sub: "2'şer, 5'er, 10'ar", color: '#3bb273', kind: 'count', steps: [2, 5, 10] },
    { name: 'İleri geri', sub: 'Sayı örüntüsü', color: '#ef476f', kind: 'count2', steps: [1, 2, 5, 10] },
    { name: 'Şampiyon', sub: 'Hepsi', color: '#26874f', kind: 'mix' }
  ];
  GAMES.pat = { id: 'pat', title: 'Örüntü Treni', iconHTML: 'pat', color: '#f09a2a', levels: LEVELS_PAT };

  // Bakkal Mandi: paralarımız (20 liraya kadar)
  var LEVELS_SHOP = [
    { name: 'Kaç lira?', sub: '1 liralar', color: '#e0a800', kind: 'coins' },
    { name: '5 ve 1', sub: "10'a kadar", color: '#8e7dff', kind: 'mix5' },
    { name: 'Kumbara', sub: "20'ye kadar", color: '#ef476f', kind: 'mix10' },
    { name: 'Öde', sub: "10 liraya kadar", color: '#3bb273', kind: 'pay', max: 10, notes: [1, 5, 10] },
    { name: 'Neyi alabilirim?', sub: 'Cebindeki para', color: '#3a86ff', kind: 'afford' },
    { name: 'Öde', sub: "20 liraya kadar", color: '#ff8a3d', kind: 'pay', max: 20, notes: [1, 5, 10, 20] },
    { name: 'Para üstü', sub: '10 ve 20 ile', color: '#ef476f', kind: 'change' },
    { name: 'Şampiyon', sub: 'Hepsi', color: '#26874f', kind: 'mix' }
  ];
  GAMES.shop = { id: 'shop', title: 'Bakkal Mandi', iconHTML: 'shop', color: '#c98b4d', levels: LEVELS_SHOP };

  GAMES.hece = { id: 'hece', title: 'Hece Treni', iconHTML: 'hece', color: '#ef476f', levels: LEVELS_HECE };

  // Ana sayfa: konu başlıkları altında oyun kartları (yeni oyunlar buraya eklenir)
  var SUBJECTS = [
    { title: 'Matematik', games: ['add', 'sub', 'pv', 'cmp', 'pat', 'clock', 'shop'] },
    { title: 'Türkçe', games: ['hece'] }
  ];
  var GAME_ORDER = ['add', 'sub', 'pv', 'cmp', 'pat', 'clock', 'shop', 'hece'];
  var CUR = GAMES.add; // seçili oyun
  function starsOf(game) {
    if (game.id === 'add') return save.stars;
    if (!save.games[game.id]) save.games[game.id] = {};
    return save.games[game.id];
  }

  function makeQuestion(lv, seen, op) {
    if (op === 'sub') return makeSubQuestion(lv, seen);
    if (op === 'pv') return makePvQuestion(lv, seen);
    if (op === 'clock') return makeClockQuestion(lv, seen);
    if (op === 'hece') return makeHeceQuestion(lv, seen);
    if (op === 'cmp') return makeCmpQuestion(lv, seen);
    if (op === 'pat') return makePatQuestion(lv, seen);
    if (op === 'shop') return makeShopQuestion(lv, seen);
    var a, b, key, tries = 0;
    do {
      if (lv.kind === 'frame20') {
        a = rnd(6, 14);
        b = rnd(Math.max(1, 11 - a), Math.min(9, 20 - a));
      } else if (lv.kind === 'line') {
        b = rnd(1, 4);
        a = rnd(0, lv.max - b);
        if (a === 0) a = rnd(1, lv.max - b);
      } else if (lv.max === 20) {
        // Şampiyon: yarısı 10'u geçen, yarısı 10'a kadar
        var sum = Math.random() < 0.6 ? rnd(11, 20) : rnd(5, 10);
        a = rnd(1, sum - 1); b = sum - a;
        if (b > 10) { var t = a; a = b; b = t; }
      } else {
        var lo = lv.max === 5 ? 2 : (lv.kind === 'objects' ? 6 : 4);
        var s = rnd(lo, lv.max);
        a = rnd(1, s - 1); b = s - a;
      }
      key = a + '+' + b;
      tries++;
    } while (seen[key] && tries < 40);
    seen[key] = true;
    var sumAB = a + b;
    var answer = lv.kind === 'missing' ? b : sumAB;
    return { a: a, b: b, sum: sumAB, answer: answer, opts: makeChoices(answer, lv.kind === 'missing' ? lv.max - 1 : lv.max) };
  }

  function makeSubQuestion(lv, seen) {
    var a, b, key, tries = 0;
    do {
      if (lv.kind === 'frame20') {
        a = rnd(11, 19); b = rnd(1, a - 10);          // onluk bozmadan: sonuç >= 10
      } else if (lv.kind === 'line') {
        b = rnd(1, 4); a = rnd(b + 1, 10);
      } else if (lv.max === 20) {
        // Şampiyon: çoğu 10'dan büyük (onluk bozmadan), bir kısmı 10'a kadar
        var roll = Math.random();
        if (roll < 0.1) { a = pick([20, rnd(11, 19)]); b = a - 10; }
        else if (roll < 0.65) { a = rnd(11, 19); b = rnd(1, a - 10); }
        else { a = rnd(4, 10); b = rnd(1, a - 1); }
      } else if (lv.max === 5) {
        a = rnd(2, 5); b = rnd(1, a - 1);
      } else {
        a = rnd(lv.kind === 'objects' ? 6 : 4, 10); b = rnd(1, a - 1);
      }
      key = a + '-' + b;
      tries++;
    } while (seen[key] && tries < 40);
    seen[key] = true;
    var r = a - b;
    var answer = lv.kind === 'missing' ? b : r;
    return { a: a, b: b, sum: r, answer: answer, opts: makeChoices(answer, a) };
  }

  function makeChoices(ans, max) {
    var out = [ans];
    var cand = shuffle([ans - 1, ans + 1]).concat(shuffle([ans - 2, ans + 2, ans + 3, ans - 3]));
    for (var i = 0; i < cand.length && out.length < 3; i++) {
      var c = cand[i];
      if (c >= 0 && c <= max + 2 && out.indexOf(c) === -1) out.push(c);
    }
    return shuffle(out);
  }

  /* ------------------------------------------------------------------ */
  /* Ekran yönetimi ve ölçekleme                                         */
  /* ------------------------------------------------------------------ */
  var current = null;
  function show(name) {
    clearTimers();
    stopHint();
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $('s-' + name).classList.add('active');
    current = name;
    if (pendingReload && safeToReload()) { doReload(); return; }
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
  }

  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var portrait = h > w * 1.1;
    var fs = portrait ? Math.min(w / 620, h / 980) * 16 : Math.min(w / 1024, h / 560) * 16;
    if (fs < 8) fs = 8;
    if (fs > 22) fs = 22;
    document.documentElement.style.fontSize = fs.toFixed(2) + 'px';
    document.body.className = portrait ? 'portrait' : '';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
  fit();

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute('data-go')) {
        Snd.tap();
        show(t.getAttribute('data-go'));
        return;
      }
      t = t.parentNode;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Ana sayfa                                                           */
  /* ------------------------------------------------------------------ */
  var HELLOS = ['Merhaba! Hadi oynayalım!', 'Bugün ne öğrenelim?', 'Bugün yıldız toplayalım!'];
  function totalStars(game) {
    var t = 0, m = starsOf(game);
    for (var k in m) if (m.hasOwnProperty(k)) t += m[k];
    return t;
  }
  function gameIcon(game) {
    if (game.iconHTML === 'shop') {
      return '<div class="game-icon" style="background:' + game.color + '"><div class="sh-ico">' + moneySVG(10) + moneySVG(1) + moneySVG(1) + '</div></div>';
    }
    if (game.iconHTML === 'pat') {
      return '<div class="game-icon" style="background:' + game.color + '"><div class="pt-ico">' +
        patItemSVG({ s: 'circle', c: '#ef476f' }) + patItemSVG({ s: 'square', c: '#ffd23f' }) +
        patItemSVG({ s: 'circle', c: '#ef476f' }) + patItemSVG({ s: 'square', c: '#ffd23f' }) + '<b>?</b></div></div>';
    }
    if (game.iconHTML === 'hece') {
      return '<div class="game-icon" style="background:' + game.color + '"><div class="hc-ico"><span>ka</span><span>le</span><b>' + LOCO + '</b></div></div>';
    }
    if (game.iconHTML === 'clock') {
      return '<div class="game-icon" style="background:' + game.color + '"><div class="clk-ico">' + clockSVG(10, 30, true) + '</div></div>';
    }
    if (game.iconHTML === 'pv') {
      return '<div class="game-icon" style="background:' + game.color + '"><div class="pv-ico">' +
        svgUse('i-rod') + svgUse('i-rod') + svgUse('i-rod') + svgUse('i-cube', 'c') + svgUse('i-cube', 'c') + svgUse('i-cube', 'c') + svgUse('i-cube', 'c') +
        '</div></div>';
    }
    return '<div class="game-icon" style="background:' + game.color + '">' + game.icon + '</div>';
  }
  function renderHome() {
    $('home-hello').innerHTML = pick(HELLOS);
    var box = $('subjects');
    box.innerHTML = '';
    for (var s = 0; s < SUBJECTS.length; s++) {
      var subj = SUBJECTS[s];
      var sec = el('div', 'subject', '<h2 class="subject-title">' + subj.title + '</h2>');
      var g = el('div', 'games');
      for (var i = 0; i < subj.games.length; i++) {
        (function (game) {
          var card = el('button', 'game-card', gameIcon(game) + '<h3>' + game.title + '</h3><p>' +
            totalStars(game) + ' / ' + (game.levels.length * 3) + ' yıldız</p>');
          card.addEventListener('click', function () { Snd.tap(); CUR = game; show('levels'); });
          g.appendChild(card);
        })(GAMES[subj.games[i]]);
      }
      if (subj.soon) g.appendChild(el('div', 'soon', subj.soon));
      sec.appendChild(g);
      box.appendChild(sec);
    }
    homeMascot.face('happy', 1200);
  }

  /* ------------------------------------------------------------------ */
  /* Seviye seçimi                                                       */
  /* ------------------------------------------------------------------ */
  function unlockedCount() {
    var n = 1, st = starsOf(CUR), L = CUR.levels;
    for (var i = 0; i < L.length; i++) {
      if (st[i] > 0) n = i + 2; else break;
    }
    return Math.min(n, L.length);
  }
  function starRow(n, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) s += svgUse('i-star', i < n ? 'on' : '');
    return '<div class="' + cls + '">' + s + '</div>';
  }
  function renderLevels() {
    var box = $('levels');
    box.innerHTML = '';
    $('levels-title').innerHTML = CUR.title;
    var open = unlockedCount();
    var st = starsOf(CUR);
    for (var i = 0; i < CUR.levels.length; i++) {
      (function (i) {
        var lv = CUR.levels[i];
        var locked = i >= open;
        var isCurrent = !locked && i === open - 1 && !(st[i] > 0);
        var b = el('button', 'lvl' + (locked ? ' locked' : '') + (isCurrent ? ' current' : ''),
          '<div class="lvl-num" style="background:' + lv.color + '">' + (locked ? svgUse('i-lock') : (i + 1)) + '</div>' +
          '<div class="lvl-name">' + lv.name + '</div>' +
          '<div class="lvl-sub">' + lv.sub + '</div>' +
          starRow(st[i] || 0, 'lvl-stars'));
        b.addEventListener('click', function () {
          if (locked) { Snd.wrong(); restartAnim(b, 'shakeit'); return; }
          Snd.tap();
          startLevel(i);
        });
        box.appendChild(b);
      })(i);
    }
    $('total-stars').innerHTML = totalStars(CUR);
  }

  /* ------------------------------------------------------------------ */
  /* Oyun                                                                */
  /* ------------------------------------------------------------------ */
  var G = null; // aktif oyun durumu

  function startLevel(i) {
    show('play');
    G = { game: CUR, op: CUR.id, sign: CUR.op, lvl: i, lv: CUR.levels[i], q: 0, missQ: 0, streak: 0, seen: {}, cur: null, locked: false, wrongNow: 0, results: [] };
    renderDots();
    say(pick(['Hadi başlayalım!', 'Hazır mısın?', 'Haydi!']));
    playMascot.face('happy', 900);
    later(nextQuestion, 350);
  }

  function renderDots() {
    var d = $('dots');
    var html = '';
    for (var i = 0; i < QUESTIONS_PER_LEVEL; i++) {
      var cls = 'dot';
      if (i < G.results.length) cls += G.results[i] ? ' ok' : ' meh';
      else if (i === G.q) cls += ' now';
      html += '<span class="' + cls + '"></span>';
    }
    d.innerHTML = html;
  }

  function nextQuestion() {
    if (G.q >= QUESTIONS_PER_LEVEL) { finishLevel(); return; }
    var stage = $('stage');
    stopHint();
    var build = function () {
      G.qid = (G.qid || 0) + 1;
      G.cur = makeQuestion(G.lv, G.seen, G.op);
      G.locked = false;
      G.wrongNow = 0;
      G.counter = 0;
      stage.innerHTML = '';
      stage.className = 'stage';
      buildQuestion(stage, G.cur, G.lv);
      void stage.offsetWidth;
      stage.className = 'stage in';
      buildChoices(G.cur);
      renderDots();
    };
    if (stage.firstChild) {
      stage.className = 'stage out';
      later(build, 170);
    } else {
      build();
    }
  }

  var PAIRS = [['#ef476f', '#3a86ff'], ['#ff8a3d', '#8e7dff'], ['#3bb273', '#ef476f'], ['#8e7dff', '#ffb000']];
  var ITEMS = ['i-apple', 'i-star', 'i-balloon'];

  function buildQuestion(stage, q, lv) {
    if (G.op === 'sub') { buildSubQuestion(stage, q, lv); return; }
    if (G.op === 'pv') { buildPvQuestion(stage, q); return; }
    if (G.op === 'clock') { buildClockQuestion(stage, q); return; }
    if (G.op === 'hece') { buildHeceQuestion(stage, q); return; }
    if (G.op === 'cmp') { buildCmpQuestion(stage, q); return; }
    if (G.op === 'pat') { buildPatQuestion(stage, q); return; }
    if (G.op === 'shop') { buildShopQuestion(stage, q); return; }
    G.countReady = true;
    var kind = lv.kind;
    if (kind === 'objects') {
      var pair = pick(PAIRS), item = pick(ITEMS);
      var vis = el('div', 'visual');
      vis.appendChild(objGroup(q.a, item, pair[0], 0));
      vis.appendChild(el('div', 'op-sign', '+'));
      vis.appendChild(objGroup(q.b, item, pair[1], q.a));
      stage.appendChild(vis);
      stage.appendChild(equation(q.a, '+', q.b, '=', null, pair));
      say(pick(['Kaç tane var?', 'Hepsini say!', 'Dokunarak say!']));
    } else if (kind === 'frame' || kind === 'frame20') {
      var vis2 = el('div', 'visual');
      var frames = kind === 'frame20' ? 2 : 1;
      var idx = 0;
      for (var f = 0; f < frames; f++) {
        var fr = el('div', 'frame');
        for (var c = 0; c < 10; c++) {
          var cell = el('div', 'cell');
          if (idx < q.a + q.b) {
            var col = idx < q.a ? '#ef476f' : '#3a86ff';
            var chip = el('div', 'chip cnt pop');
            chip.style.background = col;
            chip.style.webkitAnimationDelay = chip.style.animationDelay = (idx * 0.03) + 's';
            cell.appendChild(chip);
            cell.className = 'cell obj-cell';
            attachCount(cell);
          }
          idx++;
          fr.appendChild(cell);
        }
        vis2.appendChild(fr);
      }
      stage.appendChild(vis2);
      stage.appendChild(equation(q.a, '+', q.b, '=', null, ['#ef476f', '#3a86ff']));
      say(kind === 'frame20' ? 'Önce 10\'u bul!' : 'Kırmızı ve maviyi say!');
    } else if (kind === 'line') {
      stage.appendChild(numberLine(q));
      stage.appendChild(equation(q.a, '+', q.b, '=', null, ['#ef476f', '#3a86ff']));
      say(q.b + ' kere zıplıyor!');
    } else if (kind === 'missing') {
      stage.appendChild(equation(q.a, '+', null, '=', q.sum, ['#ef476f', '#3a86ff']));
      say('Gizli sayıyı bul!');
    } else {
      stage.appendChild(equation(q.a, '+', q.b, '=', null, ['#ef476f', '#3a86ff']));
      say(pick(['Kaç eder?', 'Bil bakalım!', 'Hızlı düşün!']));
    }
  }

  /* ---------- Çıkarma görselleri ---------- */
  function buildSubQuestion(stage, q, lv) {
    var kind = lv.kind, M = MINUS;
    var C1 = '#3a86ff', C2 = '#ef476f';
    G.countReady = false;
    if (kind === 'objects') {
      var item = pick(ITEMS), color = pick(['#ef476f', '#ff8a3d', '#3bb273', '#8e7dff', '#3a86ff']);
      var vis = el('div', 'visual');
      var grp = objGroup(q.a, item, color, 0, true);
      vis.appendChild(grp);
      stage.appendChild(vis);
      stage.appendChild(equation(q.a, M, q.b, '=', null, ['#2b2d42', C2]));
      say(pick([q.a + " taneden " + q.b + " tanesi gidiyor!", 'Kaç tane kaldı?']));
      strikeLast(grp.querySelectorAll('.obj'), q.b, 'Kaç tane kaldı?');
    } else if (kind === 'frame' || kind === 'frame20') {
      var vis2 = el('div', 'visual');
      var frames = kind === 'frame20' ? 2 : 1;
      var idx = 0, cells = [];
      for (var f = 0; f < frames; f++) {
        var fr = el('div', 'frame');
        for (var c = 0; c < 10; c++) {
          var cell = el('div', 'cell');
          if (idx < q.a) {
            var chip = el('div', 'chip pop');
            chip.style.background = C1;
            chip.style.webkitAnimationDelay = chip.style.animationDelay = (idx * 0.03) + 's';
            cell.appendChild(chip);
            cell.className = 'cell obj-cell';
            attachCount(cell);
            cells.push(cell);
          }
          idx++;
          fr.appendChild(cell);
        }
        vis2.appendChild(fr);
      }
      stage.appendChild(vis2);
      stage.appendChild(equation(q.a, M, q.b, '=', null, [C1, C2]));
      say(q.b + ' tanesini siliyoruz!');
      strikeLast(cells, q.b, kind === 'frame20' ? 'İlk kutu dolu kaldı mı?' : 'Kalanları say!');
    } else if (kind === 'line') {
      G.countReady = true;
      stage.appendChild(numberLine(q, -1));
      stage.appendChild(equation(q.a, M, q.b, '=', null, ['#ef476f', C1]));
      say(q.b + ' kere geri zıplıyor!');
    } else if (kind === 'missing') {
      G.countReady = true;
      stage.appendChild(equation(q.a, M, null, '=', q.sum, ['#2b2d42', C2]));
      say('Kaç tane gitti?');
    } else {
      G.countReady = true;
      stage.appendChild(equation(q.a, M, q.b, '=', null, ['#2b2d42', C2]));
      say(pick(['Kaç kalır?', 'Bil bakalım!', 'Hızlı düşün!']));
    }
  }

  // Son "b" nesneyi sırayla çizer (gider); bitince çocuk kalanları sayabilir.
  function strikeLast(nodeList, b, prompt) {
    var nodes = [];
    for (var i = 0; i < nodeList.length; i++) nodes.push(nodeList[i]);
    var qid = G.qid;
    var start = 650 + nodes.length * 40;
    for (var k = 0; k < b; k++) {
      (function (node, k) {
        later(function () {
          if (G.qid !== qid) return;
          node.classList.add('gone');
          node.appendChild(el('span', 'xmark', '<i></i><i></i>'));
          Snd.tone(520 - k * 25, 0, 0.09, 'triangle', 0.16);
        }, start + k * 140);
      })(nodes[nodes.length - 1 - k], k);
    }
    later(function () {
      if (G.qid !== qid) return;
      G.countReady = true;
      if (prompt) say(prompt);
    }, start + b * 140 + 150);
  }

  function objGroup(n, item, color, offset) {
    var g = el('div', 'group');
    // 5'li sıralar: göz hemen gruplar (örüntü algısı)
    var perRow = n > 5 ? 5 : n;
    g.style.width = (perRow * 3.6 + 1.2) + 'rem';
    for (var i = 0; i < n; i++) {
      var o = el('div', 'obj cnt pop', svgUse(item, '', color));
      o.style.webkitAnimationDelay = o.style.animationDelay = ((offset + i) * 0.05) + 's';
      attachCount(o);
      g.appendChild(o);
    }
    return g;
  }

  // Çocuk nesnelere dokunarak sayabilir: her dokunuşta sıradaki numara yazılır.
  // qid: her soruya özel; eski sorunun nesneleri/zamanlayıcıları yeni soruyu etkilemesin.
  function attachCount(node) {
    var qid = G.qid;
    node.addEventListener('click', function () {
      if (!G || G.qid !== qid || !G.countReady || node.getAttribute('data-n') || node.classList.contains('gone')) return;
      var grp = node.parentNode, n;
      if (grp && grp.getAttribute && grp.getAttribute('data-sep')) {   // her grup kendi içinde sayılır
        n = (+grp.getAttribute('data-c') || 0) + 1;
        grp.setAttribute('data-c', n);
      } else {
        G.counter++;
        n = G.counter;
      }
      node.setAttribute('data-n', n);
      node.classList.add('counted');
      node.appendChild(el('span', 'num', String(n)));
      Snd.count(n);
    });
  }

  // İpucu: tüm nesneleri sırayla numaralar
  var hintTimers = [];
  function stopHint() {
    for (var i = 0; i < hintTimers.length; i++) clearTimeout(hintTimers[i]);
    hintTimers = [];
  }
  function countHint() {
    var nodes = $('stage').querySelectorAll('.obj, .obj-cell');
    if (!nodes.length) return false;
    if (hintTimers.length) return true; // zaten sayıyor
    if (!G.countReady) return false;
    var qid = G.qid;
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getAttribute('data-n') && !nodes[i].classList.contains('gone')) list.push(nodes[i]);
    }
    for (var j = 0; j < list.length; j++) {
      (function (n, k) {
        hintTimers.push(setTimeout(function () {
          if (G && G.qid === qid && !n.getAttribute('data-n')) fireClick(n);
          if (k === list.length - 1) hintTimers = [];
        }, k * 230));
      })(list[j], j);
    }
    return true;
  }
  function fireClick(node) {
    var ev = document.createEvent('MouseEvents');
    ev.initEvent('click', true, true);
    node.dispatchEvent(ev);
  }

  function equation(a, op, b, eqSign, c, colors) {
    var e = el('div', 'eq');
    var html = '';
    html += a == null ? '<span class="box">?</span>' : '<span class="n c1">' + a + '</span>';
    html += '<span class="s">' + op + '</span>';
    html += b == null ? '<span class="box">?</span>' : '<span class="n c2">' + b + '</span>';
    html += '<span class="s">' + eqSign + '</span>';
    html += c == null ? '<span class="box">?</span>' : '<span class="n">' + c + '</span>';
    e.innerHTML = html;
    var ns = e.querySelectorAll('.n');
    if (colors && ns.length) {
      if (ns[0]) ns[0].style.color = colors[0];
      if (ns[1] && b != null) ns[1].style.color = colors[1];
    }
    return e;
  }

  function numberLine(q, dir) {
    dir = dir || 1;
    var wrap = el('div', 'nline');
    var max = 10;
    var W = 880, pad = 30, y = 110;
    var step = (W - pad * 2) / max;
    var s = '<svg class="line" viewBox="0 0 ' + W + ' 170" preserveAspectRatio="none">';
    s += '<line x1="' + (pad - 15) + '" y1="' + y + '" x2="' + (W - pad + 15) + '" y2="' + y + '" stroke="#2b2d42" stroke-width="5" stroke-linecap="round"/>';
    for (var i = 0; i <= max; i++) {
      var x = pad + i * step;
      var hi = i === q.a;
      // çıkarmada başlangıç noktası (eksilen) vurgulanır
      s += '<line x1="' + x + '" y1="' + (y - 14) + '" x2="' + x + '" y2="' + (y + 14) + '" stroke="#2b2d42" stroke-width="4"/>';
      s += '<text x="' + x + '" y="' + (y + 50) + '" text-anchor="middle" font-size="34" font-weight="900" fill="' + (hi ? '#ef476f' : '#2b2d42') + '" font-family="Roboto, Arial, sans-serif">' + i + '</text>';
    }
    s += '<g class="arcs"></g></svg>';
    wrap.innerHTML = s;
    var frog = el('div', 'frog', '<div class="fbody">' + svgUse('i-frog') + '</div>');
    wrap.appendChild(frog);

    // Kurbağanın konumunu % olarak tut (ölçekten bağımsız)
    var pctAt = function (n) { return (pad + n * step) / W * 100; };
    frog.style.left = pctAt(q.a) + '%';
    var pos = q.a;
    var arcs = wrap.querySelector('.arcs');
    var fbody = frog.firstChild;
    var hopOnce = function (k) {
      var from = pos, to = pos + dir;
      pos = to;
      var x1 = pad + from * step, x2 = pad + to * step, mid = (x1 + x2) / 2;
      var ns = 'http://www.w3.org/2000/svg';
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + (y - 18) + ' Q' + mid + ' ' + (y - 95) + ' ' + x2 + ' ' + (y - 18));
      p.setAttribute('stroke', dir > 0 ? '#3a86ff' : '#ef476f');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('stroke-dasharray', '8 7');
      p.setAttribute('fill', 'none');
      arcs.appendChild(p);
      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', mid); t.setAttribute('y', y - 64);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '26');
      t.setAttribute('font-weight', '900'); t.setAttribute('fill', dir > 0 ? '#3a86ff' : '#ef476f');
      t.setAttribute('font-family', 'Roboto, Arial, sans-serif');
      t.textContent = (dir > 0 ? '+' : MINUS) + k;
      arcs.appendChild(t);
      var dx = (pctAt(to) - pctAt(q.a)) / 100 * wrap.offsetWidth;
      frog.style.webkitTransform = frog.style.transform = 'translateX(' + dx + 'px)';
      restartAnim(fbody, 'jump');
      Snd.hop();
    };
    for (var h = 1; h <= q.b; h++) {
      (function (k) { later(function () { hopOnce(k); }, 550 + (k - 1) * 520); })(h);
    }
    return wrap;
  }

  /* ------------------------------------------------------------------ */
  /* Onluk ve Birlik                                                     */
  /* ------------------------------------------------------------------ */
  function makePvQuestion(lv, seen) {
    var kind = lv.kind === 'mix' ? pick(['read', 'read', 'build', 'digits']) : lv.kind;
    var n, key, tries = 0;
    do {
      if (kind === 'tens') n = 10 * rnd(1, 9);
      else {
        n = rnd(lv.min, lv.max);
        if (kind === 'digits' && n % 10 === Math.floor(n / 10)) n++; // 44 gibi sayılar olmasın
      }
      key = kind + n;
      tries++;
    } while (seen[key] && tries < 40);
    seen[key] = true;
    var t = Math.floor(n / 10), o = n % 10;
    var q = { kind: kind, n: n, t: t, o: o };
    if (kind === 'build') { q.build = true; q.answer = n; q.opts = []; }
    else if (kind === 'digits') {
      q.ask = (o === 0 || Math.random() < 0.55) ? 'tens' : 'ones';
      q.answer = q.ask === 'tens' ? t : o;
      var other = q.ask === 'tens' ? o : t;
      var c = [q.answer, other];
      var near = shuffle([q.answer + 1, q.answer - 1, q.answer + 2]);
      for (var i = 0; i < near.length && c.length < 3; i++) if (near[i] >= 0 && near[i] <= 9 && c.indexOf(near[i]) === -1) c.push(near[i]);
      q.opts = shuffle(c);
    } else {
      q.answer = n;
      var cand = [];
      if (o !== 0 && o !== t) cand.push(o * 10 + t);  // basamakları ters okuma: 47 / 74
      cand = cand.concat(shuffle([n + 10, n - 10, n + 1, n - 1]));
      var out = [n];
      for (var k = 0; k < cand.length && out.length < 3; k++) {
        var v = cand[k];
        if (v >= 1 && v <= 99 && out.indexOf(v) === -1) out.push(v);
      }
      q.opts = shuffle(out);
    }
    return q;
  }

  // Onluk çubukları ve birlik küpleri
  function pvBlocks(t, o, removable) {
    var wrap = el('div', 'pv');
    var rods = el('div', 'pv-rods'), cubes = el('div', 'pv-cubes');
    for (var i = 0; i < t; i++) rods.appendChild(pvPiece('rod', i, removable));
    for (var j = 0; j < o; j++) cubes.appendChild(pvPiece('cube', t + j, removable));
    wrap.appendChild(rods);
    wrap.appendChild(cubes);
    return wrap;
  }
  function pvPiece(type, idx, removable) {
    var p = el('div', 'pv-' + type + ' pop', svgUse(type === 'rod' ? 'i-rod' : 'i-cube'));
    p.style.webkitAnimationDelay = p.style.animationDelay = (removable ? 0 : idx * 0.04) + 's';
    if (removable) {
      p.addEventListener('click', function () {
        if (G.locked) return;
        if (type === 'rod') G.bt--; else G.bo--;
        Snd.tone(330, 0, 0.08, 'triangle', 0.15);
        renderBuild();
      });
    }
    return p;
  }

  function buildPvQuestion(stage, q) {
    G.countReady = true;
    if (q.kind === 'build') {
      G.bt = 0; G.bo = 0;
      var head = el('div', 'pv-target', '<span class="pv-num">' + q.n + '</span>');
      stage.appendChild(head);
      var area = el('div', 'pv-area');
      area.id = 'pv-area';
      stage.appendChild(area);
      renderBuild();
      say(q.n + ' sayısını kur!');
      return;
    }
    if (q.kind === 'digits') {
      stage.appendChild(el('div', 'pv-target', '<span class="pv-num">' + '<b class="d-t">' + q.t + '</b><b class="d-o">' + q.o + '</b></span>'));
      stage.appendChild(el('div', 'pv-ask', q.n + ' sayısında kaç <strong>' + (q.ask === 'tens' ? 'onluk' : 'birlik') + '</strong> var?'));
      var holder = el('div', 'pv-holder');
      holder.id = 'pv-holder';
      stage.appendChild(holder);
      say(q.ask === 'tens' ? 'Onluklar soldaki rakam!' : 'Birlikler sağdaki rakam!');
      return;
    }
    stage.appendChild(pvBlocks(q.t, q.o, false));
    var eq = el('div', 'eq', '<span class="box">?</span>');
    stage.appendChild(eq);
    say(q.kind === 'tens' ? 'Her çubuk 10 tane!' : (q.t === 1 && q.o > 0 ? '1 onluk ve ' + q.o + ' birlik' : 'Onlukları ve birlikleri say!'));
  }

  function renderBuild() {
    var area = $('pv-area');
    if (!area) return;
    area.innerHTML = '';
    if (!G.bt && !G.bo) area.appendChild(el('div', 'pv-empty', 'Aşağıdaki düğmelerle çubuk ve küp ekle'));
    else area.appendChild(pvBlocks(G.bt, G.bo, true));
    var v = G.bt * 10 + G.bo;
    area.appendChild(el('div', 'pv-now', '<span>' + G.bt + ' onluk</span> <span>' + G.bo + ' birlik</span> = <b>' + v + '</b>'));
  }

  function buildPvControls(box, q) {
    var addRod = el('button', 'ch pvb k2', svgUse('i-rod', 'pvb-rod') + '<span>+10</span>');
    var addCube = el('button', 'ch pvb k1', svgUse('i-cube', 'pvb-cube') + '<span>+1</span>');
    var ok = el('button', 'ch pvb pvok', '<span class="tick"></span><span>Tamam</span>');
    addRod.addEventListener('click', function () {
      if (G.locked) return;
      if (G.bt >= 9) { Snd.wrong(); return; }
      G.bt++; Snd.tone(392, 0, 0.1, 'triangle', 0.2); renderBuild();
    });
    addCube.addEventListener('click', function () {
      if (G.locked) return;
      if (G.bo === 9) {
        // 10 birlik = 1 onluk: küpler çubuğa dönüşür
        if (G.bt >= 9) { Snd.wrong(); return; }
        G.bo = 0; G.bt++;
        say('10 birlik = 1 onluk!');
        Snd.tone(523, 0, 0.12, 'triangle', 0.25); Snd.tone(784, 0.1, 0.2, 'triangle', 0.25);
      } else {
        G.bo++; Snd.count(G.bo);
      }
      renderBuild();
    });
    ok.addEventListener('click', function () { answer(ok, G.bt * 10 + G.bo); });
    var list = [addRod, addCube, ok];
    for (var i = 0; i < list.length; i++) {
      list[i].style.webkitAnimationDelay = list[i].style.animationDelay = (0.08 * i + 0.1) + 's';
      box.appendChild(list[i]);
    }
  }

  function pvBuildHint() {
    var q = G.cur;
    if (G.bt !== q.t) return q.n + ' için ' + q.t + ' onluk gerekiyor!';
    return 'Onluklar tamam! ' + q.o + ' birlik olmalı.';
  }

  // Yanlış cevapta: çubukları 10'ar 10'ar, küpleri birer birer sayar
  function pvHint() {
    var q = G.cur, stage = $('stage');
    if (hintTimers.length) return true;
    if (q.kind === 'digits') {
      var holder = $('pv-holder');
      if (holder && !holder.firstChild) holder.appendChild(pvBlocks(q.t, q.o, false));
    }
    var rods = stage.querySelectorAll('.pv-rod'), cubes = stage.querySelectorAll('.pv-cube');
    if (!rods.length && !cubes.length) return false;
    say(q.kind === 'digits' ? (q.ask === 'tens' ? 'Çubukları say!' : 'Küpleri say!') : 'Onluklarla sayalım!');
    var qid = G.qid, total = 0, delay = 350;
    var steps = [];
    var onlyRods = q.kind === 'digits' && q.ask === 'tens', onlyCubes = q.kind === 'digits' && q.ask === 'ones';
    if (!onlyCubes) for (var i = 0; i < rods.length; i++) steps.push([rods[i], 10]);
    if (!onlyRods) for (var j = 0; j < cubes.length; j++) steps.push([cubes[j], 1]);
    if (!steps.length) return false;
    for (var m = 0; m < steps.length; m++) {
      (function (node, add, idx) {
        hintTimers.push(setTimeout(function () {
          if (!G || G.qid !== qid || node.getAttribute('data-n')) return;
          total += add;
          node.setAttribute('data-n', total);
          node.classList.add('counted');
          node.appendChild(el('span', 'num', String(q.kind === 'digits' ? idx + 1 : total)));
          Snd.count(idx + 1);
          if (idx === steps.length - 1) hintTimers = [];
        }, delay));
      })(steps[m][0], steps[m][1], m);
      delay += steps[m][1] === 10 ? 420 : 280;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Saat                                                                */
  /* ------------------------------------------------------------------ */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function hourNext(h, k) { return ((h - 1 + k) % 12 + 12) % 12 + 1; }
  function timeText(v) { var h = Math.floor(v / 100), m = v % 100; return h + ':' + (m < 10 ? '0' : '') + m; }
  function timeWords(v) { var h = Math.floor(v / 100), m = v % 100; return m === 30 ? h + ' buçuk' : 'saat ' + h; }
  // Bulunma eki: 3'te, 6'da, 12'de ...
  var ABL = { 1: "'den", 2: "'den", 3: "'ten", 4: "'ten", 5: "'ten", 6: "'dan", 7: "'den", 8: "'den", 9: "'dan", 10: "'dan", 11: "'den", 12: "'den" };
  var LOC = { 1: "'de", 2: "'de", 3: "'te", 4: "'te", 5: "'te", 6: "'da", 7: "'de", 8: "'de", 9: "'da", 10: "'da", 11: "'de", 12: "'de" };

  function clockSVG(h, m, mini) {
    var s = '<svg class="clock' + (mini ? ' mini' : '') + '" viewBox="0 0 200 200">';
    s += '<circle cx="100" cy="100" r="96" fill="#2b2d42"/><circle cx="100" cy="100" r="89" fill="#ffffff"/>';
    if (!mini) {
      for (var t = 0; t < 60; t++) {
        if (t % 5 === 0) continue;
        s += '<line x1="100" y1="15" x2="100" y2="20" stroke="#c9cfdc" stroke-width="2" transform="rotate(' + (t * 6) + ' 100 100)"/>';
      }
    }
    for (var i = 1; i <= 12; i++) {
      var a = i * 30 * Math.PI / 180, x = 100 + Math.sin(a) * 70, y = 100 - Math.cos(a) * 70;
      s += '<circle class="nb nb' + i + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="15" fill="none"/>';
      s += '<line x1="100" y1="12" x2="100" y2="22" stroke="#2b2d42" stroke-width="4" stroke-linecap="round" transform="rotate(' + (i * 30) + ' 100 100)"/>';
      if (!mini || i % 3 === 0) s += '<text x="' + x.toFixed(1) + '" y="' + (y + 8).toFixed(1) + '" text-anchor="middle" font-size="' + (mini ? 26 : 22) + '" font-weight="900" fill="#2b2d42" font-family="Roboto, Arial, sans-serif">' + i + '</text>';
    }
    s += '<g class="hand-m" transform="rotate(' + (m * 6) + ' 100 100)"><line x1="100" y1="108" x2="100" y2="38" stroke="#3a86ff" stroke-width="7" stroke-linecap="round"/></g>';
    s += '<g class="hand-h" transform="rotate(' + ((h % 12) * 30 + m * 0.5) + ' 100 100)"><line x1="100" y1="108" x2="100" y2="60" stroke="#ef476f" stroke-width="11" stroke-linecap="round"/></g>';
    s += '<circle cx="100" cy="100" r="8" fill="#2b2d42"/></svg>';
    return s;
  }
  function setHands(wrap, h, m) {
    wrap.querySelector('.hand-m').setAttribute('transform', 'rotate(' + (m * 6) + ' 100 100)');
    wrap.querySelector('.hand-h').setAttribute('transform', 'rotate(' + ((h % 12) * 30 + m * 0.5) + ' 100 100)');
  }
  function markNumber(n, on) {
    var c = $('stage').querySelector('.clock .nb' + n);
    if (c) c.setAttribute('fill', on ? '#ffe08a' : 'none');
  }

  function makeClockQuestion(lv, seen) {
    var kind = lv.kind;
    if (kind === 'mix') kind = pick(['full', 'half', 'match', 'setfull', 'sethalf', 'later']);
    if (kind === 'readmix') kind = pick(['full', 'half', 'half']);
    var h, m, k = 0, key, tries = 0;
    do {
      h = rnd(1, 12);
      m = (kind === 'half' || kind === 'sethalf') ? 30 : (kind === 'match' ? pick([0, 30]) : 0);
      if (kind === 'later') k = rnd(1, 3);
      key = kind + h + ':' + m + '+' + k;
      tries++;
    } while (seen[key] && tries < 40);
    seen[key] = true;
    var v = h * 100 + m;
    var q = { kind: kind, h: h, m: m, k: k };
    if (kind === 'setfull' || kind === 'sethalf') {
      q.build = true; q.ctrl = 'clock'; q.answer = v; q.opts = [];
      return q;
    }
    var opts;
    if (kind === 'later') {
      q.answer = hourNext(h, k) * 100;
      opts = [q.answer, hourNext(h, k + 1) * 100, hourNext(h, k - 1) * 100];
      if (k === 1) opts[2] = hourNext(h, 3) * 100;
    } else {
      q.answer = v;
      if (m === 30) opts = [v, hourNext(h, 1) * 100 + 30, h * 100];        // en sık hata: akrebin geçtiği sayıyı okumak
      else opts = [v, hourNext(h, 1) * 100, (h === 6 ? 12 : 6) * 100 + (kind === 'match' ? 30 : 0)];
      if (opts[2] === opts[0] || opts[2] === opts[1]) opts[2] = hourNext(h, -1) * 100 + m;
    }
    q.opts = shuffle(opts);
    q.answerText = timeText(q.answer);
    if (kind === 'match') {
      q.optClass = 'clk';
      q.optHTML = function (val) { return clockSVG(Math.floor(val / 100), val % 100, true); };
    } else {
      q.optClass = 'tm';
      q.optHTML = function (val) { return '<span class="tm-big">' + timeText(val) + '</span><span class="tm-small">' + timeWords(val) + '</span>'; };
    }
    return q;
  }

  function buildClockQuestion(stage, q) {
    G.countReady = true;
    var row = el('div', 'clk-row');
    var face = el('div', 'clk-face');
    var info = el('div', 'clk-info');
    row.appendChild(face);
    row.appendChild(info);
    stage.appendChild(row);
    if (q.build) {
      G.ch = 12; G.cm = 0;
      face.innerHTML = clockSVG(G.ch, G.cm);
      face.className = 'clk-face live';
      info.innerHTML = '<div class="clk-prompt">Saati kur</div><div class="dig">' + timeText(q.answer) + '</div><div class="clk-words">' + timeWords(q.answer) + '</div>';
      attachClockDrag(face, q);
      say(q.kind === 'setfull' ? 'Kırmızı akrebi ' + q.h + LOC[q.h] + ' bırak!' : 'Önce mavi yelkovanı 6' + LOC[6] + ' bırak!');
      return;
    }
    if (q.kind === 'match') {
      face.innerHTML = '';
      face.className = 'clk-face dig-only';
      info.innerHTML = '<div class="dig big">' + timeText(q.answer) + '</div><div class="clk-words">' + timeWords(q.answer) + '</div>';
      say('Aynı saati gösteren saati bul!');
      return;
    }
    face.innerHTML = clockSVG(q.h, q.m);
    if (q.kind === 'later') {
      info.innerHTML = '<div class="clk-prompt">Saat ' + q.h + '.<br><b>' + q.k + ' saat sonra</b> saat kaç?</div><div class="eq"><span class="box">?</span></div>';
      say('Akrep ' + q.k + ' sayı ilerler!');
    } else {
      info.innerHTML = '<div class="clk-prompt">Saat kaç?</div><div class="eq"><span class="box">?</span></div>';
      say(q.m === 30 ? 'Yelkovan 6' + LOC[6] + ': buçuk!' : pick(['Kısa kırmızı ibre akrep!', 'Saat kaç?']));
    }
    q.onRight = function () {
      if (q.kind === 'later') setHands(face, hourNext(q.h, q.k), 0);
    };
  }

  // Akrep ve yelkovanı sürükleme (dokunma + fare). Dış halka: yelkovan, iç: akrep.
  function attachClockDrag(face, q) {
    var svg = face.querySelector('svg'), hand = null;
    function point(e) {
      var t = e.touches && e.touches.length ? e.touches[0] : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : e);
      var r = svg.getBoundingClientRect();
      var x = t.clientX - (r.left + r.width / 2), y = t.clientY - (r.top + r.height / 2);
      return { ang: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, rad: Math.sqrt(x * x + y * y) / (r.width / 2) };
    }
    function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
    function choose(p) {
      if (q.kind === 'setfull') return 'h';
      var ha = (G.ch % 12) * 30 + G.cm * 0.5, ma = G.cm * 6;
      // Kısa akrep içte, uzun yelkovan dışta: önce uzaklığa bak, arada kalırsa yakın ibreyi seç
      if (p.rad < 0.45) return 'h';
      if (p.rad > 0.6) return 'm';
      return angDiff(p.ang, ha) <= angDiff(p.ang, ma) ? 'h' : 'm';
    }
    function apply(p) {
      if (hand === 'm') {
        G.cm = (Math.round(p.ang / 180) % 2) * 30;
      } else {
        var h = Math.round((p.ang - G.cm * 0.5) / 30);
        h = ((h % 12) + 12) % 12;
        G.ch = h === 0 ? 12 : h;
      }
      setHands(face, G.ch, G.cm);
    }
    function down(e) {
      if (G.locked) return;
      if (e.preventDefault) e.preventDefault();
      var p = point(e);
      hand = choose(p);
      face.className = 'clk-face live drag-' + hand;
      var before = G.ch * 100 + G.cm;
      apply(p);
      if (G.ch * 100 + G.cm !== before) Snd.tone(hand === 'm' ? 660 : 440, 0, 0.05, 'triangle', 0.12);
    }
    function move(e) {
      if (!hand) return;
      if (e.preventDefault) e.preventDefault();
      var before = G.ch * 100 + G.cm;
      apply(point(e));
      if (G.ch * 100 + G.cm !== before) Snd.tone(hand === 'm' ? 660 : 440, 0, 0.05, 'triangle', 0.12);
    }
    function up() {
      if (!hand) return;
      hand = null;
      face.className = 'clk-face live';
    }
    face.addEventListener('touchstart', down, false);
    face.addEventListener('touchmove', move, false);
    face.addEventListener('touchend', up, false);
    face.addEventListener('mousedown', down, false);
    document.addEventListener('mousemove', move, false);
    document.addEventListener('mouseup', up, false);
    // Soru değişince belge dinleyicilerini bırak
    var qid = G.qid;
    var cleanup = setInterval(function () {
      if (!G || G.qid !== qid || current !== 'play') {
        document.removeEventListener('mousemove', move, false);
        document.removeEventListener('mouseup', up, false);
        clearInterval(cleanup);
      }
    }, 1000);
  }

  function buildClockControls(box, q) {
    var ok = el('button', 'ch pvb pvok', '<span class="tick"></span><span>Tamam</span>');
    ok.style.webkitAnimationDelay = ok.style.animationDelay = '.1s';
    ok.addEventListener('click', function () { answer(ok, G.ch * 100 + G.cm); });
    box.appendChild(ok);
  }

  function clockSetHint() {
    var q = G.cur;
    markNumber(q.h, true);
    if (G.cm !== q.m) { markNumber(6, q.m === 30); markNumber(12, q.m === 0); }
    if (G.cm !== q.m) return q.m === 30 ? 'Buçukta mavi yelkovan 6' + LOC[6] + ' olur!' : 'Tam saatte mavi yelkovan 12' + LOC[12] + ' olur!';
    if (q.m === 30) return 'Akrep ' + q.h + ' ile ' + hourNext(q.h, 1) + ' arasında olmalı!';
    return 'Kırmızı akrep ' + q.h + LOC[q.h] + ' olmalı!';
  }
  function clockHint(val) {
    var q = G.cur;
    if (q.kind === 'match') {
      return q.m === 30 ? 'Buçukta yelkovan 6' + LOC[6] + ' olur!' : 'Tam saatte yelkovan 12' + LOC[12] + ' olur!';
    }
    if (q.kind === 'later') {
      markNumber(q.h, true);
      return q.h + ABL[q.h] + ' ' + q.k + ' sayı ilerle!';
    }
    if (q.m === 30) {
      markNumber(q.h, true); markNumber(hourNext(q.h, 1), true);
      return 'Akrep ' + q.h + ' ile ' + hourNext(q.h, 1) + ' arasında: ' + q.h + ' buçuk!';
    }
    markNumber(q.h, true);
    return 'Kısa kırmızı akrep ' + q.h + LOC[q.h] + '!';
  }

  /* ------------------------------------------------------------------ */
  /* Hece Treni                                                          */
  /* ------------------------------------------------------------------ */
  /* ---------- Hece Treni: kelimeler ve resimler (SVG, viewBox 0 0 100 100) ---------- */
  var WORDS = [
    { id: 'top', s: ['top'] }, { id: 'mum', s: ['mum'] }, { id: 'ev', s: ['ev'] },
    { id: 'muz', s: ['muz'] }, { id: 'kus', s: ['kuş'] }, { id: 'ay', s: ['ay'] },
    { id: 'kale', s: ['ka', 'le'] }, { id: 'lale', s: ['la', 'le'] }, { id: 'inek', s: ['i', 'nek'] },
    { id: 'elma', s: ['el', 'ma'] }, { id: 'kedi', s: ['ke', 'di'] }, { id: 'kalem', s: ['ka', 'lem'] },
    { id: 'kutu', s: ['ku', 'tu'] }, { id: 'utu', s: ['ü', 'tü'] }, { id: 'balon', s: ['ba', 'lon'] },
    { id: 'balik', s: ['ba', 'lık'] }, { id: 'kitap', s: ['ki', 'tap'] }, { id: 'masa', s: ['ma', 'sa'] },
    { id: 'saat', s: ['sa', 'at'] }, { id: 'gunes', s: ['gü', 'neş'] }, { id: 'bulut', s: ['bu', 'lut'] },
    { id: 'yildiz', s: ['yıl', 'dız'] }, { id: 'cicek', s: ['çi', 'çek'] }, { id: 'agac', s: ['a', 'ğaç'] },
    { id: 'gemi', s: ['ge', 'mi'] }, { id: 'karpuz', s: ['kar', 'puz'] }, { id: 'cilek', s: ['çi', 'lek'] },
    { id: 'ari', s: ['a', 'rı'] }, { id: 'kapi', s: ['ka', 'pı'] },
    { id: 'araba', s: ['a', 'ra', 'ba'] }, { id: 'semsiye', s: ['şem', 'si', 'ye'] },
    { id: 'yumurta', s: ['yu', 'mur', 'ta'] }, { id: 'kelebek', s: ['ke', 'le', 'bek'] },
    { id: 'telefon', s: ['te', 'le', 'fon'] }, { id: 'ananas', s: ['a', 'na', 'nas'] },
    { id: 'patates', s: ['pa', 'ta', 'tes'] }, { id: 'kaplumbaga', s: ['kap', 'lum', 'ba', 'ğa'] }
  ];
  var WORD = {};
  for (var wi = 0; wi < WORDS.length; wi++) { WORDS[wi].w = WORDS[wi].s.join(''); WORD[WORDS[wi].id] = WORDS[wi]; }

  var K = '#2b2d42';
  var PIC = {
    top: '<circle cx="50" cy="52" r="36" fill="#ef476f"/><path d="M15 46 Q50 24 85 46" stroke="#fff" stroke-width="7" fill="none"/><path d="M17 64 Q50 84 83 64" stroke="#fff" stroke-width="7" fill="none"/><ellipse cx="36" cy="36" rx="8" ry="5" fill="#fff" opacity=".5"/>',
    mum: '<rect x="38" y="42" width="24" height="48" rx="3" fill="#fff3c4" stroke="#e0a800" stroke-width="3"/><line x1="50" y1="42" x2="50" y2="33" stroke="' + K + '" stroke-width="3"/><path d="M50 8 Q66 26 50 34 Q34 26 50 8Z" fill="#ff8a3d"/><path d="M50 18 Q58 28 50 32 Q42 28 50 18Z" fill="#ffd23f"/>',
    ev: '<rect x="22" y="48" width="56" height="40" fill="#ffd23f"/><polygon points="12,50 50,16 88,50" fill="#ef476f"/><rect x="44" y="62" width="14" height="26" fill="#8b5a2b"/><rect x="28" y="56" width="12" height="12" fill="#bfe8ff" stroke="' + K + '" stroke-width="2"/><rect x="64" y="56" width="10" height="12" fill="#bfe8ff" stroke="' + K + '" stroke-width="2"/>',
    muz: '<path d="M22 24 Q24 76 84 72 Q90 66 82 62 Q40 62 34 22Z" fill="#ffd23f" stroke="#e0a800" stroke-width="3"/><rect x="24" y="16" width="8" height="10" rx="2" fill="#8b5a2b"/>',
    kus: '<ellipse cx="46" cy="58" rx="28" ry="20" fill="#3a86ff"/><polygon points="20,52 4,40 8,66" fill="#1f63cf"/><circle cx="70" cy="40" r="15" fill="#3a86ff"/><circle cx="74" cy="37" r="4" fill="#fff"/><circle cx="75" cy="37" r="2" fill="' + K + '"/><polygon points="84,40 96,44 84,48" fill="#ff8a3d"/><ellipse cx="42" cy="56" rx="15" ry="9" fill="#1f63cf"/><line x1="42" y1="78" x2="40" y2="90" stroke="#ff8a3d" stroke-width="3"/><line x1="54" y1="78" x2="56" y2="90" stroke="#ff8a3d" stroke-width="3"/>',
    ay: '<path d="M58 10 A40 40 0 1 0 90 72 A32 32 0 1 1 58 10Z" fill="#ffd23f" stroke="#e0a800" stroke-width="3"/>',
    kale: '<rect x="20" y="44" width="60" height="44" fill="#b8bfcc"/><rect x="10" y="30" width="20" height="58" fill="#9aa3b5"/><rect x="70" y="30" width="20" height="58" fill="#9aa3b5"/><rect x="10" y="22" width="6" height="9" fill="#9aa3b5"/><rect x="17" y="22" width="6" height="9" fill="#9aa3b5"/><rect x="24" y="22" width="6" height="9" fill="#9aa3b5"/><rect x="70" y="22" width="6" height="9" fill="#9aa3b5"/><rect x="77" y="22" width="6" height="9" fill="#9aa3b5"/><rect x="84" y="22" width="6" height="9" fill="#9aa3b5"/><path d="M41 88 V68 A9 9 0 0 1 59 68 V88Z" fill="#6b4226"/><line x1="50" y1="44" x2="50" y2="16" stroke="' + K + '" stroke-width="3"/><polygon points="50,16 68,22 50,28" fill="#ef476f"/>',
    lale: '<line x1="50" y1="50" x2="50" y2="94" stroke="#3bb273" stroke-width="5"/><path d="M50 84 Q28 74 26 52 Q44 62 50 78Z" fill="#3bb273"/><path d="M50 84 Q72 74 74 52 Q56 62 50 78Z" fill="#3bb273"/><path d="M32 22 L32 44 Q50 62 68 44 L68 22 L59 34 L50 18 L41 34Z" fill="#ef476f"/>',
    inek: '<rect x="12" y="42" width="60" height="34" rx="14" fill="#fff" stroke="' + K + '" stroke-width="3"/><ellipse cx="30" cy="54" rx="9" ry="7" fill="' + K + '"/><ellipse cx="52" cy="64" rx="7" ry="6" fill="' + K + '"/><rect x="18" y="74" width="8" height="16" fill="#fff" stroke="' + K + '" stroke-width="3"/><rect x="54" y="74" width="8" height="16" fill="#fff" stroke="' + K + '" stroke-width="3"/><rect x="64" y="24" width="28" height="34" rx="12" fill="#fff" stroke="' + K + '" stroke-width="3"/><ellipse cx="78" cy="52" rx="13" ry="8" fill="#ffb3c1"/><circle cx="72" cy="36" r="3" fill="' + K + '"/><circle cx="85" cy="36" r="3" fill="' + K + '"/><path d="M66 26 L60 16 M90 26 L96 16" stroke="#c9a26b" stroke-width="4" stroke-linecap="round"/>',
    elma: '<path d="M50 30 C30 16 8 28 12 54 C16 82 36 92 50 86 C64 92 84 82 88 54 C92 28 70 16 50 30Z" fill="#ef476f"/><path d="M50 30 L54 12" stroke="#6b4226" stroke-width="4" stroke-linecap="round"/><path d="M55 18 C64 8 76 10 78 14 C70 22 60 22 55 18Z" fill="#3bb273"/><ellipse cx="30" cy="46" rx="6" ry="10" fill="#fff" opacity=".4"/>',
    kedi: '<polygon points="22,42 20,10 46,30" fill="#ff8a3d"/><polygon points="78,42 80,10 54,30" fill="#ff8a3d"/><circle cx="50" cy="56" r="32" fill="#ff8a3d"/><ellipse cx="38" cy="52" rx="5" ry="7" fill="' + K + '"/><ellipse cx="62" cy="52" rx="5" ry="7" fill="' + K + '"/><polygon points="45,64 55,64 50,70" fill="#ef476f"/><path d="M50 70 Q44 78 38 74 M50 70 Q56 78 62 74" stroke="' + K + '" stroke-width="2.5" fill="none"/><path d="M30 66 L8 62 M30 70 L8 74 M70 66 L92 62 M70 70 L92 74" stroke="' + K + '" stroke-width="2"/>',
    kalem: '<g transform="rotate(-35 50 50)"><rect x="8" y="42" width="12" height="16" fill="#ef476f"/><rect x="20" y="42" width="5" height="16" fill="#b8bfcc"/><rect x="25" y="42" width="50" height="16" fill="#ffd23f"/><polygon points="75,42 94,50 75,58" fill="#f2c49b"/><polygon points="88,47 94,50 88,53" fill="' + K + '"/></g>',
    kutu: '<polygon points="16,40 30,24 86,24 72,40" fill="#e0a96d"/><rect x="16" y="40" width="56" height="46" fill="#c98b4d"/><polygon points="72,40 86,24 86,70 72,86" fill="#a8703a"/><rect x="40" y="40" width="8" height="46" fill="#e8c597"/>',
    utu: '<path d="M12 76 L88 76 Q86 44 58 38 L30 38 Q14 48 12 76Z" fill="#3a86ff"/><rect x="10" y="76" width="80" height="9" rx="2" fill="#b8bfcc"/><path d="M34 38 Q34 22 50 22 L68 22 Q74 22 72 38" stroke="' + K + '" stroke-width="6" fill="none"/><circle cx="40" cy="58" r="5" fill="#ffd23f"/>',
    balon: '<path d="M50 8 C28 8 18 26 18 40 C18 62 38 76 50 78 C62 76 82 62 82 40 C82 26 72 8 50 8Z" fill="#8e7dff"/><polygon points="46,78 50,84 54,78" fill="#8e7dff"/><path d="M50 84 Q42 90 50 94 Q58 98 50 100" stroke="#7a7a8c" stroke-width="2" fill="none"/><ellipse cx="36" cy="30" rx="6" ry="11" fill="#fff" opacity=".45"/>',
    balik: '<polygon points="72,50 94,30 94,70" fill="#e0661c"/><ellipse cx="44" cy="50" rx="32" ry="22" fill="#ff8a3d"/><path d="M40 30 Q50 20 60 30" fill="#e0661c"/><circle cx="26" cy="45" r="6" fill="#fff"/><circle cx="25" cy="45" r="3" fill="' + K + '"/><path d="M48 40 Q56 50 48 60" stroke="#e0661c" stroke-width="3" fill="none"/>',
    kitap: '<rect x="26" y="18" width="56" height="68" rx="3" fill="#26874f"/><rect x="20" y="14" width="56" height="68" rx="3" fill="#3bb273"/><rect x="22" y="80" width="56" height="7" fill="#fff" stroke="#c9cfdc" stroke-width="1"/><rect x="30" y="28" width="36" height="12" rx="2" fill="#fff" opacity=".8"/>',
    masa: '<rect x="8" y="38" width="84" height="11" rx="3" fill="#c98b4d"/><rect x="15" y="49" width="9" height="40" fill="#a8703a"/><rect x="76" y="49" width="9" height="40" fill="#a8703a"/><rect x="40" y="26" width="20" height="12" rx="2" fill="#ef476f"/>',
    gunes: '<g stroke="#ff8a3d" stroke-width="6" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="94"/><line x1="6" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="94" y2="50"/><line x1="19" y1="19" x2="29" y2="29"/><line x1="71" y1="71" x2="81" y2="81"/><line x1="19" y1="81" x2="29" y2="71"/><line x1="71" y1="29" x2="81" y2="19"/></g><circle cx="50" cy="50" r="24" fill="#ffd23f"/>',
    bulut: '<path d="M24 72 A16 16 0 0 1 26 40 A22 22 0 0 1 66 32 A18 18 0 0 1 80 70Z" fill="#fff" stroke="#9fb3cc" stroke-width="4" stroke-linejoin="round"/>',
    yildiz: '<path d="M50 6 L62 36 L94 38 L69 58 L77 90 L50 72 L23 90 L31 58 L6 38 L38 36Z" fill="#ffd23f" stroke="#e0a800" stroke-width="3" stroke-linejoin="round"/>',
    cicek: '<line x1="50" y1="56" x2="50" y2="94" stroke="#3bb273" stroke-width="5"/><path d="M50 84 Q30 78 30 64 Q44 68 50 80Z" fill="#3bb273"/><circle cx="50" cy="22" r="13" fill="#ef476f"/><circle cx="67" cy="34" r="13" fill="#ef476f"/><circle cx="61" cy="54" r="13" fill="#ef476f"/><circle cx="39" cy="54" r="13" fill="#ef476f"/><circle cx="33" cy="34" r="13" fill="#ef476f"/><circle cx="50" cy="40" r="11" fill="#ffd23f"/>',
    agac: '<rect x="43" y="56" width="14" height="36" fill="#8b5a2b"/><circle cx="50" cy="34" r="24" fill="#3bb273"/><circle cx="30" cy="50" r="16" fill="#3bb273"/><circle cx="70" cy="50" r="16" fill="#3bb273"/><circle cx="42" cy="28" r="5" fill="#ef476f"/><circle cx="62" cy="44" r="5" fill="#ef476f"/>',
    gemi: '<rect x="50" y="22" width="10" height="20" fill="' + K + '"/><rect x="32" y="40" width="36" height="20" rx="2" fill="#fff" stroke="' + K + '" stroke-width="3"/><circle cx="42" cy="50" r="4" fill="#3a86ff"/><circle cx="56" cy="50" r="4" fill="#3a86ff"/><path d="M8 60 L92 60 L78 82 L22 82Z" fill="#ef476f"/><path d="M4 90 Q14 84 24 90 Q34 96 44 90 Q54 84 64 90 Q74 96 84 90 Q90 86 96 90" stroke="#3a86ff" stroke-width="4" fill="none"/>',
    karpuz: '<path d="M8 36 A42 42 0 0 0 92 36Z" fill="#3bb273"/><path d="M15 36 A35 35 0 0 0 85 36Z" fill="#ef476f"/><ellipse cx="36" cy="48" rx="2.5" ry="4" fill="' + K + '"/><ellipse cx="50" cy="56" rx="2.5" ry="4" fill="' + K + '"/><ellipse cx="64" cy="48" rx="2.5" ry="4" fill="' + K + '"/><ellipse cx="44" cy="40" rx="2.5" ry="4" fill="' + K + '"/><ellipse cx="58" cy="40" rx="2.5" ry="4" fill="' + K + '"/>',
    cilek: '<path d="M50 90 C24 72 16 46 28 34 C38 26 62 26 72 34 C84 46 76 72 50 90Z" fill="#ef476f"/><polygon points="30,30 40,18 50,28 60,18 70,30 50,36" fill="#3bb273"/><circle cx="40" cy="46" r="2.5" fill="#ffd23f"/><circle cx="58" cy="46" r="2.5" fill="#ffd23f"/><circle cx="48" cy="58" r="2.5" fill="#ffd23f"/><circle cx="36" cy="62" r="2.5" fill="#ffd23f"/><circle cx="62" cy="62" r="2.5" fill="#ffd23f"/><circle cx="50" cy="74" r="2.5" fill="#ffd23f"/>',
    ari: '<ellipse cx="38" cy="34" rx="14" ry="18" fill="#e6f6ff" stroke="#9fb3cc" stroke-width="2"/><ellipse cx="60" cy="32" rx="14" ry="18" fill="#e6f6ff" stroke="#9fb3cc" stroke-width="2"/><ellipse cx="50" cy="60" rx="30" ry="20" fill="#ffd23f"/><rect x="40" y="41" width="7" height="38" fill="' + K + '"/><rect x="56" y="42" width="7" height="36" fill="' + K + '"/><circle cx="22" cy="58" r="12" fill="' + K + '"/><circle cx="19" cy="55" r="3" fill="#fff"/><polygon points="80,58 92,60 80,64" fill="' + K + '"/>',
    kapi: '<rect x="26" y="8" width="48" height="86" rx="3" fill="#a8703a"/><rect x="33" y="16" width="34" height="30" rx="2" fill="#c98b4d"/><rect x="33" y="54" width="34" height="32" rx="2" fill="#c98b4d"/><circle cx="64" cy="52" r="4" fill="#ffd23f"/>',
    araba: '<path d="M8 66 L12 48 L28 46 L40 28 L66 28 L80 46 L92 50 L92 66Z" fill="#ef476f"/><polygon points="43,32 52,32 52,46 33,46" fill="#bfe8ff"/><polygon points="56,32 64,32 75,46 56,46" fill="#bfe8ff"/><circle cx="30" cy="68" r="11" fill="' + K + '"/><circle cx="30" cy="68" r="4" fill="#b8bfcc"/><circle cx="72" cy="68" r="11" fill="' + K + '"/><circle cx="72" cy="68" r="4" fill="#b8bfcc"/><rect x="86" y="52" width="6" height="5" fill="#ffd23f"/>',
    semsiye: '<path d="M50 50 V82 Q50 92 40 90" stroke="' + K + '" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M8 50 A42 38 0 0 1 92 50 Q82 42 71 50 Q61 42 50 50 Q39 42 29 50 Q18 42 8 50Z" fill="#8e7dff"/><path d="M50 12 Q36 30 29 50 M50 12 Q64 30 71 50" stroke="#6a57e0" stroke-width="2" fill="none"/>',
    yumurta: '<path d="M50 10 C70 10 82 44 82 62 C82 80 68 92 50 92 C32 92 18 80 18 62 C18 44 30 10 50 10Z" fill="#fff6e6" stroke="#e0c9a6" stroke-width="4"/><ellipse cx="38" cy="40" rx="6" ry="10" fill="#fff"/>',
    kelebek: '<circle cx="32" cy="36" r="18" fill="#ff8a3d"/><circle cx="68" cy="36" r="18" fill="#ff8a3d"/><circle cx="34" cy="66" r="13" fill="#ffd23f"/><circle cx="66" cy="66" r="13" fill="#ffd23f"/><circle cx="30" cy="34" r="6" fill="#fff" opacity=".7"/><circle cx="70" cy="34" r="6" fill="#fff" opacity=".7"/><ellipse cx="50" cy="52" rx="5" ry="26" fill="' + K + '"/><path d="M48 28 Q42 14 34 12 M52 28 Q58 14 66 12" stroke="' + K + '" stroke-width="2.5" fill="none"/>',
    telefon: '<rect x="28" y="8" width="44" height="84" rx="9" fill="' + K + '"/><rect x="33" y="17" width="34" height="62" rx="2" fill="#3a86ff"/><circle cx="50" cy="85" r="3.5" fill="#6b6f8a"/><rect x="38" y="26" width="9" height="9" rx="2" fill="#ffd23f"/><rect x="53" y="26" width="9" height="9" rx="2" fill="#3bb273"/><rect x="38" y="40" width="9" height="9" rx="2" fill="#ef476f"/><rect x="53" y="40" width="9" height="9" rx="2" fill="#fff"/>',
    ananas: '<polygon points="50,6 44,28 36,14 40,34 28,24 38,40 62,40 72,24 60,34 64,14 56,28" fill="#3bb273"/><ellipse cx="50" cy="64" rx="24" ry="30" fill="#ffd23f"/><path d="M32 46 L68 82 M28 62 L58 92 M42 38 L74 70 M68 46 L32 82 M72 62 L42 92 M58 38 L26 70" stroke="#e0a800" stroke-width="2.5"/>',
    patates: '<path d="M20 52 C16 34 36 22 56 26 C78 30 90 44 84 62 C78 80 52 84 36 78 C24 74 22 64 20 52Z" fill="#c9a26b" stroke="#a8803f" stroke-width="3"/><circle cx="40" cy="44" r="2.5" fill="#8b6a35"/><circle cx="62" cy="50" r="2.5" fill="#8b6a35"/><circle cx="50" cy="64" r="2.5" fill="#8b6a35"/><circle cx="70" cy="40" r="2" fill="#8b6a35"/>',
    kaplumbaga: '<ellipse cx="26" cy="74" rx="8" ry="6" fill="#8bd18b"/><ellipse cx="70" cy="74" rx="8" ry="6" fill="#8bd18b"/><polygon points="12,64 4,62 12,58" fill="#8bd18b"/><circle cx="86" cy="58" r="10" fill="#8bd18b"/><circle cx="89" cy="55" r="2.5" fill="' + K + '"/><path d="M14 66 A34 32 0 0 1 82 66Z" fill="#3bb273"/><path d="M30 66 L36 46 L48 40 L60 46 L66 66 M36 46 L24 56 M60 46 L72 56 M48 40 L48 34" stroke="#26874f" stroke-width="3" fill="none"/>',
    saat: '<circle cx="50" cy="50" r="42" fill="' + K + '"/><circle cx="50" cy="50" r="36" fill="#fff"/><line x1="50" y1="50" x2="50" y2="22" stroke="#3a86ff" stroke-width="5" stroke-linecap="round"/><line x1="50" y1="50" x2="68" y2="50" stroke="#ef476f" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="50" r="5" fill="' + K + '"/><g fill="' + K + '"><rect x="48" y="16" width="4" height="7"/><rect x="48" y="77" width="4" height="7"/><rect x="16" y="48" width="7" height="4"/><rect x="77" y="48" width="7" height="4"/></g>'
  };
  function picSVG(id) { return '<svg class="pic" data-id="' + id + '" viewBox="0 0 100 100">' + PIC[id] + '</svg>'; }

  function wordsWith(syl) {
    var out = [];
    for (var i = 0; i < WORDS.length; i++) if (syl.indexOf(WORDS[i].s.length) !== -1) out.push(WORDS[i]);
    return out;
  }
  function allSyllables() {
    var out = [];
    for (var i = 0; i < WORDS.length; i++) for (var j = 0; j < WORDS[i].s.length; j++) if (out.indexOf(WORDS[i].s[j]) === -1) out.push(WORDS[i].s[j]);
    return out;
  }
  var ALL_SYL = allSyllables();
  // Benzer heceler önce (aynı harfle başlayan), sonra rastgele
  function sylDistractors(word, n, exclude) {
    var near = [], far = [];
    var first = {};
    for (var i = 0; i < word.s.length; i++) first[word.s[i].charAt(0)] = true;
    var pool = shuffle(ALL_SYL.slice());
    for (var j = 0; j < pool.length; j++) {
      var sy = pool[j];
      if (word.s.indexOf(sy) !== -1 || (exclude && exclude.indexOf(sy) !== -1)) continue;
      if (first[sy.charAt(0)]) near.push(sy); else far.push(sy);
    }
    return near.concat(far).slice(0, n);
  }
  function similarWords(word, n) {
    var near = [], far = [], pool = shuffle(WORDS.slice());
    for (var i = 0; i < pool.length; i++) {
      var w = pool[i];
      if (w.id === word.id) continue;
      if (w.s[0] === word.s[0] || w.w.charAt(0) === word.w.charAt(0)) near.push(w); else far.push(w);
    }
    return near.slice(0, 1).concat(far).slice(0, n);
  }

  function makeHeceQuestion(lv, seen) {
    var kind = lv.kind, extra = lv.extra || 1, split = !!lv.split;
    if (kind === 'mix') {
      kind = pick(['read', 'build', 'build', 'missing', 'count']);
      extra = 2;
    }
    var syl = lv.syl;
    if (kind === 'missing') syl = [2, 3, 4];
    if (kind === 'build' && lv.kind === 'mix') syl = [2, 3, 4];
    if (kind === 'read' && lv.kind === 'mix') syl = [2, 3, 4];
    var list = wordsWith(syl), w, tries = 0;
    do { w = pick(list); tries++; } while (seen[w.id] && tries < 60);
    seen[w.id] = true;
    var q = { kind: kind, word: w, split: split };
    if (kind === 'build') {
      q.build = true; q.ctrl = 'hece'; q.keepBtn = true;
      q.answer = w.w;
      q.cards = shuffle(w.s.concat(sylDistractors(w, extra)));
      q.opts = [];
    } else if (kind === 'missing') {
      q.hole = rnd(0, w.s.length - 1);
      q.answer = w.s[q.hole];
      q.opts = shuffle([q.answer].concat(sylDistractors(w, 2)));
      q.optClass = 'syl';
    } else if (kind === 'count') {
      var n = w.s.length;
      q.answer = n;
      var o = [n, n + 1, n - 1, n + 2];
      var c = [];
      for (var i = 0; i < o.length && c.length < 3; i++) if (o[i] >= 1 && o[i] <= 5 && c.indexOf(o[i]) === -1) c.push(o[i]);
      q.opts = shuffle(c);
    } else {
      q.answer = w.id;
      var ws = similarWords(w, 2);
      q.opts = shuffle([w.id, ws[0].id, ws[1].id]);
      q.optClass = 'pic';
      q.optHTML = function (id) { return picSVG(id); };
    }
    return q;
  }

  function sylHTML(s, hole) {
    var h = '';
    for (var i = 0; i < s.length; i++) {
      if (i) h += '<i class="dash">-</i>';
      h += '<b class="sy sy' + (i % 2) + '">' + (i === hole ? '?' : s[i]) + '</b>';
    }
    return h;
  }

  var LOCO = '<svg viewBox="0 0 80 64"><rect x="4" y="20" width="44" height="30" rx="4" fill="#ef476f"/><rect x="40" y="6" width="30" height="44" rx="4" fill="#ef476f"/><rect x="46" y="12" width="18" height="14" rx="2" fill="#bfe8ff"/><rect x="10" y="8" width="10" height="14" fill="#2b2d42"/><rect x="0" y="46" width="76" height="6" rx="2" fill="#2b2d42"/><circle cx="18" cy="54" r="8" fill="#2b2d42"/><circle cx="18" cy="54" r="3" fill="#b8bfcc"/><circle cx="56" cy="54" r="8" fill="#2b2d42"/><circle cx="56" cy="54" r="3" fill="#b8bfcc"/></svg>';
  function trainHTML(n, fill, hole) {
    var h = '<div class="train" id="train"><div class="wagons">';
    for (var i = 0; i < n; i++) {
      var txt = fill ? fill[i] : '';
      var cls = 'wg' + (i === hole ? ' hole' : '') + (txt ? ' full' : '');
      h += '<div class="' + cls + '" data-i="' + i + '"><span>' + (i === hole ? '?' : txt) + '</span></div>';
    }
    h += '</div><div class="loco">' + LOCO + '</div></div>';
    return h;
  }

  function buildHeceQuestion(stage, q) {
    G.countReady = true;
    var w = q.word;
    if (q.kind === 'read') {
      var word = el('div', 'hc-word' + (q.split ? ' split' : ''), q.split ? sylHTML(w.s) : w.w);
      stage.appendChild(word);
      say(q.split ? 'Heceleri oku, resmi bul!' : 'Kelimeyi oku, resmi bul!');
      return;
    }
    var row = el('div', 'hc-row');
    row.appendChild(el('div', 'hc-pic', picSVG(w.id)));
    stage.appendChild(row);
    if (q.kind === 'count') {
      row.appendChild(el('div', 'hc-side', '<div class="hc-word">' + w.w + '</div><div class="hc-q">Kaç hece var?</div>'));
      say('El çırparak hecele!');
      return;
    }
    if (q.kind === 'missing') {
      var fill = w.s.slice();
      row.appendChild(el('div', 'hc-side', trainHTML(w.s.length, fill, q.hole)));
      say('Hangi vagon eksik?');
      q.onRight = function () {
        var hole = $('train').querySelector('.hole');
        hole.className = 'wg full ok';
        hole.innerHTML = '<span>' + q.answer + '</span>';
        heceLeave();
      };
      return;
    }
    // build
    G.hw = []; // vagonlardaki kart indeksleri
    for (var i = 0; i < w.s.length; i++) G.hw.push(-1);
    row.appendChild(el('div', 'hc-side', trainHTML(w.s.length)));
    say(w.s.length + ' vagonu doldur!');
    var wagons = $('train').querySelectorAll('.wg');
    for (var k = 0; k < wagons.length; k++) {
      (function (wi) {
        wagons[wi].addEventListener('click', function () {
          if (G.locked || G.hw[wi] < 0) return;
          var ci = G.hw[wi];
          G.hw[wi] = -1;
          var card = $('choices').querySelectorAll('.ch')[ci];
          if (card) card.className = 'ch syl';
          Snd.tone(330, 0, 0.08, 'triangle', 0.15);
          renderTrain();
        });
      })(k);
    }
  }

  function renderTrain() {
    var q = G.cur, wagons = $('train').querySelectorAll('.wg');
    for (var i = 0; i < wagons.length; i++) {
      var ci = G.hw[i];
      wagons[i].className = 'wg' + (ci >= 0 ? ' full' : '');
      wagons[i].innerHTML = '<span>' + (ci >= 0 ? q.cards[ci] : '') + '</span>';
    }
  }

  function buildHeceControls(box, q) {
    for (var i = 0; i < q.cards.length; i++) {
      (function (ci) {
        var b = el('button', 'ch syl', q.cards[ci]);
        b.style.webkitAnimationDelay = b.style.animationDelay = (0.06 * ci + 0.1) + 's';
        b.addEventListener('click', function () {
          if (G.locked || b.className.indexOf('used') !== -1) return;
          var slot = G.hw.indexOf(-1);
          if (slot < 0) return;
          G.hw[slot] = ci;
          b.className = 'ch syl used';
          Snd.tone(523 + slot * 60, 0, 0.1, 'triangle', 0.2);
          renderTrain();
          if (G.hw.indexOf(-1) < 0) {
            var made = '';
            for (var k = 0; k < G.hw.length; k++) made += q.cards[G.hw[k]];
            G.locked = true;
            later(function () {
              G.locked = false;
              var tr = $('train');
              if (made === q.answer) { answer(tr, made); heceLeave(); }
              else answer(tr, made);
            }, 250);
          }
        });
        box.appendChild(b);
      })(i);
    }
  }

  // Tren doğru kelimeyle yola çıkar
  function heceLeave() {
    var tr = $('train');
    if (!tr) return;
    var ws = tr.querySelectorAll('.wg');
    for (var i = 0; i < ws.length; i++) ws[i].className += ' ok';
    Snd.tone(392, 0.15, 0.15, 'square', 0.08); Snd.tone(392, 0.35, 0.15, 'square', 0.08);
    later(function () { tr.className = 'train go'; }, 300);
  }

  // Yanlış dizilişte: yanlış vagonlar boşalır, doğrular kalır
  function heceBuildWrong() {
    var q = G.cur, w = q.word, firstWrong = -1;
    var wagons = $('train').querySelectorAll('.wg');
    for (var i = 0; i < G.hw.length; i++) {
      if (q.cards[G.hw[i]] !== w.s[i]) { wagons[i].className = 'wg full bad'; if (firstWrong < 0) firstWrong = i; }
    }
    var qid = G.qid;
    later(function () {
      if (G.qid !== qid) return;
      var cards = $('choices').querySelectorAll('.ch');
      for (var k = 0; k < G.hw.length; k++) {
        if (q.cards[G.hw[k]] !== w.s[k]) { cards[G.hw[k]].className = 'ch syl'; G.hw[k] = -1; }
      }
      renderTrain();
      // ilk boş vagonun doğru hecesini parlat
      var slot = G.hw.indexOf(-1);
      for (var c = 0; c < q.cards.length; c++) {
        if (q.cards[c] === w.s[slot] && cards[c].className.indexOf('used') === -1) { cards[c].className = 'ch syl glow'; break; }
      }
    }, 700);
    return firstWrong === 0 ? 'İlk hece "' + w.s[0] + '" olmalı!' : (firstWrong + 1) + '. vagonu düzelt: "' + w.s[firstWrong] + '"';
  }

  function heceHint(val) {
    var q = G.cur, w = q.word;
    if (q.kind === 'read') {
      var word = $('stage').querySelector('.hc-word');
      if (word && !q.split) { word.className = 'hc-word split'; word.innerHTML = sylHTML(w.s); }
      return 'Hecele: ' + w.s.join('-');
    }
    if (q.kind === 'count') {
      var wd = $('stage').querySelector('.hc-word');
      if (wd) { wd.className = 'hc-word split'; wd.innerHTML = sylHTML(w.s); }
      return w.s.join(' - ') + ': ' + w.s.length + ' hece!';
    }
    return '"' + w.w + '" kelimesini hecele: ' + w.s.join('-');
  }

  /* ------------------------------------------------------------------ */
  /* Büyük mü, küçük mü?                                                 */
  /* ------------------------------------------------------------------ */
  // Ayrılma eki: 7'den, 3'ten, 40'tan ...
  var ABL_ONES = ["'dan", "'den", "'den", "'ten", "'ten", "'ten", "'dan", "'den", "'den", "'dan"];
  var ABL_TENS = ["", "'dan", "'den", "'dan", "'tan", "'den", "'tan", "'ten", "'den", "'dan"];
  function numAbl(n) { return n + (n % 10 || n === 0 ? ABL_ONES[n % 10] : ABL_TENS[n / 10]); }
  // Timsah ağzı: dir 1 = '>' (ağız sola, büyük sayıya açık), -1 = '<'
  function crocSVG(dir) {
    // Arkada kafa ve göz, önde açık ağız (pembe), dişler ve burun delikleri: ağız büyüğe açılır
    return '<svg class="croc" viewBox="0 0 120 80"><g' + (dir < 0 ? ' transform="translate(120 0) scale(-1 1)"' : '') + '>' +
      '<polygon points="90,40 16,12 16,68" fill="#ff8fab"/>' +
      '<path d="M94 32 L14 6 Q4 6 6 15 L88 43 Z" fill="#3bb273" stroke="#26874f" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M94 48 L14 74 Q4 74 6 65 L88 37 Z" fill="#3bb273" stroke="#26874f" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M24 14 L27 21 L31 16 L35 24 L39 19 L43 27 L47 22 L51 30 M24 66 L27 59 L31 64 L35 56 L39 61 L43 53 L47 58 L51 50" stroke="#fff" stroke-width="2.5" fill="none" stroke-linejoin="round"/>' +
      '<circle cx="98" cy="40" r="17" fill="#3bb273" stroke="#26874f" stroke-width="2.5"/>' +
      '<circle cx="100" cy="27" r="9" fill="#3bb273" stroke="#26874f" stroke-width="2.5"/><circle cx="100" cy="27" r="5.5" fill="#fff"/><circle cx="98.5" cy="27" r="3" fill="#2b2d42"/>' +
      '<circle cx="11" cy="9" r="1.8" fill="#26874f"/><circle cx="11" cy="71" r="1.8" fill="#26874f"/>' +
      '</g></svg>';
  }
  function signOf(a, b) { return a > b ? '>' : (a < b ? '<' : '='); }
  function cmpPair(max, eqChance) {
    var a, b;
    if (Math.random() < eqChance) { a = rnd(max > 20 ? 10 : 1, max); return [a, a]; }
    if (max > 20) {
      var r = Math.random();
      if (r < 0.35) {                       // basamakları ters: 47 / 74
        var t = rnd(1, 9), o = rnd(1, 9);
        if (t === o) o = (o % 9) + 1;
        a = t * 10 + o; b = o * 10 + t;
      } else if (r < 0.7) {                 // aynı onluk: 63 / 68
        var tt = rnd(1, 9) * 10;
        a = tt + rnd(0, 9); do { b = tt + rnd(0, 9); } while (b === a);
      } else { a = rnd(10, 99); do { b = rnd(10, 99); } while (b === a); }
    } else {
      a = rnd(1, max); do { b = rnd(Math.max(1, a - 5), Math.min(max, a + 5)); } while (b === a);
    }
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }

  function makeCmpQuestion(lv, seen) {
    var kind = lv.kind, max = lv.max, eq = lv.eq || 0.12;
    if (kind === 'mix') {
      kind = pick(['more', 'less', 'signobj', 'sign', 'sign', 'extreme']);
      if (kind === 'more' || kind === 'less' || kind === 'signobj') max = 10;
    }
    var q = { kind: kind }, key, tries = 0, pr;
    if (kind === 'extreme') {
      var nums;
      do {
        var base = rnd(1, 8) * 10, c = [];
        var cands = shuffle([base + rnd(0, 9), (base % 100) + rnd(0, 9) + 10, rnd(10, 99)]);
        nums = [];
        for (var i = 0; i < cands.length; i++) if (nums.indexOf(cands[i]) === -1 && cands[i] <= 99) nums.push(cands[i]);
        while (nums.length < 3) { var x = rnd(10, 99); if (nums.indexOf(x) === -1) nums.push(x); }
        key = nums.join(',');
        tries++;
      } while (seen[key] && tries < 40);
      seen[key] = true;
      q.big = Math.random() < 0.6;
      q.nums = nums;
      q.answer = q.big ? Math.max.apply(null, nums) : Math.min.apply(null, nums);
      q.opts = shuffle(nums.slice());
      return q;
    }
    var bad;
    do {
      pr = (kind === 'more' || kind === 'less') ? cmpPair(max, 0) : cmpPair(max, eq);
      key = kind + pr.join(',');
      tries++;
      bad = seen[key] || ((kind === 'more' || kind === 'less') && pr[0] === pr[1]) ||
        ((kind === 'more' || kind === 'less' || kind === 'signobj') && Math.abs(pr[0] - pr[1]) > 4);
    } while (bad && tries < 60);
    seen[key] = true;
    q.a = pr[0]; q.b = pr[1];
    if (kind === 'more' || kind === 'less') {
      q.noChoices = true; q.keepBtn = true;
      q.answer = ((kind === 'more') === (q.a > q.b)) ? 'L' : 'R';
      q.item = pick(ITEMS);
      return q;
    }
    q.answer = signOf(q.a, q.b);
    q.opts = ['<', '=', '>'];
    q.optClass = 'sign';
    q.optHTML = function (v) { return v === '=' ? '=' : v === '<' ? '&lt;' : '&gt;'; };
    q.answerText = q.answer === '<' ? '&lt;' : q.answer === '>' ? '&gt;' : '=';
    return q;
  }

  function cmpPlate(n, item, color, side, q) {
    var plate = el('button', 'plate');
    var g = objGroup(n, item, color, side === 'R' ? n : 0);
    g.setAttribute('data-sep', '1');
    plate.appendChild(g);
    plate.addEventListener('click', function (e) {
      // nesneye dokunmak sayar; tabağın boş yerine dokunmak seçer
      var t = e.target;
      while (t && t !== plate) { if (t.className && String(t.className).indexOf('obj') === 0) return; t = t.parentNode; }
      answer(plate, side);
    });
    var pick2 = el('span', 'plate-pick', 'Bunu seç');
    plate.appendChild(pick2);
    return plate;
  }

  function buildCmpQuestion(stage, q) {
    G.countReady = true;
    var pair = pick(PAIRS);
    if (q.kind === 'more' || q.kind === 'less') {
      var row = el('div', 'plates');
      row.appendChild(cmpPlate(q.a, q.item, pair[0], 'L', q));
      row.appendChild(cmpPlate(q.b, q.item, pair[1], 'R', q));
      stage.appendChild(row);
      say(q.kind === 'more' ? 'Hangisinde <b>daha çok</b> var?' : 'Hangisinde <b>daha az</b> var?');
      q.onRight = function () {
        var ps = stage.querySelectorAll('.plate');
        ps[q.answer === 'L' ? 0 : 1].className = 'plate right';
        ps[q.answer === 'L' ? 1 : 0].className = 'plate fade';
      };
      return;
    }
    if (q.kind === 'extreme') {
      stage.appendChild(el('div', 'cmp-ask', q.big ? 'En <b>büyük</b> sayı hangisi?' : 'En <b>küçük</b> sayı hangisi?'));
      say('Önce onluklara bak!');
      return;
    }
    if (q.kind === 'signobj') {
      var item = pick(ITEMS), vis = el('div', 'visual cmp-vis');
      var g1 = objGroup(q.a, item, pair[0], 0), g2 = objGroup(q.b, item, pair[1], q.a);
      g1.setAttribute('data-sep', '1'); g2.setAttribute('data-sep', '1');
      vis.appendChild(g1);
      vis.appendChild(el('div', 'cmp-gap'));
      vis.appendChild(g2);
      stage.appendChild(vis);
    }
    var eq = el('div', 'eq cmp-eq', '<span class="n c1">' + q.a + '</span><span class="box">?</span><span class="n c2">' + q.b + '</span>');
    stage.appendChild(eq);
    say(q.kind === 'signobj' ? 'Timsah ağzını çok olana açar!' : pick(['Timsah ağzını büyüğe açar!', 'Hangi işaret?']));
    q.onRight = function () {
      if (q.answer !== '=') {
        var bx = eq.querySelector('.box');
        bx.innerHTML = crocSVG(q.answer === '>' ? 1 : -1);
        bx.className = 'box done croc-box';
      }
    };
  }

  // Grupları ayrı ayrı numaralar (yanlış cevapta)
  function countGroups() {
    var groups = $('stage').querySelectorAll('.group');
    if (!groups.length || hintTimers.length) return;
    var qid = G.qid, delay = 300;
    for (var g = 0; g < groups.length; g++) {
      var objs = groups[g].querySelectorAll('.obj');
      for (var i = 0; i < objs.length; i++) {
        (function (node, n) {
          hintTimers.push(setTimeout(function () {
            if (!G || G.qid !== qid) return;
            var old = node.querySelector('.num');
            if (old) node.removeChild(old);
            node.setAttribute('data-n', n);
            node.classList.add('counted');
            node.appendChild(el('span', 'num', String(n)));
            Snd.count(n);
          }, delay));
        })(objs[i], i + 1);
        delay += 220;
      }
      delay += 300;
    }
    hintTimers.push(setTimeout(function () { hintTimers = []; }, delay));
  }

  function cmpHint(val) {
    var q = G.cur;
    if (q.kind === 'more' || q.kind === 'less') {
      countGroups();
      return 'Birlikte sayalım: ' + q.a + ' ve ' + q.b;
    }
    if (q.kind === 'extreme') {
      var tens = [];
      for (var i = 0; i < q.nums.length; i++) tens.push(Math.floor(q.nums[i] / 10));
      return 'Onluklar: ' + tens.join(', ') + '. ' + (q.big ? 'En büyük' : 'En küçük') + ' onluğu bul!';
    }
    if (q.kind === 'signobj') countGroups();
    var bx = $('stage').querySelector('.cmp-eq .box');
    if (q.answer === '=') return q.a + ' ile ' + q.b + ' aynı: eşit!';
    if (bx) { bx.innerHTML = crocSVG(q.answer === '>' ? 1 : -1); bx.className = 'box croc-box hint'; }
    var big = Math.max(q.a, q.b), small = Math.min(q.a, q.b);
    if (big > 9 && small > 9 && Math.floor(big / 10) === Math.floor(small / 10)) return 'Onluklar aynı, birliklere bak! ' + big + ' büyük.';
    return big + ', ' + numAbl(small) + ' büyük. Timsahın ağzı büyüğe açılır!';
  }

  /* ------------------------------------------------------------------ */
  /* Örüntü Treni                                                        */
  /* ------------------------------------------------------------------ */
  var PT_COLORS = [
    { c: '#ef476f', n: 'kırmızı' }, { c: '#3a86ff', n: 'mavi' }, { c: '#ffd23f', n: 'sarı' },
    { c: '#3bb273', n: 'yeşil' }, { c: '#8e7dff', n: 'mor' }
  ];
  var PT_SHAPES = {
    circle: { n: 'daire', d: '<circle cx="20" cy="20" r="15"/>' },
    square: { n: 'kare', d: '<rect x="6" y="6" width="28" height="28" rx="4"/>' },
    triangle: { n: 'üçgen', d: '<polygon points="20,4 37,35 3,35"/>' },
    star: { n: 'yıldız', d: '<path d="M20 3l5 11 12 1.5-9 8.5 2.5 12L20 30l-10.5 6 2.5-12-9-8.5L15 14z"/>' },
    heart: { n: 'kalp', d: '<path d="M20 35 C6 25 2 16 8 10 C13 5 19 8 20 12 C21 8 27 5 32 10 C38 16 34 25 20 35Z"/>' }
  };
  var PT_SHAPE_KEYS = ['circle', 'square', 'triangle', 'star', 'heart'];
  function colorName(c) { for (var i = 0; i < PT_COLORS.length; i++) if (PT_COLORS[i].c === c) return PT_COLORS[i].n; return ''; }
  function patKey(it) { return typeof it === 'number' ? it : it.s + '|' + it.c; }
  function patItemSVG(it) {
    return '<svg class="pt" viewBox="0 0 40 40"><g fill="' + it.c + '" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linejoin="round">' + PT_SHAPES[it.s].d + '</g></svg>';
  }
  function itemName(it, kind) {
    if (kind === 'color') return colorName(it.c);
    if (kind === 'shape') return PT_SHAPES[it.s].n;
    return colorName(it.c) + ' ' + PT_SHAPES[it.s].n;
  }
  function fromKey(k) { var p = String(k).split('|'); return { s: p[0], c: p[1] }; }

  function makePatQuestion(lv, seen) {
    var kind = lv.kind;
    if (kind === 'mix') kind = pick(['color', 'shape', 'both', 'hole', 'count', 'count2']);
    var q = { kind: kind }, tries = 0, key;
    if (kind === 'count' || kind === 'count2') {
      var steps = lv.steps || [1, 2, 5, 10], step, start, dir, n = 6, seq;
      do {
        step = pick(steps);
        dir = (kind === 'count2' && Math.random() < 0.45) ? -1 : 1;
        var span = step * (n - 1);
        if (dir > 0) start = step === 1 ? rnd(1, 20) : step * rnd(0, Math.max(0, Math.floor((100 - span) / step)));
        else start = step === 1 ? rnd(n, 20) : step * rnd(Math.ceil(span / step), Math.floor(100 / step));
        if (step >= 5 && start > 100 - span && dir > 0) start = 0;
        seq = [];
        for (var i = 0; i < n; i++) seq.push(start + dir * step * i);
        key = seq.join(',');
        tries++;
      } while ((seen[key] || seq[0] < 0 || seq[n - 1] > 100 || seq[n - 1] < 0) && tries < 60);
      seen[key] = true;
      q.seq = seq; q.step = step; q.dir = dir; q.num = true;
      q.hole = (kind === 'count2' && Math.random() < 0.5) ? rnd(2, n - 2) : n - 1;
      q.answer = seq[q.hole];
      var c = [q.answer], cand = shuffle([q.answer + 1, q.answer - 1, q.answer + step * dir, q.answer - step * dir, q.answer + 10, q.answer + 2]);
      for (var j = 0; j < cand.length && c.length < 3; j++) if (cand[j] >= 0 && cand[j] <= 110 && c.indexOf(cand[j]) === -1) c.push(cand[j]);
      q.opts = shuffle(c);
      return q;
    }
    // renk / şekil / ikisi / eksik vagon
    var units = lv.units || ['AB', 'ABB', 'ABC'];
    var sub = kind === 'hole' ? pick(['color', 'shape', 'both']) : kind;
    var unit, items, seq2;
    do {
      unit = pick(units);
      var letters = unit.replace(/(.)(?=.*\1)/g, '').split('');   // tekil harfler: A, B, C
      var cols = shuffle(PT_COLORS.slice()), shs = shuffle(PT_SHAPE_KEYS.slice());
      var fixedShape = pick(['circle', 'square', 'heart']), fixedColor = pick(PT_COLORS).c;
      items = {};
      for (var k = 0; k < letters.length; k++) {
        if (sub === 'color') items[letters[k]] = { s: fixedShape, c: cols[k].c };
        else if (sub === 'shape') items[letters[k]] = { s: shs[k], c: fixedColor };
        else items[letters[k]] = { s: shs[k], c: cols[k].c };
      }
      // renk+şekil: bir öğe diğerinin rengini ya da şeklini paylaşsın (dikkat gerektirsin)
      if (sub === 'both' && letters.length > 1) items[letters[1]].s = Math.random() < 0.5 ? items[letters[0]].s : items[letters[1]].s;
      if (sub === 'both' && letters.length > 1 && items[letters[1]].s === items[letters[0]].s && items[letters[1]].c === items[letters[0]].c) items[letters[1]].c = cols[3].c;
      seq2 = [];
      var len = 7;
      for (var m = 0; m < len; m++) seq2.push(items[unit.charAt(m % unit.length)]);
      key = sub + unit + patKey(seq2[0]) + patKey(seq2[1]);
      tries++;
    } while (seen[key] && tries < 40);
    seen[key] = true;
    q.sub = sub; q.unit = unit; q.items = items; q.seq = seq2;
    q.hole = kind === 'hole' ? rnd(unit.length, 5) : seq2.length - 1;
    q.answer = patKey(seq2[q.hole]);
    var opts = [q.answer];
    for (var l in items) if (items.hasOwnProperty(l) && opts.indexOf(patKey(items[l])) === -1 && opts.length < 3) opts.push(patKey(items[l]));
    while (opts.length < 3) {
      var ex = sub === 'color' ? { s: seq2[0].s, c: pick(PT_COLORS).c } : sub === 'shape' ? { s: pick(PT_SHAPE_KEYS), c: seq2[0].c } : { s: pick(PT_SHAPE_KEYS), c: pick(PT_COLORS).c };
      if (opts.indexOf(patKey(ex)) === -1) opts.push(patKey(ex));
    }
    q.opts = shuffle(opts);
    q.optClass = 'pic';
    q.optHTML = function (k) { return patItemSVG(fromKey(k)); };
    return q;
  }

  function buildPatQuestion(stage, q) {
    G.countReady = true;
    var h = '<div class="train pt-train" id="train"><div class="wagons">';
    for (var i = 0; i < q.seq.length; i++) {
      var hole = i === q.hole;
      var inner = hole ? '?' : (q.num ? String(q.seq[i]) : patItemSVG(q.seq[i]));
      h += '<div class="wg pt' + (q.num ? ' num' : '') + (hole ? ' hole' : '') + '" data-i="' + i + '"><span>' + inner + '</span></div>';
    }
    h += '</div><div class="loco">' + LOCO + '</div></div>';
    stage.appendChild(el('div', 'pt-wrap', h));
    if (q.num) {
      say(q.hole === q.seq.length - 1 ? 'Sıradaki sayı ne?' : 'Eksik sayı ne?');
    } else {
      say(q.hole === q.seq.length - 1 ? 'Sıradaki vagonda ne var?' : 'Eksik vagonda ne var?');
    }
    q.onRight = function () {
      var hw = $('train').querySelector('.hole');
      hw.className = 'wg pt full' + (q.num ? ' num' : '');
      hw.innerHTML = '<span>' + (q.num ? String(q.answer) : patItemSVG(fromKey(q.answer))) + '</span>';
      heceLeave();
    };
  }

  // İpucu: tekrar eden birimi bantla göster; sayılarda adımı yaz
  function patHint(val) {
    var q = G.cur, ws = $('train').querySelectorAll('.wg');
    if (q.num) {
      for (var i = 1; i < ws.length; i++) {
        if (!ws[i].querySelector('.stp')) ws[i].appendChild(el('i', 'stp', (q.dir > 0 ? '+' : MINUS) + q.step));
      }
      return 'Her vagonda ' + q.step + (q.dir > 0 ? ' artıyor!' : ' azalıyor!');
    }
    var L = q.unit.length;
    for (var j = 0; j < ws.length; j++) {
      ws[j].className = ws[j].className.replace(/ band\d/g, '') + ' band' + (Math.floor(j / L) % 2);
    }
    var names = [];
    for (var k = 0; k < L; k++) names.push(itemName(q.seq[k], q.sub));
    return 'Tekrar eden: ' + names.join(', ') + '!';
  }

  /* ------------------------------------------------------------------ */
  /* Bakkal Mandi (paralar)                                              */
  /* ------------------------------------------------------------------ */
  // Gerçek banknotların kopyası değil; renkleri benzeyen sade çizimler.
  var NOTE_COLORS = { 5: ['#a77bca', '#8a5fb0'], 10: ['#e5626a', '#c2414a'], 20: ['#3bb273', '#26874f'] };
  function moneySVG(v) {
    if (v === 1) {
      return '<svg class="money coin" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#e9c046" stroke="#c9a227" stroke-width="2.5"/>' +
        '<circle cx="20" cy="20" r="13" fill="none" stroke="#c9a227" stroke-width="1.5"/>' +
        '<text x="20" y="22" text-anchor="middle" font-size="15" font-weight="900" fill="#7a5c00" font-family="Roboto, Arial, sans-serif">1</text>' +
        '<text x="20" y="31" text-anchor="middle" font-size="6.5" font-weight="900" fill="#7a5c00" font-family="Roboto, Arial, sans-serif">TL</text></svg>';
    }
    var c = NOTE_COLORS[v];
    return '<svg class="money note" viewBox="0 0 64 34"><rect x="1" y="1" width="62" height="32" rx="3" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="2"/>' +
      '<rect x="5" y="5" width="54" height="24" rx="2" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>' +
      '<circle cx="52" cy="17" r="6.5" fill="#fff" opacity=".35"/>' +
      '<text x="9" y="23" font-size="16" font-weight="900" fill="#fff" font-family="Roboto, Arial, sans-serif">' + v + '</text>' +
      '<text x="' + (v >= 10 ? 29 : 21) + '" y="23" font-size="8" font-weight="900" fill="#fff" font-family="Roboto, Arial, sans-serif">TL</text></svg>';
  }
  function sumOf(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  // Bir tutarı en az parayla ayır (20, 10, 5, 1)
  function breakdown(n, notes) {
    var out = [], ns = (notes || [20, 10, 5, 1]).slice().sort(function (a, b) { return b - a; });
    for (var i = 0; i < ns.length; i++) while (n >= ns[i]) { out.push(ns[i]); n -= ns[i]; }
    return out;
  }
  function liraWords(a) {
    var cnt = {}, order = [], parts = [];
    for (var i = 0; i < a.length; i++) { if (!cnt[a[i]]) { cnt[a[i]] = 0; order.push(a[i]); } cnt[a[i]]++; }
    for (var j = 0; j < order.length; j++) parts.push((cnt[order[j]] > 1 ? cnt[order[j]] + ' tane ' : '') + order[j] + ' lira');
    return parts.join(' + ');
  }
  var SHOP_ITEMS = ['elma', 'muz', 'cilek', 'karpuz', 'ananas', 'patates', 'yumurta', 'top', 'balon', 'kalem', 'kitap', 'mum', 'kutu'];
  var ITEM_NAMES = { elma: 'elma', muz: 'muz', cilek: 'çilek', karpuz: 'karpuz', ananas: 'ananas', patates: 'patates', yumurta: 'yumurta', top: 'top', balon: 'balon', kalem: 'kalem', kitap: 'kitap', mum: 'mum', kutu: 'kutu' };

  function makeShopQuestion(lv, seen) {
    var kind = lv.kind, max = lv.max, notes = lv.notes;
    if (kind === 'mix') {
      kind = pick(['mix10', 'pay', 'afford', 'change', 'pay']);
      max = 20; notes = [1, 5, 10, 20];
    }
    var q = { kind: kind }, key, tries = 0, pieces;
    if (kind === 'coins' || kind === 'mix5' || kind === 'mix10') {
      do {
        if (kind === 'coins') { pieces = []; var n = rnd(2, 10); for (var i = 0; i < n; i++) pieces.push(1); }
        else if (kind === 'mix5') { pieces = [5]; var k = rnd(1, 5); for (var j = 0; j < k; j++) pieces.push(1); if (Math.random() < 0.25) pieces = [5, 5].concat(pieces.slice(1, 1)); }
        else {
          pieces = [];
          var target = rnd(6, 20), opts = [10, 5, 1];
          while (sumOf(pieces) < target) {
            var left = target - sumOf(pieces), cand = [];
            for (var c = 0; c < opts.length; c++) if (opts[c] <= left) cand.push(opts[c]);
            pieces.push(pick(cand));
          }
          pieces.sort(function (a, b) { return b - a; });
          if (pieces.length > 8) { tries++; key = null; continue; }
        }
        key = kind + pieces.join(',');
        tries++;
      } while ((!key || seen[key]) && tries < 60);
      seen[key] = true;
      q.pieces = pieces;
      q.answer = sumOf(pieces);
      var o = [q.answer], cc = shuffle([q.answer + 1, q.answer - 1, pieces.length, q.answer + 5, q.answer - 5]);
      for (var m = 0; m < cc.length && o.length < 3; m++) if (cc[m] > 0 && cc[m] <= 25 && o.indexOf(cc[m]) === -1) o.push(cc[m]);
      q.opts = shuffle(o);
      q.optClass = 'tm';
      q.optHTML = function (v) { return '<span class="tm-big">' + v + '</span><span class="tm-small">lira</span>'; };
      return q;
    }
    if (kind === 'pay') {
      var price;
      do { price = max === 10 ? rnd(3, 10) : rnd(11, 20); q.item = pick(SHOP_ITEMS); key = 'pay' + price + q.item; tries++; } while (seen[key] && tries < 40);
      seen[key] = true;
      q.price = price; q.answer = price; q.build = true; q.ctrl = 'shop'; q.opts = []; q.notes = notes || [1, 5, 10, 20];
      return q;
    }
    if (kind === 'afford') {
      var wallet, items;
      do {
        wallet = rnd(5, 15);
        items = shuffle(SHOP_ITEMS.slice()).slice(0, 3);
        key = 'af' + wallet + items[0];
        tries++;
      } while (seen[key] && tries < 40);
      seen[key] = true;
      q.wallet = breakdown(wallet, [10, 5, 1]);
      q.walletSum = wallet;
      q.prices = {};
      q.prices[items[0]] = Math.max(1, wallet - rnd(0, 3));
      q.prices[items[1]] = wallet + rnd(1, 4);
      q.prices[items[2]] = wallet + rnd(2, 7);
      q.answer = items[0];
      q.opts = shuffle(items.slice());
      q.optClass = 'pic shopitem';
      q.optHTML = function (id) { return picSVG(id) + '<span class="tag">' + q.prices[id] + ' TL</span>'; };
      return q;
    }
    // para üstü
    var p2, note;
    do { p2 = rnd(2, 19); note = p2 < 10 ? pick([10, 20]) : 20; q.item = pick(SHOP_ITEMS); key = 'ch' + p2 + note; tries++; } while (seen[key] && tries < 40);
    seen[key] = true;
    q.price = p2; q.note = note; q.answer = note - p2;
    var co = [q.answer], cand2 = shuffle([q.answer + 1, q.answer - 1, p2, q.answer + 2, q.answer - 2]);
    for (var x = 0; x < cand2.length && co.length < 3; x++) if (cand2[x] >= 0 && cand2[x] <= 20 && co.indexOf(cand2[x]) === -1) co.push(cand2[x]);
    q.opts = shuffle(co);
    q.optClass = 'tm';
    q.optHTML = function (v) { return '<span class="tm-big">' + v + '</span><span class="tm-small">lira</span>'; };
    return q;
  }

  function moneyRow(pieces, removable) {
    var row = el('div', 'money-row');
    for (var i = 0; i < pieces.length; i++) {
      (function (v, idx) {
        var m = el('div', 'mpiece ' + (v === 1 ? 'is-coin' : 'is-note') + ' pop', moneySVG(v));
        m.setAttribute('data-v', v);
        m.style.webkitAnimationDelay = m.style.animationDelay = (removable ? 0 : idx * 0.05) + 's';
        if (removable) {
          m.addEventListener('click', function () {
            if (G.locked) return;
            G.paid.splice(idx, 1);
            Snd.tone(330, 0, 0.08, 'triangle', 0.15);
            renderPaid();
          });
        }
        row.appendChild(m);
      })(pieces[i], i);
    }
    return row;
  }
  function shopItemCard(id, price) {
    return el('div', 'sh-item', '<div class="hc-pic">' + picSVG(id) + '</div><div class="tag big">' + price + ' TL</div>');
  }

  function buildShopQuestion(stage, q) {
    G.countReady = true;
    var k = q.kind;
    if (k === 'coins' || k === 'mix5' || k === 'mix10') {
      var box = el('div', 'wallet');
      box.appendChild(moneyRow(q.pieces.slice().sort(function (a, b) { return b - a; }), false));
      stage.appendChild(box);
      stage.appendChild(el('div', 'cmp-ask', 'Toplam kaç lira?'));
      say(k === 'coins' ? 'Paraları say!' : 'Önce büyük paraları say!');
      return;
    }
    if (k === 'pay') {
      G.paid = [];
      var row = el('div', 'hc-row');
      row.appendChild(shopItemCard(q.item, q.price));
      var area = el('div', 'pv-area pay-area');
      area.id = 'pay-area';
      row.appendChild(area);
      stage.appendChild(row);
      renderPaid();
      say(ITEM_NAMES[q.item] + ' ' + q.price + ' lira. Tam parayı ver!');
      return;
    }
    if (k === 'afford') {
      var w = el('div', 'wallet');
      w.appendChild(el('div', 'wallet-t', 'Cebindeki para:'));
      w.appendChild(moneyRow(q.wallet, false));
      stage.appendChild(w);
      stage.appendChild(el('div', 'cmp-ask small', 'Hangisini <b>alabilirsin</b>?'));
      say('Paranın yettiğini seç!');
      return;
    }
    // para üstü
    var r2 = el('div', 'hc-row');
    r2.appendChild(shopItemCard(q.item, q.price));
    var side = el('div', 'hc-side');
    side.appendChild(el('div', 'wallet-t', 'Mandi verdi:'));
    side.appendChild(moneyRow([q.note], false));
    side.appendChild(el('div', 'hc-q', 'Para üstü kaç lira?'));
    r2.appendChild(side);
    stage.appendChild(r2);
    say(q.note + ' liradan ' + q.price + ' lira çıkar!');
  }

  function renderPaid() {
    var area = $('pay-area');
    if (!area) return;
    area.innerHTML = '';
    var sorted = G.paid;
    if (!sorted.length) area.appendChild(el('div', 'pv-empty pay-empty', 'Aşağıdaki paralara dokun'));
    else area.appendChild(moneyRow(sorted, true));
    area.appendChild(el('div', 'pv-now', 'Verdiğin: <b>' + sumOf(G.paid) + ' lira</b>'));
  }

  function buildShopControls(box, q) {
    var list = [];
    for (var i = 0; i < q.notes.length; i++) {
      (function (v) {
        var b = el('button', 'ch pvb paybtn', moneySVG(v));
        b.addEventListener('click', function () {
          if (G.locked) return;
          if (G.paid.length >= 12) { Snd.wrong(); return; }
          G.paid.push(v);
          G.paid.sort(function (a, c) { return c - a; });
          Snd.tone(v === 1 ? 880 : 520, 0, 0.1, 'triangle', 0.2);
          renderPaid();
        });
        list.push(b);
      })(q.notes[i]);
    }
    var ok = el('button', 'ch pvb pvok', '<span class="tick"></span><span>Öde</span>');
    ok.addEventListener('click', function () { answer(ok, sumOf(G.paid)); });
    list.push(ok);
    for (var j = 0; j < list.length; j++) {
      list[j].style.webkitAnimationDelay = list[j].style.animationDelay = (0.07 * j + 0.1) + 's';
      box.appendChild(list[j]);
    }
  }

  function shopPayHint() {
    var q = G.cur, paid = sumOf(G.paid);
    if (paid > q.price) return 'Fazla verdin! ' + q.price + ' lira olmalı. Bir parayı geri al.';
    if (paid < q.price) return 'Biraz daha! ' + (q.price - paid) + ' lira eksik.';
    return 'Örneğin: ' + liraWords(breakdown(q.price, q.notes));
  }

  // Paraların üstüne ara toplamları yazar
  function labelRunning() {
    var ps = $('stage').querySelectorAll('.wallet .mpiece');
    if (!ps.length || hintTimers.length) return;
    var qid = G.qid, total = 0, delay = 300;
    for (var i = 0; i < ps.length; i++) {
      (function (node, v, d) {
        hintTimers.push(setTimeout(function () {
          if (!G || G.qid !== qid) return;
          total += v;
          var old = node.querySelector('.num');
          if (old) node.removeChild(old);
          node.appendChild(el('span', 'num', String(total)));
          Snd.count(Math.min(total, 20));
        }, d));
      })(ps[i], +ps[i].getAttribute('data-v'), delay);
      delay += 380;
    }
    hintTimers.push(setTimeout(function () { hintTimers = []; }, delay));
  }

  function shopHint(val) {
    var q = G.cur;
    if (q.kind === 'afford') {
      return 'Cebinde ' + q.walletSum + ' lira var. Fiyatı ' + q.walletSum + ' lira ya da daha az olanı seç!';
    }
    if (q.kind === 'change') {
      return q.note + ' ' + MINUS + ' ' + q.price + ' = ? Ödediğinden fiyatı çıkar!';
    }
    labelRunning();
    return 'Birlikte sayalım: ' + liraWords(q.pieces);
  }

  function buildChoices(q) {
    var box = $('choices');
    box.innerHTML = '';
    if (q.noChoices) return;
    if (q.build) {
      if (q.ctrl === 'clock') buildClockControls(box, q);
      else if (q.ctrl === 'hece') buildHeceControls(box, q);
      else if (q.ctrl === 'shop') buildShopControls(box, q);
      else buildPvControls(box, q);
      return;
    }
    for (var i = 0; i < q.opts.length; i++) {
      (function (val, k) {
        var b = el('button', 'ch k' + k + (q.optClass ? ' ' + q.optClass : ''), q.optHTML ? q.optHTML(val) : String(val));
        b.style.webkitAnimationDelay = b.style.animationDelay = (0.08 * k + 0.1) + 's';
        b.addEventListener('click', function () { answer(b, val); });
        box.appendChild(b);
      })(q.opts[i], i);
    }
  }

  function answer(btn, val) {
    if (G.locked || btn.disabled) return;
    var q = G.cur;
    if (val === q.answer) {
      G.locked = true;
      stopHint();
      var clean = G.wrongNow === 0;
      G.results.push(clean);
      if (!clean) G.missQ++;
      G.streak = clean ? G.streak + 1 : 0;
      if (!q.keepBtn) btn.className = q.build ? 'ch pvb pvok right' : 'ch right' + (q.optClass ? ' ' + q.optClass : '');
      var others = $('choices').querySelectorAll('.ch');
      for (var i = 0; i < others.length; i++) if (others[i] !== btn) others[i].classList.add('fade');
      var box = $('stage').querySelector('.box');
      if (box) { box.innerHTML = q.answerText || String(q.answer); box.className = 'box done'; }
      if (q.onRight) q.onRight();
      Snd.right();
      burst(btn, 16);
      say(pick(PRAISE));
      playMascot.face('happy', 1100);
      if (G.streak === 3 || G.streak === 5 || G.streak === QUESTIONS_PER_LEVEL) showStreak(G.streak);
      G.q++;
      renderDots();
      later(nextQuestion, G.lv.kind === 'line' && !clean ? 1100 : 950);
    } else {
      G.wrongNow++;
      G.streak = 0;
      Snd.wrong();
      playMascot.face('sad', 700);
      if (q.build) { restartAnim(btn, 'shake'); say(q.ctrl === 'clock' ? clockSetHint() : q.ctrl === 'hece' ? heceBuildWrong() : q.ctrl === 'shop' ? shopPayHint() : pvBuildHint()); return; }
      btn.disabled = true;
      btn.className += ' wrong';
      if (G.op === 'shop') {
        say(shopHint(val));
      } else if (G.op === 'pat') {
        say(patHint(val));
      } else if (G.op === 'cmp') {
        say(cmpHint(val));
      } else if (G.op === 'hece') {
        say(heceHint(val));
      } else if (G.op === 'clock') {
        say(clockHint(val));
      } else if (G.op === 'pv') {
        if (!pvHint()) say(pick(RETRY));
      } else if (G.wrongNow >= 1 && countHint()) {
        say('Birlikte sayalım!');
      } else {
        say(pick(RETRY));
      }
    }
  }

  function showStreak(n) {
    var s = $('streak');
    s.innerHTML = n === QUESTIONS_PER_LEVEL ? 'Hepsi doğru!' : n + ' doğru üst üste!';
    restartAnim(s, 'show');
  }

  /* Konfeti: az sayıda parça, sadece transform + opacity geçişi */
  var CONF_COLORS = ['#ef476f', '#ffd23f', '#3bb273', '#3a86ff', '#8e7dff', '#ff8a3d'];
  function burst(node, count) {
    var fx = $('fx');
    var r = node.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var parts = [];
    for (var i = 0; i < count; i++) {
      var p = el('div', 'conf');
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.background = CONF_COLORS[i % CONF_COLORS.length];
      fx.appendChild(p);
      parts.push(p);
    }
    void fx.offsetWidth;
    for (var j = 0; j < parts.length; j++) {
      var ang = (j / parts.length) * Math.PI * 2 + Math.random() * 0.4;
      var dist = 70 + Math.random() * 110;
      var tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist - 60;
      var tr = 'translate(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px) rotate(' + rnd(90, 540) + 'deg)';
      parts[j].style.webkitTransform = parts[j].style.transform = tr;
      parts[j].style.opacity = '0';
    }
    setTimeout(function () {
      for (var k = 0; k < parts.length; k++) if (parts[k].parentNode) fx.removeChild(parts[k]);
    }, 900);
  }

  function finishLevel() {
    var stars = G.missQ <= 1 ? 3 : G.missQ <= 3 ? 2 : 1;
    var st = starsOf(G.game);
    var prev = st[G.lvl] || 0;
    if (stars > prev) st[G.lvl] = stars;
    var LV = G.game.levels;
    persist();
    var lvlIndex = G.lvl;
    show('result');

    var titles = { 3: 'Muhteşem!', 2: 'Çok iyi!', 1: 'Bitirdin!' };
    $('result-title').innerHTML = titles[stars];
    var txt;
    if (stars === 3) txt = G.game.title + ' ustası oldun!';
    else if (stars === 2) txt = 'Bir daha oynarsan 3 yıldız alabilirsin!';
    else txt = 'Her oyunda daha iyi oluyorsun!';
    if (lvlIndex === LV.length - 1) txt = 'Bütün seviyeleri bitirdin! Sen bir şampiyonsun!';
    else if (!prev) txt += '<br>Yeni seviye açıldı!';
    $('result-text').innerHTML = txt;

    var bs = $('big-stars');
    bs.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var s = el('div', '', svgUse('i-star', i < stars ? 'on' : ''));
      var svg = s.firstChild;
      svg.style.webkitAnimationDelay = svg.style.animationDelay = (0.25 + i * 0.3) + 's';
      bs.appendChild(svg);
    }
    resultMascot.face('happy', 1600);
    Snd.win();
    later(function () { burst($('big-stars'), 24); }, 300);
    later(function () { burst($('result-mascot'), 18); }, 900);

    var next = $('btn-next');
    next.style.display = lvlIndex < LV.length - 1 ? '' : 'none';
    next.onclick = function () { Snd.tap(); startLevel(lvlIndex + 1); };
    $('btn-again').onclick = function () { Snd.tap(); startLevel(lvlIndex); };
  }

  /* ------------------------------------------------------------------ */
  /* Ses düğmesi                                                         */
  /* ------------------------------------------------------------------ */
  var soundBtn = $('sound-btn');
  function paintSound() { soundBtn.className = 'icon-btn' + (save.sound ? '' : ' muted'); }
  soundBtn.addEventListener('click', function () {
    save.sound = !save.sound;
    persist();
    paintSound();
    Snd.tap();
  });
  paintSound();

  /* ------------------------------------------------------------------ */
  /* Çevrimdışı (Service Worker)                                         */
  /* ------------------------------------------------------------------ */
  var status = $('offline-status');
  var verBtn = $('ver');
  var verText = 'Sürüm ' + APP_VERSION + (BUILD.indexOf('__') === 0 ? '' : ' · ' + BUILD) +
    (SIZE_KB.indexOf('__') === 0 ? '' : ' · ' + SIZE_KB + ' KB');
  verBtn.innerHTML = verText;

  /* Güncelleme: oyun önbellekten (internetsiz) açılır. Yeni sürüm yayınlanınca
   * arka planda iner; hazır olduğunda oyun ortasında değil, ana sayfadayken
   * sayfa kendiliğinden yenilenir. */
  var swReg = null, pendingReload = false, reloading = false, lastCheck = 0;
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  function doReload() {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  }
  function safeToReload() { return current === 'home' || current === 'levels' || current === 'about'; }
  function checkUpdate(force) {
    if (!swReg || !navigator.onLine) return;
    var now = Date.now();
    if (!force && now - lastCheck < 60000) return;
    lastCheck = now;
    try { swReg.update(); } catch (e) { }
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; } // ilk kurulum: yenilemeye gerek yok
      if (safeToReload()) doReload();
      else { pendingReload = true; status.innerHTML = 'Yeni sürüm hazır'; }
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      reg.addEventListener('updatefound', function () {
        if (hadController) status.innerHTML = 'Yeni sürüm indiriliyor...';
      });
      return navigator.serviceWorker.ready;
    }).then(function () {
      if (!pendingReload) status.innerHTML = 'İnternetsiz oynanabilir';
    }).catch(function () {
      status.innerHTML = '';
    });
    // Ana ekrandan açılan uygulama günlerce açık kalabilir: öne gelince kontrol et
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        checkUpdate(false);
        if (ac && ac.status !== 0 && !(navigator.serviceWorker && navigator.serviceWorker.controller)) { try { ac.update(); } catch (e) { } }
      }
    });
    window.addEventListener('online', function () { checkUpdate(true); });
  }
  /* Yedek: Service Worker'ı olmayan ya da kuramayan eski tarayıcılar AppCache kullanır.
   * (Service Worker sayfayı kontrol ediyorsa tarayıcı AppCache'i yok sayar.) */
  var PRIVATE_MSG = 'Gizli modda veya çerezler engelliyken internetsiz çalışmaz';
  var storageOK; // aşağıda belirlenir
  var ac = window.applicationCache;
  if (ac) {
    var acReady = function () {
      if (!pendingReload) status.innerHTML = 'İnternetsiz oynanabilir';
    };
    ac.addEventListener('cached', acReady);
    ac.addEventListener('noupdate', acReady);
    ac.addEventListener('downloading', function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) status.innerHTML = 'İnternetsiz kullanım için hazırlanıyor...';
    });
    ac.addEventListener('updateready', function () {
      try { ac.swapCache(); } catch (e) { }
      if (safeToReload()) doReload();
      else { pendingReload = true; status.innerHTML = 'Yeni sürüm hazır'; }
    });
    ac.addEventListener('error', function () {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) return;
      // İnternetsizken açılışta da 'error' gelir; önbellek varsa sorun yok
      if (ac.status !== 0) acReady();
      else status.innerHTML = storageOK === false ? PRIVATE_MSG : 'İnternetsiz mod kurulamadı (sürüm yazısına dokunun)';
    });
    ac.addEventListener('obsolete', function () { status.innerHTML = 'İnternetsiz mod kaldırıldı'; });
    if (ac.status === 1) acReady(); // IDLE: zaten önbellekte
  }
  if (!('serviceWorker' in navigator) && !ac) status.innerHTML = '';

  function chromeVersion() {
    var ua = navigator.userAgent;
    var m = ua.match(/Chrome\/(\d+)/);
    if (m) return 'Chrome ' + m[1];
    m = ua.match(/OS (\d+)_(\d+)(?:_(\d+))? like Mac/);
    if (m) return 'iOS ' + m[1] + '.' + m[2] + (m[3] ? '.' + m[3] : '');
    m = ua.match(/Version\/(\d+)[^ ]* Safari/);
    return m ? 'Safari ' + m[1] : '';
  }
  // Gizli mod / "Tüm çerezleri engelle" açıkken eski Safari'de depolama ve AppCache kapalıdır
  storageOK = (function () {
    try {
      window.localStorage.setItem('mandi.t', '1');
      window.localStorage.removeItem('mandi.t');
      return true;
    } catch (e) { return false; }
  })();
  if (!storageOK && !(navigator.serviceWorker && navigator.serviceWorker.controller)) {
    status.innerHTML = PRIVATE_MSG;
  }

  // Cihazın kendisinden manifest dosyasını kontrol et
  var manifestCheck = '';
  function checkManifest(done) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', 'offline.appcache?t=' + Date.now(), true);
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        var ct = (x.getResponseHeader('Content-Type') || '').split(';')[0];
        manifestCheck = 'manifest ' + x.status + ' ' + ct;
        done();
      };
      x.send();
    } catch (e) { manifestCheck = 'manifest hata'; done(); }
  }

  // Teşhis: hangi çevrimdışı yöntem kullanılıyor, durumu ne
  function offlineInfo() {
    var parts = [];
    if (navigator.serviceWorker) parts.push('SW ' + (navigator.serviceWorker.controller ? 'aktif' : 'pasif'));
    else parts.push('SW yok');
    if (ac) parts.push('AC ' + ['yok', 'hazır', 'kontrol', 'iniyor', 'yeni', 'silindi'][ac.status]);
    if (window.navigator.standalone) parts.push('ana ekran');
    if (!storageOK) parts.push('depolama KAPALI');
    var log = window.__acLog;
    if (ac && log) parts.push('olaylar: ' + (log.length ? log.join('>') : 'hiç'));
    if (manifestCheck) parts.push(manifestCheck);
    return parts.join(', ');
  }
  function checkAll() {
    checkUpdate(true);
    if (ac && ac.status !== 0) { try { ac.update(); } catch (e) { } }
  }

  // Sürüm yazısına dokununca elle güncelleme kontrolü (+ tarayıcı sürümü, sorun bildirimi için)
  verBtn.addEventListener('click', function () {
    var info = verText + (chromeVersion() ? ' · ' + chromeVersion() : '') + ' · ' + offlineInfo();
    if (!navigator.onLine) { verBtn.innerHTML = info + ' · internet yok'; return; }
    verBtn.innerHTML = info + ' · kontrol ediliyor...';
    checkAll();
    checkManifest(function () {
      info = verText + (chromeVersion() ? ' · ' + chromeVersion() : '') + ' · ' + offlineInfo();
      verBtn.innerHTML = info + ' · kontrol ediliyor...';
    });
    setTimeout(function () { if (!reloading) verBtn.innerHTML = info + ' · güncel'; }, 4000);
  });

  show('home');
})();
