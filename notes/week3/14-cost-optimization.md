# Week3-14: コスト最適化（Savings Plans / RI、可視化・予算、Compute Optimizer、S3 ストレージクラス、Spot）

出典（2026-09-26 に原文を curl で確認）: Savings Plans User Guide「Savings Plans types」「Understanding how Savings Plans apply to your usage」、EC2 User Guide「Reserved Instances overview」「Regional and zonal Reserved Instances (scope)」「Exchange Convertible Reserved Instances」「Sell Reserved Instances in the Reserved Instance Marketplace」「Spot Instance interruptions」「Spot Instance interruption notices」、Billing User Guide「Consolidating billing」「Reserved Instances」「Reserved Instances and Savings Plans discount sharing」「cost allocation tags」「Cost Explorer」「Budgets」「Budget actions」「Cost Anomaly Detection」「Data Exports」、Compute Optimizer User Guide「What is AWS Compute Optimizer?」、S3 User Guide「How S3 Intelligent-Tiering works」「Transitioning objects using Amazon S3 Lifecycle」「Understanding and managing Amazon S3 storage classes」

## 選定の早見表
| 要件 | 選択 |
|---|---|
| EC2・Fargate・Lambda を横断して最大の柔軟性（ファミリー・リージョン・OS 変更可） | **Compute Savings Plans**（最大 66% 割引） |
| 特定リージョンの特定ファミリー（サイズ・OS は自由）で割引を最大化 | **EC2 Instance Savings Plans**（最大 72%） |
| RDS / Aurora / DynamoDB / ElastiCache など DB を横断して割引 | **Database Savings Plans**（最大 35%） |
| インスタンス構成を将来変えたい RI | **Convertible RI**（交換可・売却不可） |
| 不要になった RI を手放したい | **Standard RI** を RI Marketplace で売却 |
| 予算超過で自動的に権限を絞る | **AWS Budgets のアクション**（IAM ポリシー / SCP / EC2・RDS 停止） |
| 想定外のコスト急増を機械学習で検知 | **Cost Anomaly Detection** |
| 詳細な請求データを S3 に出力し Athena 等で分析 | **Data Exports（CUR 2.0）** |
| 過剰スペックのリソースを見つけたい | **Compute Optimizer** |
| アクセス頻度が不明・変動するデータを自動で最適化 | **S3 Intelligent-Tiering** |
| 中断に耐えられるバッチを最安で | **Spot Instances** |

## Savings Plans
- **1 時間あたりの USD コミットメント**（使用量ではなく金額）と引き換えに割引を受ける。**コミットの条件（期間・金額）は購入後に変更不可**。使用量が増えたら追加で購入する
- **各時間のコミットはその時間内でのみ使え、翌時間に繰り越せない**

### 4 種類
| 種類 | 割引 | 対象 | 柔軟性 |
|---|---|---|---|
| **Compute** | 最大 66% | EC2、**Fargate、Lambda** | ファミリー、サイズ、**リージョン**、OS、テナンシーを問わない。EC2 から Fargate への移行でも継続 |
| **EC2 Instance** | 最大 72% | EC2 | **リージョン + ファミリーを固定**。サイズ・OS・テナンシーは自由 |
| **Database** | 最大 35% | Aurora、RDS、DynamoDB、ElastiCache、DocumentDB、Timestream、Neptune、Keyspaces、DMS、OpenSearch | エンジン・ファミリー・サイズ・AZ・リージョンを問わず、**サーバーレスにも適用**。RDS から DynamoDB への移行でも維持 |
| **SageMaker AI** | 最大 64% | SageMaker AI インスタンス | ファミリー・リージョン・コンポーネントを問わない |

- **EMR / EKS / ECS クラスターの EC2 インスタンス**には Compute / EC2 Instance の両方が適用される。**EKS 自体の料金（クラスター料金）は対象外**で、下の EC2 だけが対象
- **Dedicated Instances のリージョンごとの $2/時の固定料金は割引されない**

### 適用順序（試験頻出）
1. **EC2 RI が先**に適用され、**その後に Savings Plans**
2. Savings Plans の中では **EC2 Instance SP が Compute SP より先**（Compute のほうが適用範囲が広いため）
3. **Consolidated Billing ファミリー内では、まず購入したアカウント（オーナー）の使用量に適用**され、次に他アカウント（共有が有効な場合のみ）
4. 同じ条件内では**割引率が最も高い使用量から**適用し、コミットを使い切るまで続ける。残りはオンデマンド料金。Fargate では**メモリ (GB) → vCPU の順**（Savings Plans レートが低い方が先）

## Reserved Instances（EC2）
- **RI は物理的なインスタンスではなく、請求上の割引**。一致する属性のオンデマンド使用に適用される
- **料金を決める属性**: インスタンスタイプ、リージョン、テナンシー、プラットフォーム（OS）。期間は **1 年または 3 年**（3 年のほうが割引大）。**自動更新されない**（期限後はオンデマンド料金）
- **購入後のキャンセルは不可**。ただし変更（modify）、交換（exchange）、売却できる場合がある
- **支払い**: All Upfront / Partial Upfront / No Upfront。**No Upfront は請求実績が必要**。一般に前払いが多いほど割引大
- 原文の冒頭に **「Savings Plans を推奨」**とあり、Savings Plans は RI と同等の割引で柔軟

### オファリングクラス
| | Standard | Convertible |
|---|---|---|
| 割引 | **大** | Standard より小 |
| 変更（modify） | 可 | 可 |
| **交換（exchange）** | **不可** | **可**（別ファミリー・OS・テナンシーの Convertible へ） |
| **RI Marketplace で売却** | **可** | **不可** |

### スコープ（リージョナル vs ゾーナル）
| | リージョナル | ゾーナル |
|---|---|---|
| **キャパシティ予約** | **しない** | **する**（指定 AZ） |
| AZ 柔軟性 | リージョン内の任意の AZ | 指定 AZ のみ |
| サイズ柔軟性 | ファミリー内で可（**Amazon Linux/Unix・default テナンシーのみ**） | なし |
| 購入のキュー | 可 | 不可 |

- **スコープで価格は変わらない**
- **キャパシティ確保が要件なら、ゾーナル RI**（または On-Demand キャパシティ予約。即時利用なら期間の縛りなしでいつでも変更・キャンセルでき、キャンセルまで課金される。将来日付の予約は期間の約束があり、キャンセル料がかかる場合がある。割引は RI / Savings Plans と別）。**リージョナル RI は割引だけ**

### Convertible RI の交換
- 条件: **有効**、**未処理の交換なし**、**残り 24 時間以上**。**回数制限なし**だが、**新しい RI の価値が交換元と同等以上**であること（下回る場合は自動で数量を調整）
- **リージョンは変更不可**（交換でリージョンをまたげない）。**別の Convertible RI にのみ交換可**
- 複数の RI を 1 つに統合できる（期限は最も遠い日付、期間が混在すると 3 年）。単独の交換は同じ期間（1 年 / 3 年）が必要
- **No Upfront → All/Partial Upfront は可**、**その逆は不可**

### RI Marketplace（売却）
- **Standard RI のみ**（リージョナル・ゾーナル両方）。**Convertible は不可、RDS / ElastiCache の RI も不可**
- 条件: **残り期間 1 か月以上**、**有効になってから 30 日以上**、前払いがある場合は AWS が入金を受け取済み、**ボリュームディスカウントで購入した RI は不可**
- **手数料は前払い額の 12%**。売却後は RI の割引とキャパシティ予約を失い、使い続けるとオンデマンド料金
- 売り手は**米国の銀行口座**が必要で、**AWS India の顧客は売却不可**

## 組織内での割引共有
- **一括請求（Consolidated Billing）**: 組織を 1 アカウントとして扱い、**ボリュームディスカウント・RI・Savings Plans の割引を全アカウントで共有**。追加料金なし。請求書は管理アカウントに 1 通
- **管理アカウントは、RI / Savings Plans の割引共有を制御できる**。共有モード: **組織全体 / 優先グループ / 制限グループ**（グループは **Cost Categories の Accounts ディメンション**で定義。**1 アカウントは 1 グループのみ、支払者（管理）アカウントはグループに入れない**）
  - 全モードで**まず購入アカウント自身**を優先。制限グループは**グループ外へは、未使用でも共有しない**
  - 共有するには、**購入アカウントと受け取るアカウントの両方で共有が有効**
- **請求転送（billing transfer）を使う場合、RI / Savings Plans は購入した Organizations 内でのみ適用**。組織をまたいだ購入・共有はできない
- **メンバーアカウントが組織を離れると、その間の Cost Explorer データにアクセスできなくなる**（データは削除されず、管理アカウントは見られる）。再加入すれば再びアクセス可

## コストの可視化・予算・異常検知
### コスト配分タグ
- **AWS 生成タグ（`aws:` プレフィックス）とユーザー定義タグ（`user:`）を、それぞれ Billing コンソールで有効化**して初めて Cost Explorer やレポートに出る。**反映まで最大 24 時間**
- **有効化は管理アカウント（または組織に属さない単独アカウント）のみ**。有効化前のコストにさかのぼって適用されるかは未確認（原文には有効化後の反映のみ）

### Cost Explorer
- **過去 13 か月**の表示と、**今後 18 か月**の予測、**RI 購入の推奨**。UI は無料、**API は 1 リクエスト $0.01**。**一度有効にすると無効化できない**
- データは**最低 24 時間ごと**に更新

### AWS Budgets
- **種類**: コスト / 使用量 / **RI 使用率** / **RI カバレッジ** / **Savings Plans 使用率** / **Savings Plans カバレッジ**。使用率・カバレッジ予算は**下回ったとき**に通知（無駄なコミット検知に使う）
- **実績（actual）と予測（forecasted）の両方**で通知可。通知先は SNS とメール。**情報は 1 日最大 3 回更新（8〜12 時間間隔）**
- **アクション**: 閾値到達時に**自動または手動承認**で実行。**IAM ポリシー適用、SCP 適用、特定の EC2 / RDS インスタンスの停止**。**管理アカウントから他アカウントへ SCP を適用できるが、他アカウントの EC2 / RDS は対象にできない**
- 予算はデフォルトでメンバーアカウントの所有者も自分の分を作成できる。**クロスアカウントでの利用は非対応**（作成したアカウントのユーザーのみ閲覧）

### Cost Anomaly Detection
- **機械学習**で異常な支出を検出し、週次・月次の季節性や自然な成長を考慮して誤検知を減らす。**根本原因を 4 つのディメンション（サービス・アカウント・リージョン・使用タイプ）で金額影響順に表示**
- 通知は**メールまたは SNS**（SNS を Amazon Q Developer in chat applications 経由で Slack / Chime へ）。EventBridge 連携あり
- **正味の非ブレンドコスト（net unblended）を 1 日約 3 回評価**。Cost Explorer のデータを使うため**検知まで最大 24 時間**、**新規モニターは 24 時間後から**、新規サービスは **10 日分の履歴**が必要
- **AWS Marketplace の第三者製品は対象外**（Bedrock の第三者モデルを除く）。それを監視するには Budgets の請求エンティティフィルターを使う
- **Budgets との違い**: Budgets は**固定の閾値**、Anomaly Detection は**通常パターンからの逸脱**

### Data Exports（旧 Cost and Usage Report）
- **CUR 2.0 が推奨**。**SQL で列・行を選択**して S3 に定期出力（不要な列や特定アカウントのデータを除外できる）。**Cost optimization recommendations（Cost Optimization Hub）**、**FOCUS 1.0 / 1.2**、**炭素排出量**、**QuickSight ダッシュボード**、**Legacy CUR** の種類がある
- **最も詳細なデータ**を S3 に出力 → **Athena / QuickSight** で分析、が定番

## Compute Optimizer
- **リソース構成と使用率メトリクス（CloudWatch）を分析して、ライトサイジングとアイドルリソースの推奨**を出す。**オプトインが必要**
- **対象**: EC2、**EC2 Auto Scaling グループ**、**EBS**、**Lambda**、**ECS on Fargate**、商用ソフトウェアライセンス、Aurora / RDS、**NAT Gateway**、DynamoDB、ElastiCache、MemoryDB、DocumentDB、WorkSpaces、SageMaker
- **既定の分析は過去 14 日**。**拡張インフラストラクチャメトリクス（有料）で 93 日に延長**
- **組織の管理アカウントでオプトインすると、複数アカウントの推奨を確認できる**
- **外部のメモリ使用率メトリクス（Datadog、Dynatrace 等）を取り込める**（既定では EC2 のメモリは CloudWatch に標準では出ないため、CloudWatch エージェントも一般的。ここは推論）

## S3 のコスト最適化
### Intelligent-Tiering
- **アクセスパターンが不明・変動する場合**に自動で階層移動。**小さな月額のオブジェクト監視・自動化料金**がかかる
- **自動の階層**: Frequent → **30 日アクセスなしで Infrequent** → **90 日アクセスなしで Archive Instant Access**（S3 Intelligent-Tiering に取り出し料金はなく、オブジェクト単位の月額のモニタリング・自動化料金がかかる。S3 User Guide）
- **任意の階層**（有効化が必要）: **Archive Access**（最短 90 日、最大 730 日まで延長可、**取り出しに数時間、標準で 3〜5 時間**）、**Deep Archive Access**（最短 180 日）
- **アクセスされると Frequent に自動で戻る**（GetObject 等）。HeadObject や List 系はアクセス扱いにならない
- **128 KB 未満のオブジェクトは監視対象外**で、常に Frequent Access 階層

### ライフサイクル
- **ライフサイクルは「ウォーターフォール」型**で、**下位の（より冷たい）クラスへの移行のみ**（例: Standard → Standard-IA → Glacier）。逆方向は不可
- **128 KB 未満のオブジェクトは、既定でどのクラスにも移行しない**（2024 年 9 月以降の既定。移行リクエスト料金が節約を上回るため）。フィルターで変更可
- **最小保存期間に満たずに移行・削除すると残りの期間分が課金**される。Standard-IA / One Zone-IA は **30 日**、Glacier Instant Retrieval は **90 日**。**最小期間が終わる前に次のクラスへ移すルールは 1 つのルールでは作れない**（例: GIR に 4 日後 → Deep Archive に 20 日後は不可）
- 用途の目安: **アクセス頻度が低いが即時取得が必要 → Standard-IA / Glacier Instant Retrieval**、**再作成可能で単一 AZ でよい → One Zone-IA**、**数時間の取得待ちでよい長期保管 → Glacier Flexible / Deep Archive**（最小保存期間は Standard-IA / One Zone-IA が 30 日、Glacier Instant / Flexible が 90 日、Deep Archive が 180 日。S3 User Guide、ノート 18 参照）

## Spot Instances
- **未使用のキャパシティを大幅割引で利用**。EC2 が容量を必要とすると**中断（interruption）**される。**理由: キャパシティ、価格（最大価格を指定した場合）、制約（起動グループ / AZ グループ）**
- **最大価格を指定すると、指定しない場合より中断されやすくなる**（原文）。**中断時の動作は terminate / stop / hibernate を選べる**
- **中断の 2 分前に通知**（EventBridge イベント **「EC2 Spot Instance Interruption Warning」**と、インスタンスメタデータ）。**hibernate は 2 分前の警告なし**（すぐに開始）。**ベストエフォート**。**5 秒ごとのメタデータ確認を推奨**
- **耐障害性のある設計**が前提: ステートレス、バッチ、CI/CD、コンテナ、ビッグデータ、分散型ワークロード
- **オンデマンド / RI / Savings Plans / Spot の組み合わせ**が典型（ベースを SP、変動を Spot）。Auto Scaling グループの混在インスタンスポリシーは未確認
- リバランス推奨（rebalance recommendation）は取得したが、本文は未整理（未確認）

## 判断ポイント
- 「EC2 と Fargate と Lambda を使い、リージョンやファミリーを将来変えるかもしれない」→ **Compute Savings Plans**
- 「特定リージョン・特定ファミリーで最も安く」→ **EC2 Instance Savings Plans**（Compute より割引が大きいが柔軟性は低い）
- 「RDS / Aurora / DynamoDB の割引」→ **Database Savings Plans**（RI にも RDS 用はあるが、柔軟性なら SP）
- 「Savings Plans と RI の適用順」→ **RI が先、次に EC2 Instance SP、最後に Compute SP**。同じ条件では割引率の高い使用量から
- 「特定 AZ でキャパシティを確保しつつ割引」→ **ゾーナル RI**。**リージョナル RI はキャパシティを予約しない**
- 「RI をインスタンスファミリー変更に合わせたい」→ **Convertible RI**（交換）。「不要になった RI を売りたい」→ **Standard RI**（Marketplace。手数料 12%）
- 「Convertible RI をリージョン間で交換」→ **不可**
- 「1 つのアカウントが購入した RI / SP を組織全体で使う」→ **一括請求の共有（既定で有効）**。特定アカウントに限定したいなら**制限グループ**、共有を止めるなら共有設定を無効化
- 「予算超過で新規リソース作成を止めたい」→ **Budgets のアクション（IAM ポリシー / SCP）**。SCP なら新規のリソースを作らずに済む。**他アカウントの EC2 / RDS の停止はできない**
- 「RI / SP の使い残しを検知」→ **Budgets の RI / SP 使用率予算**
- 「突然のコスト急増を自動検知」→ **Cost Anomaly Detection**。「事前設定した金額を超えたら通知」→ **Budgets**
- 「部門・プロジェクト別のコスト配分」→ **コスト配分タグ**（有効化が必要、管理アカウントから）と **Cost Categories**
- 「詳細なコストデータを Athena で分析」→ **Data Exports（CUR 2.0）→ S3 → Athena**
- 「EC2 / EBS / Lambda / NAT Gateway のライトサイジング」→ **Compute Optimizer**（既定 14 日、有料で 93 日）
- 「アクセス頻度が予測できないデータのコスト削減」→ **S3 Intelligent-Tiering**（128 KB 未満は対象外）
- 「中断に耐えられるバッチ処理を最安に」→ **Spot**。**2 分前通知**を EventBridge で処理

## Q&A（答えを隠して考えてから確認）
### Q1. EC2・Fargate・Lambda を使っており、将来リージョンやインスタンスファミリーを変える可能性がある。割引を受けたい。どうする？
<details><summary>答え</summary>
Compute Savings Plans（最大 66% 割引）。ファミリー、サイズ、リージョン、OS、テナンシーを問わず適用される。リージョン + ファミリー固定でよければ EC2 Instance Savings Plans（最大 72%）のほうが割引は大きい。
</details>

### Q2. RI と Savings Plans が併存するとき、どの順で適用される？
<details><summary>答え</summary>
EC2 RI が先、その後に Savings Plans。Savings Plans の中では EC2 Instance SP が Compute SP より先。Consolidated Billing では購入アカウントの使用量が先で、同じ条件内は割引率の高い使用量から適用される。
</details>

### Q3. 特定の AZ でキャパシティを確保しつつ割引を受けたい。どうする？
<details><summary>答え</summary>
ゾーナル RI（指定 AZ でキャパシティ予約もする）。リージョナル RI は割引のみでキャパシティは予約しない。
</details>

### Q4. インスタンスファミリーを将来変えたい RI と、不要になったら売却したい RI は、それぞれどのクラス？
<details><summary>答え</summary>
変更したい場合は Convertible RI（交換可、売却不可）。売却したい場合は Standard RI（RI Marketplace で売却可、手数料は前払い額の 12%）。Convertible RI はリージョンをまたぐ交換もできない。
</details>

### Q5. 予算を超えたら自動で新規リソースの作成を止めたい。どうする？また、他アカウントの EC2 は停止できる？
<details><summary>答え</summary>
AWS Budgets のアクションで IAM ポリシーまたは SCP を適用する。管理アカウントから他アカウントへ SCP は適用できるが、他アカウントの EC2 / RDS の停止はできない。
</details>

### Q6. 突然のコスト急増を自動で検知したい。Budgets との違いは？
<details><summary>答え</summary>
Cost Anomaly Detection（機械学習で通常パターンからの逸脱を検出）。Budgets は固定の閾値で通知する。
</details>

## 未確認
- **Savings Plans**: 購入のキャンセル・返品ポリシー、キューでの購入、カバレッジ・使用率レポートの詳細、購入時の推奨エンジン（Cost Explorer の推奨）、RDS / ElastiCache / OpenSearch などの RI の詳細
- **RI**: **On-Demand キャパシティ予約**との比較、**サイズ柔軟性の正規化係数**、**ボリュームディスカウント**（原文で言及のみ）、RI の変更（modify）の詳細
- **Spot**: **リバランス推奨**、**Spot Fleet / EC2 Fleet の割り当て戦略**（capacity-optimized など）、**Spot ブロック**、Auto Scaling グループの混在インスタンスポリシー、Spot の価格モデル
- **S3**: Flexible Retrieval / Deep Archive の最小保存期間と取り出し時間、Requester Pays、**S3 Storage Lens**、**S3 Storage Class Analysis**、Intelligent-Tiering の取り出し料金
- **その他のコスト要素**: **データ転送料金**（リージョン間、AZ 間、インターネット向け、NAT Gateway の処理料金と VPC エンドポイントによる削減）、**Trusted Advisor のコスト最適化チェック**（取得したが、Support プランごとの対象範囲は未整理）、**Cost Optimization Hub**、**AWS Billing Conductor**、**Cost Categories の詳細**、**Graviton**、**EBS（gp3 への移行、スナップショットのアーカイブ）**、**Lambda / DynamoDB のキャパシティモード（オンデマンド vs プロビジョンド）**、**AWS License Manager**
