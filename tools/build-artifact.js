// index.html から公開（Artifact）用のページを生成する。
// - Artifact は <head> を自前で持てないため、<title> / <link> / <style> / 本文 を並べた「本文だけ」のHTMLにする
// - 公開版はオンライン前提なので、Google Fonts の丸ゴシック（Zen Maru Gothic）を追加する
//   ※ index.html 本体は「外部通信なし」の要件があるため手を入れない
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const style = src.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];

const styled = style.replace(
  'font-family:"Hiragino Maru Gothic ProN"',
  'font-family:"Zen Maru Gothic","Hiragino Maru Gothic ProN"'
);

const out = [
  '<title>きいちアプリ</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap">',
  '<style>' + styled + '</style>',
  body.trim()
].join('\n');

const dest = path.join(root, 'dist', 'kiichi-app.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('built: ' + dest + ' (' + out.length + ' chars)');
