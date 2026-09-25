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

## 注意
WebFetch の要約は誤ることがある（VPN の大容量トンネルを2.5Gbpsと返した）。数値は原文で確認すること。

## 2026-09-25（新規ノート05〜07の根拠）
根拠: search_documentation の原文チャンク（Direct Connect Resiliency Toolkit / re:Post、IAM Identity Center ユーザーガイド、Security Hub・GuardDuty API・CloudTrail・Config・Control Tower の各ドキュメント）。

| 対象 | 結果 |
|---|---|
| 05: Control Tower の Log Archive / Audit、AFT、ID ソース1つ、Simple AD 非対応、SCIM、クォータ（7,000 / 100 / 6 / 3,500） | ✅ 原文と一致 |
| 06: DX 3モデルと SLA（最大 99.99%、高 99.9%、開発/テストはSLAなし）、BFD、BGP タイマー、graceful restart 非推奨 | ✅ 原文と一致 |
| 06: DX Gateway あたりの TGW 数 | ⚠️ クォータ表は6、re:Post のVIF解説は最大3で**不一致**。→ 2026-09-26 に解決（下記） |
| 07: GuardDuty 自動有効化 NEW/ALL/NONE、Security Hub 中央設定・管理アカウントは委任管理者不可、Config 組織アグリゲーター、CloudTrail 組織証跡と委任管理者 | ✅ 原文と一致 |
| 06: LAG は同一ロケーション・同一速度で束ねる | 未確認（一般知識で記載） |
| 05: 許可セットを割り当てるとアカウントに IAM ロールが作られ一時認証情報でアクセス | 未確認（一般知識で記載） |
| 07: Macie / Inspector / Detective / Firewall Manager の委任管理者 | 未確認 |
| 07: 組織証跡ログの改ざん防止策（S3 Object Lock 等） | 未確認（ノートからは削除） |

## 2026-09-26（Week1 ノート 05〜07 の未確認項目）
根拠: aws-mcp の search_documentation / read_documentation で取得した公式ドキュメント原文（Organizations / Macie / Inspector / Detective / Firewall Manager / Direct Connect / TGW / CloudTrail / IAM Identity Center の各ガイド、re:Post）。一部は AWS ブログ（ノート内に明記）

| 対象 | 結果 |
|---|---|
| 07: Macie の委任管理者（リージョンごとの指定）、Inspector（リージョンごとに enableDelegatedAdminAccount、Organizations ポリシーでの有効化）、Detective（管理者はリージョンごと、管理アカウント自身も指定可）、Firewall Manager（デフォルト管理者が自動で委任管理者に、追加管理者は最大 9） | ✅ 原文どおり（Macie の 5,000 アカウントは AWS ブログ） |
| 06: DX Gateway あたりの TGW 数 = 6（調整不可） | ✅ DX クォータ表・TGW クォータ表・re:Post 2 件が一致。VIF 解説の「最大 3」は誤りと判断 |
| 06: LAG の条件（専用接続のみ、同一帯域、同一 DX エンドポイントに終端、100G/400G は 2 本・それ未満は 4 本、Active/Active、MLAG 非対応） | ✅ 原文どおり |
| 06: 専用接続あたりの VIF 合計 | ⚠️ ノートの「合計 51」は誤り。クォータ表は Private/Public 50 + Transit 4 で**合計 54**。訂正済み |
| 07: 組織証跡の改ざん対策 = ログファイル整合性検証（SHA-256 ハッシュ + RSA 署名のダイジェストを毎時配信。改ざん・削除を検知する機能） | ✅ 原文どおり |
| 07: S3 Object Lock 等による組織証跡ログの改ざん防止 | 未確認（引き続き） |
| 05: 許可セットの割り当てでアカウントに IAM ロールが作られる（`AWSReservedSSO_` で始まる名前） | ✅ 原文どおり |

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

## 2026-09-25（Week2 ノート 10）
根拠: 公式ドキュメント原文（curl）— KMS Developer Guide（Multi-Region keys、Default key policy、外部アカウントでの利用、Rotate keys）、S3 User Guide（Replicating encrypted objects）、EBS User Guide（Copy snapshot）、RDS User Guide（Copy snapshot）

| 対象 | 結果 |
|---|---|
| 10: マルチリージョンキー（同一キーID/マテリアル、変換不可、共有/独立プロパティ、ローテーションはプライマリのみ、EXTERNAL は各レプリカにインポート、プライマリ削除はレプリカ削除後、カスタムキーストア不可、AWS マネージドキーは単一リージョン、S3 CRR はシングルリージョン扱い） | ✅ 原文どおり |
| 10: キーポリシーの root 委任文、クロスアカウントは両ポリシー必須、有効な操作の限定、CloudTrail 両側記録 | ✅ 原文どおり |
| 10: S3 CRR の SSE-KMS（既定では複製されない、SourceSelectionCriteria、宛先キー指定、ロール権限、ETag の変化）、EBS/RDS スナップショットコピーの暗号化 | ✅ 原文どおり（KMS 権限の細部は原文の一部のみ確認） |
| 10: ローテーション（CMK は既定で無効・既定 365 日、AWS マネージドキーは約365日で常時） | ✅ 原文どおり |
| 10: カスタムローテーション期間の範囲、キー削除の待機期間、暗号化スナップショットのクロスアカウント共有制約、グラント/条件キー/XKS、KMS クォータ | 未確認 |

## 2026-09-25（qa/ 追加質問: ExternalId、CloudFormation フック）
根拠: 公式ドキュメント原文（curl）— IAM User Guide「External IDs for third party access」、CloudFormation Hooks User Guide「What are CloudFormation Hooks?」「Hooks concepts」

| 対象 | 結果 |
|---|---|
| qa/iam.md Q3: ExternalId の目的（confused deputy 防止）、秘密ではない、サードパーティ側が生成、顧客ごとに1つ、2〜1,224文字と使用可能な記号、コンソールのロール切り替えでは使えない、sts:ExternalId 条件 | ✅ 原文どおり |
| qa/organizations-scp.md Q3: フックの目的、失敗モード FAIL/WARN、ターゲット（RESOURCE/STACK/CHANGE_SET/CLOUD_CONTROL）、アクション、実装4種、WARN で先に検証する推奨 | ✅ 原文どおり |
| qa/organizations-scp.md Q3: 「CloudFormation を経由しない作成は止められない」 | ⚠️ 原文にこの一文はなく、フックが CloudFormation / Cloud Control API の操作の直前に呼ばれるという説明からの推論。Control Tower 側の記述（CloudFormation 経由のみ）とは整合 |
| qa/organizations-scp.md Q3: フックはアカウント・リージョン単位で有効化する、スタックフィルターの詳細 | 未確認 |
| qa/iam.md Q3: 「自社内の別アカウント間では通常 ExternalId は不要」 | 未確認（原文の "When should I use an external ID?" の条件は全文を読んでいないため、一般的な理解として記載） |

## 2026-09-26（Week2 ノート 11）
根拠: 公式ドキュメント原文（curl）— ECS Developer Guide（capacity providers、Fargate、service auto scaling、task placement、service parameters）、EKS User Guide（compute、Fargate、autoscaling）、Lambda Developer Guide（concurrency、reserved concurrency、SnapStart、Resilience）

| 対象 | 結果 |
|---|---|
| 11: ECS キャパシティプロバイダー（種類、戦略内で混在不可、起動タイプ間更新不可）、Fargate の分離、FARGATE_SPOT の 2 分前警告 | ✅ 原文どおり |
| 11: ECS のサービス既定の spread（AZ）、binpack/random/spread、戦略はベストエフォート・制約は拘束、Service Auto Scaling の方式、SQS バックログ、最小 0 | ✅ 原文どおり |
| 11: EKS のコンピュート選択肢、Auto Mode（Karpenter ベース、SSH/カスタム AMI 不可）、EKS on Fargate の制約、Karpenter に SLA なし、Cluster Autoscaler は ASG | ✅ 原文どおり |
| 11: Lambda の同時実行数の式、上限 1,000、予約（上下限・無料・残り 100）、プロビジョニング済み（有料）、SnapStart の位置づけ | ✅ 原文どおり |
| 11: Lambda のスケーリング速度（10 秒あたり 1,000 実行環境） | ⚠️ 同ページに「500 のバースト / 10 秒」の記述もあり、整合を未確認 |
| 11: Lambda の VPC 設定と AZ、SnapStart のランタイム制約、ECS デプロイ方式、App Runner/Batch との比較 | 未確認 |

## 2026-09-26（Week3 ノート 12）
根拠: 公式ドキュメント原文（curl）— CloudFormation User Guide（StackSets 概念・サービスマネージド権限・自動デプロイ・アカウントゲート・StackSet ドリフト、ドリフト検出、変更セット、スタックポリシー、ロールバック継続、Export、ネストスタック）、Template Reference（DeletionPolicy、UpdateReplacePolicy、CreationPolicy）、CDK v2 Developer Guide（bootstrapping、constructs）

| 対象 | 結果 |
|---|---|
| 12: StackSets の権限モデル、サービスマネージドの制約（管理アカウントには展開されない、委任管理者の権限、ネスト・マクロ非対応）、自動デプロイ（アカウントフィルター非考慮、StackSet 単位、依存関係 10/100） | ✅ 原文どおり |
| 12: 操作オプション（Failure tolerance はリージョンごと・切り捨て、Region concurrency 既定 Sequential、アカウントゲートの関数名とスキップ挙動）、スタックインスタンスのステータス | ✅ 原文どおり |
| 12: ドリフト検出（明示プロパティのみ、ネスト非対象、対象ステータス、StackSet のドリフト判定）、変更セット（成功保証なし、実行で他の変更セットが削除） | ✅ 原文どおり |
| 12: DeletionPolicy / UpdateReplacePolicy（既定、RDS の例外、置換には効かない、RetainExceptOnCreate、Snapshot 対応）、スタックポリシー、ContinueUpdateRollback と resources-to-skip、Export の制約と GetStackOutput、CreationPolicy 対応リソース | ✅ 原文どおり |
| 12: CDK のコンストラクト L1/L2/L3、ブートストラップの内容（S3/ECR/IAM、CDKToolkit、環境ごと） | ✅ 原文どおり |
| 12: 「DB は DeletionPolicy と UpdateReplacePolicy の両方を付ける」 | ⚠️ 原文にそう推奨する記述はなく、原文の例が両方 Retain であることのみ。ノートは例の説明に修正済み |
| 12: drift-aware 変更セット、Concurrency mode の詳細、終了保護、サービスロール、Resource type support の範囲、CDK の diff/Pipelines | 未確認（ページ取得に失敗、または未取得） |

## 2026-09-26（Week3 ノート 13）
根拠: 公式ドキュメント原文（curl）— CloudTrail User Guide（組織証跡、整合性検証、concepts、Insights、組織イベントデータストア）、Config Developer Guide（アグリゲーター、組織ルール、組織適合パック、修復、自動修復）、CloudWatch User Guide（クロスアカウントオブザーバビリティ、複合アラーム）、CloudWatch Logs User Guide（クロスアカウントサブスクリプション、データ集約）、X-Ray Developer Guide（サンプリングルール）

| 対象 | 結果 |
|---|---|
| 13: 組織証跡（委任管理者、コンソールはマルチリージョン、SLR、加入・脱退時の挙動、オプトインリージョン、S3 構成、Event history 90 日・自アカウントのみ、メンバーは変更不可） | ✅ 原文どおり |
| 13: イベント種別（既定は管理イベントのみ）、Insights（ベースライン、write 管理イベントの呼び出し率、データイベント Insights は証跡のみ）、整合性検証（SHA-256、1 時間ごとのダイジェスト、RSA 署名、有効化のみでは検証されない） | ✅ 原文どおり |
| 13: Config アグリゲーター（読み取り専用、Organizations は認可不要）、組織ルール／適合パック（API のみ、リージョン単位、7 時間の再試行、委任管理者と SLR）、修復（SSM Automation、再試行、準拠済みに対する修復の注意） | ✅ 原文どおり |
| 13: OAM（sink/link、上限 100,000 / 5、種別の不一致時の挙動、Organizations で自動オンボード）、Logs 集約（同一リージョン制約、新規ログのみ、LogsManaged タグ）、複合アラームの循環、X-Ray サンプリング（reservoir 1/秒 + 5%、ペアレントベース） | ✅ 原文どおり |
| 13: CloudTrail Lake の新規受付終了（2026-05-31 以降） | ✅ 原文の注記どおり（試験範囲での扱いは未確認） |
| 13: 「組織外アカウントはソース側が集約アカウントを認可する」 | ⚠️ 原文は Authorization の定義と「Organizations なら不要」のみ。組織外の手順は推論 |
| 13: ネットワークアクティビティイベント、CloudTrail/Config の料金、Config レコーダー、Logs Insights・メトリクスフィルター・異常検知、サブスクリプション宛先の作成手順、EventBridge の集約 | 未確認 |


## 2026-09-26（qa/organizations-scp.md Q4）
根拠: CloudFormation Hooks User Guide「Hooks concepts」、Control Tower Controls Reference「Control behavior and guidance」原文（curl）

| 対象 | 結果 |
|---|---|
| Q4: フックの呼び出しタイミングは CloudFormation と Cloud Control API の操作の直前、Control Tower のプロアクティブコントロールは CloudFormation でプロビジョニングされるリソースに適用 | ✅ 原文どおり |
| Q4: Terraform AWS プロバイダーが各サービス API を直接呼ぶため対象外 | ➕ 原文に Terraform の記述はなく、上記の原文からの推論 |
| Q4: awscc プロバイダー（Cloud Control API 経由）ならフックが効く可能性 | 未確認 |

## 2026-09-26（Week3 ノート 14）
根拠: 公式ドキュメント原文（curl）— Savings Plans User Guide、EC2 User Guide（RI、スコープ、交換、Marketplace、Spot）、Billing User Guide（一括請求、RI/SP 共有、コスト配分タグ、Cost Explorer、Budgets、Cost Anomaly Detection、Data Exports）、Compute Optimizer User Guide、S3 User Guide（Intelligent-Tiering、ライフサイクル、ストレージクラス）

| 対象 | 結果 |
|---|---|
| 14: Savings Plans 4 種（割引率、対象、Dedicated の $2/時、EKS 料金は対象外）、適用順（RI → EC2 Instance SP → Compute SP、オーナー優先、割引率順、Fargate はメモリ先） | ✅ 原文どおり |
| 14: RI（属性、1/3 年、自動更新なし、キャンセル不可、Standard/Convertible、リージョナル/ゾーナル、Convertible 交換条件、Marketplace 条件・手数料 12%） | ✅ 原文どおり |
| 14: 組織内共有（共有モード、Cost Categories によるグループ条件、請求転送時の制約、メンバー離脱時の Cost Explorer データ）、Budgets（種類、アクション、更新頻度）、Cost Anomaly Detection、Data Exports、Cost Explorer（13/18 か月、API $0.01） | ✅ 原文どおり |
| 14: Compute Optimizer（対象リソース、14 日 / 93 日、外部メトリクス）、S3 Intelligent-Tiering（30/90/90/180 日、128 KB 未満）、ライフサイクル（ウォーターフォール、128 KB 既定、最小期間課金）、Spot（2 分前通知、hibernate は警告なし、最大価格で中断増） | ✅ 原文どおり |
| 14: 「EC2 メモリは CloudWatch 標準では出ないため CloudWatch エージェントも一般的」 | ➕ 原文は外部メトリクス取り込みの記述のみ。ノート内で推論と明記 |
| 14: Intelligent-Tiering の取り出し料金、Glacier Flexible / Deep Archive の最小期間、データ転送料金、Trusted Advisor、Spot Fleet 戦略、リバランス推奨、Savings Plans の返品ポリシー、ODCR | 未確認 |

## 2026-09-26（Week4 ノート 16）
根拠: aws-mcp の search_documentation / read_documentation で取得した公式ドキュメント原文（CloudFront Developer Guide、Global Accelerator Developer Guide・FAQ、re:Post、ACM FAQ）。一部は AWS ブログ（ノート内に明記）

| 対象 | 結果 |
|---|---|
| 16: OAC（SSE-KMS、全リージョン、PUT/DELETE、Object Ownership、静的ウェブサイトエンドポイント不可）、VPC オリジン、マネージドプレフィックスリスト | ✅ 原文どおり |
| 16: 署名付き URL / Cookie の使い分け、署名者（キーグループ推奨）、オリジンフェイルオーバー（ステータスコード 9 種、GET/HEAD/OPTIONS のみ、30 秒 = 10 秒 × 3 回、1〜10 秒 / 1〜3 回） | ✅ 原文どおり |
| 16: CloudFront Functions と Lambda@Edge の比較表、フィールドレベル暗号化（最大 10 フィールド）、地理的制限、ACM は us-east-1 | ✅ 原文どおり |
| 16: Global Accelerator（静的 IP、エンドポイント種別、ヘルスチェック、重み 0〜255、トラフィックダイヤル、クライアント IP 保存、カスタムルーティング） | ✅ 原文どおり |
| 16: 地理的制限が WAF / エッジ関数より先に評価される、OAC の署名オプション、フェイルオーバーの「ステートレス」 | ➕ AWS ブログの記述（DG 原文では未確認） |
| 16: CloudFront に静的 IP がないこと、Lambda@Edge の発行リージョン、キャッシュ / Origin Shield / 料金クラス、GA の料金とヘルスチェック数値、BYOIP、WAF 統合 | 未確認 |

## 2026-09-26（Week4 ノート 17）
根拠: aws-mcp の search_documentation と curl で取得した公式ドキュメント原文（SQS / SNS / Step Functions / API Gateway / EventBridge / Scheduler の各 Developer Guide、re:Post）。一部は AWS ブログ・Well-Architected（ノート内に明記）

| 対象 | 結果 |
|---|---|
| 17: SQS（標準 / FIFO の保証、FIFO 300 TPS・バッチ 3,000、可視性タイムアウト 30 秒〜12 時間、ロングポーリング最大 20 秒、保持 4 日（60 秒〜14 日）、1 MiB、遅延最大 15 分、DLQ は同種別、FIFO 変換不可・メッセージ単位遅延不可、重複排除 5 分） | ✅ 原文どおり |
| 17: SNS（FIFO トピックの配信先制限、フィルターポリシー、変更反映最大 15 分、DLQ） | ✅ 原文どおり |
| 17: Step Functions（Standard / Express の比較、型は変更不可、統合パターン、分散マップ） | ✅ 原文どおり（開始レートはブログ、Express 同期の at-most-once は Well-Architected の記述） |
| 17: API Gateway（API 種別、REST / HTTP 選択基準、エンドポイント 3 種、キャッシュ TTL 300〜3,600 秒、スロットリング、アカウント 10,000 RPS・バースト 5,000） | ✅ 原文どおり |
| 17: EventBridge（アーカイブ / リプレイ、クロスアカウント・クロスリージョン、別アカウントの直接ターゲット 5 種、Pipes、Scheduler） | ✅ 原文どおり（クロスリージョンの詳細はブログ） |
| 17: SQS の Lambda 連携・DLQ リドライブ・暗号化、SNS のリトライ、EventBridge のスキーマ / API Destinations / グローバルエンドポイント、Step Functions の Retry/Catch・上限値、API Gateway の統合タイムアウト・オーソライザー・リソースポリシー | 未確認 |

## 2026-09-26（Week4 ノート 18）
根拠: aws-mcp の search_documentation で取得した公式ドキュメント原文（S3 User Guide、S3 / Storage Gateway / FSx の FAQ、Volume Gateway ガイド、FSx / EFS ユーザーガイド、re:Post）。一部は AWS ブログ（ノート内に明記）

| 対象 | 結果 |
|---|---|
| 18: Glacier 3 クラス（最小期間 90/90/180 日、取り出し時間）、削除マーカーの既定動作、RTC（99.99% / 15 分、SLA 99.9%）、Batch Replication の条件、Object Lock（モード、リーガルホールド、バージョニング必須、条件キー） | ✅ 原文どおり |
| 18: MRAP（権限の 3 ポリシー、VPC 制限、OAC 対応とオプトインリージョンの制限）、Storage Gateway 4 タイプ、Volume Gateway キャッシュ型の上限（1 GiB〜32 TiB、32 ボリューム、1 PiB） | ✅ 原文どおり |
| 18: FSx 4 種の配置・SLA・リージョン間レプリケーション（比較表）、Lustre のスクラッチ / 永続・DRA（最大 8）、ONTAP のプロトコル、EFS のストレージクラス・ライフサイクル既定（30/90 日）・スループットモード | ✅ 原文どおり |
| 18: MRAP が Global Accelerator を使い Transfer Acceleration 不要、アクセスポイント上限 10,000、Deep Archive 約 $1/TB | ➕ AWS ブログの記述（DG 原文では未確認） |
| 18: S3 Standard-IA 等の最小期間、Express One Zone、Glacier 取り出しオプション、FSx File Gateway の位置づけ、Windows の AD 連携、EFS のパフォーマンスモード・レプリケーション | 未確認 |

## 2026-09-26（Week4 ノート 19）
根拠: aws-mcp の search_documentation で取得した公式ドキュメント原文（WAF / Shield / Secrets Manager / GuardDuty / Firewall Manager の各ガイド、Prescriptive Guidance、re:Post）。一部は AWS ブログ・製品ページ（ノート内に明記）

| 対象 | 結果 |
|---|---|
| 19: WAF の保護対象リソース、CloudFront スコープは us-east-1、レートベースルール（10〜2,000,000,000、IP ヘッダー集計） | ✅ 原文どおり（NLB が対象外という点は列挙からの読み取り） |
| 19: Shield Standard / Advanced 比較（有料・1 年、L7 自動緩和、SRT は Enterprise / Business サポート、コスト保護、保護対象 5 種、入口リソースのみ保護して DTO 二重課金回避） | ✅ 原文どおり（比較表は製品ページ） |
| 19: Secrets Manager（リージョン間レプリケーション、ローテーションの伝播、Lambda リソースポリシーと SourceAccount / SourceArn、KMS 暗号化コンテキスト、RotationToken） | ✅ 原文どおり |
| 19: Firewall Manager の NACL ポリシー、GuardDuty の複数アカウント設定（EKS_ADDON_MANAGEMENT、GuardDutyManaged タグ） | ✅ 原文どおり |
| 19: GuardDuty のプロテクションプランと推奨構成、ACM の DNS / HTTP 検証とメール検証廃止、Network Firewall と WAF の比較、WAF の Count モード推奨 | ➕ AWS ブログ・製品ページの記述（DG 原文では未確認） |
| 19: WAF の WCU・評価順序、Shield Advanced の料金、Secrets Manager と Parameter Store の比較、ACM のエクスポート条件・プライベート CA、GuardDuty 各プランのデータソース、Network Firewall のデプロイモデル | 未確認 |

## 2026-09-26（Week1 の残り未確認: Resolver 上限・Profiles・TGW ピアリング）
根拠: 公式ドキュメント原文（curl）— Route 53 Developer Guide「Quotas」（DNSLimitations.md）、「What are Amazon Route 53 Profiles?」、TGW Guide「Transit gateway peering attachments」。

| 項目 | 結果 |
|---|---|
| 03: Resolver の数値上限 | ➕ エンドポイント 4/リージョン/アカウント、エンドポイントあたり IP 6、ルール 1,000、ルール-VPC 関連付け 2,000、IP あたり UDP 10,000 QPS（Service Quotas で引き上げ可。IP/ルール 6 は固定） |
| 03: Route 53 Profiles | ➕ PHZ・Resolver ルール・DNS Firewall・インターフェイス VPC エンドポイント・クエリログ設定を一括適用。1 VPC 1 Profile、RAM 共有、ローカル設定が優先。上限は Profile 5/アカウント、VPC 1,000/Profile ほか。PHZ 関連付け 300 超は Profiles 推奨 |
| 02: TGW ピアリングは静的ルート | ✅ 原文「add a static route to the transit gateway route table that points to the transit gateway peering attachment」。一意の ASN を推奨（将来のルート伝播機能のため） |
| 03: TGW ピアリング越しの Resolver | ➕ ピアリングは別リージョンの Route 53 Resolver による DNS 名前解決をサポートしない（原文） |

## 2026-09-26（07 組織証跡ログの改ざん防止）
根拠: aws-mcp search_documentation の原文（AWS SRA「Log Archive account」、CloudTrail「Validating CloudTrail log file integrity」、CloudTrail FAQ）

| 項目 | 結果 |
|---|---|
| 07: 組織証跡ログの改ざん防止 | ✅ 整合性検証は「変更・削除されたか」の検知。防止側は S3 Object Lock（SRA が選択肢として明記）。S3 MFA Delete はダイジェストファイルの保護強化（整合性検証ドキュメント）、ログ全体の追加保護（FAQ） |

## 2026-09-26（08〜20 の個別の未確認項目 第1弾）
根拠: 公式ドキュメント原文（curl / Python で本文取得）— CloudFormation User Guide「Protect stacks from being deleted」、S3 User Guide「Understanding and managing storage classes」「Intelligent-Tiering」、EC2 User Guide「Capacity Reservations」、ACM User Guide「Exportable public certificates」、GuardDuty User Guide「Runtime Monitoring」、CloudFront Developer Guide（Lambda@Edge、S3 origin の OAC）、WAF Developer Guide、Global Accelerator Developer Guide

| 項目 | 結果 |
|---|---|
| 12: スタックの終了保護 | ✅ 既定無効、有効だと削除が失敗、ネストは親から継承（単独変更不可）、親の更新による削除は可 |
| 14: ODCR | ✅ 即時は期間縛りなし・いつでもキャンセル、将来日付は期間あり・キャンセル料の可能性 |
| 14: Intelligent-Tiering の取り出し料金 | ✅ なし（モニタリング・自動化料金のみ） |
| 14: 各クラスの最小期間 | ✅ Standard-IA / One Zone-IA 30 日（Glacier 系はノート 18 で確認済み） |
| 19: GuardDuty Runtime Monitoring の EC2 | ✅ EKS / ECS on Fargate / EC2 に対応。Fargate 上の EKS は非対応 |
| 19: ACM エクスポート可能証明書 | ✅ 198 日有効、45 日前に更新、デプロイは利用者管理、追加料金。検証は原文で DNS またはメール（ノートの「メール検証廃止」はブログ由来で別件） |
| 16: Lambda@Edge の発行リージョン | ✅ us-east-1 |
| 16: S3 ウェブサイトエンドポイントと OAC | ✅ OAC / OAI 不可（カスタムオリジン）。代替の保護手段は未確認のまま |
| 16: WAF の geo match | ✅ ルールステートメントが存在。CloudFront 地理的制限との使い分けは未確認 |
| 16: CloudFront に静的 IP がないこと | 未確認（Global Accelerator が既定で静的 IP 2 個を提供する点のみ ✅） |
| 上記以外の 08〜20 の未確認項目（CloudTrail ネットワークアクティビティイベント、Kinesis 料金、SQS/SNS/EventBridge 上限比較など） | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第2弾: Aurora Global の昇格時間）
根拠: 公式ドキュメント原文（curl）— Aurora User Guide「Aurora Global Database」「Using switchover or failover in Amazon Aurora Global Database」

| 項目 | 結果 |
|---|---|
| 08/09: Aurora Global のセカンダリ昇格は 1 分未満 | ⚠️ User Guide 原文では確認できず。原文は「RTO は分単位」「RPO は通常秒単位」「選ばれたセカンダリは通常数分でプライマリになる」。「1 分未満」は DR ホワイトペーパー由来の記述として扱い、ノート 08/09 を「通常数分」に訂正 |
| 09: Aurora PostgreSQL の RPO 管理 | ➕ rds.global_db_rpo は 20 秒〜2,147,483,647 秒。少なくとも 1 つのセカンダリが RPO 内になるようコミットを制御し、全セカンダリが超過するとプライマリのトランザクションをブロック。switchover は RPO 0、failover は RPO が秒単位の非ゼロ（詳細のノート反映は未実施） |

## 2026-09-26（08〜20 の個別の未確認項目 第3弾: CloudTrail ネットワークアクティビティイベント）
根拠: 公式ドキュメント原文（curl）— CloudTrail User Guide「Logging network activity events」

| 項目 | 結果 |
|---|---|
| 13: ネットワークアクティビティイベント | ✅ VPC エンドポイント所有者が、VPC エンドポイント経由の AWS API 呼び出しを記録するイベント。組織外の認証情報によるアクセス試行の検知に使える。証跡・イベントデータストアの両方で設定可、既定は記録されず、追加料金あり。高度なイベントセレクタは eventCategory=NetworkActivity と eventSource（Equals のみ）が必須。errorCode で指定できる値は VpceAccessDenied のみ。vpcEndpointId での絞り込みは証跡のみ。対応サービスは S3/KMS/EC2/STS/Secrets Manager/DynamoDB/Lambda など多数 |
| 13: 上記以外（証跡の料金の詳細、CloudWatch Logs / EventBridge 連携など） | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第4弾: Kinesis のモード切り替え・料金）
根拠: 公式ドキュメント原文（curl）— Kinesis Data Streams Developer Guide「Choose the right mode to stream in」（how-do-i-size-a-stream.html）

| 項目 | 結果 |
|---|---|
| 20: オンデマンド↔プロビジョニングの切り替え制約 | ✅ ストリームごとに 24 時間に 2 回。無停止、ステータスは Updating→Active。切り替え直後のシャード数は引き継ぎ |
| 20: On-demand Advantage の条件 | ✅ アカウント単位、最低 25 MiB/秒の取り込み・取得を約束（不足分は割引単価で課金）、有効化後 24 時間は無効化不可、Standard へ戻す前にウォームスループット削除が必要。ストリームごとの固定料金なし、取り込み・取得・延長保持は Standard より 60% 以上低い |
| 20: オンデマンド vs プロビジョニングの判断 | ✅ 原文でオンデマンドは予測不能・変動大、プロビジョニングは予測可能なトラフィック向け。ノートの「料金は未確認」注記を更新 |
| 20: Kinesis の具体的な単価 | 未確認（Developer Guide に金額なし。料金ページは今回未取得。aws-mcp は権限未付与で使えず） |

## 2026-09-26（08〜20 の個別の未確認項目 第5弾: SQS の上限）
根拠: 公式ドキュメント原文（curl）— SQS Developer Guide「Quotas」（quotas-queues.html、quotas-fifo.html、quotas-messages.html）

| 項目 | 結果 |
|---|---|
| 17: SQS の In-flight 上限 | ✅ 標準は約 120,000（トラフィック・バックログ依存）、FIFO は 120,000。標準のショートポーリングで超過すると OverLimit、ロングポーリングはエラーなし。FIFO は超過してもエラーなしだが処理に影響しうる。Support で引き上げ可 |
| 17: SQS のメッセージサイズ・保持・可視性タイムアウト | ➕ 1 バイト〜1 MiB（超過は Extended Client Library）、保持は既定 4 日・60 秒〜14 日、可視性タイムアウトは既定 30 秒・0〜12 時間、ロングポーリング最大 20 秒 |
| 17: SQS のその他（Lambda 連携、DLQ リドライブ、暗号化など）、SNS / EventBridge の上限比較 | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第6弾: SQS の DLQ とリドライブ）
根拠: 公式ドキュメント原文（curl / Python）— SQS Developer Guide「Using dead-letter queues in Amazon SQS」（sqs-dead-letter-queues.html）、「Learn how to configure a dead-letter queue redrive」（sqs-configure-dead-letter-queue-redrive.html）

| 項目 | 結果 |
|---|---|
| 17: DLQ の期限は元のエンキュー時刻基準 | ⚠️ 標準キューのみ正しい。FIFO は DLQ へ移動するとエンキュー時刻がリセットされる。ノート 17 を訂正。DLQ は同一アカウント・同一リージョン（➕） |
| 17: DLQ リドライブ | ✅ 既定は元のキュー、同種なら任意のキューへ。StartMessageMoveTask / ListMessageMoveTasks / CancelMessageMoveTask（キャンセルは RUNNING のみ）。最大 500 メッセージ/秒、フィルタ・変更不可、最大 36 時間、アクティブなタスク 100/アカウント。戻したメッセージは新しい messageID・enqueueTime で保持期間リセット |
| 17: redrive policy / redrive allow policy | ➕ maxReceiveCount、allow policy は既定全許可・byQueue 最大 10・denyAll |
| 17: SQS の Lambda イベントソースマッピング連携、FIFO ハイスループットの数値、暗号化、クロスアカウント | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第7弾: SQS と Lambda のイベントソースマッピング）
根拠: 公式ドキュメント原文（curl）— Lambda Developer Guide「Using Lambda with Amazon SQS」（with-sqs.html）、「Configuring queues and event source mappings for SQS」（services-sqs-configure.html）、「Handling errors for an SQS event source」（services-sqs-errorhandling.html）

| 項目 | 結果 |
|---|---|
| 17: バッチサイズ・バッチウィンドウ | ✅ 標準は最大 10,000、FIFO は最大 10。10 超はウィンドウ 1 秒以上が必須。ウィンドウは標準キューのみ |
| 17: 可視性タイムアウトとの関係 | ✅ 関数タイムアウト ≦ 可視性タイムアウト（超過は ESM 作成・更新でエラー）。推奨は関数タイムアウトの 6 倍（＋バッチウィンドウ） |
| 17: 部分バッチ応答 | ✅ ReportBatchItemFailures と batchItemFailures。例外はバッチ全体の失敗。FIFO は最初の失敗で停止し、失敗分と未処理分をすべて返す |
| 17: 最大同時実行 | ✅ イベントソース単位で制限可、プロビジョンドモードとは併用不可。予約同時実行を設定する場合は最低 5 を推奨（理由の続きは未確認） |
| 17: プロビジョンドモードのポーラー数上限 | ⚠️ 原文が 2 ページで食い違い（configure ページは最大 2〜2,000、with-sqs ページは 2〜10,000）。数値は未確定としてノートに記載 |
| 17: Lambda 連携の DLQ の設定場所 | 未確認（今回の原文抜粋では確認せず） |
| 17: FIFO ハイスループットの数値、暗号化、クロスアカウント | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第8弾: SQS FIFO ハイスループット）
根拠: 公式ドキュメント原文（curl）— SQS Developer Guide「High throughput for FIFO queues」（high-throughput-fifo.html）、「Enabling high throughput for FIFO queues」（enable-high-throughput-fifo.html）、「Amazon SQS message quotas」（quotas-messages.html）

| 項目 | 結果 |
|---|---|
| 17: 通常 FIFO は 300 TPS/API、バッチで 3,000 メッセージ/秒 | ✅ 原文どおり（3,000 は 300 コール × 10 件） |
| 17: ハイスループットの上限数値 | ✅ バッチなし TPS / バッチありメッセージ/秒: 米国東部（バージニア北部）・米国西部（オレゴン）・欧州（アイルランド）70,000 / 700,000、米国東部（オハイオ）・欧州（フランクフルト）19,000 / 190,000、東京・欧州（スペイン）9,000 / 90,000、その他 2,400 / 24,000 |
| 17: 有効化の条件 | ➕ 重複排除スコープ＝メッセージグループ、FIFO スループット上限＝メッセージグループ ID 単位が必須。変更すると通常スループットに戻る。各パーティションは 3,000（バッチ）/300 メッセージ/秒、パーティションは自動管理、上げるにはメッセージグループ数を増やす |
| 17: SQS の暗号化（SSE-SQS / SSE-KMS）、クロスアカウント、拡張クライアント、SNS / EventBridge の上限比較 | 未確認（今回対象外） |

## 2026-09-26（08〜20 の個別の未確認項目 第9弾: SQS の暗号化 SSE）
根拠: 公式ドキュメント原文（curl / Python）— SQS Developer Guide「Encryption at rest in Amazon SQS」（sqs-server-side-encryption.html）、「Amazon SQS Key management」（sqs-key-management.html）

| 項目 | 結果 |
|---|---|
| 17: SSE-SQS / SSE-KMS の暗号化範囲 | ✅ 本文のみ。キュー名・属性、メッセージのメタデータ、キュー単位メトリクスは対象外。HTTPS と SigV4 必須、匿名リクエストは拒否 |
| 17: 有効化前のメッセージ・DLQ 移動時の暗号化 | ➕ 有効化後に送信したメッセージのみ暗号化（バックログは非暗号化）。DLQ 移動で暗号化状態は変わらない |
| 17: AWS マネージドキー（alias/aws/sqs）の制約 | ➕ キーポリシー変更不可。暗号化キューは別アカウントの Lambda を呼び出せない（カスタマー管理キーが必要） |
| 17: KMS 権限 | ➕ プロデューサーは kms:Decrypt + kms:GenerateDataKey、コンシューマーは kms:Decrypt。S3 / EventBridge / SNS からは、カスタマー管理キーのキーポリシーでサービスプリンシパルを許可 |
| 17: データキー再利用期間 | ✅ 60 秒〜24 時間、既定 5 分。KMS 呼び出し数 R = (B/D) × (2P + C)。エンベロープ暗号化 |
| 17: SSE-SQS の既定有効化・料金、キューポリシーによるクロスアカウント、拡張クライアント、SNS / EventBridge の上限比較 | 未確認（今回の原文では確認せず） |
