# Week4-19: セキュリティ補足（WAF / Shield / Secrets Manager / ACM / GuardDuty / Network Firewall）

出典（2026-09-26 に aws-mcp の search_documentation で原文を確認）: WAF Developer Guide「What is AWS WAF, Shield Advanced…」、Shield 機能ページ（Getting started）、Prescriptive Guidance「Network account」、wafv2 API リファレンス、re:Post（WAF レートベースルール、Secrets Manager ローテーション、ACM エクスポート）、Secrets Manager ユーザーガイド「Replicate secrets across Regions」「ローテーション」、GuardDuty ユーザーガイド（Runtime Monitoring 複数アカウント）と AWS Security Blog（プロテクションプラン、ACM の検証方式）、Firewall Manager「network ACL policies」、AWS 製品比較ページ（Network Firewall と WAF）。ブログ・製品ページはノート内に明記。組織横断集約は Week1 ノート 07 を参照

## 選定の早見表
| 要件 | 選択 |
|---|---|
| SQL インジェクション / XSS / ボット / L7 の HTTP フラッド対策 | **AWS WAF**（マネージドルール、レートベースルール、Bot Control） |
| L3/L4 の DDoS（SYN / UDP フラッド、リフレクション） | **Shield Standard**（全顧客、追加料金なし） |
| 大規模 DDoS、L7 の自動緩和、SRT、DDoS によるコスト急増の補償 | **Shield Advanced** |
| VPC のアウトバウンド制御、侵入防止（IPS）、ドメインフィルタ | **Network Firewall** |
| 複数アカウントへの WAF / Shield / NACL ポリシーの一括適用と是正 | **Firewall Manager** |
| DB 認証情報などの自動ローテーション | **Secrets Manager** |
| HTTPS 用の証明書の発行と自動更新 | **ACM** |
| アカウント / ワークロードの脅威検出（ログ分析ベース） | **GuardDuty** |

## AWS WAF
- **保護できるリソース**: **CloudFront、ALB、API Gateway REST API、AppSync GraphQL API、Cognito ユーザープール、App Runner、Verified Access**。**NLB は原文の列挙に含まれない**（L7 のサービスが対象。API リファレンスの記述からの読み取り）
- **CloudFront 用は `us-east-1`（スコープ CLOUDFRONT）**、他は**リージョナル**（ノート 16 の ACM と同じ性質の制約）
- **レートベースルール**: 送信元 IP または**ヘッダー内の IP**（プロキシ / CDN の背後ではこちら）で集計。レート上限は **10〜2,000,000,000**、評価ウィンドウを選択。**範囲を絞る条件（スコープダウン）**も指定できる（re:Post のコンソール手順）
- **AWS Managed Rules**（Core Rule Set、Known Bad Inputs など）は OWASP Top 10 相当をカバー。**まず Count モードで検証してから Block に切り替える**（製品比較ページの専門家コメント）。**Bot Control**、**Fraud Control（アカウント乗っ取り / アカウント作成の不正防止）**
- **WAF と Shield の関係**: **Shield Advanced を使うと WAF の料金は追加なし**（機能比較表: 「Included at no additional charge with AWS Shield Advanced」。保護対象リソースの WAF 利用分。詳細な範囲は未確認）

## Shield Standard と Advanced
| | Standard | Advanced |
|---|---|---|
| 料金 | **全 AWS 顧客に追加料金なし** | **有料、1 年のサブスクリプション** |
| 一般的な L3/L4 DDoS（SYN / ACK / UDP フラッド、リフレクション） | ✓ 自動インライン緩和 | ✓ |
| 大規模イベント向けの追加緩和キャパシティ | ✗ | ✓ |
| アプリケーション層（L7）の**自動**緩和 | 追加料金で利用可（原文の表） | ✓（WAF ルールを自動生成） |
| **Shield Response Team（SRT）**による緩和・事後分析 | ✗ | ✓（**Enterprise または Business サポートが必要**） |
| L3/L4/L7 のイベント通知・履歴レポート、アプリ層トラフィック監視 | ✗ | ✓ |
| **DDoS コスト保護**（Route 53、CloudFront、ELB、EC2） | ✗ | ✓ |
- **Shield Advanced の保護対象**: **EC2（Elastic IP）、ELB（ALB / NLB / Classic）、CloudFront、Route 53 ホストゾーン、Global Accelerator（標準アクセラレーター）**
- **SRT のプロアクティブエンゲージメント**: SRT が保護対象リソースを監視し、DDoS の兆候で連絡してくる
- **設計上の注意（Prescriptive Guidance）**: **CloudFront → ALB のように連なる構成では、入口のリソース（CloudFront）だけを保護対象にする**と、Shield の **Data Transfer Out 料金を二重に払わずに済む**。**Firewall Manager で大規模に設定**できる。Shield Advanced のメトリクスは **CloudWatch** に出るので、アラームと SNS で通知
- 判断: 「DDoS で請求が跳ね上がるのを避けたい」→ **Shield Advanced（コスト保護）**、「攻撃中に専門家の支援」→ **SRT（Enterprise / Business サポート）**、「L7 のフラッドを WAF ルールで自動緩和」→ **Shield Advanced の自動 L7 緩和**

## Network Firewall / セキュリティグループ / NACL / WAF の使い分け
- **Network Firewall**: **VPC 境界のネットワークレベル保護**。**ステートフル検査、侵入防止（IPS）、Web（ドメイン）フィルタ、アウトバウンド制御、Suricata 互換ルール**。エンドポイント時間 + 処理 GB で課金。**Firewall Manager で複数アカウントに展開**できる（製品比較ページ）
- **WAF**: **HTTP/HTTPS（L7）**。SQL インジェクション、XSS、ボット、レート制限、IP レピュテーション
- **Firewall Manager の NACL ポリシー**: 組織内の**サブネットの NACL に、最初 / 最後のルール（インバウンド・アウトバウンド）の存在と順序を強制**し、非準拠を報告（是正も可）。**各アカウントは最初と最後のルールの間に独自ルールを追加できる**
- 判断: 「VPC からインターネットへの通信を許可ドメインだけに」→ **Network Firewall（ドメインフィルタ）**、「ALB の前で SQL インジェクションを防ぐ」→ **WAF**、「組織全体で NACL の最低限のルールを強制」→ **Firewall Manager の NACL ポリシー**

## Secrets Manager
- **リージョン間レプリケーション**: **暗号化されたシークレットデータと、タグ・リソースポリシーなどのメタデータ**をレプリケーション。**レプリカの ARN はリージョン部分だけが異なる**。**ローテーションは主リージョンで実行され、新しい値がすべてのレプリカに伝播**する（レプリカごとのローテーション管理は不要）。**レプリカは独立したシークレットに昇格**できる
- **レプリカにはソース DB の接続情報がそのまま入る**。リージョン固有の接続情報が必要なら、**キーと値を追加**する
- **特別なリージョン（GovCloud、中国）と商用リージョンの間ではレプリケーション不可**。レプリケーション先のリージョンは事前に**有効化**しておく必要がある
- **レプリケーションしなくても、シークレットのあるリージョンのエンドポイントを呼べば、他リージョンから使える**
- **ローテーション**: **Lambda ローテーション関数**を使う。Secrets Manager が関数を起動できるよう、**Lambda のリソースポリシーで `secretsmanager.amazonaws.com` に `lambda:InvokeFunction` を許可**（混同した代理対策に **`aws:SourceAccount`** を推奨。`aws:SourceArn` を付けると**特定のシークレットにしか使えない**）。シークレットがカスタマー管理の KMS キーで暗号化されている場合、Lambda の実行ロールに KMS の権限が付与され、**`kms:EncryptionContext:SecretARN`** 条件で対象のシークレットに限定できる
- **クロスアカウント / 引き受けたロールでのローテーション**: **2024 年 12 月から、`PutSecretValue` の呼び出し元の検証のために、ローテーションのトークン（RotationToken）を渡す必要がある**（re:Post。旧コードは `RotationFailed`）
- 判断: 「DR 用に別リージョンでも同じ DB 認証情報を」→ **シークレットのレプリケーション**（接続先は別途）、「クロスアカウントの Lambda で認証情報をローテーション」→ **Lambda のリソースポリシー + KMS キーポリシー + RotationToken**

## ACM
- **リージョナルなサービス**: 証明書は**利用するサービスと同じリージョン**で発行 / インポートする（re:Post）。**CloudFront 用は us-east-1（バージニア北部）**
- **別リージョン / 別アカウントで使うには**、**エクスポート可能なパブリック証明書**を発行するか、**リージョンごとに個別に発行**する（re:Post。エクスポートの条件・料金は未確認）
- **検証方式**: **DNS 検証**（CNAME レコード。**レコードが残っている限り自動更新**）と、**CloudFront 向けの HTTP 検証**（ブログ。**メール検証は今後廃止**。詳細な時期は未確認）
- 判断: 「CloudFront に独自ドメインの HTTPS」→ **us-east-1 で ACM 証明書**、「マルチリージョンの ALB に同じドメインの証明書」→ **各リージョンで証明書を発行**、「証明書の更新を自動化」→ **DNS 検証**

## GuardDuty（プロテクションプラン）
- **基本（Foundational）**: CloudTrail 管理イベント、VPC フローログ、DNS ログなどを分析（DNS ログは**既定の VPC DNS リゾルバー使用時のみ**処理される。re:Post）
- **プロテクションプラン**（ブログ）: **S3 Protection、EKS Protection、Runtime Monitoring（EKS / ECS。EC2 は未確認）、Malware Protection（EC2 / S3）、Lambda Protection、RDS Protection**。**存在するリソースの分だけ課金**され、EKS を使っていなければ EKS Protection を有効にしても課金されない。**新しいサービスを使い始めたときも自動でカバー**できるため、該当するプランを有効にしておく方針
- **ワークロード別の推奨**（ブログ）: EC2 + S3 → **Foundational + S3 Protection + Malware Protection for EC2**、コンテナ（EKS / ECS）→ **+ EKS Protection + Runtime Monitoring**、Lambda 中心 → **Foundational + Lambda Protection**（S3 トリガーなら S3 Protection も）、Aurora / RDS → **Foundational + RDS Protection + S3 Protection + Malware Protection for S3**
- **複数アカウント**: **委任された GuardDuty 管理者アカウント**から、メンバーアカウントごとに Runtime Monitoring などを有効化。**EKS のエージェントは GuardDuty が管理する（`EKS_ADDON_MANAGEMENT`）か、手動**。**タグ `GuardDutyManaged=false` で除外**できる。**タグの変更を承認済みプリンシパルだけに制限**するポリシーを組織で設定できる
- 判断: 「S3 バケットの不審なアクセス」→ **S3 Protection**、「コンテナ内の不審なプロセス」→ **Runtime Monitoring**、「EBS の悪意あるファイル」→ **Malware Protection for EC2**

## 判断ポイント
- 「ALB の SQL インジェクション、ボット、クレデンシャルスタッフィング対策」→ **WAF（マネージドルール、Bot Control、Fraud Control）**
- 「NLB や EC2 に直接来る L3/L4 攻撃」→ **Shield（Standard は自動、大規模は Advanced）**。WAF の保護対象は L7 のリソース（NLB は列挙にない）
- 「CloudFront + ALB の Shield Advanced 保護」→ **入口の CloudFront だけ**を保護対象にして DTO の二重課金を避ける
- 「DDoS でスケールアウトした分の請求を補償」→ **Shield Advanced（コスト保護）**
- 「VPC のアウトバウンドを許可ドメインに限定」→ **Network Firewall**
- 「組織の全アカウントに WAF ルールや NACL ルールを強制」→ **Firewall Manager**
- 「Secrets のリージョン間 DR」→ **レプリケーション（ローテーションは主リージョンから伝播）**
- 「CloudFront の証明書」→ **us-east-1 の ACM**
- 「コンテナ、S3、Lambda の脅威検出を組織全体で」→ **GuardDuty プロテクションプラン + 委任管理者**

## 未確認
- **WAF**: WebACL の容量ユニット（WCU）の上限、ルールの評価順序と優先度、ルールグループの種類（AWS Managed / 自前 / Marketplace）、ログ出力先（S3 / CloudWatch Logs / Firehose）、CAPTCHA / Challenge、WAF の料金、**Shield Advanced に含まれる WAF 料金の範囲**
- **Shield**: 保護対象の**ヘルスベース検出**、**Shield Advanced のサブスクリプション料金（月額と組織単位）**、**Route 53 のヘルスチェックとの統合**、**Shield network security director**
- **Secrets Manager**: **Parameter Store との比較（料金、ローテーション、クロスアカウント）**、**リソースポリシーによるクロスアカウントアクセス**、**管理ローテーション（マネージドローテーション）**、**料金**、**削除の猶予期間**、**KMS キーとのクロスアカウント共有の詳細**
- **ACM**: **エクスポート可能な証明書の条件と料金**、**プライベート CA（ACM PCA）**、**マネージド更新の条件（30 日 / 60 日前など）**、**メール検証廃止の時期**、**インポートした証明書は自動更新されない点**
- **GuardDuty**: 各プランの**データソースと検出内容の詳細**、**Extended Threat Detection**、**複数リージョンでの有効化**、**信頼済み IP リスト / 脅威リスト**、**EventBridge 連携と自動対応**、**料金**、**Malware Protection の対象**
- **Network Firewall**: **ルールグループの種類（ステートレス / ステートフル）**、**分散型とセントラライズ型のデプロイモデル（TGW 連携）**、**TLS 検査**
- **その他**: **Amazon Inspector / Macie / Detective**（Week1 ノート 07 の未確認項目）、**IAM Access Analyzer**、**Security Hub**

## 疑問・確認したい点
