global.window = global; require('../src/topics.js'); var E = require('../src/engine.js'); var assert = require('assert');
E.loadDict(window.MK_TOPICS); E.setSeed(7);
var T = function (n, f) { f(); console.log('ok', n); };
T('書き方', function () {
  assert.equal(E.norm('パイナップル'), 'はいなつふる'); assert.equal(E.norm('じゃがいも'), 'しやかいも'); assert.equal(E.norm('ゲーム'), 'けーむ');
  assert.equal(E.norm('ヴァイオリン'), 'うあいおりん'); assert(!E.check('あ').ok); assert(!E.check('あいうえおかきく').ok); assert(E.check('あいうえおかき').ok);
  assert(!E.check('ABC').ok); assert(E.check('しんぶんし').ok); });
function game(words, starter) { var G = E.newGame(words.map(function (w, i) { return { name: 'p' + i }; })); G.starter = starter || 0;
  E.act(G, { t: 'topic', topic: 'どうぶつ' }); words.forEach(function (w, i) { assert(E.act(G, { t: 'word', w: w }, i)); }); return G; }
T('ヒットで全部開く・連続攻撃は2回まで', function () {
  var G = game(['しんぶんし', 'ねこ', 'いぬ']); assert.equal(G.phase, 'battle');
  assert(E.act(G, { t: 'attack', k: 'し' }, 0)); assert.deepEqual(G.rev[0].slice(0, 5), [1, 0, 0, 0, 1]); assert.equal(G.turn, 0); // 自爆でも連続
  assert(!E.act(G, { t: 'attack', k: 'し' }, 0)); // 同じ文字は不可
  assert(!E.act(G, { t: 'attack', k: 'ね' }, 1)); // 手番外
  assert(E.act(G, { t: 'attack', k: 'ね' }, 0)); assert.equal(G.turn, 1); // 2回目ヒットでも交代
  assert(E.act(G, { t: 'attack', k: 'あ' }, 1)); assert.equal(G.turn, 2); });
T('ハズレで交代・脱落は手番スキップ', function () {
  var G = game(['ねこ', 'いぬ', 'うま']);
  E.act(G, { t: 'attack', k: 'い' }, 0); E.act(G, { t: 'attack', k: 'ぬ' }, 0); assert(!G.alive[1]); assert.equal(G.turn, 2);
  E.act(G, { t: 'attack', k: 'あ' }, 2); assert.equal(G.turn, 0); });
T('最後に残った人の勝ち', function () {
  var G = game(['ねこ', 'いぬ']); E.act(G, { t: 'attack', k: 'い' }, 0); E.act(G, { t: 'attack', k: 'ぬ' }, 0);
  assert.equal(G.phase, 'end'); assert.equal(G.winner, 0); });
T('同時に脱落したら攻撃した人の勝ち', function () {
  var G = game(['かか', 'かかか', 'さる']); E.act(G, { t: 'attack', k: 'さ' }, 0); E.act(G, { t: 'attack', k: 'る' }, 0);
  assert(!G.alive[2]); assert.equal(G.turn, 1); E.act(G, { t: 'attack', k: 'か' }, 1); assert.equal(G.phase, 'end'); assert.equal(G.winner, 1); });
T('自爆で自分だけ脱落したら残りの人が勝ち/続行', function () {
  var G = game(['ねこ', 'いぬ', 'さる']); E.act(G, { t: 'attack', k: 'ね' }, 0); E.act(G, { t: 'attack', k: 'こ' }, 0);
  assert(!G.alive[0]); assert.equal(G.phase, 'battle'); assert.equal(G.turn, 1); });
T('viewFor は他人の言葉と長さを隠す', function () {
  var G = game(['ねこ', 'らいおん']); var v = E.viewFor(G, 0); assert.equal(v.words[0], 'ねこ'); assert.equal(v.words[1], '？？？？？？？'); assert.equal(v.len[1], null);
  assert(JSON.stringify(v).indexOf('らいおん') < 0); E.act(G, { t: 'attack', k: 'い' }, 0); assert.equal(E.viewFor(G, 0).words[1], '？い？？？？？'); });
T('CPU 候補の絞り込み', function () {
  var G = game(['ねこ', 'きりん']); E.act(G, { t: 'attack', k: 'り' }, 0); E.act(G, { t: 'attack', k: 'ん' }, 0);
  var C = E.candidates(G, 1, 3).map(function (c) { return c.n; }); assert(C.indexOf('きりん') >= 0); assert(C.every(function (n) { return n[1] === 'り' && n[2] === 'ん'; })); });
T('again で勝ち数持ちこし', function () { var G = game(['ねこ', 'いぬ']); E.act(G, { t: 'attack', k: 'い' }, 0); E.act(G, { t: 'attack', k: 'ぬ' }, 0); E.act(G, { t: 'again' }); assert.equal(G.phase, 'topic'); assert.equal(G.wins[0], 1); assert.equal(G.starter, 1); });
console.log('all ok');
