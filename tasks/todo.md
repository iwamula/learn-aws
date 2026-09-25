# 進捗と次のタスク（最終更新: 2026-09-25（Week2 ノート 09 完了、次は 10））

## 完了
- [x] README にロードマップ作成（試験日 2026-10-24）
- [x] Week1 ノート 01〜04（Organizations/SCP、VPC接続、ハイブリッドDNS、IAM評価）
- [x] `qa/iam.md` の Q1・Q2 に回答
- [x] Week1 ノートの初回事実確認（`other/fact-check-log.md`）
- [x] Week1 残りノート作成: 05 Control Tower/Identity Center、06 DX 冗長構成、07 セキュリティサービス組織横断集約 — 2026-09-25
- [x] 未確認項目の裏取り（Control Tower コントロール種別、TGW 上限、ホスト型DX、PHZ/Resolver）— 2026-09-25

## 次にやること（優先順）
- [ ] 残りの未確認: Resolver の数値上限、Route 53 Profiles、TGW ピアリングの静的ルート（`other/fact-check-log.md` 参照。優先度低）
- [ ] Week1 新規ノート05〜07の未確認項目を裏取り: Macie/Inspector/Detective/Firewall Manager の委任管理者、DX Gateway あたりの TGW 数（6 vs 3）、LAG の条件、組織証跡の改ざん防止策
- [ ] 01 ノート末尾のクイズ形式Q&Aを残すか整理するか、ユーザーに確認
- [ ] Week2 ノート作成（README のロードマップ: 10/2-10/8）。1本ずつ、公式ドキュメント原文で裏取りしてから書く。新規セッションで再開する場合は CLAUDE.md、このファイル、tasks/lessons.md を読み、notes/week1/05〜07 の書式に合わせる
  - [x] 08 Multi-AZ / Multi-Region と DR 4パターン（Backup & Restore、Pilot Light、Warm Standby、Multi-site Active/Active。RTO/RPO、Route 53 フェイルオーバー、Elastic Disaster Recovery）— 2026-09-25 作成、DR ホワイトペーパー原文で裏取り済み
  - [x] 09 データ層のリージョン間構成（Aurora Global Database、DynamoDB Global Tables、S3 CRR/SRR、RDS リードレプリカ、ElastiCache Global Datastore）— 2026-09-25 作成、各公式ドキュメント原文で裏取り済み。次は 10
  - [ ] 10 KMS（マルチリージョンキー、キーポリシーとクロスアカウント、リージョン間コピー時の暗号化）
  - [ ] 11 コンピュート（ECS/EKS/Fargate/Lambda の選定と、マルチAZ・スケーリング）
  - [ ] 各ノート完成後、README の Week2 ノート一覧にリンクを追加する（08・09 は追加済み）

## メモ
- ユーザーは各ノートで気になった点を `Qn` として書き込み、AIに事実確認させる運用（クイズ形式ではない）
- `aws-core` プラグイン導入済みだが、aws-mcp は 2026-09-25 のセッションで接続でき、`search_documentation` が使えた（原文チャンクを返す）。docs.aws.amazon.com は curl でも取得可（ページ名が不明な場合は search_documentation でURLを探す）
- コミットはユーザーが自分のタイミングで行う（確認不要）
