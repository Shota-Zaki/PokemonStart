# Celio Pocket 作業状態

更新: 2026-10-15 / 作業先: Shota-Zaki/PokemonStart `work`。
開始時HEAD: `ffec20f0abcbc7b65c0a45d1c0373ae9ff0f7403`。
`main`・既存パッチ・ルートREADMEのクレジットは変更対象外。

## 現在のWork Unit

iPhone/iPad共通PWAと、iCloud Driveを利用者が選ぶ通常.savの手動受け渡し。配信ディレクトリ `docs/`。アプリ版 `ipad-icloud-v2`。

## 完了

- 共有専用パネルとFiles選択・Web Shareファイル書出・明示的ダウンロードフォールバック。
- 読込前1世代退避、容量/拡張子/ROM識別子チェック、保存失敗時の復旧処理。
- 通常.savを切り詰めず扱い、6MiB＋16バイトの合成データで確認。
- 端末サイズ別パネル配置、版付きキャッシュと既存IndexedDB非削除。
- Chromium＋模擬coreの12テスト、Service Workerの10模擬テストと構文/変換テストがPASS。

## 重要な確定事項

PC・ZIP・署名プロファイル不要。オンライン交換・USB通信・アプリからの自動アップロードは無効。
利用者がiCloud Driveへ書き出した通常セーブはAppleのクラウドへ同期される。そのためプレイはオフラインでも共有時は通信が必要。クイックセーブの共有や自動上書きは行わない。
共有画面が閉じても保存先/同期完了は判定できない。任意名の.savから別ゲーム/進行の新旧を完全判定することもできない。両端末で同じROMを使い、同時プレイしない。

## 未完了・次のWork Unit

公開URL/Pages設定の確認、iPhone/iPad実機での初回/旧版更新・6MiB実セーブ往復・機内モード再起動・ファイルプロバイダーでの同名置換と同期反映を確認する。実機未検証を完成/同期保証へ読み替えない。
公開先の準備が必要ならユーザーの既存設定を確認する。GitHubにソースがあることを公開済みと扱わず、未確認URLを起動リンクとして提示しない。

## 再開

このファイル → `docs/README_JP.md` → `docs/TEST_RESULTS_ICLOUD.md` → `docs/save-transfer.js` → `docs/install.js` / `docs/sw.js` の順で読む。
テストは `python tests/test_handoff.py` と `node tests/test_offline.cjs`。
