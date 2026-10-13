# もじかくしバトル
お題にそった言葉を7枚のふだにかくし、五十音から1文字ずつ攻撃して当てあうパーティーゲーム（ふらっとgames／制作 watg）。
既存の言葉当てゲームの仕組みを参考にしたオリジナル作品です。お題・キャラクター・文章・絵・音はすべてオリジナルです。

- `index.html` 単一ファイル（`python3 build.py` で src/ から生成）
- お題・ことば辞典: `src/topics.js`（153お題・約1700語）
- テスト: `node test/engine.test.js`, `node test/selfplay.js 300`, `python3 test/ui.test.py`, `python3 test/online.test.py`（ローカルで `python3 -m http.server 18801`）
