# Celio Pocket — iPhone・iPad共通オフラインPWA

アプリ版: `ipad-icloud-v2` / 2026-10-15。
公開元: `liru55/mgba-celio-web` の固定配信コミット `8d4b304080d768ea32aaa5f155fc3aa81f6300f9`。
MPL-2.0。元のクレジット・ライセンスを保持。ROM・個人セーブ・クイックセーブはRepositoryにも配信物にも追加しない。
元の `mgba-celio-local.astralpike7.chatgpt.site` 自体の完全複製ではなく、確認できた上流版を基にする。

## 初回・更新

両端末それぞれで、公開URLをSafariからホーム画面へWebアプリとして追加する。追加したアイコンから開き、「この端末にアプリを保存」を実行する。初回・今回の版更新時には固定プログラム約2.7MiBを取得する。PC・ZIP展開・Python・署名プロファイルは不要。
既存のIndexedDB（ROM・通常セーブ・クイックセーブ）は消さない。新版の準備が済む前に旧プログラムのキャッシュを削除しない。容量不足時も利用者にセーブ削除を自動要求しない。

## iPhone → iPad → iPhone の受け渡し

両端末を同じApple AccountでiCloudにサインインし、iCloud Driveを有効にする。「ファイル」AppのiCloud Driveに任意の共有保存先、例 `Celio Pocket` を作る。同じバージョン・同じ内容のROMを各端末へ用意する。

1. 遊ぶ端末でROMを開く。「ファイル」内の「iCloud Driveから読込」から、前の端末が書き出した最新の通常 `.sav` を選ぶ。ファイル名・容量・更新日時を確認して取り込む。元の進行は端末内に1世代退避する。
2. ゲーム内でレポートを書く。クイックセーブだけでは通常 `.sav` に反映されない。
3. 「iCloud Driveへ書出」を押す。共有画面の「ファイルに保存」からiCloud Driveの同じフォルダを選ぶ。同名の共有用 `.sav` を更新する場合は、保存画面で置き換えを確認する。
4. ファイルAppで保存結果・別端末への反映を確認する。次の端末で1から繰り返す。2台で同時に別の進行を作らない。

初回に既存の任意名 `.sav` を読み込むこともできる。書出名は `ROMの名前--12桁のROM識別子.sav` なので、以降はその書出ファイルを共通の正本として使う。ROMファイル名も両端末でそろえると迷いにくい。識別子付きの別ROM用ファイルは読み込みを拒否するが、任意名の生 `.sav` だけからゲーム・進行の互換性を完全には判定できない。

共有APIが使えない場合は「.savをダウンロード」後にファイルAppでiCloud Driveへ移動する。共有キャンセル時には勝手にダウンロードしない。共有画面が閉じても、保存先や同期完了を確認した表示にはしない。

## オフラインとプライバシー

プレイはオフライン。iCloudへの書出・別端末への同期には通信が必要。読み込みはファイルのコピーであり、読み込んだだけではその後の進行はiCloudへ戻らない。アプリによる自動アップロード、iCloud APIへの直接接続、バックグラウンド監視は実装しない。
手動でiCloud Driveを選んで保存したセーブはAppleのクラウドに送られる。「クラウドに一切送らない」と「iCloudで共有」は両立しない。ROMをiCloudへ置く必要はない。
Service Workerは準備済みゲームをキャッシュだけで配信し、非GET・未許可通信・クエリ付きURLを拒否する。外部からの初回取得はインストール画面による固定静的プログラムのみ。CSPと通信アダプターの置換も維持する。OS・ブラウザの更新通信は別なので、端末の通信そのものを止めるには機内モードとWi-Fiオフを使う。

## データ保護

通常 `.sav` は1バイト以上〜6MiB＋16バイト。入力の末尾やRTC情報を切り詰めない。読込前に `handoff-before:<ROM SHA-256>` キーへ退避し、退避失敗時は上書きしない。読込後の端末保存に失敗した場合は元の通常セーブへ復旧を試み、失敗を隠さない。「読込前のセーブを書出」で退避データを保管できる。クイックセーブは削除・共有しない。

## 実装位置・変更比較

`docs/install.js` の通信アダプター置換前:
```js
window.createLinkSession=function(api){return {busy:false,blockSave:false,async onGame(){},tick(){return false}};};
```
置換後:
```js
window.createLinkSession=function(api){return window.createCelioSaveTransfer(api);};
```
新規 `docs/save-transfer.js` にネイティブ共有・読込・バックアップを分離し、ネットワーク通信を増やさずファイル受け渡しを追加する。

上流 `app.js` の `getGame` 接続情報への変更:
```js
// 前
{loaded,bytes:romBytes,key:romKey,name,cheats:cheats.length>0}
// 後
{loaded,bytes:romBytes,key:romKey,name,blocked:romLoading||quickBusy||backupBusy,cheats:cheats.length>0}
```
読み込みや保存が進行中なら受け渡しを止めるための情報だけを追加。ゲームエンジン自体は変えない。固定ソースで接続位置が一致しなければインストールを停止する。

`docs/save-transfer.css` は共有パネルだけを調整し、600px以上ではボタンを2列、狭い画面は1列、操作領域は最低48pxとする。`docs/install.js` / `docs/sw.js` のキャッシュキーに `ipad-icloud-v2` を追加し、旧インストールにも改修を届ける。

## 公開・検証

変更先は `Shota-Zaki/PokemonStart` の `work`、配信対象は `/docs`。`main`は変更しない。Pages公開設定は別であり、今回のコード反映だけで公開済みとは扱わない。GitHubのSettings → Pagesで指定済みなら、その設定画面に表示される公開URLを利用する。
検証内容と制約は `TEST_RESULTS_ICLOUD.md`。iPhone/iPad実機、Safariの実共有シート、実際のiCloud同期、64MiB実ROMの起動とセーブ往復は未検証。

一次情報:
- https://support.apple.com/ja-jp/118443
- https://support.apple.com/ja-jp/guide/ipad/ipad8f1f7a29/ipados
- https://www.w3.org/TR/web-share/
- https://github.com/liru55/mgba-celio-web/tree/8d4b304080d768ea32aaa5f155fc3aa81f6300f9
