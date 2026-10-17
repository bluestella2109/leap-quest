# LEAP QUEST — WORD RPG

GitHub Pages向けのLEAP QUEST再構築版です。元の画面構成を土台に、夜空のネイビー配色・落下する星のアニメーション・CSV単語データ・Google Sheetsランキング連携をまとめています。

## ファイル
- `index.html` — 画面と各ページ
- `assets/css/app.css` — レスポンシブUI、アニメーション
- `assets/js/vocabulary.js` — 提供されたCSVから生成した単語データ（2,300語）
- `assets/js/store.js` — 学習状況のローカル保存
- `assets/js/api.js` — Apps Script API接続
- `assets/js/learning.js` — ゲーム学習、タイマー、単語帳、画面キーボード
- `assets/js/app.js` / `ui.js` — ログイン、ランキング、画面操作
- `gas/Code.gs` — Google Apps Scriptバックエンド

## GitHub Pagesへの配置
ZIP内の `index.html` と `assets` フォルダをGitHubリポジトリのルートに配置してください。`index.html` はルート直下に必要です。

## Google Sheets / Apps Script
1. 学習用のGoogleスプレッドシートを開き、拡張機能 → Apps Script を開く。
2. `gas/Code.gs` の内容をApps Scriptの `Code.gs` に貼り付けて保存。
3. デプロイ → 新しいデプロイ → ウェブアプリを選択。実行ユーザーは自分、アクセスできるユーザーは「全員」に設定してデプロイ。
4. 発行された `/exec` URLをサイトの「設定」→「Google Sheets連携」に入力し、接続テストを行う。
5. スクリプトは `ユーザー`、`ランキング`、`スコア履歴` の各タブを自動作成します。ランキング表示の参照元は専用の `ランキング` タブです。

新規登録時は冒険者名（ランキング表示名）と4桁PINを登録し、6桁のユーザーIDが発行されます。ランキングにはユーザーIDではなく冒険者名を表示します。既存のユーザーシートがある場合、既存列を維持したまま「冒険者名」列を追加します。以前に登録された名前のないアカウントは、名前を設定するまでランキングでは「冒険者」と表示されます。

## 単語データ
`Leap words - シート1(2).csv` の番号・英単語・意味の3列を読み込み、2,300件を `assets/js/vocabulary.js` に組み込んでいます。英単語と意味の文字列は書き換えていません。末尾の「単語帳」行は単語データではないため除外しています。

## 確認事項
- JavaScript構文チェック済み（Apps Scriptも構文確認）。
- 実際のGoogleアカウント／スプレッドシートを使ったオンライン動作は、利用者のApps Scriptデプロイ後に確認が必要です。
