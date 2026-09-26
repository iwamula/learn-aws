# 進捗と次のタスク（最終更新: 2026-09-26（todo 整理））

## 完了（要約）
- README のロードマップ作成（試験日 2026-10-24）
- Week1 ノート 01〜07、Week2 ノート 08〜11、Week3 ノート 12〜15、Week4 補強ノート 16〜20 を作成済み（README のノート一覧にリンク追加済み）。02〜19 にクイズ形式 Q&A 追加済み。20 以降は作成時に付ける（CLAUDE.md「ノート作成ルール」参照）
- `qa/iam.md` の Q1・Q2 に回答済み
- 未確認項目の裏取り第1〜26弾まで完了。各弾の内容・訂正は `other/fact-check-log.md` を参照
- notes/ の md を HTML に変換するスクリプト（`npm run build:html`、`scripts/build-html.mjs`、出力は gitignore 済みの `docs/`。md が正本、変換に AI トークン不要、`--watch` 対応。新規ノート追加後は再実行）

## 次にやること
- [ ] 08〜20 に残る個別の未確認項目の裏取り。**試験に出やすい項目に絞り、次の順で進める**（各ノートの「未確認」欄が対象。1件ずつ公式ドキュメント原文で確認し、`other/fact-check-log.md` に記録）
  1. ノート 17: EventBridge（グローバルエンドポイント、ターゲットの DLQ / リトライ、API Destinations、バスのリソースポリシー、スキーマレジストリ）、Step Functions（Retry / Catch、Distributed Map、Express の同期実行）、SNS（配信リトライ、FIFO のアーカイブ）
  2. ノート 20: Lake Formation（行・セルレベルフィルター、クロスアカウント共有のバージョン設定、ハイブリッドアクセスモード、組織単位への付与）、Redshift（Multi-AZ、Serverless、Spectrum、リージョン間コピー）、Firehose（バッファリング、動的パーティショニング）、Athena（フェデレーテッドクエリ、Iceberg）
  3. 上記が終わったら他ノートの未確認（CloudFront の mTLS / Connection Functions など）
  - やらない（優先度最低）: 単価・料金の数値、EMR / QuickSight / OpenSearch / Data Exchange の詳細
- [ ] 試験まで残りわずかなので、`qa/` に疑問を書いて回答をもらう学習と、各ノートのクイズ Q&A での復習を優先する

## メモ
- `aws-core` プラグイン導入済みだが、aws-mcp は 2026-09-25 のセッションで接続でき、`search_documentation` が使えた（原文チャンクを返す）。docs.aws.amazon.com は curl でも取得可（ページ名が不明な場合は search_documentation でURLを探す）
- コミットはユーザーが自分のタイミングで行う（確認不要）
