# learn-aws

AWS Certified Solutions Architect - Professional (SAP-C02) 学習リポジトリ。
試験日: **2026-10-24** / 学習開始: 2026-09-25（SAA取得済み）

## 出題ドメイン
| ドメイン | 配点 |
|---|---|
| 1. 組織の複雑さに対応するソリューションの設計 | 26% |
| 2. 新しいソリューションの設計 | 29% |
| 3. 既存ソリューションの継続的な改善 | 25% |
| 4. ワークロードの移行とモダナイゼーションの加速 | 20% |

## 4週間ロードマップ
| 週 | 期間 | テーマ | 主なサービス |
|---|---|---|---|
| 1 | 9/25-10/1 | 組織・マルチアカウント・ネットワーク | Organizations, SCP, Control Tower, IAM Identity Center, RAM, Transit Gateway, Direct Connect, PrivateLink, Route 53 Resolver |
| 2 | 10/2-10/8 | 新規設計: 可用性・DR・データ層 | Multi-AZ/Region, Aurora Global, DynamoDB Global Tables, S3 CRR, DR 4パターン, KMS, ECS/EKS/Lambda |
| 3 | 10/9-10/15 | 継続的改善 + 移行 | CloudFormation/CDK, CloudWatch/X-Ray, Config, Cost Explorer, Savings Plans, DMS/SCT, DataSync, Snow, MGN, 7R |
| 4 | 10/16-10/23 | 総仕上げ | 模擬試験（75問を180分で通し）、間違い分野の復習 |
| - | 10/24 | 試験日 | 前日は軽い復習のみ |

## 進め方（Q&A運用）
1. `notes/weekN/` の要点ノートを読む（HTMLで読むなら `npm i && npm run build:html` → `docs/index.html` を開く。`docs/` は生成物で gitignore 済み）
2. 気になった仕様や、自分の理解が合っているか不安な点を、トピック別ファイル（`qa/iam.md` など）に `Qn 質問（自分の理解も書く）` として追記する
3. AIに「事実確認して」と依頼し、質問の直下に、根拠つきの回答・訂正を普通の段落で書き込んでもらう
4. 間違っていた理解は `qa/mistakes.md` に記録し、週末に見直す

## Week1 ノート
- [01 Organizations と SCP](notes/week1/01-organizations-scp.md)
- [02 VPC 接続（Peering / TGW / PrivateLink / DX）](notes/week1/02-vpc-connectivity.md)
- [03 ハイブリッド DNS と Route 53](notes/week1/03-hybrid-dns-route53.md)
- [04 IAM ポリシー評価とクロスアカウント](notes/week1/04-iam-policy-evaluation.md)
- [05 Control Tower と IAM Identity Center](notes/week1/05-control-tower-identity-center.md)
- [06 Direct Connect の冗長構成](notes/week1/06-direct-connect-resiliency.md)
- [07 セキュリティサービスの組織横断集約](notes/week1/07-org-wide-security-services.md)

## Week2 ノート
- [08 Multi-AZ / Multi-Region と DR 4パターン](notes/week2/08-dr-strategies.md)
- [09 データ層のリージョン間構成](notes/week2/09-cross-region-data.md)
- [10 KMS（マルチリージョンキー、クロスアカウント、リージョン間コピー）](notes/week2/10-kms.md)
- [11 コンピュート（ECS/EKS/Fargate/Lambda の選定とスケーリング）](notes/week2/11-compute.md)

## Week3 ノート
- [12 CloudFormation / CDK（StackSets、ドリフト、変更セット、削除・置換の保護）](notes/week3/12-cloudformation-cdk.md)
- [13 監視・監査・コンプライアンス（CloudTrail 組織証跡、Config、CloudWatch 横断監視、X-Ray）](notes/week3/13-monitoring.md)
- [14 コスト最適化（Savings Plans / RI、Budgets・Anomaly Detection、Compute Optimizer、S3 階層化、Spot）](notes/week3/14-cost-optimization.md)
- [15 移行（7R、DMS / SCT、DataSync、Snow、MGN）](notes/week3/15-migration.md)

## Week4 ノート（Week3 までで未カバーの頻出分野の補強）
- [16 CloudFront と Global Accelerator（OAC、署名付き URL、エッジ関数、オリジンフェイルオーバー、静的 IP）](notes/week4/16-cloudfront-global-accelerator.md)
- [17 メッセージングと疎結合（SQS、SNS、EventBridge、Step Functions、API Gateway）](notes/week4/17-messaging-decoupling.md)
- [18 ストレージ（S3 詳細、Storage Gateway、FSx、EFS）](notes/week4/18-storage.md)
- [19 セキュリティ補足（WAF、Shield、Network Firewall、Secrets Manager、ACM、GuardDuty）](notes/week4/19-security.md)
- [20 分析（Athena、Glue、Lake Formation、Redshift、Kinesis、Firehose）](notes/week4/20-analytics.md)

## 構成
- `notes/` ドメイン別・週別の要点ノート（Q&A付き）
- `qa/` 間違いノート・自作Q&A（`qa/iam.md` など）
- `other/` 事実確認ログ（`other/fact-check-log.md`）
