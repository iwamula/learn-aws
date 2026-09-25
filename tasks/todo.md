# 進捗と次のタスク（最終更新: 2026-09-26（Week4 ノート 19 完了））

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
- [x] Week2 ノート作成（README のロードマップ: 10/2-10/8）— 08〜11 完了。1本ずつ、公式ドキュメント原文で裏取りしてから書く。新規セッションで再開する場合は CLAUDE.md、このファイル、tasks/lessons.md を読み、notes/week1/05〜07 の書式に合わせる
  - [x] 08 Multi-AZ / Multi-Region と DR 4パターン（Backup & Restore、Pilot Light、Warm Standby、Multi-site Active/Active。RTO/RPO、Route 53 フェイルオーバー、Elastic Disaster Recovery）— 2026-09-25 作成、DR ホワイトペーパー原文で裏取り済み
  - [x] 09 データ層のリージョン間構成（Aurora Global Database、DynamoDB Global Tables、S3 CRR/SRR、RDS リードレプリカ、ElastiCache Global Datastore）— 2026-09-25 作成、各公式ドキュメント原文で裏取り済み。次は 10
  - [x] 10 KMS（マルチリージョンキー、キーポリシーとクロスアカウント、リージョン間コピー時の暗号化、ローテーション）— 2026-09-25 作成、KMS/S3/EBS/RDS 公式ドキュメント原文で裏取り済み。次は 11
  - [x] 11 コンピュート（ECS/EKS/Fargate/Lambda の選定と、マルチAZ・スケーリング）— 2026-09-26 作成、ECS/EKS/Lambda 公式ドキュメント原文で裏取り済み（Lambda の VPC/AZ、SnapStart 制約は未確認）
  - [ ] 各ノート完成後、README の Week2 ノート一覧にリンクを追加する（08〜11 は追加済み）

- [ ] Week3 ノート作成（README のロードマップ: 10/9-10/15）。12〜15 は完了。Week3 のロードマップ項目は一通り完了。書式は notes/week2 に合わせる
  - [x] 12 CloudFormation/CDK — 2026-09-26 作成、CloudFormation/CDK 公式ドキュメント原文で裏取り済み（drift-aware 変更セット、Concurrency mode、終了保護などは未確認）
  - [x] 13 監視・監査（CloudTrail 組織証跡/Insights/整合性検証、Config アグリゲーター/組織ルール/修復、CloudWatch OAM・Logs 集約・複合アラーム、X-Ray サンプリング）— 2026-09-26 作成、公式ドキュメント原文で裏取り済み（CloudWatch のメトリクス/Logs Insights/異常検知、EventBridge は未確認）
  - [x] 14 コスト最適化（Savings Plans 4種と適用順、RI のクラス・スコープ・交換・Marketplace、組織内共有、Budgets/Anomaly Detection/Data Exports、Compute Optimizer、S3 Intelligent-Tiering/ライフサイクル、Spot）— 2026-09-26 作成、公式ドキュメント原文で裏取り済み（データ転送料金、Trusted Advisor、Spot Fleet 戦略、S3 Glacier の最小期間などは未確認）
  - [x] 15 移行（7R、DMS の同種/異種・CDC、SCT、DataSync、Snowball Edge、MGN）— 2026-09-26 作成、公式ドキュメント原文で裏取り済み（Snowball Edge は新規顧客受付終了、MGN は原文で「AWS Transform MGN」表記。DMS Serverless、DataSync Enhanced モード、Transfer Family などは未確認）
  - [ ] 各ノート完成後、README の Week3 ノート一覧にリンクを追加する（12〜15 は追加済み）

- [ ] Week4 前の補強ノート（Week3 までで未カバーの頻出分野。書式は notes/week3 に合わせる。`notes/week4/` に置く。1本ずつ原文で裏取り）
  - [x] 16 CloudFront / Global Accelerator — 2026-09-26 作成（aws-mcp で原文確認。Origin Shield、キャッシュポリシー、料金などは未確認）
  - [x] 17 SQS / SNS / EventBridge / Step Functions / API Gateway — 2026-09-26 作成（aws-mcp と curl で原文確認。SQS の Lambda 連携・DLQ リドライブ、API Gateway の統合タイムアウト、EventBridge のスキーマ / API Destinations などは未確認）
  - [x] 18 S3 詳細 / Storage Gateway / FSx / EFS（ストレージ）— 2026-09-26 作成（aws-mcp で原文確認。S3 Standard-IA 等の最小期間、Express One Zone、EFS パフォーマンスモード / レプリケーション、FSx Windows の AD 連携、FSx File Gateway の位置づけなどは未確認）
  - [x] 19 セキュリティ（WAF / Shield / Network Firewall / Secrets Manager / ACM / GuardDuty 補足）— 2026-09-26 作成（aws-mcp で原文確認。WAF の WCU・ルール評価順、Shield Advanced の料金、Secrets Manager と Parameter Store の比較、ACM のエクスポート条件・プライベート CA、GuardDuty 各プランの詳細などは未確認）
  - [ ] 20 分析（Athena / Glue / Lake Formation / Redshift / Kinesis）
  - [ ] 各ノート完成後、README の Week4 ノート一覧にリンクを追加する（16〜19 は追加済み）

- [x] notes/ の md を HTML に変換するスクリプト（2026-09-26）— `npm run build:html`（`scripts/build-html.mjs`、marked、出力は gitignore 済みの `docs/`）。md が正本で、変換に AI トークンは不要。`--watch` 対応。新規ノートを追加したら再実行するだけ

## メモ
- ユーザーは各ノートで気になった点を `Qn` として書き込み、AIに事実確認させる運用（クイズ形式ではない）
- `aws-core` プラグイン導入済みだが、aws-mcp は 2026-09-25 のセッションで接続でき、`search_documentation` が使えた（原文チャンクを返す）。docs.aws.amazon.com は curl でも取得可（ページ名が不明な場合は search_documentation でURLを探す）
- コミットはユーザーが自分のタイミングで行う（確認不要）
