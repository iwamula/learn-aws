# Week4-17: SQS / SNS / EventBridge / Step Functions / API Gateway（メッセージングと疎結合）

出典（2026-09-26 に aws-mcp の search_documentation と curl で原文を確認）: SQS Developer Guide「Create queue」「Amazon SQS message quotas」「Visibility timeout」「Short and long polling」「Configure a dead-letter queue」「FIFO 排他的処理」「Moving from a standard queue to a FIFO queue」「Message retention period」、SNS Developer Guide「FIFO topics のメッセージ配信 / フィルタリング」「Message filtering」「Dead-letter queues」、Step Functions Developer Guide「Choosing workflow type」「Service integration patterns」「Distributed Map」、API Gateway Developer Guide「Choose between REST APIs and HTTP APIs」「Caching」「Throttling」「Quotas」、API Gateway FAQ、EventBridge User Guide「What is EventBridge」「Archive and replay」「Pipes」、EventBridge Scheduler「What is」、re:Post「クロスアカウントターゲット」、AWS Compute Blog（EventBridge クロスリージョン、SQS Well-Architected）

## 選定の早見表
| 要件 | 選択 |
|---|---|
| 非同期のバッファ、ワーカーの負荷平準化、疎結合 | **SQS** |
| 順序保証 + 重複排除が必要なキュー | **SQS FIFO** |
| 1 つのメッセージを複数の購読者へ配信（ファンアウト） | **SNS**（+ SQS 購読） |
| ルールでイベントを振り分け、AWS サービス / SaaS / 別アカウントへ連携 | **EventBridge** |
| 送信元と送信先を 1 対 1 で結び、フィルタ・加工したい | **EventBridge Pipes** |
| cron / 1 回限りのスケジュール実行 | **EventBridge Scheduler** |
| 複数ステップの処理を順序・分岐・リトライ付きで制御 | **Step Functions** |
| 長時間（最大 1 年）、非冪等な処理（決済など） | **Step Functions Standard** |
| 大量・短時間（5 分以内）、冪等な処理 | **Step Functions Express** |
| HTTP API を公開（API キー、使用量プラン、WAF、プライベート API が必要） | **API Gateway REST API** |
| 低料金・低遅延の Lambda / HTTP プロキシ（JWT 認証で足りる） | **API Gateway HTTP API** |
| 双方向のリアルタイム通信 | **API Gateway WebSocket API** |

## SQS
- **標準キュー**: ほぼ無制限のスループット。**少なくとも 1 回**配信（重複あり）、**順序は保証しない**
- **FIFO キュー**: 順序保持、**重複なし**（5 分の重複排除間隔内）。スループットは標準より低い。**バッチなしで 300 TPS / API メソッド、バッチ（10 件）ありで 3,000 メッセージ/秒**（ハイスループットモードで引き上げ可。リージョン別の上限は「未確認」欄の裏取り結果を参照）
  - **メッセージグループ ID**（グループ内で順序保持、グループ間は並列処理）は必須。**細かい粒度のビジネス単位**にするほどスケールする
  - **重複排除 ID**、またはコンテンツベースの重複排除を使う
  - **既存の標準キューを FIFO に変換することはできない**（作り直す）。FIFO は**メッセージ単位の遅延不可、キュー単位の遅延のみ**
- **可視性タイムアウト**: **既定 30 秒、最大 12 時間**。処理中のメッセージを他のコンシューマーから隠す。処理が長い場合は延長（ChangeMessageVisibility）
- **ロングポーリング**: 最大待機 **20 秒**。空レスポンスを減らしコスト削減。**ショートポーリングが既定**（ReceiveMessageWaitTimeSeconds か WaitTimeSeconds で有効化）
- **保持期間**: **既定 4 日、60 秒〜14 日**
- **メッセージサイズ**: 最大 **1,048,576 バイト（1 MiB）**（大きいデータは S3 に置いて参照する Extended Client Library（Java・Python 版、256 KB〜2 GB）の考え方）。**配信遅延: 既定 0 秒、最大 15 分**
- **デッドレターキュー（DLQ）**: **キュー種別が同じ**（FIFO は FIFO の DLQ、標準は標準の DLQ）。**標準キューは期限が元のエンキュー時刻基準**（DLQ へ移動しても変わらない）なので、DLQ の保持期間は元のキューより長くする（**FIFO は DLQ へ移動するとエンキュー時刻がリセット**される。原文）。DLQ は元のキューと**同一アカウント・同一リージョン**
- 判断: 「順序が重要、重複不可」→ FIFO、「スループット最優先で重複は許容」→ 標準

## SNS
- **標準トピック**: 高スループットのパブリッシュ / サブスクライブ。**メッセージフィルタリング**は購読ごとの**フィルターポリシー**（**メッセージ属性**または**メッセージ本文**のスコープ）。ポリシーがない購読は**全メッセージを受信**。ポリシーの追加・変更は反映まで**最大 15 分**（re:Post）
- **FIFO トピック**: **SQS の標準キュー / FIFO キュー**へ配信できる。**メール・SMS・モバイルプッシュ・HTTP(S) など顧客管理のエンドポイントへは配信できず、購読するとエラー**。FIFO トピックから Lambda へは、**SQS を挟んで**トリガーする。FIFO でも**フィルタリングは標準トピックと同等**
- **SNS + SQS ファンアウト**: 1 メッセージを複数の SQS キューに配信し、それぞれ独立して処理（各購読者が自分のペースで消費、フィルターで振り分け）。**順序 + 重複排除 + ファンアウト**なら「SNS FIFO + SQS FIFO」、コスト重視でベストエフォートの順序なら SQS 標準
- **DLQ**: SNS の購読に SQS の DLQ を設定でき、配信失敗（クライアント / サーバーエラー）のメッセージを保持して分析・再処理できる。FIFO トピックには FIFO キューを使う

## EventBridge
- **イベントバス**（ルールでイベントを受け取り、パターンに一致したものをターゲットへ）は**多対多**のルーティングに向く。新規アプリはカスタムイベントバスを使う（原文: 「Custom Event Bus」と「Custom Event Bus - Classic」の 2 種）
- **アーカイブとリプレイ**: イベントをアーカイブし、**元のイベントバスに再送**できる（障害復旧、新機能のテストなど）
- **クロスアカウント / クロスリージョン**: ルールのターゲットに**別アカウント / 別リージョンのイベントバス**を指定できる。**配信されるイベントは元のイベントと同一**（追加メタデータなし）。CLI で設定する場合は **`events:PutEvents` を許可する IAM ロールを自分で作る**
- **別アカウントの直接ターゲット**: **ルールとターゲットは同一リージョン**。**API Gateway、Kinesis Data Streams、Lambda、SNS、SQS** のみ対象（re:Post）
- **Pipes**: **ソース → 任意のフィルター → 任意の強化（enrichment）→ ターゲット**の**1 対 1**の連携。イベントバスの多対多とは用途が違う
- **Scheduler**: **cron / rate の定期実行**と**1 回限り**の呼び出し。**数百万件**のスケジュール、**270 以上のサービス・6,000 以上の API** を呼び出せる。**フレキシブルタイムウィンドウ**、リトライ上限、失敗時の最大保持時間を設定できる
- SNS との使い分け: SNS は**シンプルなファンアウト**（高スループット）、EventBridge は**内容ベースのルーティング、SaaS / AWS サービスのイベント、スキーマ、アーカイブ**（上限の比較は「未確認」欄の裏取り結果を参照: SNS はメッセージ 256 KiB、EventBridge は PutEvents のリクエスト合計 1 MB 未満・ルールあたりターゲット 5）

## Step Functions
| | Standard | Express |
|---|---|---|
| 最大実行時間 | **1 年** | **5 分** |
| 実行モデル | **exactly-once**（Retry を指定しない限り 1 回だけ） | **at-least-once**（非同期）。原文の Well-Architected では同期は **at-most-once** |
| 向く処理 | **非冪等**（EMR 起動、決済） | **冪等**（DynamoDB への PUT など）、IoT 取り込み、ストリーム処理、モバイルバックエンド |
| 課金 | **状態遷移数** | **実行数・実行時間・メモリ** |
| 履歴 | サービス内（完了後 **90 日**、API で取得） | CloudWatch Logs |
| 統合パターン | リクエスト/レスポンス、**.sync（ジョブ完了待ち）**、**.waitForTaskToken（コールバック）** | **リクエスト/レスポンスのみ** |
| 開始レート（ブログの数値） | 2,000 超/秒 | 100,000 超/秒 |

- **ワークフロータイプは作成後に変更できない**
- 状態遷移課金なので、**ポーリングのループより .sync やコールバックの方が遷移数を減らしコストが下がる**（Well-Architected）
- **分散マップ（Distributed Map）**: S3 の大量データ（JSON / CSV / オブジェクト一覧）を**子ワークフロー実行**で大規模並列処理する。子実行はそれぞれ**独立した実行履歴**を持つ
- 起動元: API Gateway、IoT ルール、EventBridge の 140 以上のイベントソースなど

## API Gateway
- **API の種類**: **REST**（エンドポイント 3 種: エッジ最適化 / リージョン / プライベート）、**HTTP**（REST の軽量な機能サブセット。自動デプロイと CORS 対応）、**WebSocket**（双方向。**プライベートエンドポイントなし**、VPC リンクによるプライベート統合は可）
- **REST と HTTP の選択**: HTTP API は**低価格**。**API キー、クライアント単位のスロットリング、リクエスト検証、AWS WAF 統合、プライベート API エンドポイントが必要なら REST**。**キャッシュ、カナリアリリース**も REST の機能。認証は HTTP が **JWT オーソライザー**（Cognito 対応）、REST は Lambda オーソライザー等で JWT を検証
- **エンドポイント**:
  - **エッジ最適化**（REST のデフォルト）: CloudFront 経由で分散クライアント向け。**同一リージョンのサービスがクライアントの場合や、CloudFront のキャッシュを細かく制御したい場合は不向き**
  - **リージョン**（HTTP / WebSocket のデフォルト）: 同一リージョンのクライアント、または**自分で管理する CloudFront のオリジン**にする場合
  - **プライベート**: **VPC 内から、インターフェイス VPC エンドポイント経由のみ**
- **キャッシュ（REST）**: **TTL 既定 300 秒、最大 3,600 秒、0 で無効**。**ベストエフォート**。キャッシュサイズの例に 0.5 GB
- **スロットリング**: **アカウント単位（リージョンごと）**、ステージ / メソッド単位、**使用量プラン**（クライアント単位）。上限を超えると **429 Too Many Requests**。スロットルとクォータは**ベストエフォート**。**アカウント上限は 10,000 RPS、バーストのバケット容量 5,000**（原文の記述。値は変わりうる）
- 統合: HTTP API のプライベート統合は **ALB、NLB、AWS Cloud Map**

## 判断ポイント
- 「リクエストの急増を吸収して、バックエンドの処理は一定ペース」→ **SQS**（前段に API Gateway / SNS）
- 「注文処理は順序保持、重複不可」→ **SQS FIFO**（メッセージグループ ID に注文 ID など）
- 「1 つのイベントを在庫・配送・分析の 3 システムへ、それぞれ独立に処理」→ **SNS + SQS ファンアウト**
- 「SNS FIFO からメールや HTTP エンドポイントへ」→ **不可**（SQS を経由）
- 「処理に失敗し続けるメッセージを隔離して調査」→ **DLQ**（種別を合わせる。保持期間は元より長く）
- 「処理に時間がかかり、途中で別のコンシューマーに重複処理されてしまう」→ **可視性タイムアウトを延長**
- 「SQS を空ポーリングするコストを削減」→ **ロングポーリング（最大 20 秒）**
- 「SaaS / AWS サービスのイベントを内容で振り分けて別アカウントへ」→ **EventBridge（クロスアカウントのイベントバス）**
- 「過去のイベントを再送して不具合を再現」→ **EventBridge アーカイブ + リプレイ**
- 「決済や EMR 起動を含む、最大数日〜数か月の承認フロー」→ **Step Functions Standard**（.waitForTaskToken）
- 「IoT からの大量イベントを 5 分以内に変換して DynamoDB へ」→ **Step Functions Express**（冪等にする）
- 「API キーとクライアントごとのレート制限で API を外部提供」→ **REST API + 使用量プラン**
- 「Lambda を低コストで公開、JWT 認証」→ **HTTP API**
- 「VPC 内のクライアントだけが呼べる API」→ **REST API のプライベートエンドポイント**
- 「同一リージョンの内部サービスからの呼び出し」→ **リージョンエンドポイント**（エッジ最適化は不向き）

## Q&A（答えを隠して考えてから確認）
### Q1. 注文処理で順序を保持し、重複も許したくない。スループットは標準キューより低くてよい。どうする？
<details><summary>答え</summary>
SQS FIFO キュー。メッセージグループ ID（注文 ID など細かい粒度）で順序を保ち、重複排除 ID またはコンテンツベースの重複排除を使う。バッチなしで 300 TPS / API メソッド、バッチありで 3,000 メッセージ/秒。既存の標準キューは FIFO に変換できないので作り直す。
</details>

### Q2. 1 つのイベントを在庫・配送・分析の 3 システムへ、それぞれ独立したペースで処理したい。どうする？
<details><summary>答え</summary>
SNS + SQS ファンアウト。1 メッセージを複数の SQS キューに配信し、各購読者が自分のペースで消費する。フィルターポリシーで振り分けもできる。
</details>

### Q3. SNS FIFO トピックからメールと HTTP エンドポイントへ配信したい。可能？
<details><summary>答え</summary>
不可。FIFO トピックが配信できるのは SQS のキューのみで、メール・SMS・HTTP(S) などは購読するとエラーになる。Lambda は SQS を挟んでトリガーする。
</details>

### Q4. SQS の処理に時間がかかり、途中で別のコンシューマーに重複処理されてしまう。どうする？ また空ポーリングのコストも下げたい。
<details><summary>答え</summary>
可視性タイムアウトを延長する（既定 30 秒、最大 12 時間。ChangeMessageVisibility でも延長できる）。空ポーリングにはロングポーリング（最大待機 20 秒）を使う。
</details>

### Q5. 処理に失敗し続けるメッセージを隔離して調査したい。DLQ の注意点は？
<details><summary>答え</summary>
DLQ を設定する。キュー種別は元のキューと同じにする（FIFO は FIFO、標準は標準）。期限は元のエンキュー時刻基準なので、DLQ の保持期間は元のキューより長くする。
</details>

### Q6. 決済や EMR 起動を含む、数日〜数か月かかる承認フローを作りたい。一方、IoT の大量イベントを 5 分以内に変換して DynamoDB に入れる処理もある。それぞれ何を使う？
<details><summary>答え</summary>
前者は Step Functions Standard（最大 1 年、exactly-once、.waitForTaskToken のコールバックが使える）。後者は Express（最大 5 分、非同期実行は at-least-once なので冪等にする）。ワークフロータイプは作成後に変更できない。
</details>

## 未確認
- **SQS**: SSE-SQS 単体の料金の明記（SSE の料金は 2026-09-26 に FAQ で裏取り済み。In-flight 上限・メッセージサイズ・可視性タイムアウト・拡張クライアントも裏取り済み: 下記）
  - **SQS Extended Client Library（原文、2026-09-26 裏取り。SQS Developer Guide「Managing large Amazon SQS messages with Extended Client Library and Amazon S3」）**: **256 KB〜2 GB** のペイロードを扱うため、本文を **S3 バケットに保存し、S3 オブジェクトへの参照だけを SQS メッセージで送る**。**標準キュー・FIFO キューの両方に対応**。Java 版と Python 版のライブラリがある。「常に S3 に保存」か「256 KB 超のときだけ S3 に保存」を選べ、S3 からの取得・削除もライブラリが行う。Java 版のページには「**S3 での大きなメッセージ管理は AWS SDK for Java でのみ可能で、AWS CLI・SQS コンソール・SQS HTTP API・他の SDK では不可**」とあるが、親ページは Python 版も挙げていて記述が食い違う（Python 版の詳細は未確認）。Java ページのコード説明に「標準の最大 256 KB」とあり、現行の SQS 上限 1 MiB との関係は原文から断定できず未確認
  - **SQS の DLQ とリドライブ（原文、2026-09-26 裏取り）**: redrive policy の **maxReceiveCount** 回受信されても削除されないと DLQ へ移動（低すぎると 1 回の失敗で移動するので、十分なリトライ回数にする）。**redrive allow policy** で DLQ を使える元キューを制御（既定は全許可、byQueue で最大 10 キュー、denyAll で DLQ として使用不可）。**DLQ リドライブ**は DLQ から**元のキュー（既定）または同種の任意のキュー**へメッセージを戻す機能で、API は StartMessageMoveTask / ListMessageMoveTasks / CancelMessageMoveTask（キャンセルは RUNNING のときのみ）。速度は「システム最適化」か**最大 500 メッセージ/秒**のカスタム。**メッセージのフィルタ・変更は不可**、タスクは**最大 36 時間**、アカウントあたり**アクティブなタスク 100 まで**。リドライブで戻したメッセージは**新しい messageID / enqueueTime になり保持期間がリセット**。FIFO → FIFO DLQ 移動時は重複排除 ID が元のメッセージ ID に置き換わる。FIFO の順序を崩したくない場合は FIFO で DLQ を使わない
  - **SQS FIFO ハイスループットモード（原文、2026-09-26 裏取り）**: 通常モードは 1 API アクションあたり 300 TPS、バッチ（10 件）で 3,000 メッセージ/秒。ハイスループットモードは新規・既存の FIFO キューで有効化でき、**重複排除スコープ＝メッセージグループ単位（Message group）、FIFO スループット上限＝メッセージグループ ID 単位（Per message group ID）**が必須設定（変更すると通常スループットに戻る）。**リージョン別の上限（バッチなし TPS / バッチありメッセージ/秒）**: 米国東部（バージニア北部）・米国西部（オレゴン）・欧州（アイルランド）は 70,000 / 700,000、米国東部（オハイオ）・欧州（フランクフルト）は 19,000 / 190,000、アジアパシフィック（東京）・欧州（スペイン）は 9,000 / 90,000、その他は 2,400 / 24,000。スループットを上げるにはメッセージグループ数を増やす（各パーティションは 3,000 メッセージ/秒（バッチ）または 300 メッセージ/秒）。パーティションは自動管理。数値は原文時点のもので変わりうる
  - **SQS と Lambda のイベントソースマッピング（原文、2026-09-26 裏取り）**: 標準・FIFO の両方に対応。**関数とキューは同一リージョン（別アカウントは可）**。**バッチサイズは標準で最大 10,000、FIFO は最大 10**。10 を超えるなら**バッチウィンドウ（MaximumBatchingWindowInSeconds）を 1 秒以上**にする必要があり、ウィンドウは**標準キューのみ**。**関数タイムアウト ≦ キューの可視性タイムアウト**（超えると ESM の作成・更新がエラー）。推奨は**可視性タイムアウト ＝ 関数タイムアウトの 6 倍 ＋ バッチウィンドウ**（スロットリング時のリトライ分）。既定ではバッチ内でエラーが出ると**成功したメッセージも含めバッチ全体**が可視性タイムアウト後に再表示されるため、処理は**冪等**にする（at-least-once）。**部分バッチ応答**は FunctionResponseTypes に **ReportBatchItemFailures** を指定し、失敗した messageId を batchItemFailures で返す（例外を投げるとバッチ全体が失敗扱い）。有効時は失敗があってもポーリングを絞らない。FIFO では**最初の失敗で処理を止め、失敗分と未処理分をすべて返す**（順序維持）。**最大同時実行（Maximum concurrency）でイベントソース単位の同時実行数を制限**でき、**プロビジョンドモードとは併用不可**（プロビジョンドモードはイベントポーラー数で制御。最小 2〜200・最大は原文で「2〜2,000」と「2〜10,000」の 2 ページで食い違い、最大 100,000 同時実行・1 分あたり最大 1,000 追加、と説明される。数値は未確定）。関数に**予約同時実行を設定する場合は最低 5** を推奨（理由の続きは原文の抜粋では未確認）
  - **SQS の暗号化 SSE（原文、2026-09-26 裏取り。SQS Developer Guide「Encryption at rest」「Key management」）**: SSE は **SQS 管理キー（SSE-SQS）** か **KMS のキー（SSE-KMS）** でメッセージ**本文**を暗号化する。**キュー名・属性、メッセージのメタデータ（ID・タイムスタンプ・属性）、キュー単位のメトリクスは暗号化されない**。SSE 有効のキューへのリクエストは **HTTPS と Signature Version 4 が必須**で、匿名の SendMessage / ReceiveMessage は拒否される。**暗号化されるのは有効化後に送信されたメッセージのみ**（バックログは暗号化されない）、無効化しても既存の暗号化メッセージは暗号化のまま。DLQ への移動では暗号化状態は変わらない（暗号化ソース→非暗号化 DLQ は暗号化のまま、非暗号化ソース→暗号化 DLQ は非暗号化のまま）。**既定の AWS マネージドキー（alias/aws/sqs）で暗号化したキューは、別アカウントの Lambda 関数を呼び出せない**（クロスアカウントはカスタマー管理キーが必要）。**AWS マネージドキーのキーポリシーは変更不可**。S3 イベント通知・EventBridge（events）・SNS サブスクリプションなどのイベントソースから暗号化キューへ送るには、**カスタマー管理キーを作り、キーポリシーでそのサービスプリンシパルに kms:Decrypt と kms:GenerateDataKey を許可**する（混乱した代理対策に aws:SourceArn / aws:SourceAccount を使える）。**プロデューサーは kms:Decrypt と kms:GenerateDataKey、コンシューマーは kms:Decrypt** の権限が必要（DLQ のコンシューマーは、ソースキューの暗号化に使った KMS キーへの kms:Decrypt も必要）。**データキー再利用期間は 60 秒〜24 時間、既定 5 分**（短いほど安全だが KMS 呼び出しが増え課金される）。KMS 呼び出し数の目安は R = (B / D) × (2P + C)（B=請求期間の秒数、D=再利用期間、P=プロデューサー数、C=コンシューマー数）。KMS キーを変更しても既存メッセージは旧キーで暗号化されたままなので、処理し終えるまで旧キーを削除・無効化しない。**エンベロープ暗号化**（KMS キーでデータキーを暗号化し、暗号化データキーをメッセージと一緒に保存）。KMS の追加料金あり（原文の Important 注記）。**SSE は新規作成キューで既定で有効**（原文: SQS console「Configuring SSE-SQS for a queue」ページに「server-side encryption (SSE) enabled by default for all newly created queues」）。SSE の SQS 側の料金は、SQS FAQ 原文（aws.amazon.com/sqs/faqs/「Are there any charges for using SSE with Amazon SQS?」、2026-09-26 裏取り）で「追加の SQS 料金はない。ただし SQS から AWS KMS への呼び出しには課金される（KMS の料金はデータキー再利用期間に依存）」。FAQ は SSE-SQS と SSE-KMS を区別せず「SSE」と書いているため、SSE-SQS 単体の料金の明記は未確認（Developer Guide の SSE 関連ページと SQS 料金ページの本文にも SSE-SQS の記載は見つからず）
  - **SQS のクロスアカウントアクセス（原文、2026-09-26 裏取り。SQS Developer Guide「Overview of managing access」「Basic examples of Amazon SQS policies」）**: 別アカウントからキューを使わせるには**キューのアクセスポリシー（リソースベースポリシー）でクロスアカウントのプリンシパルを許可する**必要があり、**IAM のアイデンティティベースポリシーだけでは不十分**（原文）。ポリシー例では Principal にアカウント ID（複数指定可）やロールを指定し、Action は sqs:SendMessage / sqs:ReceiveMessage など、Resource はキュー ARN。ロール経由の場合は、キュー所有アカウント（A）でキューポリシーにアカウント B のプリンシパルを許可し、A に信頼ポリシー付きのロールを作り、B 側でそのロールを引き受ける権限を与える。**クロスアカウント権限が使えないアクション**: AddPermission、CancelMessageMoveTask、CreateQueue、DeleteQueue、ListMessageMoveTask、ListQueues、ListQueueTags、RemovePermission、SetQueueAttributes、StartMessageMoveTask、TagQueue、UntagQueue（キューを所有する同じアカウントのユーザーのみ）。暗号化キューの場合は上の SSE の記述のとおりカスタマー管理キーが別途必要
  - **SQS の主な上限（原文）**: In-flight メッセージは標準キューで**約 120,000**（トラフィックとバックログに依存）、FIFO は **120,000**。標準でショートポーリング中に上限に達すると **OverLimit エラー**、ロングポーリングならエラーなし。FIFO は上限到達でもエラーは返らないが処理に影響しうる。どちらも Support への申請で引き上げ可。処理後に削除する、キュー数を増やすことで回避。メッセージサイズは **1 バイト〜1 MiB（1,048,576 バイト）**、それ超は Extended Client Library（Java）。可視性タイムアウトは**既定 30 秒、0 秒〜12 時間**。ロングポーリングの最大待機は **20 秒**
- **SNS**: 配信リトライポリシー、メッセージ配信の暗号化、**メッセージ保持・アーカイブ（FIFO）**、料金
  - **SNS と EventBridge の上限比較（原文、2026-09-26 裏取り。General Reference「Amazon SNS endpoints and quotas」「Amazon EventBridge endpoints and quotas」、EventBridge User Guide「Sending events with PutEvents」）**: SNS は**メッセージ最大 256 KiB（262,144 バイト）**で、超える場合は SNS Extended Client Libraries（ペイロード最大 2 GB）。**標準トピックは購読 12,500,000 件/トピック・トピック 100,000 件/アカウント、FIFO トピックは購読 100 件/トピック・トピック 1,000 件/アカウント**。**PublishBatch は 1 リクエスト最大 10 メッセージ**。Publish のスロットリングは Publish と PublishBatch を合わせたメッセージ数/秒/アカウント/リージョンで、us-east-1 は標準・FIFO とも 30,000 メッセージ/秒（ソフトリミット、リージョンにより 9,000 など）。FIFO は**メッセージグループあたり 300 メッセージ/秒**、FifoThroughputScope が Topic のときトピックあたり既定 3,000 メッセージ/秒または 20 MB/秒の早い方。EventBridge は **PutEvents が 1 リクエスト最大 10 エントリ、リクエスト合計が 1 MB（1,048,576 バイト）未満**（エントリ単位ではなくリクエスト全体の上限で、1 件だけなら 1 MB まで使える）。**ルールあたりターゲットは 5（引き上げ不可）**、**バスあたりルールは既定 300（一部リージョンは 100）**、イベントパターンは 2,048 文字、イベントバスは 100/リージョン。PutEvents のスロットリングは us-east-1・us-west-2 で 10,000/秒、他リージョンは 400〜2,400/秒（リージョン別）。試験では「大きなペイロードは S3 参照（Extended Client）」「EventBridge は 1 リクエスト 1 MB 未満」「ファンアウトの規模は SNS（標準トピックは購読 1,250 万）」と押さえる。AWS サービス由来のイベントのサイズ上限、SNS FIFO の全リージョン別スループットは未確認
- **EventBridge**: イベントパターンの記法、**スキーマレジストリ**、**API Destinations**、ターゲットの DLQ とリトライ、**グローバルエンドポイント（イベントバスのリージョンフェイルオーバー）**、バスのリソースポリシーの書き方
- **Step Functions**: **Retry / Catch の記法**、Map の同時実行数、Express の同期実行（API Gateway 経由）、**Distributed Map の上限**、Standard の開始レートやクォータの公式値（ブログの数値を採用）、**Express の履歴が CloudWatch Logs になる詳細**
- **API Gateway**: **統合タイムアウト（29 秒の既定と引き上げ）**、ペイロード上限、**Lambda オーソライザーのキャッシュ**、Cognito オーソライザー、**リソースポリシーによるクロスアカウント / IP 制限**、**カスタムドメインと ACM（エッジ最適化は us-east-1）**、**ステージ変数、カナリア**、**HTTP API のスロットリング**、CloudFront / WAF との組み合わせ、mTLS

