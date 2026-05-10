# Live2D Face & Voice Web App

音声ファイルを読み込み、その内容に合わせて Live2D モデルを動かすブラウザアプリです。ゲーム配信や声劇の用途を想定しています。表示は上半身（バスト）構図に固定。

主な機能：

- 音声からの口パク・頭の揺れ・視線
- 表情切り替え（キーボードショートカット対応）
- Whisper による文字起こし → Claude による感情・ジェスチャ解析 → タイミング指定での自動演出
- ステージの MP4 録画

## 解説動画

[![解説動画](https://img.youtube.com/vi/Q_n2IP2f6KI/0.jpg)](https://youtu.be/Q_n2IP2f6KI)

https://youtu.be/Q_n2IP2f6KI

## 必要なもの

- Node.js 18 以上（静的サーバーと解析 API の起動に使用）
- ブラウザ（Chrome / Edge 推奨。WebCodecs を使う MP4 録画機能のため）
- **任意**：[Claude Code CLI](https://docs.claude.com/en/docs/claude-code/overview) — `感情付き再生` 機能を使う場合のみ。サーバーが `claude -p` を spawn して感情解析を実行します。インストール後 `claude login` で認証してください

## 起動

```powershell
npm.cmd start
```

起動後、ブラウザで次を開きます。

```text
http://127.0.0.1:5173/
```

`npm` が使えない場合は次でも起動できます。

```powershell
node scripts/server.mjs
```

ポートは環境変数 `PORT` / `HOST` で変更できます。

## 使い方

1. ブラウザで開くとモデルが上半身構図で表示される。
2. 右パネルの **録音** セクションで `音声を選ぶ` からローカルの音声ファイル（mp3/wav 等）を読み込み、`再生` で再生開始。
3. 音声の音量・周波数バランスから、口の開閉・頭の揺れ・視線が自動で動きます。
4. 表情ボタンで表情を切り替えできます。
5. `解析` ボタンで Whisper による文字起こしと Claude による感情解析を実行（`感情付き再生` を ON にすると解析結果に従って表情・ジェスチャが再生されます）。
6. `MP4保存` で再生内容をビデオファイルとして書き出せます。

## 自分のモデルを使う
自分のモデル実装については、まず`model/<your-model>/` を作ります。
その後の実装はClaude codeやcodexを使って調整することを推奨しています。

### 1. モデルファイルの配置

`model/<your-model>/` を作り、Cubism 出力一式を配置します。：

```text
model/<your-model>/
  ├── <your-model>.model3.json
  ├── <your-model>.moc3
  ├── <your-model>.physics3.json   （あれば）
  ├── <textures>/                   （model3.json で参照されているテクスチャ）
  └── expression/                   （表情切り替えを使う場合）
       ├── smile.exp3.json
       ├── angry.exp3.json
       └── ...
```

### 2. `src/app.js` の `MODELS` 設定を編集

ファイル先頭の `MODELS` 配列を自分のモデルに合わせて書き換えます。

```js
const MODELS = [
  {
    id: "luna",
    label: "Luna",
    dir: "./model/luna",
    file: "luna.model3.json",
    expressions: [
      { id: "smile", label: "笑顔", key: "F1", file: "expression/smile.exp3.json" },
      // ...
    ],
  },
];
```

`expressions` の `id` は `.exp3.json` の中身ではなく、UI ボタンとサーバーへ渡す識別子です。同じ `id` を `scripts/server.mjs` の `EXPRESSION_HINTS` にも追加すると、感情解析時のヒント文として使われます。

### 3. 表情オフセットの調整（任意）

`src/app.js` の `EXPRESSION_BODY_POSTURE` に、その表情を出している間の体の傾きを足せます。例：

```js
const EXPRESSION_BODY_POSTURE = {
  smile: { ParamBodyAngleY: 2.5, ParamBodyAngleZ: 1.5 },
  // ...
};
```

モデルごとにポーズの自然さは違うので、Claude Code に「`smile` のとき体がもう少し前に出るようにして」のように頼むと早いです。

### 4. ビューフレーミングの調整

モデルのアンカー位置やズーム率は `src/app.js` の `FRAME_PRESET` で制御しています。胸から上に映りすぎる／頭が切れる場合はここを調整してください。

## 解析機能の詳細（任意）

### Whisper（文字起こし）

ブラウザ内で `@xenova/transformers` 経由の Whisper-base が動作します。初回 `解析` ボタン押下時にモデルをダウンロード（数百 MB）。以降はブラウザのキャッシュに残ります。サーバー設定不要。

### Claude（感情・ジェスチャ解析）

`POST /api/analyze` がローカルの `claude` CLI を spawn します。プロンプトは `scripts/server.mjs` の `buildAnalyzePrompt()` で組み立てており、入力は文字起こしのセグメント、出力は表情・ジェスチャイベントのタイムラインです。

タイムアウトはデフォルト 60 秒（`scripts/server.mjs` の `ANALYZE_TIMEOUT_MS`）。長尺音声では伸ばしてください。

`claude` CLI を別の LLM に置き換えたい場合は `runClaude()` を差し替えれば動きます。

## 外部 CDN

実装は Live2D ランタイム等を外部 CDN から読み込みます。初回表示時はインターネット接続が必要です。`vendor/` に以下を置けばローカル優先で読み込みます（詳細は `vendor/README.md`）。

```text
vendor/live2dcubismcore.min.js
vendor/pixi.min.js
vendor/pixi-live2d-display-cubism4.min.js
vendor/mp4-muxer.mjs
```

## 既知の制約

- localhost 以外で配信する場合、HTTPS が必要になることがあります。
- MP4 録画は WebCodecs 対応ブラウザ（Chrome / Edge）でのみ動作します。
- Live2D モデルデータと Cubism Core には、それぞれ利用条件や再配布条件があります。
- モバイル端末では性能やメモリ制限によりフレームレートが下がることがあります。

## クレジット

`model/luna/` のサンプル Live2D モデル（Luna）は、[トーラ様](https://momotola.booth.pm/items/8221521) のご厚意でお借りしています。再配布・改変条件はモデル提供元の指示に従ってください。

## ライセンス

[MIT](./LICENSE)。本リポジトリ自体のコードに適用されます。`model/` 配下の Live2D モデルデータや、CDN から読み込む `live2dcubismcore` などのサードパーティ製アセットは、それぞれの提供元のライセンスに従ってください。
