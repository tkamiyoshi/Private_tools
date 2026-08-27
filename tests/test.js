// きいちアプリ 検証用ハーネス（最小DOMシム上で実コードを実行）
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'index.html');
const html = fs.readFileSync(path, 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let fails = 0, passes = 0;
function ok(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

class El {
  constructor(tag, sel) {
    this.tag = tag; this.sel = sel || tag;
    this.children = []; this.dataset = {}; this.style = {}; this.attrs = {};
    this.classes = new Set(); this.h = {};
    this._text = ''; this._html = ''; this.hidden = false; this.disabled = false;
    this.clientWidth = 400; this.offsetWidth = 400; this.parent = null; this.value = '';
    this.id = (sel && sel[0] === '#') ? sel.slice(1) : '';
    if (sel && sel[0] === '.') this.classes.add(sel.slice(1));
  }
  get classList() {
    const s = this.classes;
    return {
      add: (...c) => c.forEach(x => s.add(x)),
      remove: (...c) => c.forEach(x => s.delete(x)),
      contains: c => s.has(c),
      toggle: (c, f) => { if (f === undefined) f = !s.has(c); f ? s.add(c) : s.delete(c); }
    };
  }
  get className() { return [...this.classes].join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(t, f) { (this.h[t] = this.h[t] || []).push(f); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  insertBefore(c, ref) { c.parent = this; this.children.unshift(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  closest(sel) {
    const c = sel.replace(/^\./, '');
    let n = this;
    while (n) { if (n.classes.has(c)) return n; n = n.parent; }
    return null;
  }
  scrollIntoView() {}
  focus() {}
  fire(type, ev) { (this.h[type] || []).forEach(f => f.call(this, ev)); }
}

const reg = new Map();
function get(sel) { if (!reg.has(sel)) reg.set(sel, new El('div', sel)); return reg.get(sel); }

// タブ/パネルの実体
const TABS = ['clock','cal','calc','watch','puzzle','quiz','guess','touch'];
const tabEls = TABS.map(id => { const e = new El('button', '.tab'); e.dataset.tab = id; return e; });
const panelEls = TABS.map(id => { const e = new El('section', '#p-' + id); e.classes.add('panel'); e.id = 'p-' + id; if (id === 'clock') e.classes.add('active'); reg.set('#p-' + id, e); return e; });
const modeChips = ['add','sub','mul','div','mix'].map(m => { const e = new El('button', '.chip'); e.dataset.m = m; e.parent = get('#qMode'); return e; });
const levelChips = ['1','2','3'].map(l => { const e = new El('button', '.chip'); e.dataset.l = l; e.parent = get('#qLevel'); return e; });

const document = {
  querySelector(sel) {
    if (/^\.tab\[data-tab="(.+)"\]$/.test(sel)) {
      const id = sel.match(/"(.+)"/)[1];
      return tabEls.find(t => t.dataset.tab === id) || null;
    }
    return get(sel);
  },
  querySelectorAll(sel) {
    if (sel === '.tab') return tabEls;
    if (sel === '.panel') return panelEls;
    if (sel === '#qMode .chip') return modeChips;
    if (sel === '#qLevel .chip') return levelChips;
    if (sel === '#qChoices .choice') return get('#qChoices').children;
    return [];
  },
  createElement: t => new El(t),
  createElementNS: (ns, t) => new El(t),
  addEventListener(t, f) { (this.h = this.h || {}), ((this.h[t] = this.h[t] || []).push(f)); },
  h: {}
};
document.addEventListener = function (t, f) { (document.h[t] = document.h[t] || []).push(f); };
function keydown(key) { (document.h.keydown || []).forEach(f => f({ key, preventDefault() {} })); }

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }
};
const window = { addEventListener() {} };
const requestAnimationFrame = () => 0;
const cancelAnimationFrame = () => {};
const timers = [];
const setIntervalX = (f, ms) => { timers.push(f); return timers.length; };
const clearIntervalX = () => {};
let pendingTimeouts = [];
const setTimeoutX = (f, ms) => { pendingTimeouts.push(f); return pendingTimeouts.length; };
function flushTimeouts() { const t = pendingTimeouts; pendingTimeouts = []; t.forEach(f => f()); }

// 実行
const runner = new Function(
  'document','window','localStorage','requestAnimationFrame','cancelAnimationFrame',
  'setInterval','clearInterval','setTimeout','Element',
  js + '\nreturn {Tabs, Puzzle};'
);
const api = runner(document, window, localStorage, requestAnimationFrame, cancelAnimationFrame,
  setIntervalX, clearIntervalX, setTimeoutX, El);

console.log('\n== T1 起動時の初期化 ==');
ok('とけいのデジタル表示が HH:MM:SS 形式', /^\d\d:\d\d:\d\d$/.test(get('#dig').textContent), get('#dig').textContent);
ok('日付行が表示される', /年.+月.+日/.test(get('#dateline').textContent), get('#dateline').textContent);
ok('よみかたが ごぜん/ごご 付き', /^(ごぜん|ごご) \d+じ/.test(get('#yomi').textContent), get('#yomi').textContent);
ok('カレンダーが6週ぶん生成される', (get('#calBody').innerHTML.match(/<tr>/g) || []).length === 6);
ok('カレンダーのセルが42個', (get('#calBody').innerHTML.match(/class="day/g) || []).length === 42);
ok('電卓の初期表示は 0', get('#calcMain').textContent === '0');
ok('すうじタッチが25マス', get('#tGrid').children.length === 25);
ok('すうじタッチが1〜25を重複なく配置',
  new Set(get('#tGrid').children.map(c => Number(c.dataset.n))).size === 25);

console.log('\n== T2 タブ切り替え ==');
api.Tabs.activate('calc');
ok('でんたくパネルが active', reg.get('#p-calc').classes.has('active'));
ok('とけいパネルは非active', !reg.get('#p-clock').classes.has('active'));
ok('タブの aria-selected が更新', tabEls[2].attrs['aria-selected'] === 'true' && tabEls[0].attrs['aria-selected'] === 'false');
ok('選んだタブが保存される', store['kiichi.tab'] === 'calc');

console.log('\n== T3 でんたく ==');
const keys = get('#keys');
function K(k) { const b = new El('button', '.key'); b.dataset.k = k; b.parent = keys; keys.fire('click', { target: b }); }
function calcSeq(seq) { K('C'); seq.split(' ').forEach(K); return get('#calcMain').textContent; }
ok('12 + 8 = 20', calcSeq('1 2 + 8 =') === '20', get('#calcMain').textContent);
ok('7 × 6 = 42', calcSeq('7 * 6 =') === '42', get('#calcMain').textContent);
ok('9 − 15 = -6', calcSeq('9 - 1 5 =') === '-6', get('#calcMain').textContent);
ok('7 ÷ 2 = 3.5', calcSeq('7 / 2 =') === '3.5', get('#calcMain').textContent);
ok('0.1 + 0.2 = 0.3（誤差なし）', calcSeq('0 . 1 + 0 . 2 =') === '0.3', get('#calcMain').textContent);
ok('連続演算 2 + 3 + 4 = 9', calcSeq('2 + 3 + 4 =') === '9', get('#calcMain').textContent);
ok('5 ÷ 0 はエラー', calcSeq('5 / 0 =') === 'エラー', get('#calcMain').textContent);
K('C'); ok('C でエラーから復帰', get('#calcMain').textContent === '0');
calcSeq('1 2 3'); K('back'); ok('← で1文字消える(12)', get('#calcMain').textContent === '12', get('#calcMain').textContent);
K('sign'); ok('± で符号反転(-12)', get('#calcMain').textContent === '-12', get('#calcMain').textContent);
calcSeq('1 . 2 . 3'); ok('小数点は1つだけ(1.23)', get('#calcMain').textContent === '1.23', get('#calcMain').textContent);
K('C'); '123456789012345'.split('').forEach(K);
ok('12桁で入力が止まる', get('#calcMain').textContent.length === 12, get('#calcMain').textContent);
K('C'); keydown('4'); keydown('+'); keydown('5'); keydown('Enter');
ok('キーボード入力 4+5=9', get('#calcMain').textContent === '9', get('#calcMain').textContent);

console.log('\n== T4 1024パズル ==');
api.Tabs.activate('puzzle');
const board = get('#board');
const tileVals = () => board.children.filter(c => c.classes.has('tile')).map(t => Number(t.textContent));
ok('開始時のタイルは2枚', tileVals().length === 2, tileVals());
ok('開始タイルは2か4', tileVals().every(v => v === 2 || v === 4), tileVals());
let before = tileVals().length;
keydown('ArrowLeft'); keydown('ArrowUp'); keydown('ArrowRight'); keydown('ArrowDown');
ok('キー操作でタイルが増える/合体する', tileVals().length >= 2 && tileVals().length <= 6, tileVals());
ok('タイルの値はすべて2の累乗', tileVals().every(v => v >= 2 && (v & (v - 1)) === 0), tileVals());
let moves = 0, guard = 0;
while (guard++ < 4000 && get('#pOver').hidden) {
  keydown(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'][guard % 4]);
  flushTimeouts(); moves++;
}
ok('ランダム操作で必ず終局する（無限ループなし）', !get('#pOver').hidden, 'moves=' + moves);
ok('終局メッセージが出る', /おしまい|たっせい/.test(get('#pOverMsg').textContent), get('#pOverMsg').textContent);
ok('スコアが加算されている', Number(get('#pScore').textContent) > 0, get('#pScore').textContent);
ok('ベストスコアが保存される', Number(store['kiichi.puzzle.best']) > 0, store['kiichi.puzzle.best']);
get('#pNew').fire('click', {});
ok('もういちどでリセット', tileVals().length === 2 && get('#pScore').textContent === '0' && get('#pOver').hidden === true);

console.log('\n== T5 けいさんチャレンジ ==');
api.Tabs.activate('quiz');
const modes = [['add','たしざん'],['sub','ひきざん'],['mul','かけざん'],['div','わりざん'],['mix','ミックス']];
let qBad = [];
for (const [m] of modes) {
  for (const lv of [1,2,3]) {
    get('#qMode').fire('click', { target: modeChips.find(c => c.dataset.m === m) });
    get('#qLevel').fire('click', { target: levelChips.find(c => c.dataset.l === String(lv)) });
    for (let n = 0; n < 40; n++) {
      get('#qStart').fire('click', {});
      const txt = get('#qText').textContent;
      const mm = txt.match(/^(-?\d+) (.) (-?\d+) = \?$/);
      if (!mm) { qBad.push('式が不正: ' + txt); continue; }
      const a = +mm[1], b = +mm[3], o = mm[2];
      const expect = o === '＋' ? a + b : o === '−' ? a - b : o === '×' ? a * b : a / b;
      if (o === '−' && expect < 0) qBad.push('ひきざんが負: ' + txt);
      if (o === '÷' && !Number.isInteger(expect)) qBad.push('わりざんが割り切れない: ' + txt);
      const ch = get('#qChoices').children.map(c => Number(c.dataset.v));
      if (ch.length !== 4) qBad.push('選択肢が4つでない: ' + ch.length);
      if (new Set(ch).size !== 4) qBad.push('選択肢が重複: ' + ch);
      if (!ch.includes(expect)) qBad.push('正解が選択肢にない: ' + txt + ' ans=' + expect + ' ch=' + ch);
      if (ch.some(v => v < 0)) qBad.push('選択肢にマイナス: ' + ch);
    }
  }
}
ok('全モード×全レベル600問の式・選択肢が正当', qBad.length === 0, qBad.slice(0, 3).join(' | '));

// 10問すべて正解して結果画面へ
get('#qMode').fire('click', { target: modeChips[0] });
get('#qStart').fire('click', {});
for (let i = 0; i < 10; i++) {
  const txt = get('#qText').textContent.match(/^(\d+) . (\d+)/);
  const ans = Number(txt[1]) + Number(txt[2]);
  const btn = get('#qChoices').children.find(c => Number(c.dataset.v) === ans);
  get('#qChoices').fire('click', { target: btn });
  flushTimeouts();
}
ok('10問正解で結果画面が出る', get('#quizResult').style.display === '' && get('#quizPlay').style.display === 'none');
ok('満点で ⭐⭐⭐', get('#qStars').textContent === '⭐⭐⭐', get('#qStars').textContent);
ok('スコア表示が 10 / 10', get('#qScore').textContent.indexOf('10 / 10') === 0, get('#qScore').textContent);

// 不正解時に正解が示される
get('#qAgain').fire('click', {});
{
  const t = get('#qText').textContent.match(/^(\d+) . (\d+)/);
  const ans = Number(t[1]) + Number(t[2]);
  const wrong = get('#qChoices').children.find(c => Number(c.dataset.v) !== ans);
  get('#qChoices').fire('click', { target: wrong });
  ok('まちがえたら正解が表示される', get('#qJudge').textContent === '❌ こたえは ' + ans, get('#qJudge').textContent);
  ok('連打しても二重回答にならない',
    (get('#qChoices').fire('click', { target: wrong }), get('#qJudge').textContent === '❌ こたえは ' + ans));
  flushTimeouts();
}

console.log('\n== T6 かずあて ==');
api.Tabs.activate('guess');
get('#gNew').fire('click', {});
// 二分探索で必ず当たるか
let lo = 1, hi = 100, found = 0, steps = 0;
while (lo <= hi && steps++ < 12) {
  const mid = Math.floor((lo + hi) / 2);
  get('#gInput').value = String(mid);
  get('#gGo').fire('click', {});
  const msg = get('#guessMsg').textContent;
  if (msg.indexOf('せいかい') >= 0) { found = mid; break; }
  if (msg.indexOf('大きい') >= 0) lo = mid + 1; else hi = mid - 1;
}
ok('二分探索で7回以内に必ず当たる', found >= 1 && steps <= 7, 'found=' + found + ' steps=' + steps);
ok('正解後は入力が無効化される', get('#gInput').disabled === true && get('#gGo').disabled === true);
ok('履歴が残る', get('#guessLog').children.length === steps, get('#guessLog').children.length);
get('#gNew').fire('click', {});
get('#gInput').value = '150'; get('#gGo').fire('click', {});
ok('範囲外はエラー案内', get('#guessMsg').textContent === '1〜100の かずを いれてね', get('#guessMsg').textContent);
get('#gInput').value = 'あ'; get('#gGo').fire('click', {});
ok('数値以外もエラー案内（落ちない）', get('#guessMsg').textContent === '1〜100の かずを いれてね');

console.log('\n== T7 すうじタッチ ==');
api.Tabs.activate('touch');
get('#tNew').fire('click', {});
const grid = get('#tGrid');
const cellOf = n => grid.children.find(c => Number(c.dataset.n) === n);
const c1 = cellOf(1), c5 = cellOf(5);
grid.fire('click', { target: c5 });
ok('順番でないタッチは進まない', get('#tNext').textContent === '1' && !c5.classes.has('done'));
ok('まちがいタッチに bad クラス', c5.classes.has('bad'));
for (let n = 1; n <= 25; n++) grid.fire('click', { target: cellOf(n) });
ok('1〜25を順に押すと完了', get('#tNext').textContent === '🎉');
ok('全マスが done', grid.children.every(c => c.classes.has('done')));
ok('ベストタイムが保存される', 'kiichi.touch.best' in store, store['kiichi.touch.best']);
ok('ベスト表示が数値', /^\d+\.\d$/.test(get('#tBest').textContent), get('#tBest').textContent);

console.log('\n== T8 ストップウォッチ ==');
api.Tabs.activate('watch');
ok('初期表示 00:00.00', get('#swTime').textContent === '00:00.00', get('#swTime').textContent);
get('#swStart').fire('click', {});
ok('スタート後はボタンがストップに', get('#swStart').textContent === 'ストップ');
get('#swLap').fire('click', {});
ok('ラップが記録される', get('#laps').children.length === 1);
get('#swReset').fire('click', {});
ok('リセットで 00:00.00 に戻る', get('#swTime').textContent === '00:00.00');
ok('リセットでラップが消える', get('#laps').children.length === 0);
ok('リセットでボタンがスタートに', get('#swStart').textContent === 'スタート');

console.log('\n== T9 カレンダー ==');
api.Tabs.activate('cal');
const ym0 = get('#ym').textContent;
get('#prevM').fire('click', {});
const ym1 = get('#ym').textContent;
ok('まえの月へ移動', ym1 !== ym0, ym0 + ' -> ' + ym1);
get('#nextM').fire('click', {});
ok('つぎの月で元に戻る', get('#ym').textContent === ym0);
for (let i = 0; i < 26; i++) get('#nextM').fire('click', {});
ok('年をまたいでも壊れない', /^\d{4}年 \d{1,2}月$/.test(get('#ym').textContent), get('#ym').textContent);
get('#todayBtn').fire('click', {});
ok('きょうへ戻る', get('#ym').textContent === ym0);
{
  const t = new Date(); t.setHours(0,0,0,0);
  const b = new El('button', '.day'); b.dataset.t = String(t.getTime()); b.parent = get('#calBody');
  get('#calBody').fire('click', { target: b });
  ok('日付タップで「きょうだよ！」', get('#calInfo').textContent.indexOf('きょうだよ！') > 0, get('#calInfo').textContent);
  const b2 = new El('button', '.day'); b2.dataset.t = String(t.getTime() + 3 * 86400000); b2.parent = get('#calBody');
  get('#calBody').fire('click', { target: b2 });
  ok('3日後は「3日あと」', get('#calInfo').textContent.indexOf('3日あと') > 0, get('#calInfo').textContent);
}

console.log('\n== T11 修正点の回帰テスト ==');
// --- (1) 1024達成後に続きが遊べる ---
api.Tabs.activate('puzzle');
{
  const vals = () => board.children.filter(c => c.classes.has('tile')).map(t => Number(t.textContent));
  // 盤面をDOM（タイルのleft/top）から復元する
  const readBoard = () => {
    const g = new Array(16).fill(0);
    board.children.filter(c => c.classes.has('tile')).forEach(t => {
      const size = parseFloat(t.style.width);
      const col = Math.round((parseFloat(t.style.left) - 8) / (size + 8));
      const row = Math.round((parseFloat(t.style.top) - 8) / (size + 8));
      g[row * 4 + col] = Number(t.textContent);
    });
    return g;
  };
  // アプリと同じスライド規則をテスト側でも再現し、先読みで手を選ぶ
  const lineIdx = (dir, k) => {
    const idx = [];
    for (let i = 0; i < 4; i++) {
      if (dir === 'left')  idx.push(k * 4 + i);
      if (dir === 'right') idx.push(k * 4 + (3 - i));
      if (dir === 'up')    idx.push(i * 4 + k);
      if (dir === 'down')  idx.push((3 - i) * 4 + k);
    }
    return idx;
  };
  const simulate = (g, dir) => {
    const out = g.slice();
    let moved = false;
    for (let k = 0; k < 4; k++) {
      const idx = lineIdx(dir, k);
      const before = idx.map(j => out[j]);
      const a = before.filter(v => v), res = [];
      for (let i = 0; i < a.length; ) {
        if (i + 1 < a.length && a[i] === a[i + 1]) { res.push(a[i] * 2); i += 2; }
        else { res.push(a[i]); i++; }
      }
      while (res.length < 4) res.push(0);
      for (let i = 0; i < 4; i++) { if (before[i] !== res[i]) moved = true; out[idx[i]] = res[i]; }
    }
    if (!moved) return null;
    const e = out.indexOf(0);          // Math.random()=0 なので空きマスの先頭に必ず 2
    if (e >= 0) out[e] = 2;
    return out;
  };
  const W = [65536,32768,16384,8192, 512,1024,2048,4096, 256,128,64,32, 2,4,8,16];
  const evalB = g => g.reduce((s, v, i) => s + v * W[i], 0) + g.filter(v => !v).length * 20000;
  const search = (g, depth) => {
    let best = -1;
    for (const d of ['left','up','right','down']) {
      const n = simulate(g, d);
      if (!n) continue;
      const s = depth <= 1 ? evalB(n) : search(n, depth - 1);
      if (s > best) best = s;
    }
    return best < 0 ? evalB(g) : best;
  };
  const bestMove = g => {
    let best = -1, pick = null;
    for (const d of ['left','up','right','down']) {
      const n = simulate(g, d);
      if (!n) continue;
      const s = search(n, 2);
      if (s > best) { best = s; pick = d; }
    }
    return pick;
  };
  const KEY = { left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown' };

  const realRandom = Math.random;
  Math.random = () => 0;               // 空きマスの先頭に必ず 2 が出る（完全に決定的な進行）
  get('#pNew').fire('click', {});
  let g = 0, reached = false;
  while (g < 5000) {
    const mv = bestMove(readBoard());
    if (!mv) break;
    keydown(KEY[mv]); g++;
    if (Math.max(0, ...vals()) >= 1024) { reached = true; break; }
  }
  Math.random = realRandom;
  ok('1024に到達できる', reached, 'max=' + Math.max(0, ...vals()) + ' moves=' + g);
  flushTimeouts();
  ok('達成メッセージが出る', get('#pOverMsg').textContent.indexOf('1024') >= 0, get('#pOverMsg').textContent);
  ok('達成時は「つづける」ボタンが出る', get('#pCont').hidden === false);
  const snap = vals().join(',');
  keydown('ArrowRight'); keydown('ArrowDown');
  ok('オーバーレイ表示中は盤面が動かない', vals().join(',') === snap, snap + ' -> ' + vals().join(','));
  get('#pCont').fire('click', {});
  ok('「つづける」でオーバーレイが閉じる', get('#pOver').hidden === true);
  const before2 = vals().join(',');
  let changed = false;
  for (const d of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    keydown(d);
    if (vals().join(',') !== before2) { changed = true; break; }
  }
  ok('「つづける」後にゲームを継続できる', changed);
  ok('1024タイルは残っている', Math.max(0, ...vals()) >= 1024, vals().join(','));
  get('#pNew').fire('click', {});
  ok('新規開始時は「つづける」が隠れる', get('#pCont').hidden === true || get('#pOver').hidden === true);
}
// --- (2) すうじタッチのベスト記録が消えない（0.0秒境界） ---
{
  api.Tabs.activate('touch');
  const grid2 = get('#tGrid');
  get('#tNew').fire('click', {});
  for (let n = 1; n <= 25; n++) grid2.fire('click', { target: grid2.children.find(c => Number(c.dataset.n) === n) });
  ok('0.0秒クリアでもベストが保存される', store['kiichi.touch.best'] !== undefined, store['kiichi.touch.best']);
  ok('0.0秒クリアでもベストが表示される（- にならない）', get('#tBest').textContent !== '-', get('#tBest').textContent);
  get('#tNew').fire('click', {});
  ok('シャッフル後もベスト表示が残る', get('#tBest').textContent !== '-', get('#tBest').textContent);
}
// --- (3) ストップウォッチのラップが開始直後に効く ---
{
  api.Tabs.activate('watch');
  get('#swReset').fire('click', {});
  get('#swLap').fire('click', {});
  ok('未スタート時のラップは無視される', get('#laps').children.length === 0, get('#laps').children.length);
  get('#swStart').fire('click', {});
  get('#swLap').fire('click', {});
  ok('スタート直後(0ms)でもラップが記録される', get('#laps').children.length === 1, get('#laps').children.length);
  get('#swLap').fire('click', {});
  get('#swLap').fire('click', {});
  ok('連続ラップが積み上がる', get('#laps').children.length === 3, get('#laps').children.length);
  get('#swStart').fire('click', {});
  get('#swLap').fire('click', {});
  ok('ストップ中でもラップを記録できる', get('#laps').children.length === 4, get('#laps').children.length);
}

// ※ このテストはコード全体を別インスタンスとして再ロードするため、必ず最後に置くこと
console.log('\n== T12 localStorage が使えない環境 ==');
{
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  let threw = false;
  try {
    const r2 = new Function('document','window','localStorage','requestAnimationFrame','cancelAnimationFrame','setInterval','clearInterval','setTimeout','Element', js + '\nreturn 1;');
    reg.clear(); tabEls.forEach(t => t.attrs = {});
    r2(document, window, bad, requestAnimationFrame, cancelAnimationFrame, setIntervalX, clearIntervalX, setTimeoutX, El);
  } catch (e) { threw = true; console.log('   ' + e.message); }
  ok('localStorage 例外でも起動できる', !threw);
}

console.log('\n======================');
console.log(' PASS: ' + passes + ' / FAIL: ' + fails);
console.log('======================');
process.exit(fails ? 1 : 0);
