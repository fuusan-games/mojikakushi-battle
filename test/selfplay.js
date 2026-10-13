global.window = global; require('../src/topics.js'); var E = require('../src/engine.js');
if (process.env.TUNE) Object.assign(E.TUNE, JSON.parse(process.env.TUNE)); E.loadDict(window.MK_TOPICS); E.setSeed(+process.argv[3] || 11);
var N = +process.argv[2] || 400, wins = [0, 0, 0, 0], games = 0, turns = 0, selfH = [0, 0, 0, 0], atk = [0, 0, 0, 0];
for (var g = 0; g < N; g++) {
  var lv = E.shuffle([0, 1, 2, 3]);
  var G = E.newGame(lv.map(function (l, i) { return { name: 'c' + i, cpu: l }; })); G.starter = g % 4;
  E.act(G, { t: 'topic', topic: E.pick(E.DICT.topics).name });
  var t = 0;
  while (G.phase === 'battle' && t < 200) { var k = E.cpuAttack(G), a = G.turn; if (!E.act(G, { t: 'attack', k: k }, a)) throw 'bad ' + k;
    atk[lv[a]]++; if (G.last.self) selfH[lv[a]]++; t++; }
  if (G.phase !== 'end') throw 'no end'; wins[lv[G.winner]]++; games++; turns += t;
}
console.log('games', games, 'avg attacks', (turns / games).toFixed(1));
E.LV.forEach(function (n, i) { console.log(n, 'win', (100 * wins[i] / games).toFixed(1) + '%', 'self-hit', (100 * selfH[i] / atk[i]).toFixed(1) + '%'); });
