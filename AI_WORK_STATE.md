# Celio Pocket 作業状態

更新: 2026-10-16 / 作業先: Shota-Zaki/PokemonStart `work`。
今回の開始時HEAD: `926b84c6859e9f71e9d3430700f8bfbb04fb7e28`。
`main`・既存パッチ・ルートREADMEのクレジットは変更対象外。

## 現在のWork Unit

ユーザー依頼: 縦画面・横画面ともスクロールをなくす。
配信ディレクトリ `docs/`。アプリ版 `viewport-v3`（セーブ共有機能は前版 `ipad-icloud-v2` を維持）。

## 今回完了

- 縦はゲーム下にコントローラー、横は左右・下側に配置。利用可能な高さに追従し、最小高さとheight:autoによるはみ出しを解消。
- visualViewport、safe-area、回転・再表示への追従。標準操作ボタンを画面内に保持。
- 設定は項目選択＋前へ/次へのページ切り替え。メモリビューアを設定へ移動。後から追加されるiCloud操作もDOM/ハンドラーを保ってページ化。
- 起動画面・使い方・保存状態詳細もページ切り替え。内容を操作不能なまま隠すだけの対応はしない。
- スキンの使用可能高さをstage基準へ限定パッチ。未知の位置にはパッチしない。
- 版番号とキャッシュ保存対象を更新。IndexedDB・旧プログラムキャッシュは削除しない。
- Chromiumの再構成レイアウトfixture等39ケース、Service Worker10模擬ケース、構文・変換検査がPASS。詳細は `docs/VIEWPORT_LAYOUT.md`。

## 既存機能・確定事項（変更なし）

iPhone/iPad共通PWA、通常.savの手動読み込み・共有シートへの書き出し、読込前1世代退避、容量/拡張子/ROM識別子チェックと復旧処理を維持。
PC・ZIP・署名プロファイル不要。オンライン交換・USB通信・アプリからの自動アップロードは無効。
利用者がiCloud Driveへ書き出した通常セーブはAppleのクラウドへ同期されるため、プレイはオフラインでも共有時は通信が必要。クイックセーブの共有や自動上書きは行わない。
共有画面終了だけでは保存先・同期完了を確認できない。任意名の.savだけから互換性や新旧を完全判定しない。同じROMを両端末で使い、同時に別の進行を作らない。

## 変更しない対象

今回 `docs/save-transfer.js` / `docs/save-transfer.css` / `docs/assets.js` / WASM / セーブ形式を変更しない。標準配置以外の利用者の重ね合わせ座標は保存値を消さず、表示時に画面内へ制限する。ピンチ拡大、OSのファイル選択・共有画面内部は制御対象外。

## 未完了・次のWork Unit

公開URL/Pagesの配信結果と端末へのv3更新、iPhone/iPad実機Safariの縦横・回転・アドレスバー・キーボード、実ROM・スキン・セーブ往復を確認する。今回はレイアウトfixtureの検証であり、実エミュレーターが起動した証拠ではない。
実WebKitがローカル環境に未導入。既存の手動セーブ受け渡し12ケースは今回は再実行していない。旧記録を今回の実機合格へ読み替えない。
公開先にv3が配信された後、両端末で通信オン→アプリを開き直す→「この端末にアプリを保存」。SafariのWebサイトデータは削除しない。

## 再開

このファイル → `docs/VIEWPORT_LAYOUT.md` → `docs/README_JP.md` → 必要に応じ `docs/TEST_RESULTS_ICLOUD.md`。
レイアウトテスト: `python tests/test_viewport.py`（Playwright/Chromium）。
通信模擬テスト: `node tests/test_offline.cjs`。セーブ単体テスト: `python tests/test_handoff.py`。
