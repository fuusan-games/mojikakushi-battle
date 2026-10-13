/* もじかくしバトル：画面・進行・オンライン（PeerJS, ホストが正） */
'use strict';
var $ = function (id) { return document.getElementById(id); };
var E = window.MKE; E.loadDict(window.MK_TOPICS);
var Q = new URLSearchParams(location.search), TURBO = Q.has('turbo');
if (Q.get('seed')) E.setSeed(+Q.get('seed'));
var D = function (ms) { return TURBO ? Math.max(30, ms / 12) : ms; };
var mode = null, G = null, mySeat = 0, pumpT = null, gate = null, sel = null, peek = false, topicOpts = null, seenLog = 0, prevRev = null, confKey = '';
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
function show(id) { ['sTitle', 'sSetup', 'sOnline', 'sLobby', 'sGame'].forEach(function (s) { $(s).classList.toggle('hide', s !== id); }); window.scrollTo(0, 0); }
function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
function pname(p) { return (p.emoji || '') + esc(p.name); }
function pop(t, cls) { var d = document.createElement('div'); d.className = 'pop ' + (cls || ''); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, D(1300)); }
function confetti() { for (var i = 0; i < 26; i++) { var c = document.createElement('div'); c.className = 'conf'; c.textContent = ['🎉', '✨', '🎊', '⭐', '🀄'][i % 5]; c.style.left = Math.random() * 100 + 'vw'; c.style.animationDelay = Math.random() * .8 + 's'; document.body.appendChild(c); setTimeout(function (x) { x.remove(); }.bind(null, c), 2800); } }
var AC = null;
function beep(f, d, type) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.12, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch (e) {} }
function sfx(kind) { if (TURBO) return; if (kind === 'hit') { beep(660, .12); setTimeout(function () { beep(990, .18); }, 110); } else if (kind === 'miss') beep(220, .2, 'triangle'); else if (kind === 'out') { beep(392, .2, 'square'); setTimeout(function () { beep(262, .35, 'square'); }, 180); } else if (kind === 'win') [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, .2); }, i * 120); }); }

/* ---------- 進行 ---------- */
function V() { return mode === 'client' ? G : null; }
function doAct(a) {
  if (mode === 'client') { send({ t: 'act', a: a }); return; }
  var from = null;
  if (mode === 'host') { from = (a.t === 'topic' || a.t === 'again') ? null : 0; }
  if (E.act(G, a, from)) changed();
}
function changed() { render(); pump(); if (mode === 'host') broadcast(); }
function pump() {
  clearTimeout(pumpT); if (!G || mode === 'client') return;
  if (G.phase === 'battle' && G.players[G.turn].cpu != null) {
    pumpT = setTimeout(function () { if (G.phase !== 'battle' || G.players[G.turn].cpu == null) return; var k = E.cpuAttack(G); if (E.act(G, { t: 'attack', k: k }, G.turn)) changed(); }, D(E.cpuThinkMs(G) + (G.n ? 500 : 900)));
  }
}
function humans() { return G.players.map(function (p, i) { return p.cpu == null ? i : -1; }).filter(function (i) { return i >= 0; }); }
// この画面で「自分」として扱う席：オンラインは自席、ローカルは人が1人ならその人
function viewer() { if (mode !== 'local') return mySeat; var h = humans(); return h.length === 1 ? h[0] : -1; }
function view() { if (mode === 'client') return G; return E.viewFor(G, mode === 'host' ? 0 : (viewer() >= 0 ? viewer() : (peek && peek.seat != null ? peek.seat : -1))); }

/* ---------- 描画 ---------- */
function panelsHTML(v, i, me, flips) {
  var w = v.words[i] || '', h = '', open = v.phase === 'end' || !v.alive[i];
  for (var j = 0; j < E.PANELS; j++) {
    var ch = w[j], rv = v.rev[i][j], cls = 'pan', t = '';
    if (open || (me && v.len[i] != null)) {
      if (j >= (v.len[i] || 0)) { cls += ' xx'; t = '×'; }
      else { t = ch; cls += rv ? ' op' : (open ? ' op late' : ' mine'); }
    } else if (rv) { cls += ' op'; t = ch; }
    else t = '';
    if (flips && flips[i + ':' + j]) cls += ' flip';
    h += '<div class="' + cls + '">' + (j === 0 ? '<span class="no">1</span>' : '') + esc(t) + '</div>';
  }
  return '<div class="pans">' + h + '</div>';
}
function boardHTML(v, canAtk) {
  var hitK = {}; v.log.forEach(function (e) { if (e.t === 'atk' && e.hits.length) hitK[e.k] = 1; });
  return '<div class="bd">' + E.ROWS.map(function (r) { return '<div class="col">' + r.split('').map(function (k) {
    if (k === ' ') return '<button class="k blank" disabled></button>';
    var used = v.used.indexOf(k) >= 0;
    return '<button class="k' + (used ? ' used' + (hitK[k] ? ' hit' : '') : '') + (sel === k ? ' sel' : '') + '" data-k="' + k + '"' + (used || !canAtk ? ' disabled' : '') + '>' + k + '</button>'; }).join('') + '</div>'; }).join('') + '</div>';
}
function logText(v, e) {
  var P = v.players;
  if (e.t === 'start') return '🔔 バトルスタート！';
  if (e.t === 'end') return '🏆 ' + pname(P[e.w]) + ' の勝ち！';
  var s = pname(P[e.a]) + '「' + e.k + '」→ ';
  if (!e.hits.length) s += 'はずれ';
  else s += e.hits.map(function (h) { return (h.p === e.a ? '💥自爆 ' : '') + pname(P[h.p]) + ' ' + h.pos.map(function (x) { return (x + 1); }).join('・') + '枚目'; }).join('、');
  if (e.outs.length) s += '／' + e.outs.map(function (o) { return pname(P[o]); }).join('・') + ' 脱落';
  return s;
}
function render() {
  if (!G) return; show('sGame');
  var v = view(), h = '', me = mode === 'local' ? viewer() : mySeat, after = [];
  var isHostish = mode !== 'client';
  if (v.phase === 'topic') {
    if (isHostish) {
      if (!topicOpts) topicOpts = E.shuffle(E.DICT.topics).slice(0, 6).map(function (t) { return t.name; });
      h += '<div class="phase">🎴 お題をえらんでね</div><div class="card"><div class="tpGrid">' + topicOpts.map(function (t, i) { return '<button data-t="' + i + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
        '<button class="btn sm g" id="tpShuf" style="margin-top:8px">🔀 ほかのお題</button>' +
        '<div style="margin-top:10px;font-size:13px">じぶんで決める（自由お題）</div><div class="row"><input type="text" id="tpFree" maxlength="16" placeholder="例：さいきん買ったもの"><button class="btn sm p" id="tpGo" style="flex:none">決定</button></div>' +
        '<div class="hint">自由お題のときCPUは、近いお題があればそこから、なければ辞典全体から言葉を選びます。</div></div>';
      after.push(function () { document.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { doAct({ t: 'topic', topic: topicOpts[+b.dataset.t] }); topicOpts = null; }; });
        $('tpShuf').onclick = function () { topicOpts = null; render(); };
        $('tpGo').onclick = function () { var t = $('tpFree').value.trim(); if (!t) return toast('お題を入れてね'); doAct({ t: 'topic', topic: t }); topicOpts = null; }; });
    } else h += '<div class="card gate"><div class="em">🎴</div>ホストがお題をえらんでいます…</div>';
  } else if (v.phase === 'word') {
    h += '<div style="text-align:center">お題 <span class="topicChip">' + esc(v.topic) + '</span></div>';
    var need = mode === 'local' ? humans().filter(function (i) { return !G.words[i]; }) : (!v.ready[mySeat] ? [mySeat] : []);
    if (need.length) {
      var p = need[0];
      if (mode === 'local' && humans().length > 1 && gate !== p) {
        h += '<div class="card gate"><div class="em">🙈</div><div style="font-size:20px;font-weight:800">' + pname(G.players[p]) + ' の番</div><div class="hint" style="margin:8px 0 14px">ほかの人は見ないでね</div><button class="btn p" id="gateOk">わたしです・見る</button></div>';
        after.push(function () { $('gateOk').onclick = function () { gate = p; render(); }; });
      } else {
        h += '<div class="card"><div class="phase">✏️ ' + pname(G.players[p]) + ' の言葉</div><input type="text" id="wIn" maxlength="14" placeholder="お題にそった言葉（2〜7文字）" autocomplete="off">' +
          '<div id="wPrev" style="margin:10px 0"></div><div id="wMsg" class="hint" style="min-height:18px"></div><button class="btn p" id="wGo" disabled>この言葉でかくす！</button>' +
          '<div class="hint">「゛」「゜」はとる・小さい文字は大きく・のばす音は「ー」（自動でなおります）。みんなが知っている言葉にしてね。</div></div>';
        after.push(function () {
          var inp = $('wIn');
          function upd() { var c = E.check(inp.value), n = c.n || '', ph = ''; for (var j = 0; j < 7; j++) ph += '<div class="pan ' + (j < n.length ? 'op' : 'xx') + '">' + (j === 0 ? '<span class="no">1</span>' : '') + esc(j < n.length ? n[j] : '×') + '</div>';
            $('wPrev').innerHTML = '<div class="pans" style="justify-content:center">' + ph + '</div>'; $('wMsg').textContent = inp.value ? (c.ok ? 'ふだ：' + c.n + '（' + c.n.length + '文字）' : c.msg) : ''; $('wGo').disabled = !c.ok; }
          inp.oninput = upd; upd(); setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
          $('wGo').onclick = function () { var c = E.check(inp.value); if (!c.ok) return toast(c.msg); gate = null; doAct({ t: 'word', p: p, w: inp.value.trim() }); };
        });
      }
    } else {
      h += '<div class="card"><div class="phase">みんなが言葉を決めるのを待っています…</div>' + v.players.map(function (p, i) { return '<div class="seat"><span class="em">' + (p.emoji || '🙂') + '</span><span style="flex:1">' + esc(p.name) + '</span>' + (v.ready[i] ? '✅' : '✏️…') + '</div>'; }).join('') + '</div>';
    }
  } else {
    // battle / end
    var flips = {}, newEv = v.log.slice(seenLog);
    if (prevRev && prevRev.length === v.rev.length) v.rev.forEach(function (r, i) { r.forEach(function (x, j) { if (x && !prevRev[i][j]) flips[i + ':' + j] = 1; }); });
    prevRev = JSON.parse(JSON.stringify(v.rev)); seenLog = v.log.length;
    var turnP = v.players[v.turn], myTurn = v.phase === 'battle' && (mode === 'local' ? turnP.cpu == null : v.turn === mySeat);
    h += '<div style="display:flex;justify-content:space-between;align-items:center"><span>お題 <span class="topicChip">' + esc(v.topic) + '</span></span><button class="btn sm g" id="bRules">📖</button></div>';
    if (v.phase === 'battle') h += '<div class="banner' + (myTurn ? ' me' : '') + '">' + (myTurn ? (mode === 'local' && humans().length > 1 ? pname(turnP) + ' の' : 'あなたの') + '攻撃！' + (v.n ? '（もう1回！）' : '') : pname(turnP) + ' が考え中…' + (v.n ? '（2回目）' : '')) + '</div>';
    else { var wp = v.players[v.winner]; h += '<div class="banner me" style="font-size:22px">🏆 ' + pname(wp) + ' の勝ち！</div>'; }
    v.players.forEach(function (p, i) {
      var mine = i === me || (peek && peek.seat === i);
      h += '<div class="pl' + (v.phase === 'battle' && v.turn === i ? ' turn' : '') + (!v.alive[i] && v.phase === 'battle' ? ' dead' : '') + (newEv.some(function (e) { return e.t === 'atk' && e.hits.some(function (x) { return x.p === i; }); }) ? ' shake' : '') + '" data-p="' + i + '">' +
        '<div class="who"><b>' + (p.emoji || '🙂') + '</b>' + esc(p.name) + (p.cpu != null ? '<br><span class="hint">' + E.LV[p.cpu].replace('😎', '') + '</span>' : '') + (v.wins[i] ? '<div class="wins">👑×' + v.wins[i] + '</div>' : '') + '</div>' +
        '<div style="flex:1">' + panelsHTML(v, i, mine, flips) + ((v.phase === 'end' || !v.alive[i] || mine) && v.disp[i] && v.disp[i] !== '…' ? '<div class="hint" style="margin-top:3px">「' + esc(v.disp[i]) + '」' + (!v.alive[i] && v.phase === 'battle' ? ' 脱落' : '') + '</div>' : '') + '</div></div>';
    });
    if (v.phase === 'battle') {
      h += boardHTML(v, myTurn);
      if (myTurn) h += '<button class="btn" id="atkGo"' + (sel ? '' : ' disabled') + '>' + (sel ? '「' + sel + '」で攻撃！' : '文字をえらんでね') + '</button>';
      if (mode === 'local' && humans().length > 1) h += '<button class="btn sm g" id="peekBtn" style="display:block;margin:6px auto">👀 自分の言葉をこっそり見る</button>';
    } else {
      if (isHostish) h += '<button class="btn" id="bAgain">もう1回（同じメンバー）</button><button class="btn g" id="bHome">タイトルへ</button>';
      else h += '<div class="hint" style="text-align:center">ホストがつぎのゲームを始めるのを待っています</div>';
    }
    h += '<div class="log" id="log">' + v.log.slice().reverse().map(function (e) { return '<div>' + logText(v, e) + '</div>'; }).join('') + '</div>';
    // 演出
    newEv.forEach(function (e, idx) { setTimeout(function () {
      if (e.t === 'atk') {
        if (e.outs.length) { pop(e.outs.map(function (o) { return v.players[o].emoji; }).join('') + ' 脱落！', 'out'); sfx('out'); }
        else if (e.self && e.hits.length === 1) { pop('💥 自爆！「' + e.k + '」', 'boom'); sfx('hit'); }
        else if (e.hits.length) { pop('ヒット！「' + e.k + '」' + (e.next === 'again' ? ' もう1回！' : ''), ''); sfx('hit'); }
        else { pop('「' + e.k + '」はずれ', 'miss'); sfx('miss'); }
      } else if (e.t === 'end') { var key = v.round + ':' + v.winner; if (confKey !== key) { confKey = key; setTimeout(function () { confetti(); sfx('win'); }, D(700)); } }
    }, D(idx * 400)); });
    if (newEv.length && v.phase === 'battle') sel = null;
    after.push(function () {
      $('bRules').onclick = function () { $('rules').classList.remove('hide'); };
      document.querySelectorAll('.k[data-k]').forEach(function (b) { b.onclick = function () { if (b.disabled) return; sel = sel === b.dataset.k ? null : b.dataset.k; render(); }; });
      if ($('atkGo')) $('atkGo').onclick = function () { if (!sel) return; var k = sel; sel = null; doAct({ t: 'attack', k: k }); };
      if ($('peekBtn')) $('peekBtn').onclick = openPeek;
      if ($('bAgain')) $('bAgain').onclick = function () { prevRev = null; seenLog = 0; gate = null; doAct({ t: 'again' }); };
      if ($('bHome')) $('bHome').onclick = function () { if (mode === 'host' && !confirm('部屋を閉じてタイトルにもどりますか？')) return; location.href = location.pathname; };
    });
  }
  if (v.phase !== 'battle' && v.phase !== 'end') { prevRev = null; seenLog = 0; }
  $('gameBody').innerHTML = h; after.forEach(function (f) { f(); });
}
function openPeek() {
  var hs = humans(), m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="card"><div class="phase">だれが見る？</div>' + hs.map(function (i) { return '<button class="btn g" data-s="' + i + '">' + pname(G.players[i]) + '</button>'; }).join('') + '<button class="btn sm g" data-c>とじる</button></div>';
  m.onclick = function (e) { var b = e.target.closest('[data-s]'); if (b) { var s = +b.dataset.s; m.innerHTML = '<div class="card gate"><div class="em">🤫</div>' + pname(G.players[s]) + ' の言葉<div style="font-size:30px;font-weight:900;margin:10px;color:#7a5af8">' + esc(G.disp[s]) + '</div><div>ふだ：' + esc(G.words[s]) + '</div><button class="btn" data-c>見た・とじる</button></div>'; return; }
    if (e.target === m || e.target.closest('[data-c]')) m.remove(); };
  document.body.appendChild(m);
}

/* ---------- ローカル設定 ---------- */
var seats = [];
try { seats = JSON.parse(localStorage.getItem('mk_seats')) || []; } catch (e) {}
if (!seats.length) seats = [{ h: 1, name: 'わたし' }, { ch: 1, lv: 1 }, { ch: 3, lv: 1 }];
function lvSel(v, attr) { return '<select ' + attr + '>' + E.LV.map(function (n, i) { return '<option value="' + i + '"' + (i === v ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>'; }
function renderSeats() {
  $('seatList').innerHTML = seats.map(function (s, i) {
    return '<div class="seat">' + (s.h ? '<span class="em">🙂</span><input type="text" maxlength="10" data-n="' + i + '" value="' + esc(s.name || '') + '">'
      : '<span class="em">' + E.CHARS[s.ch][1] + '</span><span style="flex:1">' + E.CHARS[s.ch][0] + '</span>' + lvSel(s.lv, 'data-l="' + i + '"')) + '<button class="x" data-x="' + i + '">×</button></div>'; }).join('');
  document.querySelectorAll('[data-n]').forEach(function (e) { e.oninput = function () { seats[+e.dataset.n].name = e.value; }; });
  document.querySelectorAll('[data-l]').forEach(function (e) { e.onchange = function () { seats[+e.dataset.l].lv = +e.value; }; });
  document.querySelectorAll('[data-x]').forEach(function (e) { e.onclick = function () { seats.splice(+e.dataset.x, 1); renderSeats(); }; });
}
function freeChar(list) { for (var k = 0; k < 6; k++) if (!list.some(function (s) { return s.ch === k; })) return k; return 0; }
$('goLocal').onclick = function () { renderSeats(); show('sSetup'); };
$('addHuman').onclick = function () { if (seats.length < E.MAXP) { seats.push({ h: 1, name: 'プレイヤー' + (seats.length + 1) }); renderSeats(); } else toast('5人までです'); };
$('addCpu').onclick = function () { if (seats.length < E.MAXP) { seats.push({ ch: freeChar(seats), lv: seats.filter(function (s) { return !s.h; }).slice(-1).map(function (s) { return s.lv; })[0] || 1 }); renderSeats(); } else toast('5人までです'); };
$('startLocal').onclick = function () {
  if (seats.length < 2) return toast('2人以上にしてね（CPUを足せます）');
  if (!seats.some(function (s) { return s.h; })) return toast('人を1人以上入れてね');
  try { localStorage.setItem('mk_seats', JSON.stringify(seats)); } catch (e) {}
  mode = 'local'; G = E.newGame(seats.map(function (s) { return s.h ? { name: (s.name || '').trim() || 'ななし', emoji: '🙂' } : { name: E.CHARS[s.ch][0], emoji: E.CHARS[s.ch][1], cpu: s.lv }; }));
  changed();
};
$('backTitle1').onclick = $('backTitle2').onclick = function () { show('sTitle'); };
$('goRules').onclick = function () { $('rules').classList.remove('hide'); };
$('rulesClose').onclick = function () { $('rules').classList.add('hide'); };
$('goOnline').onclick = function () { $('onName').value = localStorage.getItem('mk_name') || ''; show('sOnline'); };

/* ---------- オンライン ---------- */
var ID_PREFIX = 'mojikakushi-v1-', CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var ICE = Q.get('ice') ? Q.get('ice').split(',').map(function (u) { return { urls: u }; }) : [{ urls: 'stun:stun.l.google.com:19302' }];
var PEER_OPTS = { debug: 1, config: { iceServers: ICE } };
if (Q.get('peerhost')) { PEER_OPTS.host = Q.get('peerhost'); PEER_OPTS.port = +Q.get('peerport'); PEER_OPTS.path = Q.get('peerpath') || '/'; PEER_OPTS.secure = false; }
var peer = null, conns = [], hostConn = null, lobby = null, roomCode = '';
var PARTY = window.FuuParty && window.FuuParty.info;
function genCode() { var s = ''; for (var i = 0; i < 4; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }
function myName() { var n = $('onName').value.trim().slice(0, 10); if (!n) { toast('なまえを入れてね'); return null; } localStorage.setItem('mk_name', n); return n; }
$('mkRoom').onclick = function () {
  var nm = myName(); if (!nm) return; mode = 'host'; roomCode = (PARTY && PARTY.host) ? PARTY.code : (Q.get('code') || genCode());
  lobby = [{ name: nm, emoji: '🙂', seat: 'host' }];
  peer = new Peer(ID_PREFIX + roomCode, PEER_OPTS);
  peer.on('open', function () { renderLobby(); });
  peer.on('error', function (e) { if (e.type === 'unavailable-id' && PARTY) { try { peer.destroy(); } catch (x) {} toast('部屋を開いています…'); setTimeout(function () { $('mkRoom').onclick(); }, 2500); } else if (e.type === 'unavailable-id') { roomCode = genCode(); toast('コードを作り直します'); setTimeout(function () { $('mkRoom').onclick(); }, 300); } else toast('通信エラー：' + e.type); });
  peer.on('connection', function (c) {
    c.on('data', function (m) { hostRecv(c, m); });
    c.on('close', function () { conns = conns.filter(function (x) { return x !== c; }); if (lobby && !G) { lobby = lobby.filter(function (p) { return p.seat !== c.peer; }); renderLobby(); } });
  });
};
function hostRecv(c, m) {
  if (m.t === 'hello') {
    if (!G) { if (lobby.some(function (p) { return p.seat === c.peer; })) return; if (lobby.length >= E.MAXP) { c.send({ t: 'err', msg: '満員です' }); return; }
      lobby.push({ name: String(m.name || 'ななし').slice(0, 10), emoji: '🙂', seat: c.peer }); conns.push(c); renderLobby(); return; }
    var idx = G.players.findIndex(function (p) { return p.cpu == null && p.name === m.name && p.seat !== 'host'; });
    if (idx < 0) { c.send({ t: 'err', msg: 'ゲームはもう始まっています' }); return; }
    G.players[idx].seat = c.peer; conns.push(c); broadcast(); return;
  }
  if (m.t === 'act' && G) { var seat = G.players.findIndex(function (p) { return p.seat === c.peer; }); if (seat < 0) return;
    var a = m.a || {}; if (a.t === 'topic' || a.t === 'again') return;   // お題・もう1回はホストだけ
    if (E.act(G, a, seat)) changed(); }
}
function broadcast() {
  if (!G) { conns.forEach(function (c) { try { c.send({ t: 'lobby', players: lobby, code: roomCode }); } catch (e) {} }); return; }
  conns.forEach(function (c) { var s = G.players.findIndex(function (p) { return p.seat === c.peer; }); if (s >= 0) try { c.send({ t: 'state', g: E.viewFor(G, s), seat: s }); } catch (e) {} });
}
function renderLobby() {
  show('sLobby'); $('lobCode').textContent = roomCode;
  var url = location.origin + location.pathname + '?room=' + roomCode;
  if (mode === 'host' && !$('qr').dataset.c) { try { var qr = qrcode(0, 'M'); qr.addData(url); qr.make(); $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); $('qr').dataset.c = 1; } catch (e) {} }
  var L = lobby || [];
  $('lobList').innerHTML = L.map(function (p, i) { return '<div class="seat"><span class="em">' + (p.emoji || '🙂') + '</span><span style="flex:1">' + esc(p.name) + (p.cpu != null ? '（' + E.LV[p.cpu] + '）' : '') + (i === 0 ? ' 👑' : '') + '</span>' + (mode === 'host' && i > 0 ? '<button class="x" data-k="' + i + '">×</button>' : '') + '</div>'; }).join('') +
    (mode === 'host' ? '<div style="margin-top:6px;font-size:13px">CPUの強さ ' + lvSel(+(localStorage.getItem('mk_lv') || 1), 'id="lobLv"') + '</div>' : '');
  $('lobHost').classList.toggle('hide', mode !== 'host'); $('lobWait').classList.toggle('hide', mode === 'host');
  if (mode === 'host') {
    $('lobList').querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { var p = lobby[+b.dataset.k]; if (p.cpu == null) { var c = conns.find(function (x) { return x.peer === p.seat; }); if (c) { c.send({ t: 'err', msg: 'ホストに外されました' }); conns = conns.filter(function (x) { return x !== c; }); } } lobby.splice(+b.dataset.k, 1); renderLobby(); }; });
    $('lobLv').onchange = function () { localStorage.setItem('mk_lv', this.value); };
    $('lobStart').disabled = L.length < 2; $('lobStart').textContent = L.length < 2 ? '2人以上で始められます（CPU可）' : 'スタート！（' + L.length + '人）';
    broadcast();
  }
}
$('lobCpu').onclick = function () { if (lobby.length >= E.MAXP) return toast('5人までです'); var used = lobby.map(function (p) { return p.ch; }), ch = 0; while (used.indexOf(ch) > -1) ch++; var lv = +$('lobLv').value; lobby.push({ name: E.CHARS[ch][0], emoji: E.CHARS[ch][1], cpu: lv, ch: ch }); renderLobby(); };
$('lobStart').onclick = function () { if (lobby.length < 2) return; G = E.newGame(lobby); mySeat = 0; changed(); };
$('lobLeave').onclick = function () { if (window.FuuParty) FuuParty.leave(); location.href = location.pathname; };
$('copyLink').onclick = function () { var u = location.origin + location.pathname + '?room=' + roomCode; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('コピーしました'); }, function () { prompt('このリンクを送ってね', u); }); };
$('joinRoom').onclick = function () {
  var nm = myName(); if (!nm) return; var code = $('onCode').value.trim().toUpperCase(); if (code.length < 4) return toast('部屋コードを入れてね');
  mode = 'client'; roomCode = code; peer = new Peer(PEER_OPTS); toast('つないでいます…');
  var ptries = 0;
  function connect() { hostConn = peer.connect(ID_PREFIX + code, { reliable: true });
    hostConn.on('open', function () { hostConn.send({ t: 'hello', name: nm }); });
    hostConn.on('data', function (m) {
      if (m.t === 'fuu-goto') { if (PARTY) FuuParty.handle(m); }
      else if (m.t === 'lobby') { lobby = m.players; renderLobby(); }
      else if (m.t === 'state') { var old = G; G = m.g; mySeat = m.seat; if (old && old.round !== G.round) { prevRev = null; seenLog = 0; } render(); }
      else if (m.t === 'err') { toast(m.msg); setTimeout(function () { location.href = location.pathname; }, 1800); }
    });
    hostConn.on('close', function () { toast('ホストとの接続が切れました'); });
  }
  peer.on('open', connect);
  if (PARTY) var watch = setInterval(function () { if (lobby || G) { clearInterval(watch); return; } if (peer.open && !(hostConn && hostConn.open)) { try { hostConn && hostConn.close(); } catch (e) {} connect(); } }, FuuParty.watchMs);
  peer.on('error', function (e) { if (e.type === 'peer-unavailable' && PARTY && !lobby && ++ptries < FuuParty.retries) { toast('ホストを待っています…'); setTimeout(connect, FuuParty.retryMs); return; } toast(e.type === 'peer-unavailable' ? 'その部屋が見つかりません' : '通信エラー：' + e.type); });
};
function send(m) { if (hostConn && hostConn.open) hostConn.send(m); else toast('つながっていません'); }
if (PARTY) {
  FuuParty.init({ game: 'mojikakushi-battle',
    isHost: function () { return mode === 'host'; },
    inGame: function () { return !!G && G.phase === 'battle'; },
    canSwitch: function () { return mode !== 'host' || !G || G.phase === 'end' || G.phase === 'topic'; },
    broadcast: function (m) { conns.forEach(function (c) { try { c.send(m); } catch (e) {} }); } });
  FuuParty.status = function () { return mode === 'host' ? { host: 1, n: conns.filter(function (c) { return c.open; }).length } : { host: 0, joined: !!(lobby || G) }; };
  $('goOnline').onclick(); $('onName').value = PARTY.name || 'ななし';
  if (PARTY.host) $('mkRoom').onclick(); else { $('onCode').value = PARTY.code; $('joinRoom').onclick(); }
} else if (Q.get('room')) { $('onCode').value = Q.get('room'); $('goOnline').onclick(); }
window.MK_DEBUG = { get G() { return G; }, E: E, doAct: doAct, get mode() { return mode; } };
