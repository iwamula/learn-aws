# Week2-8: Multi-AZ / Multi-Region と DR 4パターン

出典: AWS ホワイトペーパー「Disaster Recovery of Workloads on AWS」の "Disaster recovery options in the cloud"（2026-09-25 に原文を curl で確認）

## まず「何の災害か」で分ける
- データセンター1つの障害（AZ 障害）: Multi-AZ で設計済みなら、DR は **Backup & Restore で足りる場合がある**
- リージョン全体の障害、または規制要件がある: **Pilot Light / Warm Standby / Multi-site Active/Active**
- データ破損・誤削除・アカウント侵害: レプリケーションだけでは防げない（破損も複製される）→ **バージョニングや PITR、別アカウントへのバックアップが必要**

## 4パターン（コストと複雑さは上から下に増え、復旧時間は短くなる）
| パターン | DR リージョンの状態 | 復旧時に必要な作業 |
|---|---|---|
| Backup & Restore | データのバックアップのみ（インフラは未構築） | インフラ（IaC）・設定・コードを再デプロイし、バックアップをリストア |
| Pilot Light | データは常時レプリケーション。DB などの中核は稼働、アプリサーバーは「停止（未デプロイ）」 | アプリサーバーを起動（switch on）してスケールアウト。**このままではリクエストを処理できない** |
| Warm Standby | 縮小版だが**完全に動く**環境が常時稼働 | スケールアップのみ。縮小した状態でも即座にトラフィックを処理できる |
| Multi-site Active/Active | 全リージョンが同時にトラフィックを処理 | フェイルオーバーという概念がない（トラフィックを外すだけ）。復旧時間はほぼゼロにできる |

- Pilot Light と Warm Standby の違い: **リクエストを追加作業なしで処理できるか**。Pilot Light は起動・追加デプロイが要る、Warm Standby は拡張だけ
- Hot Standby: Active/Passive で、DR 側が**本番全負荷を処理できる容量**を持つが、トラフィックは受けない。Auto Scaling（コントロールプレーン操作）への依存をなくせる。フル環境を立てるなら Active/Active にする顧客が多く、Active/Active にしないなら Warm Standby の方が経済的で運用も単純
- Active/Active でもデータ破損は別問題: バックアップからの復旧が必要で、**RPO は 0 にならない**
- RTO/RPO の具体的な数値（分・時間の目安）は図のみで、原文テキストにはない。**数値は未確認**として、試験では順序（B&R が最長 → Active/Active が最短）で判断する

## 各パターンで使うサービス
- **Backup & Restore**: EBS/RDS/Aurora/DynamoDB/EFS/FSx などのスナップショット、**AWS Backup**（リージョン間・アカウント間コピー、集中管理）、AMI のリージョン間コピー、CloudFormation/CDK による再デプロイ
  - AWS Backup のクロスアカウントコピーは、内部脅威やアカウント侵害への対策になる
  - AWS Backup は自動・スケジュールでの**リストアはできない**。SDK で API を呼んで実装する（SNS + Lambda など）。リストアはコントロールプレーン操作なので、定期的にリストアしておくと災害時に使えないリスクを減らせる
  - EC2 バックアップのメタデータ（インスタンスタイプ、VPC、SG、IAM ロールなど）は**同一リージョンへのリストア時のみ**使われる
  - S3: バージョニング + CRR。既定ではソースで削除しても**削除マーカーはソース側にだけ付き、DR 側には複製されない**ので、悪意ある削除から DR 側を守れる
- **Pilot Light**: 上記に加え、継続的な**非同期**リージョン間レプリケーション: S3 レプリケーション、RDS リードレプリカ、Aurora Global Database、DynamoDB グローバルテーブル、DocumentDB グローバルクラスター、ElastiCache（Redis OSS）Global Datastore（詳細は 09）
  - RDS（Aurora 以外）のリードレプリカ昇格は数分かかり、再起動を伴う。Aurora Global Database はセカンダリの昇格が通常**数分**（Aurora User Guide。DR ホワイトペーパーは「1 分未満」と記載）、レプリケーション遅延は通常 1 秒未満
  - AMI は EC2 Image Builder でパイプライン化して、プライマリと DR の両リージョンにコピーする
  - CloudFormation は擬似パラメータと Conditions で、DR リージョンには縮小版だけをデプロイできる。リージョンごとに別アカウントにするのが最も分離が強い（推奨）
- **Warm Standby**: Auto Scaling で DR リージョンを本番容量までスケールアウト（EC2 の希望容量を上げる）。DR リージョンの**サービスクォータ**を事前に引き上げておく
- **Multi-site Active/Active**: 書き込み戦略が論点になる（下記）

## 書き込み戦略（Active/Active）
| 戦略 | 内容 | 向くサービス |
|---|---|---|
| write global | 書き込みは1リージョンに集約。障害時に別リージョンを昇格。読み取りは近いリージョン（read local） | Aurora Global Database（書き込み転送にも対応） |
| write local | 書き込みも最寄りリージョン。同時更新は **last writer wins** | DynamoDB グローバルテーブル |
| write partitioned | パーティションキー（ユーザー ID など）でリージョンを固定し、書き込みの競合を避ける | S3 の双方向レプリケーション（現状 2 リージョン間。両バケットで**レプリカ変更の同期**を有効にする） |

## フェイルオーバーとトラフィック制御
- 自動フェイルオーバーは**誤検知でも切り替わる**ため注意が必要で、手動起動（手順は自動化してボタン1つにする）もよく使われる
- **データプレーン操作を使う**: 障害時はコントロールプレーン（設定変更 API）が使えない可能性があるため、フェイルオーバーはデータプレーンだけで完結させる方が堅牢
- **Route 53 ヘルスチェック + DNS フェイルオーバー**: 自動、データプレーン操作
- **Application Recovery Controller（ARC）**: 「ヘルスチェックの形をしたオン/オフのスイッチ」（ルーティングコントロール）を作り、CLI/SDK（高可用なデータプレーン API）で切り替える手動フェイルオーバー
- **加重ルーティングの重みを変更する**方法もあるが、**コントロールプレーン操作**なので ARC より耐障害性が低い
- **Global Accelerator**: Anycast の静的 IP で複数リージョンのエンドポイントに振り分け、ヘルスチェックで自動切り替え。手動はトラフィックダイヤル（**コントロールプレーン操作**）。DNS キャッシュの問題を避けられ、AWS エッジ経由で低レイテンシ
- **CloudFront オリジンフェイルオーバー**: リクエスト単位で、プライマリが失敗したときだけセカンダリに送る。**以降のリクエストもまずプライマリに行く**（Route 53 のような切り替えではない）
- Active/Active の振り分け: Route 53（割合指定の加重、地理的近接性、レイテンシーなど）、Global Accelerator（トラフィックダイヤルで割合を指定）

## AWS Elastic Disaster Recovery（DRS）
- サーバー（オンプレミス、他クラウド、EC2）を**ブロックレベルで継続レプリケーション**し、AWS のリージョンを DR 先にする。**Pilot Light** 戦略を実装したもの
- レプリケーション先のステージング用 VPC に、データのコピーと「停止中」のリソースを維持し、フェイルオーバー時にフルキャパシティの環境を自動で作る
- AWS 上の DR にも使えるが、対象は **EC2 上のアプリ・DB のみ（RDS は対象外）**
- 「オンプレのサーバーを丸ごと、低コストで AWS に DR」→ DRS

## その他
- **AWS Resilience Hub**: ワークロードの耐障害性を継続的に検証し、RTO/RPO 目標を満たせそうか追跡する
- DR は**定期的にテストする**。バックアップのリストアテストも必須
- CloudFormation **StackSets**: 複数アカウント・リージョンへ1回の操作でスタックを展開する（DR 環境の一貫した展開）

## 判断ポイント
- 「コスト最小、RTO は数時間でよい」→ Backup & Restore
- 「DB は常時同期しておき、障害時にアプリを起動。コストを抑えたい」→ Pilot Light
- 「縮小版でも即座に処理を継続したい、RTO は短く」→ Warm Standby
- 「RTO/RPO をほぼ 0 にしたい、コストと複雑さは許容」→ Multi-site Active/Active
- 「オンプレのサーバーを AWS に DR」→ Elastic Disaster Recovery
- 「リージョン障害時、コントロールプレーンに依存せずに切り替えたい」→ Route 53 ヘルスチェック/ARC（データプレーン）。加重の変更やトラフィックダイヤルはコントロールプレーン
- 「DNS キャッシュに影響されずに、静的 IP のままフェイルオーバー」→ Global Accelerator
- 「S3 の誤削除・悪意ある削除から DR 側を守る」→ バージョニング + CRR（削除マーカーは既定で複製されない）、AWS Backup のクロスアカウントコピー
- 「Aurora で分単位の RTO・秒単位の RPO、リージョン障害対応」→ Aurora Global Database（RDS リードレプリカは数分）
- 「同時書き込みを許容するマルチリージョン」→ DynamoDB グローバルテーブル（last writer wins）

## Q&A（答えを隠して考えてから確認）
### Q1. リージョン障害に備えた DR で、DR リージョンには DB を常時レプリケーションし、アプリサーバーは障害時に起動したい。コストは抑えたい。どのパターン？
<details><summary>答え</summary>
Pilot Light。中核（DB）は稼働、アプリサーバーは未デプロイ・停止で、起動してスケールアウトする。このままではリクエストを処理できない点が Warm Standby との違い。
</details>

### Q2. 縮小版でも障害時に即座にリクエストを処理でき、あとはスケールアップだけで済む DR にしたい。どうする？
<details><summary>答え</summary>
Warm Standby。縮小版だが完全に動く環境が常時稼働している。Auto Scaling で本番容量まで拡張し、DR リージョンのサービスクォータも事前に引き上げておく。
</details>

### Q3. リージョン障害時、コントロールプレーンが使えなくても確実にフェイルオーバーしたい。どの方法を選ぶ？
<details><summary>答え</summary>
データプレーン操作を使う。Route 53 ヘルスチェック + DNS フェイルオーバー（自動）か、ARC のルーティングコントロール（手動）。加重ルーティングの重み変更や Global Accelerator のトラフィックダイヤルはコントロールプレーン操作なので耐障害性が低い。
</details>

### Q4. S3 を CRR で DR リージョンに複製している。ソース側で悪意ある削除をされても DR 側を守りたい。どうする？
<details><summary>答え</summary>
バージョニング + CRR。既定では削除マーカーはソース側にだけ付き、DR 側には複製されない。AWS Backup のクロスアカウントコピーも有効。
</details>

### Q5. オンプレミスのサーバーを丸ごと低コストで AWS に DR したい。どうする？
<details><summary>答え</summary>
AWS Elastic Disaster Recovery（DRS）。ブロックレベルで継続レプリケーションする Pilot Light 型。対象は EC2 上のアプリ・DB で、RDS は対象外。
</details>

### Q6. Active/Active 構成なら RPO は 0 になる？
<details><summary>答え</summary>
ならない。データ破損は別問題で、バックアップからの復旧が必要。レプリケーションは破損も複製する。
</details>

## 未確認
- 各パターンの RTO/RPO の目安（分・時間の数値）
- Route 53 フェイルオーバーレコード（Primary/Secondary、Evaluate Target Health）の詳細
- ARC のルーティングコントロール/準備状況チェックの詳細（コントロールプレーンのクラスターが5リージョン冗長という点など）

