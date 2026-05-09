# vendor

このディレクトリは、外部配布ライブラリをローカル優先で読み込むための配置場所です。

## Live2D Cubism Core

Live2D Cubism Core をローカルで使う場合は、次のファイル名で配置してください。

```text
vendor/live2dcubismcore.min.js
```

アプリ側の実装が対応していれば、このローカルファイルを外部 CDN より優先して読み込みます。ファイルがない場合は、CDN など外部の読み込み先にフォールバックする想定です。

## Optional local files

ネットワーク制限のある環境では、次のファイルもローカルに置けます。

```text
vendor/pixi.min.js
vendor/pixi-live2d-display-cubism4.min.js
vendor/mp4-muxer.mjs
```

`vendor/mp4-muxer.mjs` は MP4 録画機能で使用する `mp4-muxer` パッケージの ESM ビルドです。配置しない場合は CDN (`https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm`) からフェッチします。バージョンは `mp4-muxer@5` を想定しています。

## 注意

- この README は配置先の説明のみです。
- `live2dcubismcore.min.js` 自体は同梱していません。
- Live2D Cubism Core は公式の配布条件とライセンスに従って入手してください。
- ライブラリをリポジトリに含める場合は、再配布が許可されているか確認してください。
