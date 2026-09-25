# Week2-11: コンピュート（ECS/EKS/Fargate/Lambda の選定と、マルチAZ・スケーリング）

出典（2026-09-26 に原文を curl で確認）: ECS Developer Guide「Amazon ECS launch types and capacity providers」「Architect for AWS Fargate for Amazon ECS」「Automatically scale your Amazon ECS service」「Use strategies to define Amazon ECS task placement」「Best practices for Amazon ECS service parameters」、EKS User Guide「Manage compute resources by using nodes」「Simplify compute management with AWS Fargate」「Scale cluster compute with Karpenter and Cluster Autoscaler」、Lambda Developer Guide「Understanding and visualizing concurrency」「Configuring reserved concurrency」「Improving startup performance with Lambda SnapStart」「Resilience in AWS Lambda」。EC2 の Auto Scaling は SAA の範囲として省略

## 選定の早見表
| 要件 | 選択 |
|---|---|
| サーバーレスでコンテナを動かす（ノード管理なし）、ECS API でよい | ECS + Fargate |
| Kubernetes 互換性・既存の K8s 資産・OSS エコシステム | EKS |
| 短時間のイベント駆動、リクエスト単位課金、サーバー管理なし | Lambda |
| GPU や特殊な EC2 構成、ノードへの SSH、デーモン、特権コンテナが必要なコンテナ | ECS on EC2 / EKS（EC2 ノード）。Fargate は不可（下記） |
| 中断に耐えるバッチ・テスト用の安価なコンテナ | ECS の FARGATE_SPOT（2 分前警告で中断）や EC2 スポット |
| K8s を使いたいがノード運用（OS パッチ・AMI 更新）を減らしたい | EKS Auto Mode または EKS + Fargate |

## ECS
- **起動タイプ**は EC2 / Fargate / External / ECS Managed Instances。**現在は「キャパシティプロバイダーで構成する」ことが推奨**され、起動タイプはタスク定義の `requiresCompatibilities`（互換性の宣言）にだけ使うことを推奨
- キャパシティプロバイダーの種類: **Fargate / FARGATE_SPOT**（各クラスターに ECS が用意。作成不要）、**Auto Scaling グループ**（自己管理 EC2）、**ECS Managed Instances**（Fargate の手軽さと EC2 の柔軟性を両立するフルマネージド）。1 クラスターに混在できるが、**1 つのキャパシティプロバイダー戦略内では種類を混ぜられない**
- 起動タイプ間の移行（EC2 ⇔ Fargate 起動タイプ）は**サービス更新でできない**。**キャパシティプロバイダー戦略に変更**すれば、EC2 ASG ⇔ Fargate ⇔ Managed Instances の更新が可能
- **Fargate**: 各タスクが独自の分離境界（カーネル、CPU、メモリ、ENI を他タスクと共有しない）。サーバーやクラスターのサイズ・パッキングの管理が不要。**FARGATE_SPOT は余剰容量で割引、AWS が容量を必要とすると 2 分前警告で中断**

### マルチ AZ（ECS）
- **サービスのタスク配置の既定は `spread`（`attribute:ecs.availability-zone`）**。スケールイン時も AZ 間のバランスを保つように終了するタスクを選ぶ。EC2 起動タイプの配置戦略は `binpack`（cpu/memory の空きを最小に。使用インスタンス数を最小化）/ `random` / `spread` があり、配列で組み合わせられる（例: AZ で spread → メモリで binpack）
- **配置戦略はベストエフォート**（最適な配置が無理でも配置を試みる）。**配置制約は拘束力があり、配置を妨げうる**
- ローリング更新: `minimumHealthyPercent`（既定 100%）と `maximumPercent`（既定 200%）で、更新中の稼働タスク数の下限・上限を決める。追加のクラスター容量なしで更新したいなら minimumHealthyPercent を下げる

### スケーリング（ECS サービス）
- **Application Auto Scaling** を使う。**ターゲット追跡**、**ステップ**（CloudWatch アラーム）、**スケジュール**、**予測スケーリング**、**SQS キューのバックログに基づくスケーリング**（タスクあたりのバックログというカスタムメトリクス。非同期ワーカー向け）
- ECS は CPU・メモリ使用率のメトリクスを **1 分間隔**で CloudWatch に送る
- **スケールインは保守的**（クールダウン中はブロック）、スケールアウトは連続的。スケールアウトの要求はスケールインのクールダウンを止める
- **最小キャパシティを 0 にするとタスク数を 0 にできる**
- EC2 起動タイプでは、**サービスのタスク数（Service Auto Scaling）と、クラスターの EC2 台数（キャパシティプロバイダーの ASG スケーリング）の 2 階層**をそろえて考える

## EKS
- ポッドの実行先: **EKS Auto Mode 管理ノード / マネージドノードグループ / セルフマネージドノード / Fargate / EKS Hybrid Nodes**。ハイブリッドノード以外は**クラスターと同じ VPC** に置く（同じサブネットである必要はない）
- **マネージドノードグループ**: EC2 を自分でデプロイ・管理し、OS のパッチ・AMI 更新は利用者の責任（EKS 最適化 AMI の更新はコンソールから 1 クリック）。**カスタム AMI、SSH、ブートストラップ引数、Local Zone、Windows、GPU** に対応（Auto Mode の対応はより限定的）
- **EKS Auto Mode**: **EC2 を自分で管理しない**、OS の管理も不要、ノードを自動で追加・統合・削除（**Karpenter ベース**）。**SSH 不可、カスタム AMI 不可**（NodeClass で構成）、Windows 不可、Local Zone 不可
- **EKS on Fargate**: Fargate プロファイルで指定した Pod だけが Fargate で動く。**Pod ごとに独立したコンピュート境界（VM 分離）**。制約:
  - **DaemonSet 不可**（サイドカーに変更）、**特権コンテナ不可**、**HostPort / HostNetwork 不可**、**GPU 不可**
  - **プライベートサブネットのみ**（NAT ゲートウェイ経由で AWS サービスにアクセス）
  - ALB / NLB は **IP ターゲットのみ**
  - **IMDS が使えない**（IAM 認証は IRSA を使う）
  - Outposts / Wavelength / Local Zone には置けない
  - Pod のプロファイルに合致しないと Pending のまま
- **ノードのスケーリング**: **Karpenter**（Pod の要件に合う EC2 を 1 分未満で起動、OSS で**利用者がインストール・運用、AWS の SLA なし**）と **Cluster Autoscaler**（**Auto Scaling グループ**を使う）。**Pod のスケーリング**は HPA / VPA（Fargate の Pod のサイズ調整に VPA を使うなら、モードを Auto または Recreate に）

## Lambda
- **同時実行数（concurrency）= 処理中のリクエスト数** = 平均リクエスト毎秒 × 平均実行時間（秒）。例: 5,000 rps × 0.2 秒 = 1,000。リクエスト毎に別の実行環境が必要
- **アカウントの既定の同時実行数上限は、リージョンあたり全関数合計 1,000**（引き上げ申請可）。超えるとスロットリング
- **予約済み同時実行数（reserved）**: 関数の**上限であり下限でもある**。他の関数はその分を使えない。**追加料金なし**。用途は、**重要な関数の枠の確保**と、**下流（DB 接続など）を守るための上限**。**0 にすると意図的に停止**。予約できるのは、未予約の同時実行数から **100 を引いた値**まで
- **プロビジョニング済み同時実行数（provisioned）**: **事前に初期化した実行環境**を用意して**コールドスタートを削減**（ミリ秒 2 桁の応答を目指す）。**追加料金あり**。**対話型（Web/モバイル）に有効**、非同期のデータ処理には通常不要
- **SnapStart**: 関数バージョンの発行時に初期化し、Firecracker microVM の**メモリ・ディスクのスナップショット**を暗号化してキャッシュ。実行環境をそこから再開して起動を短縮（最短でサブ秒）。**コード変更は通常不要**。**一意性に依存する状態（乱数・接続など）はスナップショット対応が必要**。**厳格なコールドスタート要件はプロビジョニング済み同時実行数を使う**（SnapStart の公式の使い分け）
- スケーリングの速さ: **関数ごと・リージョンごとに、10 秒あたり最大 1,000 の実行環境を追加**（または 10 秒あたり 10,000 rps）
- **マルチ AZ**: Lambda はリージョン内の複数 AZ で動くため、利用者の AZ 設計は不要（原文の Resilience ページは AWS インフラの一般説明）。VPC 接続する関数は複数 AZ のサブネットを指定する（この記述の原文は今回未取得）

## 判断ポイント
- 「サーバー管理なし、コンテナ、ECS」→ Fargate。「特権コンテナ / DaemonSet / GPU / SSH」→ EC2 ノード
- 「EKS でノード管理を最小化」→ EKS Auto Mode（または Fargate）。「Fargate では DaemonSet 不可・プライベートサブネットのみ」
- 「EKS のノードを Pod の要求に合わせて素早く」→ Karpenter（SLA なし、利用者運用）。「ASG ベース」→ Cluster Autoscaler
- 「ECS のワーカーを SQS のバックログでスケール」→ Application Auto Scaling + タスクあたりバックログ
- 「ECS のタスクを AZ に均等に配置」→ 既定の spread（`ecs.availability-zone`）
- 「Lambda のコールドスタートを消したい」→ Provisioned Concurrency（コスト増）。「コード変更少なめで起動を短縮」→ SnapStart
- 「重要な Lambda の枠を確保 / 下流の RDS を守る」→ 予約済み同時実行数（無料）
- 「別の関数がスロットリングされる」→ アカウント上限 1,000 の共有枠や、他関数の予約で残りが減っていないかを確認

## Q&A（答えを隠して考えてから確認）
### Q1. ECS でノード管理なしにコンテナを動かしたい。一方、特権コンテナや GPU、SSH が必要なコンテナもある。どうする？
<details><summary>答え</summary>
前者は ECS + Fargate。特権コンテナ、GPU、SSH、DaemonSet が必要なものは EC2 ノード（ECS on EC2 / EKS の EC2 ノード）。Fargate では使えない。
</details>

### Q2. Kubernetes を使いたいが、ノードの OS パッチや AMI 更新の運用は減らしたい。どうする？
<details><summary>答え</summary>
EKS Auto Mode（Karpenter ベース。ただし SSH・カスタム AMI は不可）または EKS on Fargate。Fargate では DaemonSet・特権コンテナ・GPU が不可で、プライベートサブネットのみ。
</details>

### Q3. SQS のキューを処理する ECS ワーカーを、バックログに応じてスケールさせたい。どうする？
<details><summary>答え</summary>
Application Auto Scaling で、タスクあたりのバックログ（カスタムメトリクス）に基づくスケーリングを使う。
</details>

### Q4. ECS サービスのタスクを AZ 間に均等に配置したい。どうする？
<details><summary>答え</summary>
既定の spread（`attribute:ecs.availability-zone`）。スケールイン時も AZ のバランスを保つ。配置戦略はベストエフォートで、配置制約は拘束力がある。
</details>

### Q5. Lambda のコールドスタートを消したい。コード変更を少なくして起動だけ短縮したい場合は？
<details><summary>答え</summary>
消したい場合はプロビジョニング済み同時実行数（追加料金あり）。コード変更少なめで起動を短縮するなら SnapStart。厳格なコールドスタート要件にはプロビジョニング済み同時実行数を使う。
</details>

### Q6. 重要な Lambda 関数の枠を確保し、下流の RDS の接続数も守りたい。どうする？
<details><summary>答え</summary>
予約済み同時実行数（追加料金なし）。関数の上限であり下限でもあるので、枠の確保と下流保護の両方に使える。0 にすると意図的に停止できる。
</details>

## 未確認
- Lambda のスケーリング速度: 原文に「10 秒あたり 500 の同時実行数のバースト」（プロビジョニング済みのスピルオーバーの説明）と「10 秒あたり 1,000 の実行環境」（スケーリングレートの説明）の 2 つの記述があり、**整合を確認できていない**
- SnapStart の対応ランタイム・制約（プロビジョニング済み同時実行数との併用可否など）
- Lambda の VPC 設定と AZ、Lambda の AZ 障害時の挙動
- ECS Managed Instances と EKS Auto Mode の料金・詳細
- ECS のデプロイ方式（ローリング / Blue-Green / CodeDeploy）の詳細
- EKS のコントロールプレーンのマルチ AZ 構成、EKS Anywhere / ECS Anywhere
- App Runner、Elastic Beanstalk、Batch との使い分け

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
