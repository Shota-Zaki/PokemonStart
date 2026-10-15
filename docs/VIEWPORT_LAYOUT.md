# 縦横スクロールなしの画面配置

更新日: 2026-10-16 / アプリ版: `viewport-v3`。
対象: `Shota-Zaki/PokemonStart` の `work` / `docs/`。
目的: iPhone・iPadの通常倍率で、ゲーム・操作メニュー・設定・起動画面を表示領域内に収める。セーブ処理、ROM、WASM、iCloud受け渡し形式は変更しない。

## 画面の変更

縦画面はゲーム表示の下に十字キー・A/B・L/R・START/SELECTを配置する。横画面は十字キーとA/Bを左右、L/R・START/SELECTを下側へ配置し、ゲーム画像にかぶらない領域を確保する。ツールバーは縦で2行、横で1行。固定の最小高さや縦画面のheight:autoで画面を押し広げない。

`visualViewport` の高さ・幅、回転、再表示、safe-areaを反映する。操作ボタンは標準配置で44px以上、A/Bは56px。カスタム重ね合わせ配置は保存値を消さず、表示時だけ外にはみ出す座標を補正する。利用者が重ねたボタン同士を勝手に並べ直すものではない。

長い設定は「項目」の選択と「前へ／次へ」によるページ切り替えに変更する。既存のDOM要素とイベント処理を維持して移動するので、iCloudの読み込み・書き出しを削除したり、隠して操作不能にしたりしない。メモリビューアはゲーム下部から設定の「メモリ」へ移す。

起動画面の使い方・注意事項・保存状態の詳細もページ切り替えで閲覧する。極端に高さが低い画面では短い状態表示を使うが、全文は「状態の詳細」で確認できる。iOSのファイル選択画面・共有シート内部はOSが管理するため、この変更の対象外。ピンチ拡大はアクセシビリティのため禁止しない。

## 修正箇所と比較

### 1. 高さと配置

場所: 新規 `docs/viewport-fit.css`、上流の `.play` に対する後置上書き。

修正前（上流）:
```css
.play {
  height: calc(100dvh - 126px);
  min-height: 520px;
  max-height: 900px;
}
/* 縦画面では別ルールがheight:autoも設定 */
```

修正後（主要値）:
```css
.cp-fit .app-shell {
  height: 100%;
  grid-template-rows: 44px 18px minmax(0, 1fr);
}
.cp-fit .app-shell > .play {
  height: 100%;
  min-height: 0;
  max-height: none;
}
```

画面を固定高さで押し広げるのではなく、現在表示できる領域をゲーム・操作・メニューで分配する。単にoverflowを隠すだけでなく、配置と必要な操作領域も調整する。

### 2. フレームスキンの高さ

場所: `docs/install.js` の新規 `transformSkin()`。固定・照合済み上流 `skins.js` の `place()` を1箇所だけ置換。

修正前:
```js
const availableHeight=fullscreen?Math.max(1,stage.clientHeight-header):Math.max(160,innerHeight-(play.getBoundingClientRect().top+scrollY)-toolbar-bottom-2);
```

修正後:
```js
const availableHeight=Math.max(1,stage.clientHeight-header);
```

スキンも実際に割り当てられたstageの高さへ収める。置換位置が存在しない・重複する場合はインストールを停止し、未知のソースへ推測でパッチしない。

### 3. 配信・オフラインキャッシュ

場所: `docs/install.js` / `docs/sw.js` の `APP_REV`。

```js
// 前
APP_REV='ipad-icloud-v2'
// 後
APP_REV='viewport-v3'
```

新規の `viewport-fit.css` / `viewport-fit.js` を起動画面とゲーム画面へ追加し、Service Workerの保存対象にも追加。既存IndexedDB、セーブ、ROM、旧版キャッシュは削除しない。`docs/save-transfer.js`、`docs/save-transfer.css`、`docs/assets.js`、WASMに変更はない。

## 端末への反映

公開先にこの版が配信された後、iPhone・iPadそれぞれで通信をオンにしてホーム画面のアプリを開き直す。新しい起動画面になったら「この端末にアプリを保存」で `viewport-v3` のゲーム資材を準備する。既存タブが古いままならアプリを閉じて再度開く。SafariのWebサイトデータの削除は行わない。念のため通常.savは更新前にもファイルへ保管する。

GitHub上のコード反映と、公開先での配信・端末での更新は別。今回、Pages設定や公開サイトの配信結果は確認していない。

## 実行した検証

### Chromiumでの表示・操作 39/39 PASS

実行: `python tests/test_viewport.py`（Python PlaywrightとChromiumが必要）。結果は `tests/viewport-results.json` に出力される。
ゲーム側は確認した上流HTMLの構造・競合するレイアウト用CSSを再構成したfixture。実際のWASM/ゲームエンジンは起動しない。起動画面は今回の実HTML/CSSを使い、ネットワーク用スクリプトをテスト内で除去して描画した。

- 縦横と連続回転: 18サイズ。320×568、568×320、375×667、667×375、393×852、852×393、430×932、932×430、744×1133、1133×744、768×1024、1024×768、820×1180、1180×820、393×650、852×280、507×768、768×507。
- safe-area相当の余白: 4ケース。
- 全画面＋safe-area相当: 4ケース。
- 保存済みの重ね合わせ座標の回転後補正: 1ケース。
- 長い設定、遅れて追加されるiCloud操作、メモリへの到達: 4ケース。
- ROM読込前の起動画面: 1ケース。
- 実インストーラー、説明・安全性・長いエラーの詳細: 7ケース。

標準の20操作の画面内配置、中心点でのヒット判定、ゲーム画像への非重複、文書サイズ、ホイール入力でのページ移動なし、ページ切り替え後の末尾ボタンの操作を検査。fixture上での結果であり、すべての上流機能やスキンを検証したものではない。

### 通信遮断の模擬テスト 10/10 PASS

`tests/test_offline.cjs` の既存10ケースを今回の版番号で実行。POST拒否、未許可外部GET拒否、ゲーム側の初回外部取得拒否、準備後の外部GET拒否、未準備時の起動画面誘導、キャッシュ欠落時のネットワークフォールバックなし等を確認した。
実行環境では未変更の `save-transfer.js` を配置していないため、実行時に構文検査のファイルリストのみ `viewport-fit.js` へ差し替えた。10ケースの処理・期待値は変更していない。リポジトリ全体を取得した環境では `node tests/test_offline.cjs` をそのまま使用できる。
追加したJavaScriptの構文、HTMLへのCSS/JS追加、CSP維持、スキン置換位置の欠落/重複時停止も確認。

## 未検証

iPhone・iPad実機のSafari、実WebKit、実際のアドレスバー・ソフトウェアキーボード、実PWA更新、実ROMの描画・入力・セーブ、iCloud Drive往復、公開URLは今回未検証。前版のセーブ受け渡し12ケースは今回再実行していない。ブラウザサイズのシミュレーションを実機検証と呼ばない。

## 参照した実装

上流固定版 `https://github.com/liru55/mgba-celio-web/tree/8d4b304080d768ea32aaa5f155fc3aa81f6300f9` の `index.html`、`styles.css`、`app.js`、`skins.js`。元のアプリ処理・ライセンスは維持する。
