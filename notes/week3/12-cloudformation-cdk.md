# Week3-12: CloudFormation / CDK（StackSets、ドリフト、変更セット、削除・置換の保護）

出典（2026-09-26 に原文を curl で確認）: CloudFormation User Guide「StackSets concepts」「Create CloudFormation StackSets with service-managed permissions」「Enable or disable automatic deployments for StackSets in AWS Organizations」「Prevent failed StackSets deployments using target account gates」「Performing drift detection on CloudFormation StackSets」「Detect unmanaged configuration changes to stacks and resources with drift detection」「Update CloudFormation stacks using change sets」「Prevent updates to stack resources」「Continue rolling back an update」「Get exported outputs from a deployed CloudFormation stack」「Split a template into reusable pieces using nested stacks」、Template Reference「DeletionPolicy」「UpdateReplacePolicy」「CreationPolicy」、CDK v2 Developer Guide「AWS CDK bootstrapping」「Constructs」

## 選定の早見表
| 要件 | 選択 |
|---|---|
| 組織の全アカウント・複数リージョンに同じスタックを展開。新規アカウントにも自動で | StackSets（サービスマネージド権限 + 自動デプロイ） |
| 組織外のアカウントにも展開 | StackSets（**セルフマネージド権限**。各ターゲットに IAM ロールを自分で作る） |
| 更新前に「置換・削除されるリソース」を確認したい | 変更セット |
| コンソール等で手動変更されたかを検出したい | ドリフト検出 |
| スタックを削除してもデータ（S3、DB）を残したい | `DeletionPolicy: Retain` / `Snapshot` |
| 更新でリソースが置換されても旧リソースを残したい | `UpdateReplacePolicy: Retain` / `Snapshot` |
| EC2/ASG 内のアプリの起動完了を待ってからスタックを完了 | `CreationPolicy` + cfn-signal |
| 特定リソースの更新・削除を誤操作から守る | スタックポリシー（フェイルセーフ。アクセス制御は IAM） |
| 同一アカウント・リージョンのスタック間で値を共有 | Export + `Fn::ImportValue`（別アカウント・別リージョンは `Fn::GetStackOutput`） |

## StackSets
- **StackSet** = 同じテンプレートを複数のアカウント・リージョンにデプロイするコンテナ。パラメータで個別にカスタマイズできる。**StackSet はリージョンのリソース**（作成したリージョンでしか見えない）
- **管理者アカウント**で作り、**ターゲットアカウント**にスタック（**スタックインスタンス**）を作る。スタックインスタンスはスタックが無くても存在しうる（作成失敗の理由を持つ）
- **更新はテンプレートを全スタックに反映**する。一部のスタックだけテンプレートを変えることはできない
- 削除: 一部のアカウント・リージョンだけ削除／**Retain Stacks** で StackSet から外して単独スタックとして残す（以降はターゲット側アカウントで管理）。**StackSet の削除はスタックインスタンスが 0 のときだけ**

### 権限モデル
| | セルフマネージド | サービスマネージド |
|---|---|---|
| IAM ロール | **利用者が**各ターゲットに作成 | **StackSets が作成** |
| 展開先 | IAM ロールを作れる任意のアカウント | **AWS Organizations 内のアカウントのみ**（組織外は不可） |
| 新規アカウントへの自動デプロイ | なし | **あり（自動デプロイ）** |
| 前提 | ロールの信頼関係 | Organizations との**信頼されたアクセス**の有効化（管理アカウントの管理者のみ） |

サービスマネージドの注意点:
- 開始できるのは**管理アカウントまたは委任管理者**だが、**操作は管理アカウントが実行**
- **管理アカウントにはスタックがデプロイされない**（OU に属していても）
- 対象は組織全体 / OU（親 OU を指定すると**子 OU も含む**）。アカウントフィルター（Intersection / Difference / Union）で個別指定も可能
- **委任管理者は組織の全アカウントにデプロイする権限を持ち、管理アカウント側で OU や操作を絞れない**
- **ネストスタック、マクロ・トランスフォームを含むテンプレートは非対応**

### 自動デプロイ
- 有効にすると、アカウントの**追加・削除・OU 間移動**で自動的に作成・削除が走る。例: OU1 → OU2 に移すと、StackSet1 のスタックを削除し、StackSet2 のスタック作成をキューに入れる
- **アカウント削除時の動作**を選ぶ: スタックを**削除**するか**保持（Retain）**するか
- 設定は **StackSet 単位**（OU・アカウント・リージョンごとの選択的な調整は不可）
- **アカウントフィルターは自動デプロイでは考慮されない**（個別指定していても、組織内の新規アカウントに展開される。防ぐには自動デプロイを無効化）
- 依存関係（DependsOn）は 1 StackSet あたり最大 10、アカウントあたり最大 100。**管理された実行（Active）の使用が推奨**（並行実行で大規模組織を高速化）

### 操作オプション
- **Maximum concurrent accounts**: 同時に操作するアカウント数（1 リージョン内）
- **Failure tolerance**: **リージョンごと**に許容する失敗数。超えると**そのリージョンが FAILED になり、残りのリージョンへの操作も取り消される**。パーセント指定は**切り捨て**
- **Region concurrency**: **Sequential（既定）**＝1 リージョンずつ、**Parallel**＝全リージョン同時
- **Concurrency mode**: Strict Failure Tolerance の場合、Maximum concurrent accounts は Failure tolerance + 1 が上限（原文の記述。もう一方のモードの詳細は未取得）
- **アカウントゲート**: ターゲットでの操作前に Lambda（名前は **`AWSCloudFormationStackSetAccountGate`** 固定）を呼び、SUCCEEDED を返すときだけ続行（例: アラーム発報中のアカウントを避ける）。関数が無ければ**チェックをスキップして続行**。ゲート失敗は失敗許容数にカウントされる。StackSets 専用
- スタックインスタンスのステータス: CURRENT / OUTDATED / **INOPERABLE**（削除失敗。以降の更新の対象外。Retain 付き削除 → 手動削除が必要）/ FAILED / CANCELLED など

## ドリフト検出
- 「**実際の設定がテンプレート（とパラメータ）から外れていないか**」を検出。**テンプレートで明示したプロパティだけ**が対象で、**既定値は追跡されない**（追跡したいなら既定値でも明示する）。スタックレベルのタグも検出対象
- **ドリフトを検出するだけ**で、自動修復はしない。是正は手動（リソースをテンプレートに合わせる、またはインポートで取り込む）
- リソースのドリフトステータス: IN_SYNC / MODIFIED / DELETED / NOT_CHECKED（**ドリフト検出に対応しないリソース**）
- **ネストスタックのドリフトは親の検出に含まれない**（ネストスタックに直接実行する）
- 実行できるスタックの状態: CREATE_COMPLETE / UPDATE_COMPLETE / UPDATE_ROLLBACK_COMPLETE / UPDATE_ROLLBACK_FAILED
- 権限: 対象リソースの読み取り権限 + `cloudformation:DetectStackDrift` など
- **StackSet のドリフト**: 各スタックインスタンスのスタックでドリフト検出を行い、1 つでもドリフトしていれば StackSet 全体がドリフト。**CloudFormation 経由でスタックを直接更新したもの（別テンプレートにした等）はドリフトとみなされない**
- 継続的な構成監視・修復・組織横断の準拠評価は **AWS Config**（ノート 13 で扱う）

## 変更セット
- 更新を**実行せずにプレビュー**する。追加・変更・削除されるリソースと、プロパティの前後比較を確認。**置換（Replacement）や削除の有無**を実行前に知るのが主目的
- 複数の変更セットを作って比較できる。実行した時点で、そのスタックの**他の変更セットは削除される**
- **成功を保証しない**。作成時に事前検証（構文エラー、リソース名の衝突、クォータなど）は行うが、実行時の条件（カスタムリソースのロジック等）による失敗は起こりうる
- ネストスタックにも対応。**express モード**（`--deployment-config '{"mode":"EXPRESS"}'`）で高速化

## 削除・置換・更新の保護
| 仕組み | 効く場面 | 主な値 |
|---|---|---|
| **DeletionPolicy** | **スタック削除**時、およびテンプレートから**リソース定義を消した更新**時 | Delete（既定）/ **Retain** / **RetainExceptOnCreate** / **Snapshot** |
| **UpdateReplacePolicy** | 更新で**置換**（新しい物理 ID）が起きたとき、**旧リソース**をどうするか | Delete（既定）/ Retain / Snapshot |
| **スタックポリシー** | **スタック更新**時のリソース保護（JSON） | Allow / Deny |
| **CreationPolicy** | 作成時にシグナル数 or タイムアウトまで CREATE_COMPLETE にしない | EC2 / ASG / WaitCondition / AppStream Fleet が対象 |

- **DeletionPolicy の既定は Delete。例外**: `AWS::RDS::DBCluster`、および `DBClusterIdentifier` を指定しない `AWS::RDS::DBInstance` は既定が **Snapshot**。S3 バケットは**中身が空でないと削除に失敗**する
- **DeletionPolicy は置換されたリソースには効かない**（置換は UpdateReplacePolicy の担当）。**Retain したリソースは削除後も課金される**。Snapshot 対応: EBS ボリューム、RDS、Aurora（DBCluster）、DocumentDB、Neptune、ElastiCache、Redshift など。原文の例は DB に**両方**（DeletionPolicy と UpdateReplacePolicy）に Retain を付けている（削除と置換は別経路のため）
- **RetainExceptOnCreate**: 作成時のロールバックでは削除し、それ以外（スタック削除など）では保持。「空のまま作成失敗したリソースは消し、使用中のデータは残す」
- **スタックポリシー**: 設定すると**全リソースが既定で保護**（明示的な Allow が必要）。**Deny が Allow に優先**。**更新時のみ**有効で、IAM のようなアクセス制御ではなく**フェイルセーフ**。スタックあたり 1 つ、ユーザー別に変えられない。依存で自動更新されるリソースにも権限が要る

## ロールバックと障害対応
- 更新失敗 → 自動ロールバック。**ロールバック自体が失敗 → UPDATE_ROLLBACK_FAILED**（例: 旧 DB が CloudFormation の外で削除されていた）。この状態のスタックは**更新不可**だが、原因を直して **ContinueUpdateRollback** で UPDATE_ROLLBACK_COMPLETE に戻せる
- 直せない場合は **`--resources-to-skip`** でロールバックできないリソースをスキップ。スキップしたリソースはテンプレートと**不整合になるため、次の更新前に整合させる**（放置すると更新でスタックが復旧不能になりうる）。**ロールバック中に UPDATE_FAILED になったリソースだけ**が対象（順方向の更新で失敗したものは不可）。ネストは `NestedStackName.ResourceLogicalID` 形式
- **CreationPolicy**（cfn-signal / SignalResource API）: アプリの構成完了を待ってから次に進める。ASG は `MinSuccessfulInstancesPercent` と `ResourceSignal`（Count/Timeout）を指定

## スタックの分割と共有
| 方法 | 使いどころ |
|---|---|
| **ネストスタック**（`AWS::CloudFormation::Stack`） | 共通構成（ALB 等）を再利用。**ネストグループ内**の情報共有。ルートスタックで一括管理 |
| **Export / `Fn::ImportValue`** | **同一アカウント・同一リージョン**の別スタックと共有（ネットワーク層 → アプリ層など） |
| **`Fn::GetStackOutput`** | **別アカウント・別リージョン**のスタック出力を参照 |

- Export 名は**アカウント・リージョン内で一意**。**インポートされている間は、エクスポート元のスタックの削除も出力値の変更もできない**
- ネストスタックの親を更新するとき、ロールバックは子にも波及する。ドリフト検出は子に個別実行

## CDK
- **CDK は CloudFormation にデプロイする**（内部で CloudFormation テンプレートを生成）。よって上記のドリフト・変更セット・ロールバックの知識がそのまま効く
- **コンストラクトの階層**: **L1**（`Cfn` で始まる。CloudFormation リソースと 1 対 1、抽象化なし）/ **L2**（キュレート済み。既定値・ベストプラクティスの権限・ヘルパーメソッド。最も一般的）/ **L3**（パターン。複数リソースの構成）
- **ブートストラップ**: CDK を使う各**環境（アカウント × リージョン）ごとに**、`cdk bootstrap` で **S3 バケット（アセット）、ECR リポジトリ（Docker イメージ）、IAM ロール**を作る。実体は **`CDKToolkit`** という CloudFormation スタック。**環境は独立しているので、使う環境ごとに 1 回必要**

## 判断ポイント
- 「組織の全アカウントに統一のベースライン（ロギング、IAM ロール等）を展開し、新規アカウントにも自動適用」→ StackSets（サービスマネージド + 自動デプロイ）。**管理アカウントには展開されない**点に注意
- 「組織外のアカウントにも同じスタックを展開」→ セルフマネージド権限
- 「StackSets の展開が失敗したら以降のリージョンを止めたい」→ Failure tolerance（**リージョンごと**）+ Region concurrency を Sequential
- 「デプロイ前に置換・削除されるリソースを確認」→ 変更セット。「手動変更の検出」→ ドリフト検出（修復はしない）
- 「スタック削除後も DB/S3 のデータを残す」→ DeletionPolicy（Retain / Snapshot）。「更新による置換でデータを失いたくない」→ UpdateReplacePolicy
- 「更新ロールバックが失敗して更新できない」→ ContinueUpdateRollback（必要なら resources-to-skip）
- 「特定リソースを誤って更新・削除しない」→ スタックポリシー（更新時のみ）。削除の防止は DeletionPolicy や終了保護（終了保護は今回未確認）
- 「別アカウント・別リージョンのスタック出力を参照」→ `Fn::GetStackOutput`（Export/ImportValue は同一アカウント・リージョン限定）
- 「EC2 内のソフトのインストール完了を待つ」→ CreationPolicy + cfn-signal

## Q&A（答えを隠して考えてから確認）
### Q1. 組織の全アカウントに同じベースラインスタックを展開し、今後追加されるアカウントにも自動で適用したい。どうする？
<details><summary>答え</summary>
StackSets のサービスマネージド権限 + 自動デプロイ。Organizations との信頼されたアクセスを有効化する。ただし管理アカウントにはスタックがデプロイされない点に注意。
</details>

### Q2. 組織外のアカウントにも同じスタックを展開したい。どうする？
<details><summary>答え</summary>
StackSets のセルフマネージド権限。各ターゲットアカウントに IAM ロールを自分で作る。サービスマネージドは組織内のアカウントのみ。
</details>

### Q3. StackSets で、失敗したら以降のリージョンへの展開を止めたい。どう設定する？
<details><summary>答え</summary>
Failure tolerance（リージョンごとに許容する失敗数）を設定し、Region concurrency を Sequential（既定）にする。超えるとそのリージョンが FAILED になり、残りのリージョンへの操作も取り消される。
</details>

### Q4. スタック更新の前に、置換や削除されるリソースがないか確認したい。また、コンソールで手動変更されていないかも検出したい。どうする？
<details><summary>答え</summary>
更新前の確認は変更セット（実行せずにプレビューできる）。手動変更の検出はドリフト検出（検出のみで自動修復はしない）。
</details>

### Q5. スタックを削除しても RDS/S3 のデータを残したい。さらに、更新で DB が置換されても旧データを失いたくない。どうする？
<details><summary>答え</summary>
スタック削除時は DeletionPolicy（Retain / Snapshot）。更新による置換時は UpdateReplacePolicy（Retain / Snapshot）。削除と置換は別経路なので、DB には両方を付ける。
</details>

### Q6. 更新のロールバック自体が失敗して UPDATE_ROLLBACK_FAILED になり、スタックを更新できない。どうする？
<details><summary>答え</summary>
原因を直して ContinueUpdateRollback を実行し、UPDATE_ROLLBACK_COMPLETE に戻す。直せない場合は resources-to-skip でロールバックできないリソースをスキップする（次の更新前にテンプレートとの不整合を解消する）。
</details>

## 未確認
- **ドリフト対応リソースの範囲**（Resource type support の一覧）、**ドリフト対応の変更セット（drift-aware change sets）**（該当ページの取得に失敗）
- **Concurrency mode（Strict / Soft）の詳細**（該当ページの取得に失敗）
- **スタックの終了保護（termination protection）、サービスロール**、**スタックポリシーの Update:* アクションの種類**
- **Fn::GetStackOutput の詳細**（原文の記述は Export のページの 1 文のみ）
- **カスタムリソース、ラッピング（マクロ・トランスフォーム、SAM）、cfn-init / cfn-hup、WaitCondition の詳細**
- **CloudFormation ハンドラー・レジストリ・フック**（フックは `other/fact-check-log.md` の 09-25 分を参照）、**CloudFormation のクォータ**（テンプレート上限、リソース数など）
- **CDK: `cdk diff` / `cdk deploy` / アセット / Aspects / CDK Pipelines**、ブートストラップで作られる IAM ロールの種類
- **AWS Service Catalog、Elastic Beanstalk、OpsWorks との使い分け**、**Blue/Green（CodeDeploy）**

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
