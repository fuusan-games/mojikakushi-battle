/* もじかくしバトル：ルールエンジン＋CPU（DOM非依存・ホストが正） */
(function (root) {
'use strict';
var LV = ['弱い', '普通', '強い', 'アストラウルトラ😎'];
var CHARS = [['ふーさん', '🐻'], ['ミミ', '🐰'], ['ロボミ', '🤖'], ['ニャコ', '😺'], ['ポチ太', '🐶'], ['コンタ', '🦊']];
var ROWS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わをんー'];
var BOARD = ROWS.join('').replace(/ /g, '').split('');
var TUNE = { lead: .5, self: 3, cont: .35, ig: .25, kill: 1.2 };
var PANELS = 7, MINLEN = 2, MAXLEN = 7, MINP = 2, MAXP = 5;
var SMALL = { 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ', 'ゕ': 'か', 'ゖ': 'け', 'ゐ': 'い', 'ゑ': 'え', 'ゔ': 'う' };

/* 書き方ルール：ひらがな・濁点半濁点は書かない・小さい文字は大きく・のばす音は「ー」 */
function toKana(s) {
  s = String(s || '').normalize('NFKC').replace(/[\s　・]/g, '').replace(/[〜～\-－‐]/g, 'ー');
  s = s.replace(/[\u30a1-\u30f6]/g, function (m) { return String.fromCharCode(m.charCodeAt(0) - 0x60); });
  return s;
}
function norm(s) {
  s = toKana(s).normalize('NFD').replace(/[\u3099\u309a]/g, '').normalize('NFC');
  return s.split('').map(function (c) { return SMALL[c] || c; }).join('');
}
function check(raw) {   // → {ok, n, msg}
  var n = norm(raw);
  if (!n) return { ok: false, msg: 'ことばを入れてね' };
  for (var i = 0; i < n.length; i++) if (BOARD.indexOf(n[i]) < 0) return { ok: false, n: n, msg: 'ひらがな・カタカナで書いてね（「' + n[i] + '」は使えません）' };
  if (n.length < MINLEN) return { ok: false, n: n, msg: '2文字以上にしてね' };
  if (n.length > MAXLEN) return { ok: false, n: n, msg: '7文字までだよ（いまは' + n.length + '文字）' };
  return { ok: true, n: n };
}

/* ---------- 乱数 ---------- */
var seed = (Date.now() % 2147483646) + 1;
function rnd() { seed = (seed * 48271) % 2147483647; return (seed - 1) / 2147483646; }
function setSeed(s) { seed = (Math.abs(s) % 2147483646) + 1; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- ことば辞典 ---------- */
var DICT = null;
function loadDict(lines) {
  var topics = [], all = {}, freq = {}, nf = 0;
  lines.forEach(function (line) {
    var p = line.split('|'), words = [];
    p[1].split(/\s+/).forEach(function (w, r) { var c = check(w); if (!c.ok) return; words.push({ d: w, n: c.n, r: r });
      if (!all[c.n]) { all[c.n] = { d: w, n: c.n, r: r }; nf++; var seen = {}; c.n.split('').forEach(function (k) { if (!seen[k]) { seen[k] = 1; freq[k] = (freq[k] || 0) + 1; } }); } });
    topics.push({ name: p[0], words: words });
  });
  BOARD.forEach(function (k) { freq[k] = ((freq[k] || 0) + 1) / (nf + 2); });
  DICT = { topics: topics, all: Object.keys(all).map(function (k) { return all[k]; }), freq: freq };
  return DICT;
}
function topicWords(name) { var t = DICT.topics.find(function (x) { return x.name === name || norm(x.name) === norm(name); }); return t ? t.words : null; }

/* ---------- ゲーム ---------- */
function newGame(players) {
  return { players: players.map(function (p) { return { name: p.name, emoji: p.emoji || '🙂', cpu: p.cpu, seat: p.seat }; }),
    phase: 'topic', topic: '', words: players.map(function () { return null; }), disp: players.map(function () { return null; }),
    rev: players.map(function () { return [0, 0, 0, 0, 0, 0, 0]; }), used: [], alive: players.map(function () { return true; }),
    out: [], turn: 0, n: 0, last: null, log: [], winner: -1, starter: 0, round: 1, wins: players.map(function () { return 0; }) };
}
function setTopic(G, topic) {
  G.topic = String(topic || '').slice(0, 20) || 'なんでも'; G.phase = 'word';
  G.players.forEach(function (p, i) { if (p.cpu != null) { var w = cpuWord(G, i); G.words[i] = w.n; G.disp[i] = w.d; } });
  maybeStart(G);
}
function maybeStart(G) {
  if (G.phase !== 'word' || G.words.some(function (w) { return !w; })) return;
  G.phase = 'battle'; G.turn = G.starter; G.n = 0; G.log.push({ t: 'start' });
}
function hitsOf(G, k) {  // k を持つ生存者ごとの位置
  var res = [];
  G.players.forEach(function (p, i) { if (!G.alive[i]) return; var pos = []; for (var j = 0; j < G.words[i].length; j++) if (G.words[i][j] === k) pos.push(j); if (pos.length) res.push({ p: i, pos: pos }); });
  return res;
}
function hidden(G, i) { var c = 0; for (var j = 0; j < G.words[i].length; j++) if (!G.rev[i][j]) c++; return c; }
function nextAlive(G, i) { var n = G.players.length; for (var s = 1; s <= n; s++) { var j = (i + s) % n; if (G.alive[j]) return j; } return i; }
function attack(G, k, from) {
  if (G.phase !== 'battle') return false;
  if (from != null && from !== G.turn) return false;
  if (BOARD.indexOf(k) < 0 || G.used.indexOf(k) >= 0) return false;
  var a = G.turn; G.used.push(k);
  var hs = hitsOf(G, k);
  hs.forEach(function (h) { h.pos.forEach(function (j) { G.rev[h.p][j] = 1; }); });
  var outs = [];
  G.players.forEach(function (p, i) { if (G.alive[i] && hidden(G, i) === 0) { G.alive[i] = false; outs.push(i); G.out.push(i); } });
  G.n++;
  var ev = { t: 'atk', a: a, k: k, hits: hs, outs: outs, n: G.n, self: hs.some(function (h) { return h.p === a; }) };
  G.log.push(ev); G.last = ev;
  var left = G.alive.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
  if (left.length <= 1) {   // 最後の人が同時に脱落したら、攻撃した人の勝ち
    G.winner = left.length === 1 ? left[0] : a; G.phase = 'end'; G.wins[G.winner]++; G.log.push({ t: 'end', w: G.winner }); return true;
  }
  if (!G.alive[a]) { G.turn = nextAlive(G, a); G.n = 0; ev.next = 'out'; }
  else if (hs.length && G.n < 2) ev.next = 'again';
  else { G.turn = nextAlive(G, a); G.n = 0; ev.next = 'pass'; }
  return true;
}
function again(G) {   // つぎのゲーム（勝ち数は持ちこし、スタートは左どなりへ）
  var w = G.wins, st = (G.starter + 1) % G.players.length, r = G.round + 1;
  var g = newGame(G.players); Object.keys(g).forEach(function (k) { G[k] = g[k]; }); G.wins = w; G.starter = st; G.round = r;
}
function act(G, a, from) {   // from: 操作した席（null = ローカル）
  if (!a) return false;
  if (a.t === 'topic') { if (G.phase !== 'topic') return false; setTopic(G, a.topic); return true; }
  if (a.t === 'word') {
    var p = from != null ? from : a.p; if (G.phase !== 'word' || p == null || !G.players[p] || G.words[p]) return false;
    var c = check(a.w); if (!c.ok) return false; G.words[p] = c.n; G.disp[p] = String(a.w).slice(0, 12); maybeStart(G); return true; }
  if (a.t === 'attack') return attack(G, a.k, from);
  if (a.t === 'again') { if (G.phase !== 'end') return false; again(G); return true; }
  return false;
}
function viewFor(G, seat) {
  var v = JSON.parse(JSON.stringify(G)), end = G.phase === 'end';
  v.words = G.words.map(function (w, i) { if (!w) return null; if (end || i === seat || !G.alive[i]) return w;
    var o = ''; for (var j = 0; j < w.length; j++) o += G.rev[i][j] ? w[j] : '？'; return o + '？？？？？？？'.slice(0, PANELS - w.length); });
  v.disp = G.disp.map(function (d, i) { return end || i === seat || !G.alive[i] ? d : (d ? '…' : null); });
  v.len = G.words.map(function (w, i) { return w && (end || i === seat || !G.alive[i]) ? w.length : null; });
  v.ready = G.words.map(function (w) { return !!w; });
  return v;
}
/* 他の人から見える情報：7枚のうち開いた文字だけ */
function panelsOf(G, i) { var a = []; for (var j = 0; j < PANELS; j++) a.push(G.words[i] && j < G.words[i].length && G.rev[i][j] ? G.words[i][j] : null); return a; }

/* ---------- CPU ---------- */
function cpuWord(G, i) {
  var lv = G.players[i].cpu, list = topicWords(G.topic), free = !list;
  if (!list) list = DICT.all;
  if (lv <= 1 || list.length < 4) { var pool = list.filter(function (w) { return w.r < Math.max(8, list.length * (lv === 0 ? .5 : .8)); }); return pick(pool.length ? pool : list); }
  // 強い：見つかりにくい文字（めずらしい・種類が多い）の言葉。アストラは「何回の攻撃で全部開くか」で評価
  var sc = list.map(function (w) {
    var ks = {}, s = 0; w.n.split('').forEach(function (k) { ks[k] = 1; });
    var kk = Object.keys(ks);
    kk.forEach(function (k) { s += -Math.log(DICT.freq[k]); });
    if (lv >= 3) { var others = list.filter(function (x) { return x !== w; }), sim = 0;   // 同じお題の言葉と文字がかぶるほど推理されやすい
      others.forEach(function (x) { var c = 0; kk.forEach(function (k) { if (x.n.indexOf(k) >= 0) c++; }); sim += c / kk.length; });
      s -= 2.2 * sim / Math.max(1, others.length) * kk.length; s += (w.d !== w.n && norm(w.d) === w.n && /[゛゜ぁぃぅぇぉっゃゅょァィゥェォッャュョガ-ポが-ぽ]/.test(toKana(w.d).normalize('NFD') + w.d) ? .6 : 0); }
    s += kk.length * (lv >= 3 ? .35 : .2) - (w.r > 40 ? 1 : 0);
    return { w: w, s: s + rnd() * (lv >= 3 ? .6 : 1.2) };
  }).sort(function (a, b) { return b.s - a.s; });
  return sc[Math.floor(rnd() * Math.max(1, Math.ceil(sc.length * (lv >= 3 ? .12 : .25))))].w;
}
function absentSet(G, i) {   // i が持っていないと分かる文字＝使われた文字のうち i で開かなかったもの
  var pan = panelsOf(G, i), s = {}; G.used.forEach(function (k) { if (pan.indexOf(k) < 0) s[k] = 1; }); return s;
}
function fits(w, pan, absent, full) {
  if (w.length > PANELS) return false;
  for (var j = 0; j < PANELS; j++) {
    if (pan[j]) { if (w[j] !== pan[j]) return false; }
    else if (j < w.length && full && absent[w[j]]) return false;
    else if (j < w.length && !full && pan.indexOf(w[j]) >= 0) return false;
  }
  return true;
}
/* q の言葉の候補（重みつき） */
function candidates(G, q, lv) {
  var pan = panelsOf(G, q), absent = absentSet(G, q), tl = topicWords(G.topic), out = [], seen = {}, full = lv >= 2;
  (tl || []).forEach(function (w) { if (!seen[w.n] && fits(w.n, pan, absent, full)) { seen[w.n] = 1; out.push({ n: w.n, p: 1 / (1 + .04 * w.r) }); } });
  if (lv >= 2 || !tl) DICT.all.forEach(function (w) { if (!seen[w.n] && fits(w.n, pan, absent, full)) { seen[w.n] = 1; out.push({ n: w.n, p: (tl ? .02 : 1) / (1 + .04 * w.r) }); } });
  return out;
}
/* 辞典にない言葉用：文字の出やすさからの推定 */
function freqCtx(G, q) {
  var pan = panelsOf(G, q), rv = pan.filter(Boolean).length, last = -1; pan.forEach(function (x, j) { if (x) last = j; });
  var expHidden = Math.max(.6, Math.max(4.2, last + 1) - rv);
  var absent = absentSet(G, q), tot = 0; BOARD.forEach(function (x) { if (!absent[x] && pan.indexOf(x) < 0) tot += DICT.freq[x]; });
  return function (k) { var per = Math.min(.9, DICT.freq[k] / (tot || 1)); return 1 - Math.pow(1 - per, expHidden); };
}
function presence(G, q, lv) {   // → {k: P(k が q の言葉にある)}, H（候補のあいまいさ）
  var C = candidates(G, q, lv), tot = 0, P = {}, used = {}; G.used.forEach(function (k) { used[k] = 1; });
  C.forEach(function (c) { tot += c.p; });
  var trust = lv === 0 ? 0 : tot / (tot + (lv >= 2 ? .25 : .6));
  if (C.length === 1 && lv >= 2) trust = .97;
  var S = {}; C.forEach(function (c) { var seen = {}; for (var j = 0; j < c.n.length; j++) { var x = c.n[j]; if (!seen[x]) { seen[x] = 1; S[x] = (S[x] || 0) + c.p; } } });
  var fp = freqCtx(G, q);
  BOARD.forEach(function (k) { if (used[k]) return; P[k] = trust * (tot ? (S[k] || 0) / tot : 0) + (1 - trust) * fp(k); });
  P.S = S;
  var H = 0; C.forEach(function (c) { var x = c.p / tot; H -= x * Math.log(x); });
  return { P: P, C: C, tot: tot, H: H, trust: trust };
}
function cpuAttack(G) {
  var a = G.turn, lv = G.players[a].cpu, my = G.words[a], used = {};
  G.used.forEach(function (k) { used[k] = 1; });
  var free = BOARD.filter(function (k) { return !used[k]; });
  if (lv === 0) {   // 弱い：よく使う文字をなんとなく
    var w = free.map(function (k) { return { k: k, s: DICT.freq[k] * (my.indexOf(k) >= 0 ? .5 : 1) * (.4 + rnd()) }; }).sort(function (x, y) { return y.s - x.s; });
    return w[Math.floor(rnd() * Math.min(4, w.length))].k;
  }
  var opp = [], i;
  for (i = 0; i < G.players.length; i++) if (i !== a && G.alive[i]) opp.push(i);
  var info = {}; opp.forEach(function (q) { var I = presence(G, q, lv), pan = panelsOf(G, q);
    I.hid = I.C.length ? I.C.reduce(function (s, c) { var h = 0; for (var j = 0; j < c.n.length; j++) if (!pan[j]) h++; return s + h * c.p; }, 0) / (I.tot || 1) : 4; info[q] = I; });
  var myHidden = 0, myLeft = {}; for (i = 0; i < my.length; i++) if (!G.rev[a][i]) { myHidden++; myLeft[my[i]] = (myLeft[my[i]] || 0) + 1; }
  var best = null;
  free.forEach(function (k) {
    var eh = 0, pAny = 1;
    opp.forEach(function (q) {
      var p = info[q].P[k] || 0, I = info[q];
      // 残り枚数が少ない相手ほど価値が高い（脱落させる）
      var hidQ = I.hid;
      var w = 1 + (lv >= 2 ? TUNE.kill / Math.max(1, hidQ) : 0) + (lv >= 3 ? TUNE.lead * hidQ / 4 : 0);
      eh += p * w; pAny *= 1 - p;
    });
    pAny = 1 - pAny;
    var s = eh;
    if (myLeft[k]) { s -= (lv >= 2 ? TUNE.self : 1) + (myLeft[k] >= myHidden ? 50 : 0) + .4 * myLeft[k]; pAny = 1; }
    if (G.n === 0) s += TUNE.cont * pAny;
    if (lv >= 3) {   // 情報量：この文字で候補がどれだけ絞れるか
      var ig = 0;
      opp.forEach(function (q) { var I = info[q]; if (I.C.length < 2) return; var py = (I.P.S[k] || 0) / I.tot;
        if (py > 0 && py < 1) ig += -(py * Math.log(py) + (1 - py) * Math.log(1 - py)); });
      s += TUNE.ig * ig;
    }
    if (lv === 1) s *= .8 + .4 * rnd();
    if (!best || s > best.s) best = { k: k, s: s };
  });
  return best.k;
}
function cpuThinkMs(G) { var lv = G.players[G.turn].cpu; return 900 + 500 * (lv || 0) + rnd() * 600; }

var E = { LV: LV, CHARS: CHARS, ROWS: ROWS, BOARD: BOARD, PANELS: PANELS, MINP: MINP, MAXP: MAXP, norm: norm, toKana: toKana, check: check,
  setSeed: setSeed, rnd: rnd, pick: pick, shuffle: shuffle, loadDict: loadDict, topicWords: topicWords, get DICT() { return DICT; },
  newGame: newGame, setTopic: setTopic, act: act, attack: attack, viewFor: viewFor, panelsOf: panelsOf, hidden: hidden,
  cpuWord: cpuWord, cpuAttack: cpuAttack, candidates: candidates, presence: presence, cpuThinkMs: cpuThinkMs, TUNE: TUNE };
root.MKE = E; if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
