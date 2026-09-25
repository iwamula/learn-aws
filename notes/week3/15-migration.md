# Week3-15: 移行（7R、DMS / SCT、DataSync、Snow、MGN）

出典（2026-09-26 に原文を curl で確認）: Prescriptive Guidance「About the migration strategies」、DMS User Guide「What is AWS DMS?」「Getting started」「Working with AWS DMS tasks」「Creating tasks for ongoing replication」「Homogeneous data migrations」、Schema Conversion Tool User Guide「What is AWS SCT?」、DataSync User Guide「What is DataSync?」「How DataSync works」、Snowball Edge Developer Guide「What is Snowball Edge?」、Application Migration Service User Guide「What is Application Migration Service?」

## 選定の早見表
| 要件 | 選択 |
|---|---|
| サーバー（物理・仮想・他クラウド）をそのまま EC2 へ、切り替えは数分 | **Rehost**（lift and shift）→ **MGN**（継続的ブロックレベルレプリケーション） |
| DB を同じエンジンのまま AWS へ（例: オンプレ PostgreSQL → RDS / Aurora PostgreSQL） | **DMS の同種データ移行**（サーバーレス、ネイティブツールでダンプ / リストア） |
| DB を別エンジンへ（例: Oracle → PostgreSQL） | **スキーマ変換（DMS Schema Conversion / SCT）+ DMS でデータ移行** |
| 移行中も変更を継続反映して切り替え停止時間を短く | **DMS のフルロード + CDC** |
| ファイル・オブジェクトをネットワーク越しに S3 / EFS / FSx へ | **DataSync** |
| 回線が細い / 大容量を物理輸送 | **Snowball Edge**（※新規顧客は受付終了、下記） |
| VPC・リージョン・アカウント間の移動 | **Relocate** |
| ライセンス型製品を SaaS へ置き換え | **Repurchase**（drop and shop） |

## 7R（移行戦略）
| 戦略 | 内容 | 例・備考 |
|---|---|---|
| **Retire** | 廃止・アーカイブ | 平均 CPU・メモリが 5% 未満は zombie、90 日間 5〜20% は idle。90 日間インバウンド接続なしも対象 |
| **Retain** | 移行せず現状維持 | データ所在地要件、物理依存、メインフレーム / AS/400 / Solaris など、直近にアップグレード済み、SaaS 版待ち |
| **Rehost** | lift and shift。**変更なしで移す** | MGN、Cloud Migration Factory、VM Import/Export で自動化 |
| **Relocate** | オンプレのプラットフォームからクラウド版のプラットフォームへ、多数のサーバーを一度に移す。VPC・リージョン・アカウント間の移動も含む | 新規ハードウェア・アプリ書き換え不要。**最速の移行方法**（アーキテクチャに影響しないため） |
| **Repurchase** | drop and shop。別の製品・SaaS に置換 | ライセンス型 → SaaS。ユーザー教育、データ移行、AD 連携が次のステップ |
| **Replatform** | lift, tinker, and shift。**コード変更なしか少しで最適化** | SQL Server → RDS for SQL Server、Graviton、Windows → Linux、.NET Framework → .NET Core、VM → コンテナ（App2Container） |
| **Refactor / Re-architect** | クラウドネイティブに再設計 | **最も複雑でコストが高い**。大規模移行では推奨されない |

- **大規模移行で一般的なのは rehost、replatform、relocate、retire**。refactor は「まず rehost / relocate / replatform で移し、移行後にモダナイズ」が原文の推奨
- 試験では「変更を最小にして最短で」→ **Rehost / Relocate**、「マネージドサービスの利点を取りたいがアプリは大きく変えない」→ **Replatform**、「スケール・俊敏性のためアーキテクチャから見直す」→ **Refactor**

## AWS DMS（Database Migration Service）
- **ソースとターゲットのエンドポイント間でデータを移行**。同種（Oracle → Oracle）も異種（Oracle → PostgreSQL）も可
- **どちらか一方のエンドポイントが AWS サービス上にあることが必須**。**オンプレ DB からオンプレ DB への移行には使えない**
- **タスクは 3 フェーズ**: フルロード（既存データ）→ キャッシュした変更の適用 → **継続的レプリケーション（CDC）**
- **CDC**: ソースのログをデータベースエンジンのネイティブ API で収集して反映。**リアルタイムではなく、遅延の SLA はない**（数分以上に増えることがある）
- **ビュー**は**フルロードのみのタスク**で移行できる。CDC のみ、またはフルロード + CDC のタスクではテーブルだけが対象
- **同種データ移行（Homogeneous data migrations）**: セルフマネージドのオンプレ DB を **RDS / Aurora の同等エンジン**へ。**サーバーレス**（リソースを自動でスケール）。**ネイティブツールでダンプして復元**し、テーブルパーティション、データ型、関数・ストアドプロシージャなどの二次オブジェクトも移行できる
- 通常のタスクは**レプリケーションインスタンス**（従来型）が処理を実行し、エンドポイントとタスクを作って実行する

## スキーマ変換（SCT / DMS Schema Conversion）
- 異種移行ではスキーマ（テーブル、ビュー、ストアドプロシージャなど）を先に変換する。**DMS 自体はスキーマ変換をしない**（データ移行のみ）
- 原文のチュートリアルでは **DMS Schema Conversion を先に案内**し、**従来の AWS SCT は "legacy" と表現**されている
- **SCT**: 既存の DB スキーマを別エンジンへ変換。OLTP スキーマもデータウェアハウススキーマも可。変換後のスキーマは **RDS の各エンジン、Aurora、Redshift**、EC2 上の DB、S3 のデータで使える
- SCT の変換例: SQL Server → Aurora MySQL / PostgreSQL / MariaDB / MySQL / PostgreSQL など、Db2 LUW → Aurora / MariaDB / MySQL / PostgreSQL など
- **MySQL → Aurora MySQL は SCT なしで**移行できると原文に明記（同種のため）

## AWS DataSync
- **ファイル・オブジェクトデータを AWS ストレージサービスとの間、およびサービス間で転送**するマネージドサービス
- **オンプレ側**: NFS、SMB、HDFS、オブジェクトストレージ。**AWS 側**: S3、EFS、FSx（Windows File Server、Lustre、OpenZFS、NetApp ONTAP）。**他クラウド**: Google Cloud Storage、Azure Blob / Files、Wasabi、Cloudflare R2 など
- **エージェント**は VM アプライアンス。VMware ESXi、Linux KVM、Nutanix AHV、Hyper-V に配置。**AWS 内のストレージ（VPC 内）なら EC2 インスタンスとして配置**
- **同一アカウントの AWS ストレージサービス間（リージョンをまたぐ場合を含む）ではエージェント不要**。データは AWS ネットワーク内を通り、パブリックインターネットを通らない。**リージョン間の転送は元リージョンからのデータ転送 OUT として課金**
- **他クラウドとの転送はエージェントあり・なしのどちらでも可能**
- **暗号化**（オンプレ → AWS は TLS）と**データ整合性の検証**が組み込み。**VPC エンドポイント**でインターネットを経由しない転送も可能
- **ユースケース**: データ移行、**コールドデータのアーカイブ**（S3 Glacier Flexible Retrieval / Deep Archive へ直接）、レプリケーション（ほとんどの S3 ストレージクラス、EFS / FSx のスタンバイ）、インクラウド処理のための転送
- **専用プロトコルと並列マルチスレッド**で高速化

## AWS Snowball Edge
- **原文の冒頭に「新規顧客には提供されていない」と明記**。代替として、オンライン転送は **DataSync**、安全な物理転送は **AWS Data Transfer Terminal**、または AWS パートナー製品、エッジコンピューティングは **AWS Outposts** が挙げられている（**試験は古い出題範囲の可能性があるため、従来の Snow の知識も残しておく**）
- 内蔵ストレージとコンピュートを持つデバイス。**データを物理的に輸送**する（地域の運送会社経由、E Ink の配送ラベル）。インターネットより速く運べる
- 構成は **Storage Optimized 210 TB** と **Compute Optimized**
- **最大 100 Gbit/秒のネットワークアダプタ**、**暗号化は強制**（保存時と輸送中）
- **S3 との間でインポート / エクスポート**が可能
- **クラスター化**: **3〜16 台**でローカルのストレージ・コンピュートの耐久性を確保
- EC2 互換エンドポイント（sbe1 / sbe-c / sbe-g インスタンスタイプ）、S3 互換エンドポイント、EKS Anywhere、Lambda（IoT Greengrass 経由）が使える
- データ転送プロトコル: **NFSv3 / v4 / v4.1、S3 API（HTTP / HTTPS）**

## AWS Application Migration Service（MGN）
- **原文の名称は「AWS Transform MGN」**（旧 Application Migration Service）。試験では従来名の MGN で出ることが多い
- **物理・仮想・クラウドのサーバーを AWS へ Rehost**。**継続的なブロックレベルレプリケーション**でソースサーバーを変換して起動し、**切り替え（cutover）は通常数分**
- **多様な OS**（Windows Server、各種 Linux）に対応。**標準の AZ と Local Zones**に追加設定なしでレプリケート可能
- **3 種類のテンプレート**: レプリケーション、起動（launch）、起動後（post-launch）。新規追加サーバーに適用され、サーバーごとに上書き可能
- **大規模管理**: サーバー → アプリケーション → **ウェーブ（wave）**にグループ化し、起動・cutover・アーカイブをサーバー / アプリ / ウェーブ単位で実行
- 移行後に replatform / refactor する**第一歩として Rehost を使う**

## 判断ポイント
- 「オンプレサーバーを最小のダウンタイムで EC2 に移す（アプリ変更なし）」→ **MGN**
- 「オンプレ DB を移行しつつ、切り替え直前まで変更を反映」→ **DMS（フルロード + CDC）**
- 「Oracle から Aurora PostgreSQL へ（異種）」→ **スキーマ変換 + DMS**。DMS 単体ではスキーマ変換ができない
- 「PostgreSQL から RDS / Aurora PostgreSQL へ（同種）」→ **DMS の同種データ移行**。またはネイティブのバックアップ / 復元
- 「オンプレのデータセンター間で DB を移行」→ **DMS は使えない**（片方は AWS 必須）
- 「NFS / SMB のファイルを S3 / EFS / FSx へ、継続的な同期も」→ **DataSync**。同一アカウントの AWS サービス間ならエージェント不要
- 「大容量データを回線経由では現実的でない」→ **Snowball Edge**（ただし新規顧客不可）。オンライン転送なら DataSync
- 「VPC・アカウント・リージョン間で RDS を移す」→ **Relocate**
- 「大規模移行で最初に何をするか」→ Rehost / Relocate / Replatform / Retire を優先し、**移行後にモダナイズ**

## Q&A（答えを隠して考えてから確認）
### Q1. オンプレの物理・仮想サーバーをアプリ変更なしで、ダウンタイム最小で EC2 に移したい。どうする？
<details><summary>答え</summary>
Rehost（lift and shift）を MGN で行う。継続的なブロックレベルレプリケーションで、切り替え（cutover）は通常数分。
</details>

### Q2. オンプレの Oracle を Aurora PostgreSQL へ移行し、切り替え直前まで変更を反映したい。どうする？
<details><summary>答え</summary>
スキーマ変換（DMS Schema Conversion / SCT）でスキーマを変換し、DMS のフルロード + CDC でデータを移行する。DMS 自体はスキーマ変換をしない。
</details>

### Q3. オンプレの PostgreSQL を RDS / Aurora PostgreSQL へ移行したい（同じエンジン）。どうする？
<details><summary>答え</summary>
DMS の同種データ移行（サーバーレス、ネイティブツールでダンプ / 復元）。同種のため SCT は不要（原文に明記されているのは MySQL → Aurora MySQL の例）。
</details>

### Q4. データセンター A のオンプレ DB からデータセンター B のオンプレ DB へ DMS で移行できる？
<details><summary>答え</summary>
できない。DMS はソースとターゲットのどちらか一方が AWS サービス上にある必要がある。
</details>

### Q5. オンプレの NFS / SMB のファイルを S3 / EFS / FSx に継続的に同期したい。どうする？また同一アカウントの AWS ストレージ間ならエージェントは必要？
<details><summary>答え</summary>
DataSync を使う。オンプレ側はエージェント（VM アプライアンス）を配置する。同一アカウントの AWS ストレージサービス間（リージョンをまたぐ場合を含む）はエージェント不要。
</details>

### Q6. VPC・アカウント・リージョン間で移動したい。7R のどれ？また、最も複雑でコストが高い戦略は？
<details><summary>答え</summary>
Relocate（新規ハードウェアもアプリ書き換えも不要で最速）。最も複雑でコストが高いのは Refactor / Re-architect で、大規模移行では推奨されない（まず rehost / relocate / replatform で移し、移行後にモダナイズ）。
</details>

## 未確認
- **DMS**: レプリケーションインスタンスの Multi-AZ、**DMS Serverless**（従来型との違い）、検証（データ検証機能）、LOB の扱い、ソース / ターゲット DB ごとの CDC 要件、**フルロードの並列・大規模テーブルの分割**、**DMS Fleet Advisor**、**Kinesis / Kafka / S3 / Redshift へのターゲット出力**
- **SCT / DMS Schema Conversion**: DMS Schema Conversion の対応エンジンと SCT との機能差、変換できない項目の評価レポート、**SCT のデータ抽出エージェント（Snowball 経由の DWH 移行）**
- **DataSync**: **Basic モードと Enhanced モードの違い**、帯域制御、スケジュール、フィルタ、**タスク実行の検証**、S3 ストレージクラスの指定、**ライセンス / 料金**
- **Snow ファミリー**: Snowcone / Snowmobile の現状、Snowball Edge の容量・台数の細かい仕様、**Data Transfer Terminal** の詳細、**Snowball の料金と転送時間の目安（回線速度から Snow が有利になる分岐）**
- **MGN**: **エージェントのインストール要件、レプリケーションサーバーの構成、ステージング領域のコスト、cutover の詳細、ネットワーク要件（TCP 1500 など）**、**VMware 環境向けのエージェントレスレプリケーション**
- **その他の移行サービス**: **AWS Transfer Family**、**Migration Hub / Application Discovery Service / Migration Evaluator**、**AWS Transform（メインフレーム / .NET / VMware）**、**Mainframe Modernization**、**App2Container**、**VMware Cloud on AWS / Amazon EVS**、**Server Migration Service（終了済み）**、**CloudEndure**、**VM Import/Export**、**DMS を使わない DB 移行（ネイティブのバックアップ、Aurora リードレプリカ）**、**ポートフォリオ評価・移行計画（MAP、Migration Acceleration Program）**

## 疑問・確認したい点

