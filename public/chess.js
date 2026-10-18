/* Satranç Okulu — taşları ve kuralları adım adım öğreten eğitim oyunu.
 * Rakip yok; küçük tahtalarda taş taş başlar, sonunda tam tahta.
 * Ana sayfa açıldıktan sonra yüklenir (app.js: loadLazy). Yalnızca ES5.
 *
 * Koordinat: x soldan sağa 0..n-1, y yukarıdan aşağıya 0..n-1 (y=0 siyahın tarafı).
 * Beyaz piyon yukarı (y-1) gider. */
(function () {
  'use strict';
  var M = window.Mandi;
  if (!M) return;
  var $ = M.$, el = M.el, rnd = M.rnd, pick = M.pick, shuffle = M.shuffle, later = M.later, say = M.say, Snd = M.Snd;

  var NAMES = { R: 'Kale', B: 'Fil', Q: 'Vezir', K: 'Şah', N: 'At', P: 'Piyon' };
  var ACC = { R: 'Kaleyi', B: 'Fili', Q: 'Veziri', K: 'Şahı', N: 'Atı', P: 'Piyonu' };
  var GEN = { R: 'Kalenin', B: 'Filin', Q: 'Vezirin', K: 'Şahın', N: 'Atın', P: 'Piyonun' };
  var TIPS = {
    R: 'Kale düz gider: ileri, geri, sağa, sola. İstediği kadar gider.',
    B: 'Fil çapraz gider, istediği kadar. Hep aynı renk karelerde kalır.',
    Q: 'Vezir hem düz hem çapraz gider, istediği kadar. En güçlü taştır.',
    K: 'Şah her yöne yalnızca bir kare gider.',
    N: 'At L çizer: iki kare düz, bir kare yana. Taşların üstünden atlar.',
    P: 'Piyon bir kare ileri gider, ilk hamlesinde iki kare. Çapraz yer.'
  };

  /* ---------------- Taş çizimleri (sade, özgün) ---------------- */
  function pieceSVG(t, c) {
    var w = c === 'w', f = w ? '#ffffff' : '#3a3d55', s = w ? '#2b2d42' : '#1b1d2e', d = w ? '#2b2d42' : '#ffffff';
    var a = ' fill="' + f + '" stroke="' + s + '" stroke-width="2" stroke-linejoin="round"';
    var base = '<rect x="8" y="31" width="24" height="5" rx="2"' + a + '/>';
    var g = '';
    if (t === 'P') g = '<path d="M13 31 Q14 22 20 20 Q26 22 27 31 Z"' + a + '/><circle cx="20" cy="14" r="5.5"' + a + '/>';
    else if (t === 'R') g = '<path d="M12 31 L13.5 18 L26.5 18 L28 31 Z"' + a + '/><path d="M10 18 L10 8 L14 8 L14 11 L18 11 L18 8 L22 8 L22 11 L26 11 L26 8 L30 8 L30 18 Z"' + a + '/>';
    else if (t === 'B') g = '<path d="M13 31 Q13 25 17 23 L23 23 Q27 25 27 31 Z"' + a + '/><path d="M20 9 Q11 16 15 23 L25 23 Q29 16 20 9 Z"' + a + '/><circle cx="20" cy="7" r="2.6"' + a + '/>' +
      '<path d="M22.5 13 L18 18.5" stroke="' + d + '" stroke-width="2" stroke-linecap="round"/>';
    else if (t === 'N') g = '<path d="M12 31 C12 25 16 23 18 20 L13.5 21.5 Q9.5 21 10 17 L17 9.5 L18 5 L21.5 8.5 Q30 10.5 29 22 L28 31 Z"' + a + '/>' +
      '<circle cx="17" cy="13" r="1.4" fill="' + d + '"/>';
    else if (t === 'Q') g = '<path d="M11 30 L8 13 L14.5 22 L15 9.5 L20 20 L25 9.5 L25.5 22 L32 13 L29 30 Z"' + a + '/>' +
      '<circle cx="8" cy="12" r="2.3"' + a + '/><circle cx="15" cy="8.5" r="2.3"' + a + '/><circle cx="25" cy="8.5" r="2.3"' + a + '/><circle cx="32" cy="12" r="2.3"' + a + '/>';
    else if (t === 'K') g = '<path d="M11 30 Q9 19 20 17.5 Q31 19 29 30 Z"' + a + '/><rect x="18.3" y="4" width="3.4" height="13" rx="1"' + a + '/><rect x="14.5" y="7.5" width="11" height="3.4" rx="1"' + a + '/>';
    return '<svg class="cpc" viewBox="0 0 40 40">' + g + base + '</svg>';
  }
  var STAR = '<svg class="cstar" viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.8z" fill="#ffd23f" stroke="#e0a800" stroke-width="1"/></svg>';

  /* ---------------- Kural motoru ---------------- */
  function K(x, y) { return x + ',' + y; }
  function XY(k) { var a = k.split(','); return [+a[0], +a[1]]; }
  function mk(n) { return { n: n, p: {}, ep: null }; }
  function put(b, x, y, t, c) { b.p[K(x, y)] = { t: t, c: c }; }
  function at(b, x, y) { return b.p[K(x, y)]; }
  function inb(b, x, y) { return x >= 0 && y >= 0 && x < b.n && y < b.n; }
  function clone(b) { var c = mk(b.n), k; for (k in b.p) if (b.p.hasOwnProperty(k)) c.p[k] = { t: b.p[k].t, c: b.p[k].c }; c.ep = b.ep; return c; }
  var DR = [[1, 0], [-1, 0], [0, 1], [0, -1]], DB = [[1, 1], [1, -1], [-1, 1], [-1, -1]], DQ = DR.concat(DB);
  var DN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  // Sözde hamleler (şah güvenliği hariç). attackOnly: piyonun yalnızca çapraz kareleri
  function moves(b, x, y, attackOnly) {
    var pc = at(b, x, y), out = [], i, d, nx, ny, q;
    if (!pc) return out;
    var slide = function (dirs, many) {
      for (i = 0; i < dirs.length; i++) {
        nx = x; ny = y;
        while (true) {
          nx += dirs[i][0]; ny += dirs[i][1];
          if (!inb(b, nx, ny)) break;
          q = at(b, nx, ny);
          if (q) { if (q.c !== pc.c || attackOnly) out.push([nx, ny]); break; }
          out.push([nx, ny]);
          if (!many) break;
        }
      }
    };
    if (pc.t === 'R') slide(DR, true);
    else if (pc.t === 'B') slide(DB, true);
    else if (pc.t === 'Q') slide(DQ, true);
    else if (pc.t === 'K') slide(DQ, false);
    else if (pc.t === 'N') {
      for (i = 0; i < 8; i++) {
        nx = x + DN[i][0]; ny = y + DN[i][1];
        if (!inb(b, nx, ny)) continue;
        q = at(b, nx, ny);
        if (!q || q.c !== pc.c || attackOnly) out.push([nx, ny]);
      }
    } else if (pc.t === 'P') {
      d = pc.c === 'w' ? -1 : 1;
      for (i = -1; i <= 1; i += 2) {
        nx = x + i; ny = y + d;
        if (!inb(b, nx, ny)) continue;
        q = at(b, nx, ny);
        if (attackOnly || (q && q.c !== pc.c) || (b.ep && b.ep[0] === nx && b.ep[1] === ny)) out.push([nx, ny]);
      }
      if (!attackOnly && inb(b, x, y + d) && !at(b, x, y + d)) {
        out.push([x, y + d]);
        var start = pc.c === 'w' ? b.n - 2 : 1;
        if (y === start && inb(b, x, y + 2 * d) && !at(b, x, y + 2 * d)) out.push([x, y + 2 * d]);
      }
    }
    return out;
  }
  function attacked(b, x, y, byColor) {
    for (var k in b.p) {
      if (!b.p.hasOwnProperty(k) || b.p[k].c !== byColor) continue;
      var s = XY(k), m = moves(b, s[0], s[1], true);
      for (var i = 0; i < m.length; i++) if (m[i][0] === x && m[i][1] === y) return true;
    }
    return false;
  }
  function attackers(b, x, y, byColor) {
    var out = [];
    for (var k in b.p) {
      if (!b.p.hasOwnProperty(k) || b.p[k].c !== byColor) continue;
      var s = XY(k), m = moves(b, s[0], s[1], true);
      for (var i = 0; i < m.length; i++) if (m[i][0] === x && m[i][1] === y) { out.push(k); break; }
    }
    return out;
  }
  function kingOf(b, c) { for (var k in b.p) if (b.p.hasOwnProperty(k) && b.p[k].t === 'K' && b.p[k].c === c) return XY(k); return null; }
  function inCheck(b, c) { var k = kingOf(b, c); return !!k && attacked(b, k[0], k[1], c === 'w' ? 'b' : 'w'); }
  // Hamleyi uygula (geçerken alma ve terfi dahil, rok hariç)
  function doMove(b, fx, fy, tx, ty, promo) {
    var pc = at(b, fx, fy);
    delete b.p[K(fx, fy)];
    if (pc.t === 'P' && b.ep && tx === b.ep[0] && ty === b.ep[1] && !at(b, tx, ty)) delete b.p[K(tx, fy)];
    b.p[K(tx, ty)] = { t: pc.t === 'P' && (ty === 0 || ty === b.n - 1) ? (promo || 'Q') : pc.t, c: pc.c };
    b.ep = null;
  }
  // Yasal hamleler: kendi şahını tehlikeye atmayanlar (şah yoksa hepsi)
  function legal(b, x, y) {
    var pc = at(b, x, y), m = moves(b, x, y), out = [];
    if (!pc) return out;
    for (var i = 0; i < m.length; i++) {
      var t = at(b, m[i][0], m[i][1]);
      if (t && t.t === 'K') continue; // şah yenmez
      var c = clone(b);
      doMove(c, x, y, m[i][0], m[i][1]);
      if (!inCheck(c, pc.c)) out.push(m[i]);
    }
    return out;
  }
  function hasAnyMove(b, c) {
    for (var k in b.p) {
      if (!b.p.hasOwnProperty(k) || b.p[k].c !== c) continue;
      var s = XY(k);
      if (legal(b, s[0], s[1]).length) return true;
    }
    return false;
  }
  function isMate(b, c) { return inCheck(b, c) && !hasAnyMove(b, c); }
  function contains(list, x, y) { for (var i = 0; i < list.length; i++) if (list[i][0] === x && list[i][1] === y) return true; return false; }
  function keysOf(list) { var o = {}; for (var i = 0; i < list.length; i++) o[K(list[i][0], list[i][1])] = true; return o; }
  function count(o) { var n = 0; for (var k in o) if (o.hasOwnProperty(k)) n++; return n; }
  function emptySq(b, avoid) {
    var x, y, tries = 0;
    do { x = rnd(0, b.n - 1); y = rnd(0, b.n - 1); tries++; } while ((at(b, x, y) || (avoid && avoid[K(x, y)])) && tries < 200);
    return [x, y];
  }
  // Cebirsel gösterimden tahta: 'wRa1 bKg8' (8x8)
  function parse(str, mirror) {
    var b = mk(8), parts = str.split(' ');
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i], x = s.charCodeAt(2) - 97, y = 8 - (+s.charAt(3));
      if (mirror) x = 7 - x;
      put(b, x, y, s.charAt(1), s.charAt(0));
    }
    return b;
  }
  function sqName(x, y, n) { return String.fromCharCode(97 + x) + (n - y); }

  /* ---------------- Görev üreticileri ---------------- */
  // Kaç kareye gidebilir: hedefler = yasal hamleler
  function tMark(t, n, opts) {
    opts = opts || {};
    var b, x, y, tg, tries = 0;
    do {
      b = mk(n);
      if (t === 'P') { x = rnd(0, n - 1); y = Math.random() < 0.55 ? n - 2 : rnd(2, n - 3); }
      else { x = rnd(0, n - 1); y = rnd(0, n - 1); }
      put(b, x, y, t, 'w');
      var own = opts.own || 0, foe = opts.foe || 0, j, s;
      for (j = 0; j < own; j++) { s = emptySq(b); put(b, s[0], s[1], pick(['P', 'N', 'B', 'R']), 'w'); }
      for (j = 0; j < foe; j++) { s = emptySq(b); put(b, s[0], s[1], pick(['P', 'N', 'B', 'R']), 'b'); }
      if (t === 'P' && opts.pawnFoe) {
        var dx = pick([-1, 1]);
        if (inb(b, x + dx, y - 1) && !at(b, x + dx, y - 1)) put(b, x + dx, y - 1, pick(['P', 'N', 'B']), 'b');
        if (Math.random() < 0.3 && !at(b, x, y - 1) && y - 1 > 0) put(b, x, y - 1, 'P', 'b');
      }
      tg = legal(b, x, y);
      tries++;
    } while ((tg.length < (t === 'P' ? 1 : 2) || tg.length > 14) && tries < 60);
    var q = { mode: 'mark', b: b, piece: [x, y], targets: keysOf(tg), tip: TIPS[t], t: t };
    q.ask = GEN[t] + ' gidebileceği bütün karelere dokun!';
    if (opts.capOnly) {
      var caps = [];
      for (var i = 0; i < tg.length; i++) if (at(b, tg[i][0], tg[i][1])) caps.push(tg[i]);
      if (!caps.length) return tMark(t, n, opts);
      q.targets = keysOf(caps);
      q.ask = NAMES[t] + ' hangi siyah taşları yiyebilir? Hepsine dokun!';
      q.tip = TIPS[t] + ' Rakip taşın olduğu kareye giderek onu yer.';
    }
    return q;
  }
  // Ulaşılabilir kareler (yıldızlar engel değil, taşlar engel)
  function reach(b, x, y) {
    var seen = {}, queue = [[x, y]], out = [];
    seen[K(x, y)] = true;
    var pc = at(b, x, y);
    while (queue.length) {
      var cur = queue.shift();
      var c = clone(b);
      delete c.p[K(x, y)];
      c.p[K(cur[0], cur[1])] = pc;
      var m = moves(c, cur[0], cur[1]);
      for (var i = 0; i < m.length; i++) {
        var k = K(m[i][0], m[i][1]);
        if (seen[k] || at(b, m[i][0], m[i][1])) continue;
        seen[k] = true; queue.push(m[i]); out.push(m[i]);
      }
    }
    return out;
  }
  // Yıldız topla
  function tStars(t, n, nStars, opts) {
    opts = opts || {};
    var b, x, y, r, tries = 0;
    do {
      b = mk(n);
      x = rnd(0, n - 1); y = t === 'P' ? n - 2 : rnd(0, n - 1);
      put(b, x, y, t, 'w');
      for (var j = 0; j < (opts.own || 0); j++) { var s = emptySq(b); put(b, s[0], s[1], pick(['P', 'N', 'B']), 'w'); }
      r = reach(b, x, y);
      tries++;
    } while (r.length < nStars + 2 && tries < 60);
    var cand = shuffle(r.slice()), stars = {}, k = 0;
    // en az biri tek hamlede ulaşılamasın (alıştırma olsun), olmazsa da olur
    var one = keysOf(legal(b, x, y));
    cand.sort(function (a, c) { return (one[K(a[0], a[1])] ? 1 : 0) - (one[K(c[0], c[1])] ? 1 : 0); });
    if (nStars === 1 || Math.random() < 0.5) cand = shuffle(cand);
    for (var i = 0; i < cand.length && k < nStars; i++) { stars[K(cand[i][0], cand[i][1])] = true; k++; }
    var q = { mode: 'stars', b: b, movers: [K(x, y)], stars: stars, tip: TIPS[t], t: t };
    q.ask = (k > 1 ? ACC[t] + ' oynat, ' + k + ' yıldızı da topla!' : ACC[t] + ' yıldıza götür!');
    q.showDots = !!opts.showDots;
    return q;
  }
  // Piyon yıldız: düz ilerle, gerekirse çapraz yiyerek
  function tPawnStar(n, capture) {
    var b = mk(n), x = rnd(1, n - 2), y = n - 2, stars = {};
    put(b, x, y, 'P', 'w');
    if (capture) {
      var dx = pick([-1, 1]);
      put(b, x + dx, y - 1, pick(['P', 'N', 'B']), 'b');
      put(b, x, y - 1, 'P', 'b'); // önü kapalı: çapraz yemek zorunda
      stars[K(x + dx, rnd(1, 2))] = true; // son sıra değil: terfi henüz öğretilmedi
      return { mode: 'stars', b: b, movers: [K(x, y)], stars: stars, tip: TIPS.P, t: 'P', ask: 'Piyonun önü kapalı. Çapraz yiyerek yıldıza ulaş!' };
    }
    stars[K(x, rnd(1, y - 2))] = true;
    return { mode: 'stars', b: b, movers: [K(x, y)], stars: stars, tip: TIPS.P, t: 'P', ask: 'Piyonu yıldıza götür! İlk hamlede iki kare gidebilir.' };
  }
  // Birden çok beyaz taştan yıldıza tek hamlede hangisi ulaşır
  function tWhichPiece(n) {
    var b, tg, tries = 0, star;
    do {
      b = mk(n);
      var types = shuffle(['R', 'B', 'N', 'Q', 'K']).slice(0, 3);
      for (var i = 0; i < types.length; i++) { var s = emptySq(b); put(b, s[0], s[1], types[i], 'w'); }
      star = emptySq(b);
      tg = [];
      for (var k in b.p) if (b.p.hasOwnProperty(k)) { var p = XY(k); if (contains(legal(b, p[0], p[1]), star[0], star[1])) tg.push(k); }
      tries++;
    } while (tg.length !== 1 && tries < 200);
    var stars = {}; stars[K(star[0], star[1])] = true;
    var movers = []; for (var m in b.p) if (b.p.hasOwnProperty(m)) movers.push(m);
    return { mode: 'stars', b: b, movers: movers, stars: stars, oneMove: true, tip: 'Önce bir taşa dokun, sonra gideceği kareye. Her taş kendi yolundan gider.', ask: 'Yıldıza tek hamlede hangi taş gidebilir? Taşa dokun, sonra yıldıza.' };
  }
  // Siyah taşların hepsini ye (siyahlar oynamaz)
  function solvableEat(b, x, y, foes) {
    var pc = at(b, x, y), start = { x: x, y: y, left: foes.slice() }, seen = {}, queue = [start];
    var id = function (s) { return s.x + ',' + s.y + '|' + s.left.join(';'); };
    seen[id(start)] = true;
    while (queue.length) {
      var s = queue.shift();
      if (!s.left.length) return true;
      var c = mk(b.n);
      for (var i = 0; i < s.left.length; i++) { var f = XY(s.left[i]); c.p[s.left[i]] = b.p[s.left[i]]; }
      c.p[K(s.x, s.y)] = pc;
      var m = moves(c, s.x, s.y);
      for (var j = 0; j < m.length; j++) {
        var k = K(m[j][0], m[j][1]), left = [];
        for (var l = 0; l < s.left.length; l++) if (s.left[l] !== k) left.push(s.left[l]);
        var ns = { x: m[j][0], y: m[j][1], left: left };
        if (seen[id(ns)]) continue;
        seen[id(ns)] = true; queue.push(ns);
      }
    }
    return false;
  }
  function tEat(n, t, nFoes) {
    var b, x, y, foes, tries = 0;
    do {
      b = mk(n); x = rnd(0, n - 1); y = rnd(0, n - 1);
      put(b, x, y, t, 'w');
      foes = [];
      for (var i = 0; i < nFoes; i++) { var s = emptySq(b); put(b, s[0], s[1], 'P', 'b'); foes.push(K(s[0], s[1])); }
      tries++;
    } while ((!solvableEat(b, x, y, foes) || attackedCount(b, x, y) === nFoes) && tries < 300);
    return { mode: 'stars', b: b, movers: [K(x, y)], eat: true, stars: {}, tip: TIPS[t] + ' Rakip taşın karesine giderek onu yer.', t: t,
      ask: ACC[t] + ' oynat, siyah piyonların hepsini ye!' };
  }
  function attackedCount(b, x, y) { var m = legal(b, x, y), c = 0; for (var i = 0; i < m.length; i++) if (at(b, m[i][0], m[i][1])) c++; return c; }

  // Şah çekme: saldıranı bul / şahı kurtar / şah çek
  function checkSetup(n) {
    var b, kx, ky, tries = 0, att;
    do {
      b = mk(n);
      kx = rnd(0, n - 1); ky = rnd(Math.floor(n / 2), n - 1);
      put(b, kx, ky, 'K', 'w');
      var t = pick(['R', 'B', 'Q', 'N', 'P']), s = emptySq(b);
      put(b, s[0], s[1], t, 'b');
      for (var j = 0; j < rnd(1, 2); j++) { var o = emptySq(b); put(b, o[0], o[1], pick(['P', 'N', 'B', 'R']), 'b'); }
      att = attackers(b, kx, ky, 'b');
      tries++;
    } while ((att.length !== 1 || !safeKing(b, kx, ky).length || safeKing(b, kx, ky).length === legalKingAll(b, kx, ky)) && tries < 400);
    return { b: b, k: [kx, ky], att: att[0] };
  }
  function safeKing(b, x, y) { return legal(b, x, y); }
  function legalKingAll(b, x, y) { return moves(b, x, y).length; }
  function tAttacker(n) {
    var s = checkSetup(n), tg = {}; tg[s.att] = true;
    return { mode: 'mark', b: s.b, targets: tg, tip: 'Şaha saldıran taş, şahın olduğu kareye gidebilen taştır. Buna "şah çekmek" denir.', ask: 'Şah çekildi! Beyaz şaha saldıran siyah taşa dokun.', checkK: s.k };
  }
  function tEscape(n) {
    var s = checkSetup(n), safe = safeKing(s.b, s.k[0], s.k[1]);
    return { mode: 'move', b: s.b, movers: [K(s.k[0], s.k[1])], good: keysOf(safe), tip: 'Şah, saldırı altındaki bir kareye gidemez. Tehdit edilmeyen bir kare bul.', ask: 'Şah tehlikede! Şahı güvenli bir kareye götür.', checkK: s.k, badMsg: 'Orası da tehdit altında!' };
  }
  function tGiveCheck(n) {
    var b, x, y, tg, tries = 0, t;
    do {
      b = mk(n); t = pick(['R', 'B', 'Q', 'N']);
      var bk = [rnd(0, n - 1), rnd(0, Math.floor(n / 2))];
      put(b, bk[0], bk[1], 'K', 'b');
      var s = emptySq(b); x = s[0]; y = s[1];
      put(b, x, y, t, 'w');
      tg = [];
      if (attacked(b, bk[0], bk[1], 'w')) { tries++; continue; }
      var m = legal(b, x, y);
      for (var i = 0; i < m.length; i++) {
        var c = clone(b); doMove(c, x, y, m[i][0], m[i][1]);
        if (inCheck(c, 'b')) tg.push(m[i]);
      }
      tries++;
    } while (!tg.length && tries < 300);
    return { mode: 'move', b: b, movers: [K(x, y)], good: keysOf(tg), t: t, tip: TIPS[t] + ' Şah çekmek: şahın karesine saldırmak.', ask: ACC[t] + ' oynat, siyah şaha şah çek!', badMsg: 'Bu karede siyah şaha saldırmıyor.' };
  }
  // Terfi
  function tPromo() {
    var b = mk(8), x = rnd(0, 7);
    put(b, x, 1, 'P', 'w');
    var bx; do { bx = pick([0, 1, 6, 7]); } while (Math.abs(bx - x) < 2);
    put(b, 4, 7, 'K', 'w'); put(b, bx, 0, 'K', 'b');
    var good = {}; good[K(x, 0)] = true;
    return { mode: 'move', b: b, movers: [K(x, 1)], good: good, promo: true, tip: 'Piyon son sıraya ulaşınca vezir, kale, fil ya da at olur. Buna terfi denir.', ask: 'Piyonu son sıraya götür, terfi ettir!' };
  }
  // Rok
  function tCastle() {
    var side = pick(['k', 'q']), b = mk(8);
    put(b, 4, 7, 'K', 'w'); put(b, 7, 7, 'R', 'w'); put(b, 0, 7, 'R', 'w');
    put(b, 4, 0, 'K', 'b');
    for (var x = 0; x < 8; x++) if (Math.random() < 0.7) put(b, x, 6, 'P', 'w');
    // diğer kanat kapalı
    if (side === 'k') put(b, 1, 7, 'N', 'w'); else put(b, 6, 7, 'N', 'w');
    var good = {}; good[K(side === 'k' ? 6 : 2, 7)] = true;
    return { mode: 'move', b: b, movers: [K(4, 7)], good: good, castle: side, tip: 'Rok: şah kaleye doğru iki kare gider, kale şahın üstünden atlayıp yanına geçer.', ask: 'Rok yap! Şahı kaleye doğru iki kare götür.', badMsg: 'Rok için şahı, arası boş olan kaleye doğru iki kare götür.' };
  }
  function tCastleQ(seen) {
    var b = mk(8), kinds = ['ok', 'between', 'check', 'through'], kind, tries = 0;
    do { kind = pick(kinds); tries++; } while (seen && seen['cq' + kind] && tries < 20);
    if (seen) seen['cq' + kind] = true;
    put(b, 4, 7, 'K', 'w'); put(b, 7, 7, 'R', 'w'); put(b, 4, 0, 'K', 'b');
    for (var x = 0; x < 8; x++) if (x !== 4 && Math.random() < 0.6) put(b, x, 6, 'P', 'w');
    var ans = 'Evet', tip = 'Şah ile kale arası boş, şah tehdit altında değil: rok yapılabilir.';
    if (kind === 'between') { put(b, pick([5, 6]), 7, pick(['B', 'N']), 'w'); ans = 'Hayır'; tip = 'Şah ile kale arasında taş varken rok yapılamaz.'; }
    if (kind === 'check') { put(b, 4, 2, 'R', 'b'); ans = 'Hayır'; tip = 'Şah tehdit altındayken (şah çekilmişken) rok yapılamaz.'; }
    if (kind === 'through') { delete b.p[K(3, 5)]; put(b, 2, 4, 'B', 'b'); ans = 'Hayır'; tip = 'Şah, tehdit altındaki bir kareden geçerek rok yapamaz. Siyah fil f1 karesine saldırıyor.'; }
    return { mode: 'choose', b: b, hl: [K(4, 7), K(7, 7)], answer: ans, opts: ['Evet', 'Hayır'], tip: tip, labels: true, ask: 'Beyaz şah bu kaleyle rok yapabilir mi?' };
  }
  // Geçerken alma
  function tEnPassant() {
    var b = mk(8), x = rnd(1, 6), dx = pick([-1, 1]);
    put(b, x, 3, 'P', 'w'); put(b, x + dx, 3, 'P', 'b');
    put(b, 4, 7, 'K', 'w'); put(b, x === 4 || x + dx === 4 ? 0 : 4, 0, 'K', 'b');
    b.ep = [x + dx, 2];
    var good = {}; good[K(x + dx, 2)] = true;
    return { mode: 'move', b: b, movers: [K(x, 3)], good: good, ghost: K(x + dx, 1), tip: 'Geçerken alma: rakip piyon iki kare ilerleyip piyonunun yanına gelirse, hemen o hamlede çapraz gidip onu alabilirsin.', ask: 'Siyah piyon iki kare ilerledi. Geçerken al!', badMsg: 'Geçerken almak için çapraz git, siyah piyonun arkasındaki kareye.' };
  }
  // Tam tahta diziliş
  var BACK = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  function fullBoard() {
    var b = mk(8);
    for (var x = 0; x < 8; x++) { put(b, x, 7, BACK[x], 'w'); put(b, x, 6, 'P', 'w'); put(b, x, 0, BACK[x], 'b'); put(b, x, 1, 'P', 'b'); }
    return b;
  }
  function tPlace(seen) {
    var t, c, tries = 0;
    do { t = pick(['R', 'N', 'B', 'Q', 'K', 'P', 'Q', 'K']); c = Math.random() < 0.7 ? 'w' : 'b'; tries++; } while (seen['pl' + t + c] && tries < 20);
    seen['pl' + t + c] = true;
    var b = fullBoard(), row = c === 'w' ? 7 : 0, prow = c === 'w' ? 6 : 1, tg = {}, x;
    for (x = 0; x < 8; x++) {
      if (t === 'P') { delete b.p[K(x, prow)]; tg[K(x, prow)] = true; }
      else if (BACK[x] === t) { delete b.p[K(x, row)]; tg[K(x, row)] = true; }
    }
    var cn = c === 'w' ? 'Beyaz' : 'Siyah';
    var PLURAL = { R: 'kaleler', N: 'atlar', B: 'filler' }, LOWER = { Q: 'vezir', K: 'şah' };
    var tipMap = {
      R: 'Kaleler köşelerde durur.', N: 'Atlar kalelerin yanında durur.', B: 'Filler atların yanında durur.',
      Q: 'Vezir kendi rengindeki kareye konur: beyaz vezir beyaz kareye, siyah vezir siyah kareye.', K: 'Şah, vezirin yanındaki kareye konur.', P: 'Piyonlar ikinci sırada, taşların önünde durur.'
    };
    var q = { mode: t === 'P' ? 'pick' : 'mark', b: b, targets: tg, tip: tipMap[t], placeT: t, placeC: c, labels: true };
    q.ask = t === 'P' ? cn + ' piyonlar hangi sırada durur? Bir kareye dokun.' : PLURAL[t] ? cn + ' ' + PLURAL[t] + ' nereye konur? İki kareye de dokun.' : cn + ' ' + LOWER[t] + ' nereye konur?';
    return q;
  }
  function tWhich(seen) {
    var x, c, tries = 0;
    do { x = rnd(0, 7); c = pick(['w', 'b']); tries++; } while (seen['wh' + x + c] && tries < 20);
    seen['wh' + x + c] = true;
    var b = fullBoard(), y = c === 'w' ? 7 : 0, t = BACK[x];
    delete b.p[K(x, y)];
    var others = shuffle(['R', 'N', 'B', 'Q', 'K'].filter(function (v) { return v !== t; })).slice(0, 2);
    return { mode: 'choose', b: b, hl: [K(x, y)], answer: t, opts: shuffle([t].concat(others)), pieceOpts: c, labels: true,
      tip: 'Arka sıra: kale, at, fil, vezir, şah, fil, at, kale.', ask: 'İşaretli kareye hangi taş konur?' };
  }
  // Mat bulmacaları (beyaz oynar, tek hamlede mat)
  var MATES = [
    'wRa1 wKg1 bKg8 bPf7 bPg7 bPh7',
    'wQd1 wKg1 bKg8 bPf7 bPg7 bPh7',
    'wKb6 wQd7 bKa8',
    'wRa7 wRb1 wKe1 bKh8',
    'wNg5 wKa1 bKh8 bRg8 bPg7 bPh7',
    'wKf6 wRa1 bKf8',
    'wQh5 wBc4 wKe1 bKe8 bQd8 bBf8 bNg8 bPd7 bPe7 bPf7 bPg7 bPh7 bPa7 bPb7 bPc7 bRa8 bRh8 bNb8 bBc8'
  ];
  function mateMoves(b) {
    var out = {};
    for (var k in b.p) {
      if (!b.p.hasOwnProperty(k) || b.p[k].c !== 'w') continue;
      var s = XY(k), m = legal(b, s[0], s[1]);
      for (var i = 0; i < m.length; i++) {
        var c = clone(b); doMove(c, s[0], s[1], m[i][0], m[i][1]);
        if (isMate(c, 'b')) out[k + '>' + K(m[i][0], m[i][1])] = true;
      }
    }
    return out;
  }
  function tMate(seen) {
    var i, tries = 0;
    do { i = rnd(0, MATES.length - 1); tries++; } while (seen['m' + i] && tries < 20);
    seen['m' + i] = true;
    var b = parse(MATES[i], Math.random() < 0.5);
    var movers = []; for (var k in b.p) if (b.p.hasOwnProperty(k) && b.p[k].c === 'w') movers.push(k);
    return { mode: 'move', b: b, movers: movers, goodMoves: mateMoves(b), labels: true, mate: true,
      tip: 'Mat: şah tehdit altında ve kaçacak, saklanacak ya da saldıranı yiyecek yolu yok. Oyun biter.', ask: 'Tek hamlede mat et! Taşa dokun, sonra gideceği kareye.', badMsg: 'Bu hamle mat değil; siyah şah kurtulabiliyor.' };
  }
  // Tam tahta karışık: rastgele dağınık konumda hamle bul
  function tMark8() {
    var q = tMark(pick(['R', 'B', 'Q', 'N', 'K']), 8, { own: rnd(2, 3), foe: rnd(2, 3) });
    q.labels = true;
    return q;
  }
  function tCap8() {
    var q = tMark(pick(['R', 'B', 'Q', 'N']), 8, { own: 2, foe: 4, capOnly: true });
    q.labels = true;
    return q;
  }

  /* ---------------- Seviyeler ---------------- */
  function pieceLevel(t) {
    var n = t === 'P' ? 6 : 5;
    if (t === 'P') return [
      function () { var q = tMark('P', n); q.showDots = true; q.ask = 'Piyon nereye gidebilir? Gördüğün karelere dokun!'; return q; },
      function () { return tPawnStar(n, false); },
      function () { return tMark('P', n, { pawnFoe: true }); },
      function () { return tPawnStar(n, true); },
      function () { return tMark('P', n, { pawnFoe: true }); },
      function () { return tPawnStar(n, false); },
      function () { return tMark('P', n, { pawnFoe: true }); },
      function () { return tPawnStar(n, true); }
    ];
    var big = t === 'K' || t === 'N' ? 2 : 3;
    return [
      function () { var q = tMark(t, n); q.showDots = true; q.ask = GEN[t] + ' gidebildiği kareler noktalı. Hepsine dokun!'; return q; },
      function () { return tStars(t, n, 1); },
      function () { return tMark(t, n); },
      function () { return tStars(t, n, 2); },
      function () { return tMark(t, n); },
      function () { return tStars(t, n, big); },
      function () { return tMark(t, n); },
      function () { return tStars(t, n, big); }
    ];
  }
  var LEVEL_TASKS = {
    R: function () { return pieceLevel('R'); },
    B: function () { return pieceLevel('B'); },
    Q: function () { return pieceLevel('Q'); },
    K: function () { return pieceLevel('K'); },
    N: function () { return pieceLevel('N'); },
    P: function () { return pieceLevel('P'); },
    block: function () {
      return [
        function () { return tMark(pick(['R', 'B', 'Q']), 6, { own: 3 }); },
        function () { return tWhichPiece(6); },
        function () { return tStars(pick(['R', 'B', 'Q']), 6, 2, { own: 3 }); },
        function () { return tMark(pick(['R', 'Q', 'N']), 6, { own: 4 }); },
        function () { return tWhichPiece(6); },
        function () { return tStars(pick(['R', 'N', 'Q']), 6, 2, { own: 4 }); },
        function () { return tMark(pick(['B', 'Q', 'N']), 6, { own: 4 }); },
        function () { return tWhichPiece(6); }
      ];
    },
    capture: function () {
      return [
        function () { return tMark(pick(['R', 'B', 'Q']), 6, { foe: 3, capOnly: true }); },
        function () { return tEat(5, pick(['R', 'Q']), 2); },
        function () { return tMark(pick(['N', 'Q', 'R']), 6, { foe: 4, capOnly: true }); },
        function () { return tEat(5, pick(['B', 'N', 'Q']), 2); },
        function () { return tMark(pick(['B', 'K', 'N']), 6, { foe: 4, own: 1, capOnly: true }); },
        function () { return tEat(6, pick(['R', 'Q', 'N']), 3); },
        function () { return tMark(pick(['Q', 'R', 'B', 'N']), 6, { foe: 4, own: 2, capOnly: true }); },
        function () { return tEat(6, pick(['Q', 'B', 'R']), 3); }
      ];
    },
    check: function () {
      return [
        function () { return tAttacker(6); },
        function () { return tEscape(6); },
        function () { return tGiveCheck(6); },
        function () { return tAttacker(6); },
        function () { return tEscape(6); },
        function () { return tGiveCheck(6); },
        function () { return tEscape(6); },
        function () { return tGiveCheck(6); }
      ];
    },
    special: function () {
      return [tPromo, tCastle, tEnPassant, tCastleQ, tPromo, tCastle, tCastleQ, tEnPassant];
    },
    setup: function () {
      return [tPlace, tPlace, tWhich, tPlace, tWhich, tPlace, tWhich, tPlace];
    },
    champ: function () {
      var a = [tMark8, tCap8, function () { var q = tAttacker(8); q.labels = true; return q; }, function () { var q = tEscape(8); q.labels = true; return q; },
        function () { var q = tGiveCheck(8); q.labels = true; return q; }, tMate, tMate, tMate];
      return shuffle(a);
    }
  };

  /* ---------------- Çizim ve etkileşim ---------------- */
  var C = null; // aktif görev durumu

  function sqSize(n) {
    var z = n === 8 ? 2.3 : n === 6 ? 3 : 3.5;
    return document.body.className.indexOf('portrait') !== -1 ? Math.round(z * 155) / 100 : z; // dikey ekranda büyük tahta
  }
  function buildTask(q) {
    var stage = $('stage'), n = q.b.n, sz = sqSize(n);
    stage.innerHTML = '';
    stage.className = 'stage cs-stage';
    var row = el('div', 'cs-row');
    var wrap = el('div', 'cs-wrap' + (q.labels ? ' lab' : ''));
    var board = el('div', 'cs-board');
    board.style.width = board.style.height = (n * sz) + 'rem';
    var h = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      h += '<div class="sq ' + ((x + y) % 2 ? 'd' : 'l') + '" data-k="' + K(x, y) + '" style="left:' + (x * sz) + 'rem;top:' + (y * sz) + 'rem;width:' + sz + 'rem;height:' + sz + 'rem"><i class="mk"></i></div>';
    }
    board.innerHTML = h + '<div class="cs-pcs"></div>';
    wrap.appendChild(board);
    if (q.labels) {
      var fl = '', rl = '';
      for (var i = 0; i < n; i++) {
        fl += '<span style="left:' + (i * sz) + 'rem;width:' + sz + 'rem">' + String.fromCharCode(97 + i) + '</span>';
        rl += '<span style="top:' + (i * sz) + 'rem;height:' + sz + 'rem;line-height:' + sz + 'rem">' + (n - i) + '</span>';
      }
      wrap.appendChild(el('div', 'cs-files', fl));
      wrap.appendChild(el('div', 'cs-ranks', rl));
    }
    row.appendChild(wrap);
    var side = el('div', 'cs-side', '<div id="cs-ask" class="cs-ask"></div><div id="cs-cnt" class="cs-cnt"></div><div id="cs-note" class="cs-note"></div>');
    row.appendChild(side);
    stage.appendChild(row);
    C.board = board; C.sz = sz; C.pcs = board.querySelector('.cs-pcs'); C.nodes = {};
    C.squares = {};
    var sqs = board.querySelectorAll('.sq');
    for (var s = 0; s < sqs.length; s++) C.squares[sqs[s].getAttribute('data-k')] = sqs[s];
    C.marker = el('span', 'cs-burst');
    board.appendChild(C.marker);
    renderPieces();
    // yıldızlar, vurgular
    for (var sk in q.stars) if (q.stars.hasOwnProperty(sk)) C.squares[sk].querySelector('.mk').innerHTML = STAR;
    if (q.hl) for (var hi = 0; hi < q.hl.length; hi++) C.squares[q.hl[hi]].className += ' hl';
    if (q.checkK) C.squares[K(q.checkK[0], q.checkK[1])].className += ' chk';
    if (q.ghost) C.squares[q.ghost].querySelector('.mk').innerHTML = '<span class="ghost">' + pieceSVG('P', 'b') + '</span>';
    if (q.showDots) {
      var src = q.piece || XY(q.movers[0]), lm = legal(q.b, src[0], src[1]);
      for (var d = 0; d < lm.length; d++) C.squares[K(lm[d][0], lm[d][1])].className += ' hint';
    }
    board.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== board && !(t.getAttribute && t.getAttribute('data-k'))) t = t.parentNode;
      if (!t || t === board) return;
      tap(t.getAttribute('data-k'));
    });
    $('cs-ask').innerHTML = q.ask;
    updateCount();
    if (q.movers && q.movers.length === 1) select(q.movers[0]);
  }
  function renderPieces() {
    var b = C.q.b, h = '';
    C.pcs.innerHTML = '';
    C.nodes = {};
    for (var k in b.p) {
      if (!b.p.hasOwnProperty(k)) continue;
      var p = XY(k), node = el('div', 'pc', pieceSVG(b.p[k].t, b.p[k].c));
      node.style.width = node.style.height = C.sz + 'rem';
      placeNode(node, p[0], p[1]);
      C.pcs.appendChild(node);
      C.nodes[k] = node;
    }
  }
  function placeNode(node, x, y) {
    var v = 'translate(' + (x * 100) + '%,' + (y * 100) + '%)';
    node.style.webkitTransform = node.style.transform = v;
  }
  function updateCount() {
    var q = C.q, cnt = $('cs-cnt');
    if (!cnt) return;
    if (q.mode === 'mark') cnt.innerHTML = C.found + ' / ' + count(q.targets);
    else if (q.mode === 'stars' && !q.eat) cnt.innerHTML = count(q.stars) ? 'Kalan yıldız: ' + count(q.stars) : '';
    else if (q.mode === 'stars' && q.eat) cnt.innerHTML = 'Kalan siyah taş: ' + blackCount();
    else cnt.innerHTML = '';
  }
  function blackCount() { var n = 0; for (var k in C.q.b.p) if (C.q.b.p.hasOwnProperty(k) && C.q.b.p[k].c === 'b') n++; return n; }
  function note(text, ok) {
    var n = $('cs-note');
    if (!n) return;
    n.innerHTML = text;
    n.className = 'cs-note show' + (ok ? ' ok' : '');
  }
  function clsToggle(k, cls, on) {
    var s = C.squares[k];
    if (!s) return;
    var c = ' ' + s.className + ' ';
    if (on && c.indexOf(' ' + cls + ' ') === -1) s.className += ' ' + cls;
    if (!on) s.className = c.replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }
  function select(k) {
    if (C.sel) clsToggle(C.sel, 'sel', false);
    C.sel = k;
    if (k) clsToggle(k, 'sel', true);
  }
  function flashBad(k) { var s = C.squares[k]; if (s) M.restartAnim(s, 'bad'); }
  function showHints(k) {
    var p = XY(k), lm = legal(C.q.b, p[0], p[1]);
    clearHints();
    for (var i = 0; i < lm.length; i++) clsToggle(K(lm[i][0], lm[i][1]), 'hint', true);
    C.hintOn = true;
  }
  function clearHints() { for (var k in C.squares) if (C.squares.hasOwnProperty(k)) clsToggle(k, 'hint', false); C.hintOn = false; }

  function wrong(k, msg) {
    var g = M.G();
    g.wrongNow++; g.streak = 0;
    Snd.wrong();
    M.mascot.face('sad', 700);
    if (k) flashBad(k);
    say(pick(M.RETRY));
    note(msg || C.q.tip, false);
  }
  function success(k, okText) {
    var g = M.G();
    if (g.locked) return;
    var q = C.q, s = k && C.squares[k];
    if (s) { C.marker.style.left = s.style.left; C.marker.style.top = s.style.top; C.marker.style.width = s.style.width; C.marker.style.height = s.style.height; }
    q.answer = 'ok'; q.keepBtn = true; q.delay = 1500;
    q.onRight = function () { note(okText || q.tip, true); };
    M.answer(C.marker, 'ok');
  }

  function animateMove(from, to, after) {
    var b = C.q.b, f = XY(from), t = XY(to), node = C.nodes[from], victim = C.nodes[to];
    if (victim) { victim.className += ' gone'; }
    if (b.ep && at(b, f[0], f[1]).t === 'P' && t[0] === b.ep[0] && t[1] === b.ep[1]) {
      var epk = K(t[0], f[1]);
      if (C.nodes[epk]) C.nodes[epk].className += ' gone';
      if (C.q.ghost) C.squares[C.q.ghost].querySelector('.mk').innerHTML = '';
    }
    doMove(b, f[0], f[1], t[0], t[1], C.promo);
    delete C.nodes[from];
    if (node) { placeNode(node, t[0], t[1]); C.nodes[to] = node; }
    Snd.tone(520, 0, 0.08, 'triangle', 0.18);
    later(function () { renderPieces(); if (after) after(); }, 300);
  }

  function tap(k) {
    var g = M.G(), q = C.q;
    if (!g || g.locked || C.busy) return;
    var p = XY(k), pc = at(q.b, p[0], p[1]);
    if (q.mode === 'mark' || q.mode === 'pick') {
      if (C.done[k]) return;
      if (q.targets[k]) {
        C.done[k] = true; C.found++;
        if (q.placeT) { put(q.b, p[0], p[1], q.placeT, q.placeC); renderPieces(); }
        else C.squares[k].querySelector('.mk').innerHTML = '<span class="dot"></span>';
        clsToggle(k, 'ok', true);
        clsToggle(k, 'hint', false);
        Snd.count(Math.min(C.found + 1, 14));
        updateCount();
        if (q.mode === 'pick' || C.found >= count(q.targets)) success(k);
        return;
      }
      if (q.piece && p[0] === q.piece[0] && p[1] === q.piece[1]) return;
      wrong(k);
      return;
    }
    if (q.mode === 'choose') return;
    // stars / move: taş seç, sonra hedef
    var isMover = q.movers && q.movers.indexOf(k) !== -1 && pc && pc.c === 'w';
    if (isMover && C.sel !== k && !(C.sel && q.movers.length === 1)) { select(k); Snd.tap(); clearHints(); return; }
    if (!C.sel) { wrong(k, 'Önce oynatacağın beyaz taşa dokun.'); return; }
    var s = XY(C.sel), sp = at(q.b, s[0], s[1]);
    if (k === C.sel) return;
    // rok
    if (q.castle && sp.t === 'K') {
      if (q.good[k]) { doCastle(k); return; }
      wrong(k, q.badMsg); return;
    }
    var lm = legal(q.b, s[0], s[1]);
    if (!contains(lm, p[0], p[1])) {
      if (pc && pc.c === 'w' && q.movers.indexOf(k) !== -1) { select(k); return; }
      // şahı kurtar: komşu kare ama tehdit altında
      var mv = moves(q.b, s[0], s[1]);
      wrong(k, q.badMsg && sp.t === 'K' && contains(mv, p[0], p[1]) ? q.badMsg : TIPS[sp.t]);
      showHints(C.sel);
      return;
    }
    if (q.mode === 'move') {
      var ok = q.goodMoves ? q.goodMoves[C.sel + '>' + k] : q.good[k];
      if (!ok) { wrong(k, q.badMsg || q.tip); return; }
      var from = C.sel;
      C.busy = true;
      clearHints();
      if (q.promo) { promoChoice(from, k); return; }
      animateMove(from, k, function () {
        C.busy = false; select(null);
        if (q.mate) clsToggle(K(kingOf(q.b, 'b')[0], kingOf(q.b, 'b')[1]), 'chk', true);
        success(k, q.mate ? 'Mat! ' + q.tip : null);
      });
      return;
    }
    // stars
    var from2 = C.sel;
    C.busy = true;
    clearHints();
    animateMove(from2, k, function () {
      C.busy = false;
      select(k);
      if (q.movers.length === 1) q.movers = [k]; else { var mi = q.movers.indexOf(from2); q.movers[mi] = k; }
      if (q.stars[k]) {
        delete q.stars[k];
        C.squares[k].querySelector('.mk').innerHTML = '';
        Snd.tone(988, 0, 0.12, 'triangle', 0.22);
        M.burst(C.squares[k], 8);
      }
      updateCount();
      var left = q.eat ? blackCount() : count(q.stars);
      if (!left) { success(k); return; }
      if (q.oneMove) { wrong(null, 'Bu taş yıldıza gitmedi. ' + q.tip); later(function () { resetTask(); }, 900); }
    });
  }
  function doCastle(to) {
    var q = C.q, ks = q.castle === 'k';
    C.busy = true;
    var kNode = C.nodes[K(4, 7)], rFrom = K(ks ? 7 : 0, 7), rNode = C.nodes[rFrom];
    delete q.b.p[K(4, 7)]; delete q.b.p[rFrom];
    put(q.b, ks ? 6 : 2, 7, 'K', 'w'); put(q.b, ks ? 5 : 3, 7, 'R', 'w');
    placeNode(kNode, ks ? 6 : 2, 7);
    later(function () { placeNode(rNode, ks ? 5 : 3, 7); Snd.tone(660, 0, 0.1, 'triangle', 0.2); }, 280);
    later(function () { renderPieces(); C.busy = false; select(null); success(to); }, 650);
  }
  function promoChoice(from, to) {
    var q = C.q;
    C.promo = 'P'; // seçim yapılana kadar piyon olarak kalsın
    animateMove(from, to, function () {
      C.promo = null; C.busy = false; select(null);
      say('Neye dönüşsün?');
      note('Piyon son sıraya ulaştı! Vezir, kale, fil ya da at seç.', true);
      q.opts = ['Q', 'R', 'B', 'N'];
      q.controls = function (box) {
        for (var i = 0; i < q.opts.length; i++) {
          (function (v, n) {
            var b = el('button', 'ch pic cspc', pieceSVG(v, 'w') + '<span>' + NAMES[v] + '</span>');
            b.style.webkitAnimationDelay = b.style.animationDelay = (0.08 * n + 0.1) + 's';
            b.addEventListener('click', function () {
              var t = XY(to);
              put(q.b, t[0], t[1], v, 'w');
              renderPieces();
              q.answer = v; q.keepBtn = false; q.delay = 1600;
              q.onRight = function () { note(NAMES[v] + ' oldu! ' + q.tip, true); };
              M.answer(b, v);
            });
            box.appendChild(b);
          })(q.opts[i], i);
        }
      };
      M.buildChoices(q);
    });
  }
  function resetTask() {
    var g = M.G();
    C.q = C.orig();
    C.q.b = C.q.b; // yeni kopya
    start(C.q, true);
    if (g) g.locked = false;
  }

  function start(q, keepCount) {
    var g = M.G();
    C.q = q; C.found = 0; C.done = {}; C.sel = null; C.busy = false;
    g.cur = q; g.locked = false;
    if (!keepCount) g.wrongNow = 0;
    g.qid = (g.qid || 0) + 1;
    buildTask(q);
    if (q.mode === 'choose') {
      q.optClass = q.pieceOpts ? 'pic cspc' : 'word';
      if (q.pieceOpts) q.optHTML = function (v) { return pieceSVG(v, q.pieceOpts) + '<span>' + NAMES[v] + '</span>'; };
      q.hint = function () { note(q.tip, false); return pick(M.RETRY); };
      q.onRight = function () { note(q.tip, true); };
      q.delay = 1600;
      M.buildChoices(q);
    } else {
      $('choices').innerHTML = '';
    }
    M.renderDots();
    var hello = { mark: 'Dikkatle bak!', pick: 'Düşün ve dokun!', stars: 'Haydi oynat!', move: 'Doğru hamleyi bul!', choose: 'Hangisi?' };
    say(q.showDots ? 'Noktalar gidebildiği kareler!' : hello[q.mode] || 'Haydi!');
  }

  function next() {
    var g = M.G();
    if (!C || C.g !== g) return;
    if (g.q >= C.tasks.length) { M.finishLevel(); return; }
    var maker = C.tasks[g.q];
    var mkTask = function () { return maker(C.seen); };
    C.orig = function () {
      // bulmacayı yeniden kurmak için aynı tahtanın kopyası
      var base = C.snap;
      var copy = {}; for (var k in base) if (base.hasOwnProperty(k)) copy[k] = base[k];
      copy.b = clone(base.b);
      copy.stars = {}; for (var s in base.stars) if (base.stars.hasOwnProperty(s)) copy.stars[s] = true;
      copy.movers = base.movers ? base.movers.slice() : null;
      return copy;
    };
    var q = mkTask();
    C.snap = q;
    var live = C.orig();
    start(live);
  }

  function setup(i) {
    var g = M.G();
    C = { g: g, seen: {}, tasks: LEVEL_TASKS[g.lv.kind]() };
    $('stage').innerHTML = '';
    $('choices').innerHTML = '';
  }

  M.register('chess', { setup: setup, next: next });
  // testler için
  window.ChessRules = { cur: function () { return C && !C.busy ? C.q : null; }, mk: mk, put: put, legal: legal, moves: moves, attacked: attacked, inCheck: inCheck, isMate: isMate, parse: parse, mateMoves: mateMoves, MATES: MATES, LEVEL_TASKS: LEVEL_TASKS, reach: reach, solvableEat: solvableEat, K: K, XY: XY, at: at };
})();
