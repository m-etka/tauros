/* Mandi'nin Oyun Bahçesi
 * Hedef cihaz: Samsung SM-T110 (Android 4.2, Chrome <= 71, 1 GB RAM).
 * Bu yüzden: yalnızca ES5 sözdizimi, kütüphane yok, küçük DOM, transform/opacity animasyonları.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var QUESTIONS_PER_LEVEL = 8;
  var STORE_KEY = 'mandi.v1';

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
  var save = { stars: {}, sound: true };
  try {
    var raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        save.stars = parsed.stars || {};
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
  var LEVELS = [
    { name: "5'e kadar", sub: 'Say ve topla', color: '#ef476f', kind: 'objects', max: 5 },
    { name: "10'a kadar", sub: 'Say ve topla', color: '#ff8a3d', kind: 'objects', max: 10 },
    { name: 'Kurbağa', sub: 'Sayı doğrusu', color: '#3bb273', kind: 'line', max: 10 },
    { name: 'Onluk kutu', sub: '10 kutucuk', color: '#3a86ff', kind: 'frame', max: 10 },
    { name: 'Sayılarla', sub: "10'a kadar", color: '#8e7dff', kind: 'plain', max: 10 },
    { name: 'Gizli sayı', sub: '3 + ? = 7', color: '#e0a800', kind: 'missing', max: 10 },
    { name: "20'ye kadar", sub: 'İki onluk kutu', color: '#ef476f', kind: 'frame20', max: 20 },
    { name: 'Şampiyon', sub: "20'ye kadar", color: '#26874f', kind: 'plain', max: 20 }
  ];

  function makeQuestion(lv, seen) {
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
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $('s-' + name).classList.add('active');
    current = name;
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
  var HELLOS = ['Merhaba! Hadi oynayalım!', 'Toplama yapalım mı?', 'Bugün yıldız toplayalım!'];
  function totalStars() {
    var t = 0;
    for (var k in save.stars) if (save.stars.hasOwnProperty(k)) t += save.stars[k];
    return t;
  }
  function renderHome() {
    $('home-hello').innerHTML = pick(HELLOS);
    var g = $('games');
    g.innerHTML = '';
    var card = el('button', 'game-card',
      '<div class="game-icon">2+3</div><h3>Toplama</h3><p>' + totalStars() + ' / ' + (LEVELS.length * 3) + ' yıldız</p>');
    card.addEventListener('click', function () { Snd.tap(); show('levels'); });
    g.appendChild(card);
    homeMascot.face('happy', 1200);
  }

  /* ------------------------------------------------------------------ */
  /* Seviye seçimi                                                       */
  /* ------------------------------------------------------------------ */
  function unlockedCount() {
    var n = 1;
    for (var i = 0; i < LEVELS.length; i++) {
      if (save.stars[i] > 0) n = i + 2; else break;
    }
    return Math.min(n, LEVELS.length);
  }
  function starRow(n, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) s += svgUse('i-star', i < n ? 'on' : '');
    return '<div class="' + cls + '">' + s + '</div>';
  }
  function renderLevels() {
    var box = $('levels');
    box.innerHTML = '';
    var open = unlockedCount();
    for (var i = 0; i < LEVELS.length; i++) {
      (function (i) {
        var lv = LEVELS[i];
        var locked = i >= open;
        var isCurrent = !locked && i === open - 1 && !(save.stars[i] > 0);
        var b = el('button', 'lvl' + (locked ? ' locked' : '') + (isCurrent ? ' current' : ''),
          '<div class="lvl-num" style="background:' + lv.color + '">' + (locked ? svgUse('i-lock') : (i + 1)) + '</div>' +
          '<div class="lvl-name">' + lv.name + '</div>' +
          '<div class="lvl-sub">' + lv.sub + '</div>' +
          starRow(save.stars[i] || 0, 'lvl-stars'));
        b.addEventListener('click', function () {
          if (locked) { Snd.wrong(); restartAnim(b, 'shakeit'); return; }
          Snd.tap();
          startLevel(i);
        });
        box.appendChild(b);
      })(i);
    }
    $('total-stars').innerHTML = totalStars();
  }

  /* ------------------------------------------------------------------ */
  /* Oyun                                                                */
  /* ------------------------------------------------------------------ */
  var G = null; // aktif oyun durumu

  function startLevel(i) {
    show('play');
    G = { lvl: i, lv: LEVELS[i], q: 0, missQ: 0, streak: 0, seen: {}, cur: null, locked: false, wrongNow: 0, results: [] };
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
    var build = function () {
      G.cur = makeQuestion(G.lv, G.seen);
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
  function attachCount(node) {
    node.addEventListener('click', function () {
      if (node.getAttribute('data-n')) return;
      G.counter++;
      node.setAttribute('data-n', G.counter);
      node.classList.add('counted');
      node.appendChild(el('span', 'num', String(G.counter)));
      Snd.count(G.counter);
    });
  }

  // İpucu: tüm nesneleri sırayla numaralar
  function countHint() {
    var nodes = $('stage').querySelectorAll('.obj, .obj-cell');
    if (!nodes.length) return false;
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getAttribute('data-n')) list.push(nodes[i]);
    }
    for (var j = 0; j < list.length; j++) {
      (function (n, k) {
        later(function () { if (!n.getAttribute('data-n')) fireClick(n); }, k * 230);
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

  function numberLine(q) {
    var wrap = el('div', 'nline');
    var max = 10;
    var W = 880, pad = 30, y = 110;
    var step = (W - pad * 2) / max;
    var s = '<svg class="line" viewBox="0 0 ' + W + ' 170" preserveAspectRatio="none">';
    s += '<line x1="' + (pad - 15) + '" y1="' + y + '" x2="' + (W - pad + 15) + '" y2="' + y + '" stroke="#2b2d42" stroke-width="5" stroke-linecap="round"/>';
    for (var i = 0; i <= max; i++) {
      var x = pad + i * step;
      var hi = i === q.a;
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
      var from = pos, to = pos + 1;
      pos = to;
      var x1 = pad + from * step, x2 = pad + to * step, mid = (x1 + x2) / 2;
      var ns = 'http://www.w3.org/2000/svg';
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + (y - 18) + ' Q' + mid + ' ' + (y - 95) + ' ' + x2 + ' ' + (y - 18));
      p.setAttribute('stroke', '#3a86ff');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('stroke-dasharray', '8 7');
      p.setAttribute('fill', 'none');
      arcs.appendChild(p);
      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', mid); t.setAttribute('y', y - 64);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '26');
      t.setAttribute('font-weight', '900'); t.setAttribute('fill', '#3a86ff');
      t.setAttribute('font-family', 'Roboto, Arial, sans-serif');
      t.textContent = '+' + k;
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

  function buildChoices(q) {
    var box = $('choices');
    box.innerHTML = '';
    for (var i = 0; i < q.opts.length; i++) {
      (function (val, k) {
        var b = el('button', 'ch k' + k, String(val));
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
      var clean = G.wrongNow === 0;
      G.results.push(clean);
      if (!clean) G.missQ++;
      G.streak = clean ? G.streak + 1 : 0;
      btn.className = 'ch right';
      var others = $('choices').querySelectorAll('.ch');
      for (var i = 0; i < others.length; i++) if (others[i] !== btn) others[i].classList.add('fade');
      var box = $('stage').querySelector('.box');
      if (box) { box.innerHTML = String(q.answer); box.className = 'box done'; }
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
      btn.disabled = true;
      btn.className += ' wrong';
      Snd.wrong();
      playMascot.face('sad', 700);
      if (G.wrongNow >= 1 && countHint()) {
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
    var prev = save.stars[G.lvl] || 0;
    if (stars > prev) save.stars[G.lvl] = stars;
    persist();
    var lvlIndex = G.lvl;
    show('result');

    var titles = { 3: 'Muhteşem!', 2: 'Çok iyi!', 1: 'Bitirdin!' };
    $('result-title').innerHTML = titles[stars];
    var txt;
    if (stars === 3) txt = 'Toplama ustası oldun!';
    else if (stars === 2) txt = 'Bir daha oynarsan 3 yıldız alabilirsin!';
    else txt = 'Her oyunda daha iyi oluyorsun!';
    if (lvlIndex === LEVELS.length - 1) txt = 'Bütün seviyeleri bitirdin! Sen bir şampiyonsun!';
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
    next.style.display = lvlIndex < LEVELS.length - 1 ? '' : 'none';
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      status.innerHTML = 'İnternetsiz oynanabilir';
    }).catch(function () {
      status.innerHTML = '';
    });
  }

  show('home');
})();
