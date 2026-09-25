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
- **FIFO キュー**: 順序保持、**重複なし**（5 分の重複排除間隔内）。スループットは標準より低い。**バッチなしで 300 TPS / API メソッド、バッチ（10 件）ありで 3,000 メッセージ/秒**（ハイスループットモードで引き上げ可）
  - **メッセージグループ ID**（グループ内で順序保持、グループ間は並列処理）は必須。**細かい粒度のビジネス単位**にするほどスケールする
  - **重複排除 ID**、またはコンテンツベースの重複排除を使う
  - **既存の標準キューを FIFO に変換することはできない**（作り直す）。FIFO は**メッセージ単位の遅延不可、キュー単位の遅延のみ**
- **可視性タイムアウト**: **既定 30 秒、最大 12 時間**。処理中のメッセージを他のコンシューマーから隠す。処理が長い場合は延長（ChangeMessageVisibility）
- **ロングポーリング**: 最大待機 **20 秒**。空レスポンスを減らしコスト削減。**ショートポーリングが既定**（ReceiveMessageWaitTimeSeconds か WaitTimeSeconds で有効化）
- **保持期間**: **既定 4 日、60 秒〜14 日**
- **メッセージサイズ**: 最大 **1,048,576 バイト（1 MiB）**（大きいデータは S3 に置いて参照する拡張クライアントの考え方）。**配信遅延: 既定 0 秒、最大 15 分**
- **デッドレターキュー（DLQ）**: **キュー種別が同じ**（FIFO は FIFO の DLQ、標準は標準の DLQ）。**期限は元のエンキュー時刻基準**なので、DLQ の保持期間は元のキューより長くする
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
- SNS との使い分け: SNS は**シンプルなファンアウト**（高スループット）、EventBridge は**内容ベースのルーティング、SaaS / AWS サービスのイベント、スキーマ、アーカイブ**（SNS / EventBridge の細かい上限の比較は未確認）

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

## 未確認
- **SQS**: Lambda イベントソースマッピングとの連携（バッチ、部分バッチ失敗、最大同時実行、可視性タイムアウトとの関係）、**DLQ リドライブ**、FIFO の**ハイスループットモードの上限数値**、暗号化（SSE-SQS / SSE-KMS）、キューポリシーによるクロスアカウント、**In-flight 上限**、拡張クライアント
- **SNS**: 配信リトライポリシー、メッセージ配信の暗号化、**メッセージ保持・アーカイブ（FIFO）**、SNS と EventBridge の詳細な比較、料金
- **EventBridge**: イベントパターンの記法、**スキーマレジストリ**、**API Destinations**、ターゲットの DLQ とリトライ、**グローバルエンドポイント（イベントバスのリージョンフェイルオーバー）**、バスのリソースポリシーの書き方
- **Step Functions**: **Retry / Catch の記法**、Map の同時実行数、Express の同期実行（API Gateway 経由）、**Distributed Map の上限**、Standard の開始レートやクォータの公式値（ブログの数値を採用）、**Express の履歴が CloudWatch Logs になる詳細**
- **API Gateway**: **統合タイムアウト（29 秒の既定と引き上げ）**、ペイロード上限、**Lambda オーソライザーのキャッシュ**、Cognito オーソライザー、**リソースポリシーによるクロスアカウント / IP 制限**、**カスタムドメインと ACM（エッジ最適化は us-east-1）**、**ステージ変数、カナリア**、**HTTP API のスロットリング**、CloudFront / WAF との組み合わせ、mTLS

## 疑問・確認したい点
