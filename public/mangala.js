/* Mangala — Türk Mangalası (Akıl ve Zekâ Oyunları kuralları).
 * Ana sayfa açıldıktan sonra yüklenir (app.js: loadLazy). Yalnızca ES5.
 *
 * Tahta dizini: 0-5 alt sıra (oyuncu 0, soldan sağa), 6 oyuncu 0 hazinesi (sağda),
 * 7-12 üst sıra (oyuncu 1, sağdan sola), 13 oyuncu 1 hazinesi (solda).
 * Taşlar saat yönünün tersine dağılır; rakibin hazinesi atlanır. */
(function () {
  'use strict';
  var M = window.Mandi;
  if (!M) return;
  var $ = M.$, el = M.el, rnd = M.rnd, pick = M.pick, later = M.later, say = M.say, Snd = M.Snd;

  var STONE_COLORS = ['#ef476f', '#3a86ff', '#3bb273', '#ffd23f', '#8e7dff', '#ff8a3d', '#14a3a3', '#d65db1'];
  var POS = [[0, 0], [-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7], [0, -1.4], [0, 1.4], [-1.9, 0], [1.9, 0],
    [-1.5, -1.45], [1.5, -1.45], [-1.5, 1.45], [1.5, 1.45]];
  var STEP = 210;

  var S = null; // oyun durumu

  /* ---------------- Kurallar ---------------- */
  function storeOf(p) { return p === 0 ? 6 : 13; }
  function onSide(i, p) { return p === 0 ? i >= 0 && i <= 5 : i >= 7 && i <= 12; }
  function sideSum(s, p) { var t = 0, a = p === 0 ? 0 : 7; for (var i = a; i < a + 6; i++) t += s[i]; return t; }
  function legal(s, p) {
    var out = [], a = p === 0 ? 0 : 7;
    for (var i = a; i < a + 6; i++) if (s[i] > 0) out.push(i);
    return out;
  }
  // Hamleyi s üzerinde uygular; animasyon için ayrıntıları döndürür
  function applyMove(s, pit, p) {
    var own = storeOf(p), skip = storeOf(1 - p);
    var nxt = function (i) { i = (i + 1) % 14; if (i === skip) i = (i + 1) % 14; return i; };
    var n = s[pit], path = [], idx = pit;
    s[pit] = 0;
    if (n === 1) { idx = nxt(pit); s[idx]++; path.push(idx); }
    else {
      s[pit] = 1; path.push(pit); n--;
      while (n > 0) { idx = nxt(idx); s[idx]++; path.push(idx); n--; }
    }
    var res = { pit: pit, p: p, path: path, last: idx, extra: false, cap: null, over: false, collect: null };
    if (idx === own) res.extra = true;
    else if (onSide(idx, 1 - p)) {
      if (s[idx] % 2 === 0) {
        res.cap = { type: 'even', pits: [idx], amount: s[idx] };
        s[own] += s[idx]; s[idx] = 0;
      }
    } else if (onSide(idx, p) && s[idx] === 1) {
      var o = 12 - idx;
      if (s[o] > 0) {
        res.cap = { type: 'empty', pits: [idx, o], amount: s[o] + 1 };
        s[own] += s[o] + 1; s[idx] = 0; s[o] = 0;
      }
    }
    // Bitiş: kuyuları ilk biten oyuncu, rakibin kuyularındaki taşları alır
    var e = sideSum(s, p) === 0 ? p : sideSum(s, 1 - p) === 0 ? 1 - p : -1;
    if (e !== -1) {
      var other = 1 - e, a = other === 0 ? 0 : 7, amt = 0, pits = [];
      for (var i = a; i < a + 6; i++) { if (s[i]) pits.push(i); amt += s[i]; s[i] = 0; }
      s[storeOf(e)] += amt;
      res.over = true;
      res.collect = { by: e, amount: amt, pits: pits };
    }
    return res;
  }

  /* ---------------- Mandi'nin hamlesi ---------------- */
  function evalState(s) { return s[13] - s[6]; } // oyuncu 1 (Mandi) açısından
  function search(s, p, depth, alpha, beta) {
    var moves = legal(s, p);
    if (depth === 0 || !moves.length) return evalState(s);
    var best = p === 1 ? -9999 : 9999;
    for (var i = 0; i < moves.length; i++) {
      var c = s.slice(), r = applyMove(c, moves[i], p), v;
      if (r.over) v = (c[13] - c[6]) * 100;
      else v = search(c, r.extra ? p : 1 - p, depth - 1, alpha, beta);
      if (p === 1) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (beta <= alpha) break;
    }
    return best;
  }
  function bestMove(s, p, depth) {
    var moves = legal(s, p), best = null, bv = p === 1 ? -99999 : 99999;
    var order = M.shuffle(moves.slice());
    for (var i = 0; i < order.length; i++) {
      var c = s.slice(), r = applyMove(c, order[i], p), v;
      if (r.over) v = (c[13] - c[6]) * 100;
      else v = search(c, r.extra ? p : 1 - p, depth - 1, -99999, 99999);
      if (p === 1 ? v > bv : v < bv) { bv = v; best = order[i]; }
    }
    return best;
  }
  function aiMove() {
    var moves = legal(S.s, 1), d = S.lv.kind;
    if (d === 'easy') return Math.random() < 0.55 ? pick(moves) : bestMove(S.s, 1, 1);
    if (d === 'mid') return Math.random() < 0.2 ? pick(moves) : bestMove(S.s, 1, 3);
    return bestMove(S.s, 1, 6);
  }

  /* ---------------- Çizim ---------------- */
  function stonesHTML(n, max, store) {
    var h = '', k = Math.min(n, max);
    for (var i = 0; i < k; i++) {
      var c = STONE_COLORS[(i * 5 + 3) % STONE_COLORS.length];
      if (store) h += '<i style="background:' + c + '"></i>';
      // konumlar kuyu boyutuna göre yüzde: dikey ekranda küçük kuyuda da doğru durur
      else h += '<i style="background:' + c + ';left:' + (42 + POS[i][0] * 17.86).toFixed(1) + '%;top:' + (42 + POS[i][1] * 17.86).toFixed(1) + '%"></i>';
    }
    return h;
  }
  function renderCell(i) {
    var n = S.view[i], node = S.cells[i];
    if (node._n === n) return;
    node._n = n;
    var store = i === 6 || i === 13;
    node.querySelector('.mg-st').innerHTML = stonesHTML(n, store ? 36 : POS.length, store);
    node.querySelector('.mg-cnt').innerHTML = n;
  }
  function renderAll() { for (var i = 0; i < 14; i++) renderCell(i); }
  function flash(i, cls) { M.restartAnim(S.cells[i], cls); }

  function names() {
    return S.two ? ['Mavi', 'Turuncu'] : ['Sen', 'Mandi'];
  }
  function renderTurn() {
    var nm = names(), box = $('choices');
    var chip = function (p) {
      return '<div class="mg-chip p' + p + (S.turn === p && !S.over ? ' on' : '') + '"><b>' + nm[p] + '</b><span>' + S.view[storeOf(p)] + '</span></div>';
    };
    var msg = S.over ? 'Oyun bitti!' : S.two ? 'Sıra: <b>' + nm[S.turn] + '</b>' : S.turn === 0 ? 'Sıra <b>sende</b>!' : 'Mandi düşünüyor...';
    box.innerHTML = '<div class="mg-turn">' + chip(0) + '<div class="mg-msg">' + msg + '</div>' + chip(1) + '</div>';
    S.board.className = 'mg-board turn' + S.turn + (S.over ? ' over' : '');
    markHints();
  }
  // Kolay seviyede: bir tur daha kazandıran ve taş aldıran kuyuları göster
  function markHints() {
    for (var i = 0; i < 14; i++) if (S.cells[i]._hint) { S.cells[i].querySelector('.mg-hint').className = 'mg-hint'; S.cells[i]._hint = false; }
    if (!S.lv.hints || S.busy || S.over || (S.turn === 1 && !S.two)) return;
    var moves = legal(S.s, S.turn);
    for (var k = 0; k < moves.length; k++) {
      var r = applyMove(S.s.slice(), moves[k], S.turn);
      var cls = r.extra ? 'extra' : r.cap ? 'cap' : '';
      if (cls) { S.cells[moves[k]].querySelector('.mg-hint').className = 'mg-hint ' + cls; S.cells[moves[k]]._hint = true; }
    }
  }

  function buildBoard(stage) {
    stage.innerHTML = '';
    stage.className = 'stage mg-stage';
    var nm = names();
    var b = el('div', 'mg-board');
    var cell = function (i) {
      var store = i === 6 || i === 13;
      var c = el(store ? 'div' : 'button', store ? 'mg-store s' + (i === 6 ? 0 : 1) : 'mg-pit ' + (i < 6 ? 'p0' : 'p1'),
        '<div class="mg-st"></div><b class="mg-cnt">0</b>' + (store ? '<em>' + nm[i === 6 ? 0 : 1] + '</em>' : '<span class="mg-hint"></span>'));
      c.setAttribute('data-i', i);
      S.cells[i] = c;
      if (!store) c.addEventListener('click', function () { tapPit(i); });
      return c;
    };
    b.appendChild(cell(13));
    var rows = el('div', 'mg-rows');
    var top = el('div', 'mg-row top'), bot = el('div', 'mg-row bot');
    for (var t = 12; t >= 7; t--) top.appendChild(cell(t));
    for (var u = 0; u <= 5; u++) bot.appendChild(cell(u));
    rows.appendChild(top); rows.appendChild(bot);
    b.appendChild(rows);
    b.appendChild(cell(6));
    stage.appendChild(b);
    S.board = b;
  }

  /* ---------------- Oyun akışı ---------------- */
  function tapPit(i) {
    if (!S || S.busy || S.over) return;
    var p = onSide(i, 0) ? 0 : 1;
    if (!S.two && S.turn === 1) return;
    if (p !== S.turn) {
      Snd.wrong(); flash(i, 'shake');
      say(S.two ? 'Sıra ' + names()[S.turn] + ' oyuncuda!' : 'Alttaki kendi kuyularından seç!');
      return;
    }
    if (!S.s[i]) { Snd.wrong(); flash(i, 'shake'); say('Bu kuyu boş!'); return; }
    Snd.tap();
    play(i, p);
  }

  function play(pit, p) {
    S.busy = true;
    markHints();
    var before = S.s.slice();
    var r = applyMove(S.s, pit, p);
    S.view = before;
    // ilk adım: kuyu boşalır (birden çok taşta biri geri konur)
    S.view[pit] = 0;
    renderCell(pit);
    flash(pit, 'lift');
    var t = 120, g = S.g;
    for (var k = 0; k < r.path.length; k++) {
      (function (idx, n) {
        later(function () {
          if (M.G() !== g) return;
          S.view[idx]++;
          renderCell(idx);
          flash(idx, 'drop');
          Snd.count(Math.min(n + 1, 14));
        }, t);
      })(r.path[k], k);
      t += STEP;
    }
    later(function () { if (M.G() === g) resolve(r); }, t + 150);
  }

  function resolve(r) {
    var nm = names(), who = r.p, me = !S.two && who === 0, t = 0, g = S.g;
    var mine = S.two ? nm[who] + ' ' : me ? '' : 'Mandi ';
    if (r.cap) {
      for (var i = 0; i < r.cap.pits.length; i++) flash(r.cap.pits[i], 'grab');
      Snd.right();
      if (r.cap.type === 'even') say((me ? 'Çift oldu! ' : mine + 'çift yaptı! ') + r.cap.amount + ' taş ' + (me ? 'aldın!' : 'aldı.'));
      else say((me ? 'Boş kuyuna düştü! ' : mine + 'boş kuyusuna düşürdü! ') + r.cap.amount + ' taş ' + (me ? 'aldın!' : 'aldı.'));
      if (!S.two) M.mascot.face(me ? 'oh' : 'happy', 1100);
      t = 650;
    } else if (r.extra) {
      Snd.tone(988, 0, 0.14, 'triangle', 0.22);
      say(me ? 'Son taş hazinene düştü: bir tur daha!' : S.two ? nm[who] + ' bir tur daha oynar!' : 'Mandi bir tur daha oynuyor.');
      if (!S.two && !me) M.mascot.face('happy', 900);
    }
    later(function () {
      if (M.G() !== g) return;
      if (r.collect && r.collect.amount) {
        for (var j = 0; j < r.collect.pits.length; j++) flash(r.collect.pits[j], 'grab');
      }
      S.view = S.s.slice();
      renderAll();
      if (r.cap || (r.collect && r.collect.amount)) flash(storeOf(r.cap ? who : r.collect.by), 'drop');
      if (r.over) { finish(r); return; }
      S.turn = r.extra ? who : 1 - who;
      S.busy = false;
      renderTurn();
      nextTurn(r);
    }, t);
  }

  function nextTurn(r) {
    if (!S.two && S.turn === 1) {
      S.busy = true;
      var g = S.g;
      later(function () {
        if (M.G() !== g) return;
        var mv = aiMove();
        flash(mv, 'pick');
        later(function () { if (M.G() === g) play(mv, 1); }, 450);
      }, 750);
    } else if (!(r && (r.cap || r.extra))) {
      if (S.two) say(names()[S.turn] + ', sıra sende!');
      else if (S.lv.hints && S.moves < 8 && S.board.querySelector('.mg-hint.extra')) say('Yıldızlı kuyu: son taş hazinene düşer, bir tur daha oynarsın!');
      else if (S.lv.hints && S.moves < 8 && S.board.querySelector('.mg-hint.cap')) say('Artılı kuyu: Mandi\'den taş alırsın!');
      else say(pick(['Hangi kuyuyu seçeceksin?', 'Taşları say, iyi düşün!', 'Sıra sende!']));
    }
    S.moves++;
  }

  function finish(r) {
    S.over = true;
    S.busy = false;
    renderTurn();
    var a = S.s[6], b = S.s[13], nm = names(), g = M.G();
    var msg;
    if (r.collect && r.collect.amount) msg = nm[r.collect.by] + ' kuyularını ilk bitirdi, kalan ' + r.collect.amount + ' taşı aldı. ';
    else msg = '';
    if (S.two) {
      msg += a === b ? 'Berabere! ' + a + ' - ' + b : (a > b ? nm[0] : nm[1]) + ' kazandı! ' + Math.max(a, b) + ' - ' + Math.min(a, b);
      g.missQ = 0;
    } else if (a > b) {
      msg += 'Kazandın! ' + a + ' - ' + b;
      g.missQ = a - b >= 10 ? 0 : 2;
      M.mascot.face('oh', 1500);
    } else if (a === b) {
      msg += 'Berabere! ' + a + ' - ' + b;
      g.missQ = 4;
    } else {
      msg += 'Mandi kazandı: ' + b + ' - ' + a + '. Bir daha dene!';
      g.missQ = 4;
      M.mascot.face('happy', 1500);
    }
    $('choices').querySelector('.mg-msg').innerHTML = msg;
    say(a >= b || S.two ? 'Harika bir oyundu!' : 'Az kaldı! Bir daha oynayalım mı?');
    if (a > b || S.two) { Snd.win(); M.burst(S.cells[a >= b ? 6 : 13], 20); }
    later(M.finishLevel, 3600);
  }

  function setup(i) {
    var g = M.G();
    S = { g: g, lv: g.lv, two: g.lv.kind === 'two', s: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: 0, busy: true, over: false, cells: [], moves: 0 };
    S.view = S.s.slice();
    $('dots').innerHTML = '';
    buildBoard($('stage'));
    renderAll();
    S.started = false;
  }
  function next() {
    if (!S || S.started) return;
    S.started = true;
    S.busy = false;
    S.turn = S.two ? rnd(0, 1) : 0;
    renderTurn();
    if (S.two) say(names()[S.turn] + ' başlıyor! Kuyuya dokun, taşlar tek tek dağılır.');
    else if (S.lv.hints) say('Kendi kuyuna dokun! Taşlar sağa doğru tek tek dağılır.');
    else say(pick(['Hadi oynayalım!', 'Bakalım kim kazanacak?', 'Hazırım!']));
  }

  M.register('mangala', { setup: setup, next: next });
  // test ve kural doğrulaması için
  window.MangalaRules = { applyMove: applyMove, legal: legal, bestMove: bestMove };
})();
