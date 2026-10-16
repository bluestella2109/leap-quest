LEAP QUEST ONLINE — LEAP単語RPG
================================

このフォルダはFirebase連携版です。提供されたCSVからLEAP単語2,300語を収録しています。

含まれるファイル
- index.html : 画面構成
- style.css : レトロRPGデザイン、画面遷移・バトル演出
- app.js : クイズ、学習記録、Firebase認証、プロフィール、フレンド、オンライン状態
- words.js : CSVから取り込んだ2,300語
- firebase-config.js : 共有いただいたFirebaseウェブアプリ設定
- firestore.rules : Firestoreセキュリティルール
- database.rules.json : Realtime Databaseセキュリティルール
- storage.rules : プロフィール画像用Storageルール

起動方法（Firebase設定が必要）
1. Firebase Consoleで Authentication > Sign-in method > Email/Password を有効化。
2. Firestore Databaseを作成。
3. Realtime Databaseを作成し、database.rules.json のルールを公開。
4. Storageを有効化し、storage.rules のルールを公開。
5. Firestore > Rules に firestore.rules の内容を貼り付けて公開。
6. index.html、style.css、app.js、words.js、firebase-config.jsを同じフォルダ構造でWebホスティングに配置。
7. ローカルで試す場合は、ファイルを直接開くのではなくローカルHTTPサーバーを使用。ES modulesは file:// では動かない場合があります。
8. Firebase Authenticationで登録・ログインして使用。

GitHub Pagesへの配置
- このフォルダの中身をリポジトリのルートに配置して公開します。
- Firebase Console > Authentication > Settings > Authorized domains に、GitHub Pagesのホスト名（例: yourname.github.io）を追加してください。
- Firebaseの各サービスで、無料枠・地域・利用規約などを確認してください。

機能
- 画面ごとの切り替えアニメーション
- 任意の単語番号範囲を指定したバトル／カード学習
- 4択バトル、コンボ、正解時のフラッシュ・ダメージ数字・敵のノックバック
- EXP、レベル、習得済み、復習リスト
- 6桁ユーザーIDの自動割り当て（FirestoreトランザクションでIDコードを確保）
- メール・パスワード登録、ログイン、パスワード再設定
- プロフィール名・プロフィール画像
- IDによるフレンド申請／承認／拒否／解除
- Realtime Databaseによるオンライン／オフライン状態
- フレンドのレベル、習得語数、正答率の表示

注意事項
- Firebaseの設定情報はクライアント用のもので、秘密鍵ではありません。ただしFirestore/Storage/Realtime Databaseのセキュリティルールは必ず設定してください。
- この試作版では学習履歴の詳細（単語ごとの正答履歴）はブラウザのlocalStorageに保存され、プロフィールには経験値・レベル・習得語数・正答率を同期します。端末をまたいで完全同期したい場合は、学習記録の保存方式を次の段階で拡張します。
- アカウント作成時にFirestore書き込みがルールに拒否された場合、Authenticationにユーザーだけが作られる可能性があります。開発中にルールを変更したら、再度登録するかFirestoreのプロフィール／ID文書を管理画面から確認してください。
- 6桁IDはランダムなコードをトランザクションで予約します。IDを大量取得させないため、公開前にはApp Checkやレート制限、Cloud Functionsでの発行処理を追加することを推奨します。
- オンライン表示は接続切断を検知して更新します。ブラウザを強制終了した場合など、反映に短い遅延が生じることがあります。
- このアプリは単語学習用です。LEAPは出版社等の商標・著作物である可能性があります。単語リストの公開・再配布は権利条件を確認してください。
