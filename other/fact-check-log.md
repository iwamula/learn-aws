# 事実確認ログ

## 2026-09-25（初回: Week1 ノート4本 + iam.md）
根拠: aws-core:aws-iam スキル、AWS 公式ドキュメント（VPN トンネル帯域、Direct Connect MACsec/クォータ、IAM ポリシー評価ロジック）

| 対象 | 結果 |
|---|---|
| 02: VPN 1トンネル約1.25Gbps | ⚠️ 標準は正しいが、Large Bandwidth Tunnel（最大5Gbps、TGW/Cloud WAN 接続のみ）が抜けていた → 修正 |
| 02: Direct Connect 速度 | ⚠️ 専用接続は400Gbpsもあり → 修正。ホスト型「50Mから」は未確認のため削除 |
| 02: MACsec | ⚠️ 10/100/400Gbps に対応 → 修正 |
| 04: 同一アカウントの評価（Identity/Resource の和集合、明示Denyが優先） | ✅ 公式と一致 |
| 04: SCP/RCP/Boundary は共通部分 | ✅ |
| 04: リソースポリシーが IAM ユーザーARNを指定 → Boundary をバイパス | ➕ aws-iam スキルの記載に基づき追記 |
| iam.md: ロールチェーンは最大1時間 | ✅ aws-iam スキルと一致 |
| iam.md: クロスアカウントは両側の許可が必要 | ✅ |

## 2026-09-25（未確認項目の裏取り）
根拠: 公式ドキュメント原文（curl）— Control Tower Controls Reference「Control behavior and guidance」、TGW Quotas、Direct Connect Quotas、Route 53 Developer Guide（PHZ別アカウント関連付け、VPC Resolver）。ホスト型帯域とPHZのDNS属性は search_documentation（Direct Connect User Guide `hosted_connection.html`、re:Post Knowledge Center）の原文チャンク。

| 対象 | 結果 |
|---|---|
| 01: Control Tower ガードレール（予防=SCP / 発見=Config） | ⚠️ 正しいが不足。現行は「コントロール」に改称、**プロアクティブ（CloudFormation フック）**が第3の種別。予防は SCP に加え RCP・宣言型ポリシーでも実装 → 追記 |
| 02: TGW 上限 | ➕ 既定値を追記: アタッチメント5,000/TGW、ルート合計10,000、ルートテーブル20、ピアリング50、VPCアタッチメント最大100Gbps/AZ。（Direct Connect gateway あたり TGW は6、TGW あたり DX gateway は20） |
| 02: ホスト型 DX の帯域 | ✅ 50M/100M/200M/300M/400M/500M/1G/2G/5G/10G/25G。1G以上は要件を満たすパートナーのみ。VIFは1接続1つ → 追記（前回削除した「50Mから」は正しかった） |
| 03: PHZ の別アカウントVPC関連付け（認可＋関連付け） | ✅ 認可はホストゾーン作成アカウント、関連付けはVPC所有アカウント。コンソール不可（CLI/API/SDK のみ）。VPCごとに認可が必要 |
| 03: PHZ に enableDnsHostnames/enableDnsSupport が必要 | ✅ re:Post Knowledge Center に「両方オン」と明記 |
| 03: Inbound/Outbound Endpoint と転送ルール | ✅ 公式と一致。Route 53 Resolver は「Route 53 VPC Resolver」に改称 → 見出しに追記 |

## 未確認（公式で裏取りできていない項目）
- 03: Resolver エンドポイント/ルールの数値上限、PHZ の「Route 53 Profiles」との関係（今回未調査）
- 02: TGW ピアリングが静的ルートのみという記述の原文確認

## 注意
WebFetch の要約は誤ることがある（VPN の大容量トンネルを2.5Gbpsと返した）。数値は原文で確認すること。

## 2026-09-25（新規ノート05〜07の根拠）
根拠: search_documentation の原文チャンク（Direct Connect Resiliency Toolkit / re:Post、IAM Identity Center ユーザーガイド、Security Hub・GuardDuty API・CloudTrail・Config・Control Tower の各ドキュメント）。

| 対象 | 結果 |
|---|---|
| 05: Control Tower の Log Archive / Audit、AFT、ID ソース1つ、Simple AD 非対応、SCIM、クォータ（7,000 / 100 / 6 / 3,500） | ✅ 原文と一致 |
| 06: DX 3モデルと SLA（最大 99.99%、高 99.9%、開発/テストはSLAなし）、BFD、BGP タイマー、graceful restart 非推奨 | ✅ 原文と一致 |
| 06: DX Gateway あたりの TGW 数 | ⚠️ クォータ表は6、re:Post のVIF解説は最大3で**不一致**。要再確認 |
| 07: GuardDuty 自動有効化 NEW/ALL/NONE、Security Hub 中央設定・管理アカウントは委任管理者不可、Config 組織アグリゲーター、CloudTrail 組織証跡と委任管理者 | ✅ 原文と一致 |
| 06: LAG は同一ロケーション・同一速度で束ねる | 未確認（一般知識で記載） |
| 05: 許可セットを割り当てるとアカウントに IAM ロールが作られ一時認証情報でアクセス | 未確認（一般知識で記載） |
| 07: Macie / Inspector / Detective / Firewall Manager の委任管理者 | 未確認 |
| 07: 組織証跡ログの改ざん防止策（S3 Object Lock 等） | 未確認（ノートからは削除） |

## 2026-09-25（qa/organizations-scp.md Q2）
| 対象 | 結果 |
|---|---|
| OU は1組織に最大1,000、ネスト最大5段。OU へのポリシーは配下の子OUの全アカウントに効く | ✅ Organizations ユーザーガイド原文 |
| 1アカウントは1つの OU にのみ所属 | 未確認 |
| AD の OU/GPO との比較 | 未確認（一般知識で記載） |

## 2026-09-25（Week2 ノート 08）
根拠: AWS ホワイトペーパー「Disaster Recovery of Workloads on AWS」"Disaster recovery options in the cloud" の原文（curl）

| 対象 | 結果 |
|---|---|
| 08: DR 4パターンの定義、Pilot Light と Warm Standby の違い、Hot Standby、Active/Active の RPO | ✅ 原文どおり |
| 08: AWS Backup（リージョン間・アカウント間コピー、自動リストア非対応、EC2 メタデータは同一リージョンのみ）、S3 削除マーカーは既定でソースのみ | ✅ 原文どおり |
| 08: Aurora Global Database の昇格 1 分未満、RDS リードレプリカ昇格は数分＋再起動 | ✅ 原文どおり |
| 08: ARC / 加重の変更 / Global Accelerator のダイヤル（コントロールプレーン）/ CloudFront オリジンフェイルオーバー、Elastic Disaster Recovery（Pilot Light、EC2 のみで RDS 非対象） | ✅ 原文どおり |
| 08: 各パターンの RTO/RPO の数値目安 | 未確認（原文は図のみ） |
| 08: Route 53 フェイルオーバーレコード詳細、ARC のクラスター構成 | 未確認 |

## 2026-09-25（Week2 ノート 09）
根拠: 公式ドキュメント原文（curl）— Aurora User Guide（Global Database）、DynamoDB Developer Guide（Global tables）、S3 User Guide（Replication）、RDS User Guide（Cross-Region read replicas）、ElastiCache User Guide（Global datastores）

| 対象 | 結果 |
|---|---|
| 09: Aurora Global Database の構成（プライマリ + セカンダリ最大10、セカンダリのリーダー最大16、スイッチオーバーとフェイルオーバーの違い、制約） | ✅ 原文どおり |
| 08/09: Aurora のセカンダリ数 | ⚠️ DR ホワイトペーパーは「最大5」、Aurora User Guide は「最大10」で**不一致**。User Guide を優先、要再確認 |
| 09: DynamoDB MREC / MRSC（3リージョン、witness、作成後の変更不可、同一アカウントのみ）、SLA 99.999%、マルチアカウント | ✅ 原文どおり |
| 09: S3 レプリケーション（バージョニング必須、RTC 99.99%/15分、削除マーカー・ライフサイクル・既レプリケート済み・アーカイブ層の扱い） | ✅ 原文どおり |
| 09: RDS クロスリージョンレプリカの暗号化（ソース暗号化必須、宛先の KMS キー） | ✅ 原文どおり |
| 09: ElastiCache Global Datastore（ノードベースのみ、リージョン間の自動フェイルオーバー非対応） | ✅ 原文どおり |
| 09: Aurora write forwarding の整合性レベル、RPO 管理機能、MRSC の対応リージョン、S3 クロスアカウントの所有者上書き | 未確認 |
