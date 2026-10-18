/* Mandi Otobüsü — ana sayfa açıldıktan sonra yüklenir (app.js: loadLazy).
 * Kurallar app.js ile aynı: yalnızca ES5, kütüphane yok, animasyon transform/opacity. */
(function () {
  'use strict';
  var M = window.Mandi;
  if (!M) return;
  var $ = M.$, el = M.el, rnd = M.rnd, pick = M.pick, shuffle = M.shuffle, later = M.later, say = M.say, Snd = M.Snd;
  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (cb) { return setTimeout(cb, 16); };

  var VMAX = 12, ACC = 8, BRAKE = 20, COAST = 2.2;  // rem/sn
  var DOOR_X = 17.5;     // kapının ekrandaki yeri (rem)
  var STOP_TOL = 2.6;    // durak toleransı (rem)
  var STOP_NAMES = ['Okul', 'Park', 'Çarşı', 'Son durak'];
  var STOP_GAP = 55, FIRST_STOP = 40;
  var SEATS = 10;
  var COLORS = ['#ef476f', '#3a86ff', '#8e7dff', '#3bb273', '#ff8a3d', '#14a3a3', '#d65db1'];
  var HAIR = ['#2b2d42', '#6b4226', '#a0522d', '#e0a800'];

  var B = null;

  /* ---------------- Çizimler ---------------- */
  function personSVG(kid, c, hair) {
    var hy = kid ? 18 : 8, r = kid ? 5.5 : 6, by = hy + r, bh = kid ? 10 : 16, bw = kid ? 10 : 12;
    return '<svg class="bp" viewBox="0 0 20 42">' +
      '<line x1="7.5" y1="' + (by + bh - 1) + '" x2="6.5" y2="41" stroke="#2b2d42" stroke-width="2.6" stroke-linecap="round"/>' +
      '<line x1="12.5" y1="' + (by + bh - 1) + '" x2="13.5" y2="41" stroke="#2b2d42" stroke-width="2.6" stroke-linecap="round"/>' +
      '<rect x="' + (10 - bw / 2) + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="3" fill="' + c + '"/>' +
      '<circle cx="10" cy="' + hy + '" r="' + r + '" fill="#f2c49b"/>' +
      '<path d="M' + (10 - r) + ' ' + (hy - 1) + ' A' + r + ' ' + r + ' 0 0 1 ' + (10 + r) + ' ' + (hy - 1) + ' Z" fill="' + hair + '"/></svg>';
  }

  function busSVG() {
    var s = '<svg class="bus-svg" viewBox="0 0 170 66">' +
      '<rect x="2" y="4" width="164" height="50" rx="9" fill="#ffd23f" stroke="#2b2d42" stroke-width="2.5"/>' +
      '<rect x="3.3" y="38" width="132" height="6" fill="#ff8a3d"/>' +
      '<path d="M152 10 L160 10 Q164 10 164.5 16 L165 34 L152 34 Z" fill="#bfe8ff" stroke="#2b2d42" stroke-width="1.5"/>';
    for (var w = 0; w < 5; w++) s += '<rect x="' + (12 + w * 24) + '" y="12" width="22" height="20" rx="3" fill="#bfe8ff"/>';
    // yolcular: 10 koltuk, arkadan öne
    for (var i = 0; i < SEATS; i++) {
      var hx = 12 + Math.floor(i / 2) * 24 + (i % 2 ? 16 : 6);
      s += '<g class="bh" visibility="hidden">' +
        '<rect x="' + (hx - 4.5) + '" y="26" width="9" height="6" rx="2" fill="' + COLORS[i % COLORS.length] + '"/>' +
        '<circle cx="' + hx + '" cy="22" r="4.3" fill="#f2c49b"/>' +
        '<path d="M' + (hx - 4.3) + ' 21.5 A4.3 4.3 0 0 1 ' + (hx + 4.3) + ' 21.5 Z" fill="' + HAIR[i % HAIR.length] + '"/>' +
        '<circle class="bm" cx="' + hx + '" cy="23" r="6.6" fill="none" stroke="#ef476f" stroke-width="2" visibility="hidden"/></g>';
    }
    // şoför: Mandi
    s += '<circle cx="158" cy="24" r="6" fill="#ff8a3d"/><path d="M158 18 Q155 13 152 15 Z" fill="#3bb273"/>' +
      '<circle cx="156.5" cy="23" r="1.2" fill="#2b2d42"/><circle cx="160.5" cy="23" r="1.2" fill="#2b2d42"/>' +
      '<path d="M155.5 26 Q158 28.5 160.5 26" stroke="#2b2d42" stroke-width="1" fill="none"/>';
    // kapı
    s += '<g class="bdoor"><rect x="134" y="12" width="16" height="41" rx="2" fill="#bfe8ff" stroke="#2b2d42" stroke-width="1.5"/>' +
      '<line x1="142" y1="12" x2="142" y2="53" stroke="#2b2d42" stroke-width="1.5"/></g>' +
      '<rect class="bdoor-open" x="134" y="12" width="16" height="41" rx="2" fill="#5b5f73" visibility="hidden"/>' +
      '<circle cx="163" cy="46" r="3" fill="#fff3c4"/>' +
      '<text x="62" y="51" text-anchor="middle" font-size="8" font-weight="900" fill="#2b2d42" font-family="Roboto, Arial, sans-serif">MANDİ</text>';
    return s + '</svg>' + wheelDiv('bw0') + wheelDiv('bw1');
  }
  function wheelDiv(cls) {
    return '<div class="bv-wheel ' + cls + '"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#2b2d42"/><circle cx="10" cy="10" r="4.6" fill="#b8bfcc"/>' +
      '<line x1="5.4" y1="10" x2="14.6" y2="10" stroke="#5b5f73" stroke-width="1.6"/><line x1="10" y1="5.4" x2="10" y2="14.6" stroke="#5b5f73" stroke-width="1.6"/></svg></div>';
  }

  function hillsSVG() {
    var tile = 'M0 46 L0 30 Q50 6 100 26 Q150 40 200 20 Q260 2 320 24 Q360 36 400 30 L400 46 Z';
    return '<svg viewBox="0 0 800 46" preserveAspectRatio="none">' +
      '<path d="' + tile + '" fill="#8bd18b"/><path d="' + tile + '" fill="#8bd18b" transform="translate(400 0)"/></svg>';
  }
  function groundSVG() {
    var s = '<svg viewBox="0 0 700 68" preserveAspectRatio="none">' +
      '<rect x="0" y="0" width="700" height="46" fill="#5b5f73"/><rect x="0" y="0" width="700" height="2" fill="#b9b0a0"/>' +
      '<rect x="0" y="46" width="700" height="22" fill="#e4ddcf"/><rect x="0" y="46" width="700" height="2.5" fill="#b9b0a0"/>';
    for (var x = 0; x < 700; x += 100) s += '<rect x="' + (x + 20) + '" y="21" width="50" height="3" fill="#fff"/>';
    for (var j = 0; j < 700; j += 50) s += '<rect x="' + j + '" y="48" width="1.5" height="20" fill="#cfc6b4"/>';
    return s + '</svg>';
  }
  function treeG(x, c) {
    return '<g transform="translate(' + x + ' 0)"><rect x="17" y="30" width="6" height="20" fill="#8b5a2b"/><circle cx="20" cy="22" r="17" fill="' + c + '"/></g>';
  }
  function houseG(x, c) {
    return '<g transform="translate(' + x + ' 0)"><polygon points="4,22 35,2 66,22" fill="#ef476f"/><rect x="9" y="20" width="52" height="30" fill="' + c + '"/>' +
      '<rect x="16" y="27" width="11" height="10" fill="#bfe8ff"/><rect x="43" y="27" width="11" height="10" fill="#bfe8ff"/><rect x="30" y="32" width="10" height="18" fill="#8b5a2b"/></g>';
  }
  // 50 rem'lik manzara karesi iki kez çizilir (100 rem); kaydırma = -(pos mod 50)
  function sceneryStrip() {
    var tile = '', x = 0;
    while (x < 440) {
      if (Math.random() < 0.4) { tile += houseG(x, pick(['#ffe8b8', '#d6ecff', '#ffd6e0', '#e3f7d4'])); x += 70 + rnd(10, 50); }
      else { tile += treeG(x, pick(['#3bb273', '#2f9e63', '#5cc184'])); x += 40 + rnd(20, 60); }
    }
    return '<svg viewBox="0 0 1000 50" preserveAspectRatio="none"><g>' + tile + '</g><g transform="translate(500 0)">' + tile + '</g></svg>';
  }
  function stopSVG(name) {
    return '<svg viewBox="0 0 46 52"><rect x="21" y="10" width="4" height="42" fill="#5b5f73"/>' +
      '<rect x="2" y="2" width="42" height="17" rx="3" fill="#1f63cf"/>' +
      '<text x="23" y="14.5" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="Roboto, Arial, sans-serif">DURAK</text>' +
      '<rect x="4" y="21" width="38" height="11" rx="2" fill="#fff" stroke="#1f63cf" stroke-width="1.5"/>' +
      '<text x="23" y="29.5" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b2d42" font-family="Roboto, Arial, sans-serif">' + name + '</text></svg>';
  }
  function pedalSVG(gas) {
    return gas ? '<svg viewBox="0 0 40 40"><path d="M10 8 L32 20 L10 32 Z" fill="#fff"/></svg>'
      : '<svg viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" rx="3" fill="#fff"/></svg>';
  }

  /* ---------------- Yardımcılar ---------------- */
  function fsize() {
    var f = parseFloat(document.documentElement.style.fontSize);
    return f > 0 ? f : 16;
  }
  // Tam piksele yuvarla; değişmediyse yazma (eski cihazlarda gereksiz yeniden çizimi önler)
  function tr(node, xrem, yrem, rot) {
    var x = Math.round(xrem * B.fs), y = Math.round((yrem || 0) * B.fs);
    var key = x + ',' + y + ',' + (rot || 0);
    if (node._k === key) return;
    node._k = key;
    var v = 'translate3d(' + x + 'px,' + y + 'px,0)' + (rot ? ' rotate(' + rot + 'deg)' : '');
    node.style.webkitTransform = node.style.transform = v;
  }
  function choices3(ans, min) {
    var out = [ans], cand = shuffle([ans - 1, ans + 1]).concat(shuffle([ans - 2, ans + 2, ans + 3]));
    for (var i = 0; i < cand.length && out.length < 3; i++) if (cand[i] >= (min || 0) && out.indexOf(cand[i]) === -1) out.push(cand[i]);
    return shuffle(out);
  }
  function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function unitHTML(u) { return function (v) { return '<span class="tm-big">' + v + '</span><span class="tm-small">' + u + '</span>'; }; }
  function moneyRow(pieces) {
    var h = '';
    for (var i = 0; i < pieces.length; i++) {
      h += '<span class="mpiece ' + (pieces[i] === 1 ? 'is-coin' : 'is-note') + '" data-v="' + pieces[i] + '">' + M.moneySVG(pieces[i]) + '</span>';
    }
    return h;
  }

  /* ---------------- Plan: duraklar ve görevler ---------------- */
  function payTask(notes, maxA) {
    var a, tries = 0;
    do { a = rnd(2, maxA); tries++; } while (B.seen['p' + a] && tries < 20);
    B.seen['p' + a] = true;
    var pieces = M.breakdown(a, notes);
    if (pieces.length > 7) pieces = M.breakdown(a, [10, 5, 1]);
    return { kind: 'pay', amount: a, pieces: pieces, persons: 1 };
  }
  function changeTask() {
    var given = Math.random() < 0.35 ? 5 : 10, f, tries = 0;
    do { f = given === 5 ? rnd(1, 4) : rnd(2, 9); tries++; } while (B.seen['c' + given + f] && tries < 20);
    B.seen['c' + given + f] = true;
    return { kind: 'change', given: given, fare: f, persons: 1 };
  }
  function makePlan(kind) {
    var plan = [], r = kind === 'pay' ? 2 : 3;
    B.startRiders = r;
    for (var s = 0; s < 4; s++) {
      var tasks = [];
      if (kind === 'pay') {
        tasks.push(payTask([5, 1], 10)); tasks.push(payTask([5, 1], 10));
      } else if (kind === 'riders') {
        var room = SEATS - 1 - r;
        if (r >= 3 && (room < 1 || Math.random() < 0.5)) {
          var k = rnd(1, Math.min(3, r - 1));
          tasks.push({ kind: 'off', r: r, k: k, persons: 0 }); r -= k;
        } else {
          var k2 = rnd(1, Math.min(3, room));
          tasks.push({ kind: 'on', r: r, k: k2, persons: k2 }); r += k2;
        }
        tasks.push(payTask([10, 5, 1], 12));
      } else {
        tasks.push(changeTask());
        if (r + 2 > SEATS || (r >= 4 && Math.random() < 0.5)) {
          var k3 = rnd(1, Math.min(3, r - 1));
          // önce inenler, sonra para üstü
          tasks.unshift({ kind: 'off', r: r, k: k3, persons: 0 }); r -= k3;
        } else {
          tasks.push(payTask([10, 5, 1], 15));
        }
      }
      // binen yolcuların r değerlerini sırayla hesapla
      var rr = s === 0 ? B.startRiders : plan[s - 1].rEnd;
      for (var t = 0; t < tasks.length; t++) {
        var tk = tasks[t];
        if (tk.kind === 'off') { tk.r = rr; rr -= tk.k; }
        else if (tk.kind === 'on') { tk.r = rr; rr += tk.k; }
        else rr += 1;
      }
      var persons = 0;
      for (var p = 0; p < tasks.length; p++) persons += tasks[p].persons;
      plan.push({ x: FIRST_STOP + s * STOP_GAP, name: STOP_NAMES[s], tasks: tasks, persons: persons, rEnd: rr, people: [] });
      r = rr;
    }
    return plan;
  }

  /* ---------------- Sahne ---------------- */
  function addObj(x, cls, html, top, w, h) {
    var n = el('div', 'bo ' + cls, html);
    n.style.top = top + 'rem';
    n.style.width = w + 'rem';
    n.style.height = h + 'rem';
    var o = { x: x, w: w, n: n, on: true };
    B.objs.push(o);
    B.layer.appendChild(n);
    return o;
  }
  function buildScene(stage) {
    stage.innerHTML = '';
    stage.className = 'stage bus-stage';
    var view = el('div', 'bus-view');
    B.hills = el('div', 'bv-hills', hillsSVG());
    B.ground = el('div', 'bv-ground', groundSVG());
    B.scenery = el('div', 'bv-scenery', sceneryStrip());
    B.layer = el('div', 'bv-objs');
    view.appendChild(B.hills); view.appendChild(B.scenery); view.appendChild(B.ground); view.appendChild(B.layer);
    B.busEl = el('div', 'bv-bus', busSVG());
    view.appendChild(B.busEl);
    B.near = el('div', 'bv-near');
    view.appendChild(B.near);
    var route = '<div class="bv-route"><i class="rl"></i>';
    for (var i = 0; i < B.plan.length; i++) route += '<i class="rs" style="left:' + (100 * (i + 1) / B.plan.length) + '%"></i>';
    route += '<b class="rb"></b></div>';
    view.appendChild(el('div', 'bv-hud', route + '<div class="bv-kasa">' + M.moneySVG(1) + '<span>Kasa</span><b id="bus-kasa">0</b></div>'));
    stage.appendChild(view);
    var qp = el('div', 'bus-q', '<div id="bus-ask" class="bus-ask"></div><div id="bus-money" class="bus-money money-row"></div>');
    stage.appendChild(qp);
    B.view = view;
    B.routeBus = view.querySelector('.rb');
    B.heads = B.busEl.querySelectorAll('.bh');
    B.wheels = [B.busEl.querySelector('.bw0'), B.busEl.querySelector('.bw1')];
    // duraklar ve yolcular (yakın)
    for (var s = 0; s < B.plan.length; s++) {
      var st = B.plan[s];
      addObj(st.x - 8, 'nearobj', stopSVG(st.name), 7.1, 4.6, 5.2).n.className = 'bo nearobj bstop';
      for (var p = 0; p < st.persons; p++) {
        var kid = Math.random() < 0.45;
        var o = addObj(st.x + 1.4 + p * 2.1, 'nearobj', personSVG(kid, pick(COLORS), pick(HAIR)), 8.6, 1.9, 4);
        o.n.className = 'bo nearobj bperson';
        st.people.push(o);
      }
    }
    // yakın nesneler otobüsün önünde dursun
    for (var q = 0; q < B.objs.length; q++) if (B.objs[q].n.className.indexOf('nearobj') !== -1) B.near.appendChild(B.objs[q].n);
  }

  function setRiders(n, mark) {
    B.riders = n;
    for (var i = 0; i < B.heads.length; i++) {
      B.heads[i].setAttribute('visibility', i < n ? 'visible' : 'hidden');
      var m = B.heads[i].querySelector('.bm');
      if (m) m.setAttribute('visibility', mark && i >= n - mark && i < n ? 'visible' : 'hidden');
    }
  }
  function setDoor(open) {
    B.busEl.querySelector('.bdoor-open').setAttribute('visibility', open ? 'visible' : 'hidden');
  }
  function addKasa(v) {
    B.kasa += v;
    var k = $('bus-kasa');
    if (k) { k.innerHTML = B.kasa; M.restartAnim(k, 'pop'); }
  }

  function draw() {
    var p = B.pos;
    tr(B.hills, -((p * 0.35) % 40));
    tr(B.ground, -(((p % 10) + 10) % 10));
    tr(B.scenery, -(((p % 50) + 50) % 50));
    for (var i = 0; i < B.objs.length; i++) {
      var o = B.objs[i], sx = o.x - p + DOOR_X;
      var vis = sx > -o.w - 1 && sx < B.vw + 1;
      if (vis !== o.on) { o.on = vis; o.n.style.display = vis ? '' : 'none'; }
      if (vis) tr(o.n, sx);
    }
    var ang = Math.round((p / (2 * Math.PI)) * 360 % 360 / 6) * 6;
    tr(B.wheels[0], 0, 0, ang);
    tr(B.wheels[1], 0, 0, ang);
    var bob = B.v > 0.5 ? Math.sin(Date.now() / 70) * 0.05 : 0;
    tr(B.busEl, 0, bob);
    var last = B.plan[B.plan.length - 1].x;
    if (!B.routeW) B.routeW = B.routeBus.parentNode.offsetWidth / B.fs;
    tr(B.routeBus, Math.max(0, Math.min(1, p / last)) * B.routeW);
  }

  /* ---------------- Sürüş ---------------- */
  function pedal(btn, key) {
    var on = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!B || !B.driving) return;
      B[key] = true;
      btn.className = 'pedal ' + key + ' down';
      if (key === 'gas' && B.gasHelp) { B.gasHelp = false; }
    };
    var off = function () {
      if (!B) return;
      B[key] = false;
      btn.className = 'pedal ' + key;
    };
    btn.addEventListener('touchstart', on, false);
    btn.addEventListener('touchend', off, false);
    btn.addEventListener('touchcancel', off, false);
    btn.addEventListener('mousedown', on, false);
    btn.addEventListener('mouseup', off, false);
    btn.addEventListener('mouseleave', off, false);
  }
  function buildPedals() {
    var box = $('choices');
    box.innerHTML = '';
    var br = el('button', 'pedal brake', pedalSVG(false) + '<span>Fren</span>');
    var horn = el('button', 'horn', '<span>Korna</span>');
    var gas = el('button', 'pedal gas' + (B.leg === 0 ? ' hint' : ''), pedalSVG(true) + '<span>Gaz</span>');
    pedal(br, 'brake'); pedal(gas, 'gas');
    horn.addEventListener('click', function () { Snd.tone(392, 0, 0.18, 'square', 0.12); Snd.tone(330, 0.2, 0.25, 'square', 0.12); });
    box.appendChild(br); box.appendChild(horn); box.appendChild(gas);
    B.gasBtn = gas;
  }

  function startDrive() {
    var st = B.plan[B.stop];
    B.target = st.x;
    B.driving = true; B.gas = false; B.brake = false; B.warned = false; B.nearSaid = false;
    B.fs = fsize();
    B.routeW = 0;
    B.vw = B.view.offsetWidth / B.fs;
    var g = M.G();
    g.locked = true;
    g.cur = { drive: true };
    $('bus-ask').innerHTML = 'Sıradaki durak: <b>' + st.name + '</b>';
    $('bus-money').innerHTML = '';
    buildPedals();
    M.renderDots();
    say(B.leg === 0 ? 'Gaza basılı tut, otobüs gitsin!' : pick(['Haydi, yola çıkalım!', 'Sıradaki durağa!', 'Kemerler takılı, gidiyoruz!']));
    B.leg++;
    draw();
    B.t = Date.now();
    raf(frame);
  }

  function frame() {
    if (!B || !B.driving) return;
    if (M.screen() !== 'play' || M.G() !== B.g) { B.driving = false; return; }
    var now = Date.now(), dt = Math.min(0.08, (now - B.t) / 1000);
    B.t = now;
    var v = B.v;
    if (B.brake) v -= BRAKE * dt;
    else if (B.gas) v += ACC * dt;
    else v -= COAST * dt;
    if (B.pos > B.target + 6) {
      v -= 25 * dt;
      if (!B.warned) { B.warned = true; say('Dur! Durağı geçiyoruz!'); M.mascot.face('oh', 900); }
    }
    if (v < 0) v = 0;
    if (v > VMAX) v = VMAX;
    B.v = v;
    B.pos += v * dt;
    if (!B.nearSaid && B.target - B.pos < 16) {
      B.nearSaid = true;
      say(B.plan[B.stop].name + ' durağı geliyor. Fren yap!');
    }
    draw();
    if (v === 0 && !B.gas) {
      var d = B.pos - B.target;
      if (Math.abs(d) <= STOP_TOL) { arrive(Math.abs(d)); return; }
      if (d > STOP_TOL) { backUp(); return; }
    }
    raf(frame);
  }

  function backUp() {
    B.driving = false;
    say('Biraz geçtik, geri gelelim!');
    var from = B.pos, to = B.target + 0.8, t0 = Date.now(), dur = 1100, g = B.g;
    var step = function () {
      if (!B || B.g !== g || M.screen() !== 'play') return;
      var k = Math.min(1, (Date.now() - t0) / dur);
      B.pos = from + (to - from) * (1 - (1 - k) * (1 - k));
      draw();
      if (k < 1) raf(step); else arrive(1);
    };
    raf(step);
  }

  function arrive(off) {
    B.driving = false; B.v = 0; B.gas = false; B.brake = false;
    draw();
    $('choices').innerHTML = '';
    setDoor(true);
    Snd.tone(660, 0, 0.12, 'sine', 0.2); Snd.tone(880, 0.13, 0.18, 'sine', 0.2);
    var st = B.plan[B.stop];
    if (off < 1) { say('Tam durakta! Süper şoför!'); M.mascot.face('happy', 1000); M.burst(B.busEl, 10); }
    else say(st.name + ' durağı!');
    B.atStop = true;
    B.queue = st.tasks.slice();
    B.pIdx = 0;
    later(next, 1000);
  }

  /* ---------------- Görevler ---------------- */
  function board(n, done) {
    var st = B.plan[B.stop], g = B.g;
    for (var i = 0; i < n; i++) {
      (function (j) {
        later(function () {
          if (M.G() !== g) return;
          var o = st.people[B.pIdx + j];
          if (o) o.n.className += ' gone';
          setRiders(Math.min(SEATS, B.riders + 1));
          Snd.count(B.riders);
        }, 120 + j * 260);
      })(i);
    }
    later(function () { B.pIdx += n; if (done) done(); }, 120 + n * 260);
  }
  function leave(k) {
    var r = B.riders;
    setRiders(r - k);
    for (var j = 0; j < k; j++) {
      var w = el('div', 'walker', personSVG(Math.random() < 0.4, pick(COLORS), pick(HAIR)));
      w.style.left = (DOOR_X - 0.6 + j * 1.3) + 'rem';
      w.style.webkitAnimationDelay = w.style.animationDelay = (j * 0.15) + 's';
      B.near.appendChild(w);
      (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1900); })(w);
    }
  }

  function labelCoins() {
    var ps = $('bus-money').querySelectorAll('.mpiece'), total = 0, qid = B.g.qid;
    for (var i = 0; i < ps.length; i++) {
      (function (node, v, d) {
        later(function () {
          if (!B || B.g.qid !== qid) return;
          total += v;
          var old = node.querySelector('.num');
          if (old) node.removeChild(old);
          node.appendChild(el('span', 'num', String(total)));
          Snd.count(Math.min(total, 20));
        }, d);
      })(ps[i], +ps[i].getAttribute('data-v'), 300 + i * 380);
    }
  }
  function seq(from, to) {
    var a = [];
    for (var i = from; i <= to && a.length < 12; i++) a.push(i);
    return a.join(', ');
  }

  function makeQ(t) {
    var q = { kind: t.kind, delay: 1300 };
    if (t.kind === 'pay') {
      q.answer = t.amount; q.opts = choices3(t.amount, 1);
      q.optClass = 'tm'; q.optHTML = unitHTML('lira');
      q.ask = 'Yolcu bilet parası verdi.<br><b>Kaç lira?</b>';
      q.money = moneyRow(t.pieces);
      q.onRight = function () { addKasa(t.amount); board(1); };
      q.hint = function () { labelCoins(); return 'Birlikte sayalım!'; };
    } else if (t.kind === 'off') {
      q.answer = t.r - t.k; q.opts = choices3(q.answer, 0);
      q.optClass = 'tm'; q.optHTML = unitHTML('kişi');
      q.ask = 'Otobüste <b>' + t.r + '</b> yolcu var.<br><b>' + t.k + '</b> kişi iniyor. Kaç kişi kalır?';
      q.prep = function () { setRiders(t.r, t.k); };
      q.onRight = function () { leave(t.k); };
      q.hint = function () {
        return M.G().wrongNow >= 2 ? t.r + ' ' + M.MINUS + ' ' + t.k + ' = ? Geri say: ' + seq(t.r - t.k, t.r).split(', ').reverse().join(', ')
          : 'Halkalı olanlar iniyor. Diğerlerini say!';
      };
    } else if (t.kind === 'on') {
      q.answer = t.r + t.k; q.opts = choices3(q.answer, 1);
      q.optClass = 'tm'; q.optHTML = unitHTML('kişi');
      q.ask = 'Otobüste <b>' + t.r + '</b> yolcu var.<br><b>' + t.k + '</b> kişi biniyor. Kaç kişi olur?';
      q.prep = function () { setRiders(t.r); };
      q.onRight = function () { board(t.k); };
      q.hint = function () { return t.r + ' kişi var. Saymaya devam et: ' + seq(t.r + 1, t.r + t.k); };
    } else {
      var ans = t.given - t.fare;
      q.answer = ans; q.build = true; q.keepBtn = true;
      q.ask = 'Bilet <b>' + t.fare + '</b> lira. Yolcu <b>' + t.given + '</b> lira verdi.<br><b>Para üstünü ver!</b>';
      q.money = moneyRow([t.given]);
      q.controls = changeControls;
      q.onRight = function () { addKasa(t.fare); board(1); };
      q.buildHint = function () {
        var gave = sum(B.tray);
        if (M.G().wrongNow >= 2) return 'Bilet ' + t.fare + ' lira. Saymaya devam et: ' + seq(t.fare + 1, t.given) + '. Bu ' + ans + ' sayı: ' + ans + ' lira!';
        if (gave < ans) return 'Az verdin! Biraz daha ver.';
        return 'Çok verdin! Bir parayı geri al.';
      };
    }
    return q;
  }

  function renderTray() {
    var tray = $('bus-tray');
    if (!tray) return;
    var h = '';
    for (var i = 0; i < B.tray.length; i++) h += '<span class="tc" data-i="' + i + '">' + M.moneySVG(B.tray[i]) + '</span>';
    tray.innerHTML = '<div class="tc-row">' + (h || '<em>Paraya dokun</em>') + '</div><div class="tc-sum">Verdiğin: <b>' + sum(B.tray) + '</b> lira</div>';
  }
  function changeControls(box) {
    B.tray = [];
    var list = [];
    var coins = [1, 5];
    for (var i = 0; i < coins.length; i++) {
      (function (v) {
        var b = el('button', 'ch pvb paybtn', M.moneySVG(v));
        b.addEventListener('click', function () {
          if (B.g.locked) return;
          if (B.tray.length >= 10) { Snd.wrong(); return; }
          B.tray.push(v);
          B.tray.sort(function (a, c) { return c - a; });
          Snd.tone(v === 1 ? 880 : 520, 0, 0.1, 'triangle', 0.2);
          renderTray();
        });
        list.push(b);
      })(coins[i]);
    }
    var tray = el('div', 'bus-tray');
    tray.id = 'bus-tray';
    tray.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== tray && !(t.className && t.className === 'tc')) t = t.parentNode;
      if (!t || t === tray || B.g.locked) return;
      B.tray.splice(+t.getAttribute('data-i'), 1);
      Snd.tap();
      renderTray();
    });
    list.push(tray);
    var ok = el('button', 'ch pvb pvok', '<span class="tick"></span><span>Ver</span>');
    ok.addEventListener('click', function () { M.answer(ok, sum(B.tray)); });
    list.push(ok);
    for (var j = 0; j < list.length; j++) {
      list[j].style.webkitAnimationDelay = list[j].style.animationDelay = (0.07 * j + 0.1) + 's';
      box.appendChild(list[j]);
    }
    renderTray();
  }

  function present(t) {
    var g = B.g;
    var q = makeQ(t);
    g.qid = (g.qid || 0) + 1;
    g.cur = q; g.locked = false; g.wrongNow = 0;
    $('bus-ask').innerHTML = q.ask;
    $('bus-money').innerHTML = q.money || '';
    M.restartAnim($('bus-ask'), 'in');
    if (q.prep) q.prep();
    M.buildChoices(q);
    M.renderDots();
    if (t.kind === 'pay') say(pick(['Paraları say!', 'Bilet parası!', 'Kasaya kaç lira girecek?']));
    else if (t.kind === 'change') say('Para üstü ne kadar?');
    else say('Yolcuları say!');
  }

  function next() {
    if (!B) return;
    if (B.atStop && B.queue.length) { present(B.queue.shift()); return; }
    if (B.atStop) {
      B.atStop = false;
      setRiders(B.riders);
      setDoor(false);
      B.stop++;
      if (B.stop >= B.plan.length) {
        B.g.locked = true;
        $('choices').innerHTML = '';
        $('bus-ask').innerHTML = 'Sefer bitti! Kasada <b>' + B.kasa + '</b> lira var.';
        $('bus-money').innerHTML = '';
        say('Son durak! Harika bir sefer!');
        M.mascot.face('happy', 1500);
        M.burst(B.busEl, 16);
        later(M.finishLevel, 2200);
        return;
      }
    }
    startDrive();
  }

  function setup(i) {
    var g = M.G();
    B = { g: g, lv: g.lv, pos: 0, v: 0, stop: 0, leg: 0, kasa: 0, riders: 0, objs: [], seen: {}, queue: [], atStop: false, tray: [], fs: fsize() };
    B.plan = makePlan(g.lv.kind);
    buildScene($('stage'));
    setRiders(B.startRiders);
    B.vw = B.view.offsetWidth / B.fs || 50;
    draw();
  }

  // Bilgisayarda klavye: sağ ok / boşluk = gaz, sol ok = fren
  function keyState(e, down) {
    if (!B || !B.driving) return;
    var k = e.keyCode;
    if (k === 39 || k === 38 || k === 32) { B.gas = down; if (e.preventDefault) e.preventDefault(); }
    else if (k === 37 || k === 40) { B.brake = down; if (e.preventDefault) e.preventDefault(); }
  }
  document.addEventListener('keydown', function (e) { keyState(e, true); }, false);
  document.addEventListener('keyup', function (e) { keyState(e, false); }, false);

  M.register('bus', { setup: setup, next: next });
})();
