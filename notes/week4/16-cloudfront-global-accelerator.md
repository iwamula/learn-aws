# Week4-16: CloudFront と Global Accelerator（エッジ配信・オリジン保護・フェイルオーバー）

出典（2026-09-26 に aws-mcp の search_documentation / read_documentation で原文を確認）: CloudFront Developer Guide「Restrict access to an Amazon S3 origin」「Restrict access with VPC origins」「Decide to use signed URLs or signed cookies」「Specify signers that can create signed URLs and signed cookies」「Optimize high availability with CloudFront origin failover」「Differences between CloudFront Functions and Lambda@Edge」「Use field-level encryption」「Restrict the geographic distribution of your content」、Global Accelerator Developer Guide「What is AWS Global Accelerator?」「How AWS Global Accelerator works」「Endpoints for standard accelerators」「How endpoint weights work」「Custom routing accelerators」「Preserve client IP addresses」、Global Accelerator FAQs、re:Post「CloudFront に ACM 証明書を関連付ける」、ACM FAQs

## 選定の早見表
| 要件 | 選択 |
|---|---|
| 静的コンテンツ（画像・動画）のキャッシュ、動的コンテンツ / API の高速化（HTTP/HTTPS） | **CloudFront** |
| TCP / UDP（ゲーム、IoT の MQTT、VoIP など）の高速化 | **Global Accelerator** |
| HTTP だが**静的 IP が必須**（FW のホワイトリスト）、または**決定的で高速なリージョンフェイルオーバー** | **Global Accelerator** |
| S3 を CloudFront 経由でのみ公開 | **OAC**（OAI は非推奨） |
| プライベートサブネットの ALB / NLB / EC2 を CloudFront 経由でのみ公開 | **VPC オリジン** |
| 有料会員だけが 1 ファイル / 複数ファイルにアクセス | **署名付き URL / 署名付き Cookie** |
| エッジで軽量な書き換え（リダイレクト、ヘッダー、JWT 検証） | **CloudFront Functions** |
| エッジでボディ参照・外部呼び出し・数ミリ秒以上の処理 | **Lambda@Edge** |
| 特定フィールド（クレジットカード番号など）をエッジで暗号化してアプリ全体で保護 | **フィールドレベル暗号化** |
| 国単位でアクセスを遮断 | **CloudFront の地理的制限** |

## CloudFront と Global Accelerator の違い
- **CloudFront**: キャッシュ可能なコンテンツと動的コンテンツ（API 高速化、動的サイト配信）の両方の性能を改善する
- **Global Accelerator**: **TCP / UDP** のアプリを、**エッジでパケットをプロキシ**して 1 つ以上のリージョンのアプリに届ける。非 HTTP のユースケースに向く。HTTP でも、**静的 IP** や**決定的で高速なリージョンフェイルオーバー**が必要なら向く（FAQ の記述）
- 両方とも **AWS Shield** による DDoS 保護と統合されている
- 原文でキャッシュに触れているのは CloudFront 側のみ（Global Accelerator の説明はパケットのプロキシ）

## CloudFront: S3 オリジンの保護（OAC）
- S3 への認証付きリクエストの方式は **OAC（origin access control）と OAI（origin access identity）**。**OAC を推奨**
- OAC が対応し、OAI が非対応（または回避策が必要）なもの: **2022 年 12 月以降に開始したオプトインリージョンを含むすべてのリージョンの S3**、**SSE-KMS**、**S3 への動的リクエスト（PUT / DELETE）**
- OAC の注意点:
  - **S3 Object Ownership は「Bucket owner enforced」**（新規バケットのデフォルト）が必要。ACL が必要なら「Bucket owner preferred」
  - **S3 を静的ウェブサイトエンドポイントとして設定している場合は、CloudFront のカスタムオリジン扱いになり、OAC（OAI も）は使えない**
  - OAC は **Lambda@Edge によるオリジンのリダイレクトに非対応**
  - S3 Multi-Region Access Point をオリジンにする場合は別の OAC 設定が必要
- OAC の署名は SigV4。設定で「署名しない」「署名する」「Authorization ヘッダーを上書きしない」を選べる（AWS ブログ）

## CloudFront: ALB / EC2 オリジンの保護
- **VPC オリジン**: **プライベートサブネット内の ALB、NLB、EC2 インスタンス**を CloudFront のオリジンにできる。CloudFront が**唯一の入口**になり、CloudFront から VPC オリジンへは**プライベートで安全な接続**。オリジンをパブリックにして ACL などで制限する手間が要らない。**AWS アカウント間の共有**（組織内外を問わず、RAM 経由も可）に対応
- パブリックなオリジンを使う場合: **AWS マネージドのプレフィックスリスト `com.amazonaws.global.cloudfront.origin-facing`** をセキュリティグループのインバウンドルールで参照して、CloudFront のオリジン向け IP からの HTTP/HTTPS だけに絞る（追加費用なし）。全 IP に開放するとオリジンへの直接攻撃で CloudFront の保護を迂回される（AWS ブログ）

## CloudFront: 署名付き URL と署名付き Cookie
- 基本機能は同じ（誰がコンテンツにアクセスできるかを制御）
- **署名付き URL**: **個別のファイル**を制限したいとき（例: インストーラーのダウンロード）。**Cookie に対応しないクライアント**（カスタム HTTP クライアント）
- **署名付き Cookie**: **複数の制限ファイル**へのアクセスを許可したいとき（例: HLS 動画の全ファイル、会員エリア全体）。**現在の URL を変えたくない**とき
- 署名なしの URL に `Expires` / `Policy` / `Signature` / `Key-Pair-Id` / `Hash-Algorithm` のクエリ文字列が含まれていると、署名付き URL と見なされて署名付き Cookie は使えない
- **署名者（signer）は、信頼されたキーグループ（推奨）か、CloudFront キーペアを持つ AWS アカウント**。署名者をキャッシュビヘイビアに追加すると、そのビヘイビアが署名を必須にする。**ビヘイビアごとに署名の要否を変えられる**（パスごとに一部だけ保護）

## CloudFront: オリジンフェイルオーバー（詳細）
- **オリジングループ**（プライマリとセカンダリの 2 オリジン）を作り、キャッシュビヘイビアに割り当てる
- フェイルオーバー条件の**ステータスコードは 400 / 403 / 404 / 416 / 429 / 500 / 502 / 503 / 504 から任意の組み合わせ**で選ぶ。プライマリに接続できないときは **503 を条件にしていた場合**、応答が時間切れのときは **504 を条件にしていた場合**にフェイルオーバーする
- **ビューワーのリクエストが GET / HEAD / OPTIONS のときだけ**フェイルオーバーする。**POST / PUT などはしない**。OPTIONS はキャッシュビヘイビアの「Cached HTTP methods」に含める必要がある
- **常にまずプライマリに送る**。以前のリクエストがセカンダリに切り替わっていても、次のリクエストはプライマリから試す（ステートレス。オリジンの健全性を追跡しない）。そのため即座だが、タイムアウトやエラーを待つ分の遅延が出る
- **デフォルトでプライマリへの接続を最大 30 秒（10 秒 × 3 回）試してから**セカンダリへ切り替える。**接続タイムアウトは 1〜10 秒、接続試行回数は 1〜3 回**に変更できる。ストリーミングなどで速く切り替えたいときに短縮する
- **Lambda@Edge と併用できる**（詳細は原文の該当節。ここでは未確認）
- Route 53 のフェイルオーバー（ヘルスチェックに基づく DNS 切り替え）とは仕組みが違う。組み合わせた構成は AWS ブログにある

## CloudFront: Origin Shield
- エッジロケーション・リージョナルエッジキャッシュの**さらに後ろ（オリジンの手前）に置く追加のキャッシュ層**。全キャッシュ層からオリジンへのリクエストが Origin Shield を通り、同じオブジェクトへのオリジンリクエストを最小 1 つにまとめる。**キャッシュヒット率の向上、オリジン負荷の軽減**が目的（原文）
- **オリジン単位の設定**（ディストリビューション単位ではない）。オリジンごとに別のリージョンを選べる。**追加料金あり**（Origin Shield を通るリクエスト数に対する課金）
- リージョンは**オリジンへのレイテンシーが最小のリージョン**を選ぶ。オリジンが Origin Shield 提供リージョン（13 リージョン: us-east-1/2、us-west-2、ap-south-1、ap-northeast-1/2、ap-southeast-1/2、eu-central-1、eu-west-1/2、sa-east-1、me-central-1）にあるなら**同じリージョン**。ない場合は原文の対応表（例: us-west-1 → us-west-2）に従う。AWS 外（オンプレ）のオリジンにも使える
- 向くケース: 視聴者が地理的に分散、ライブ配信の just-in-time パッケージング / 画像のオンザフライ処理、帯域に制約のあるオンプレオリジン、マルチ CDN。**動的コンテンツ（プロキシ）、キャッシュされにくいコンテンツ、めったにリクエストされないコンテンツには向かない**
- 課金: PUT / POST / PATCH / DELETE、および **TTL 3,600 秒未満または無効の GET / HEAD は「動的」扱いで常に課金対象**。Origin Shield と同じリージョンのリージョナルエッジキャッシュ経由のリクエストは Origin Shield をスキップし課金されない
- 高可用性: リージョナルエッジキャッシュは 3 AZ 以上で構成。Origin Shield が使えないときは**セカンダリの Origin Shield へ自動でルーティング**
- **オリジングループと併用可**（プライマリのオリジンはプライマリの Origin Shield 経由、フェイルオーバー時はセカンダリのオリジンはセカンダリの Origin Shield 経由）。**Lambda@Edge のオリジンリクエスト / レスポンスのトリガーは Origin Shield を有効にしたリージョンで実行される**（ビューワー側は影響なし）
- gRPC リクエストは Origin Shield を通らない（直接オリジンへ）

## CloudFront: キャッシュ期間（TTL）
- キャッシュ期間の管理は**キャッシュポリシー**の更新を推奨。キャッシュポリシーは、キャッシュキーに含めるヘッダー / Cookie / クエリ文字列、TTL、圧縮オブジェクトのキャッシュを指定する。ポリシーを使わない旧設定では、**既定 TTL は 24 時間**。Minimum TTL / Maximum TTL / Default TTL をキャッシュビヘイビア単位で設定できる
- 個別ファイルは、オリジンが **`Cache-Control: max-age` / `s-maxage`** か **`Expires`** を付けて制御する。max-age の下限は 0 秒、上限は 100 年。**max-age と Expires の両方があれば max-age のみ使う**（max-age の利用を推奨）
- **視聴者リクエストの `Cache-Control` / `Pragma` ヘッダーで、オリジンへの再取得を強制することはできない**（CloudFront は無視する）
- ヘッダーと TTL の関係（Minimum TTL = 0 のとき）: max-age があれば **max-age と Maximum TTL の小さいほう**。s-maxage もあれば **s-maxage と Maximum TTL の小さいほう**（ブラウザは max-age に従う）。Expires のみなら Expires の日時と Maximum TTL の早いほう。ヘッダーなしなら **Default TTL**
- Minimum TTL > 0 のとき: ヘッダーの値が Minimum〜Maximum の範囲内ならヘッダーの値。**Minimum より小さければ Minimum TTL、Maximum より大きければ Maximum TTL**。ヘッダーなしなら Minimum と Default の大きいほう
- **`Cache-Control: no-cache` / `no-store` / `private` があっても、Minimum TTL > 0 なら Minimum TTL でキャッシュされる**（Minimum TTL = 0 ならヘッダーを尊重）。この場合、オリジンに到達できないときは以前取得したオブジェクトを返す。避けるには `stale-if-error=0` を付ける
- **`stale-while-revalidate`**: 期限切れ後も、裏で再検証しながら古いコンテンツを返す（レイテンシー改善）。**`stale-if-error`**: オリジンに到達できない・5xx のとき古いコンテンツを返す。どちらも**指定値と Maximum TTL の小さいほう**まで。Maximum TTL を過ぎた古いオブジェクトは、指定値にかかわらずエッジキャッシュから返されない
- 期限切れ後は、オリジンに再検証し、最新なら **304 Not Modified**、古ければ 200 と最新ファイル。**アクセスが少ないファイルは期限前でも追い出される**ことがある
- gRPC はキャッシュできないため、キャッシュ設定の影響を受けない

## CloudFront: オリジンリクエストポリシー / レスポンスヘッダーポリシー / 管理ポリシー
- **オリジンリクエストポリシー**: キャッシュミス時のオリジンリクエストに含める情報（ヘッダー / Cookie / クエリ文字列）を指定する。**キャッシュポリシー（キャッシュキー）とは別物**なので、オリジンには渡したいがキャッシュキーには入れたくない値を渡せ、**キャッシュヒット率を保てる**。**キャッシュキーに含めた値は自動でオリジンリクエストにも含まれる**。ポリシーなしでは、URL パス・ボディ・CloudFront が常に付ける `Host` / `User-Agent` / `X-Amz-Cf-Id` 以外（クエリ文字列・ヘッダー・Cookie）はオリジンに送られない（旧設定はヘッダーを既定で転送）。ビューワーのリクエストにない `CloudFront-Viewer-Country` などの CloudFront ヘッダーを追加することもできる
- **管理オリジンリクエストポリシー**（一部）: `AllViewer`（全ヘッダー・Cookie・クエリ文字列）、`AllViewerAndCloudFrontHeaders-2022-06`（AllViewer + 2022 年 6 月までの CloudFront ヘッダー）、**`AllViewerExceptHostHeader`**（Host 以外すべて。**API Gateway / Lambda 関数 URL オリジン向け**。これらのオリジンは Host にオリジンのドメイン名を期待するため、ビューワーの Host を転送すると動かなくなる。Host を除くと CloudFront がオリジンのドメイン名で Host を付ける）、`CORS-S3Origin`（Origin / Access-Control-Request-Headers / Access-Control-Request-Method）、`CORS-CustomOrigin`（Origin のみ）、`HostHeaderOnly`、`UserAgentRefererHeaders`、`Elemental-MediaTailor-PersonalizedManifests`
- **管理キャッシュポリシー**（一部）: **`CachingOptimized`**（Min 1 秒 / Default 24 時間 / Max 365 日。ヘッダー・Cookie・クエリ文字列はキャッシュキーに含めず、圧縮のため正規化した Accept-Encoding のみ。圧縮オブジェクトのキャッシュ有効）、`CachingOptimizedForUncompressedObjects`（同じで圧縮キャッシュ無効）、**`CachingDisabled`**（TTL がすべて 0、キャッシュキーなし。動的コンテンツ・キャッシュ不可のリクエスト向け）、`UseOriginCacheControlHeaders` / `UseOriginCacheControlHeaders-QueryStrings`（オリジンの Cache-Control に従う。Min TTL 0。後者はクエリ文字列でコンテンツが変わるオリジン向け）、`Amplify`、`Elemental-MediaPackage`。**`CachingOptimized` などは Min TTL が 0 より大きいので、`no-cache` / `no-store` / `private` があってもキャッシュされる**（原文の警告）
- **レスポンスヘッダーポリシー**: CloudFront がビューワーへの応答で**追加または削除する HTTP ヘッダー**を指定する。設定の種類は CORS ヘッダー / セキュリティヘッダー / カスタムヘッダー / ヘッダー削除 / Server-Timing ヘッダー。CORS の Access-Control-Allow-Origin では先頭サブドメインだけにワイルドカードを使える（`*.example.org`）。Access-Control-Allow-Headers の `*` は Authorization を含まない（明示が必要）。セキュリティヘッダーは Content-Security-Policy（値は 1783 文字まで）/ Referrer-Policy / Strict-Transport-Security / X-Content-Type-Options / X-Frame-Options（DENY か SAMEORIGIN）/ X-XSS-Protection。**カスタムヘッダー**は全レスポンスに追加され、値は省略可（値なしのヘッダーも追加できる）。ヘッダーごとの Origin override が true ならオリジンの同名ヘッダーを無視してポリシーの値、false ならオリジンの値を優先（オリジンにないときはポリシーの値を追加）。**ヘッダー削除**はオリジンからの応答のヘッダーを、キャッシュヒットかオリジン経由かを問わず全レスポンスから除く（例: X-Powered-By、Vary）。削除が先で追加が後なので、同じヘッダーを他の設定で追加していれば付く。Server / Date を削除しても CloudFront が自前の値（Server は `CloudFront`）を付ける。Connection / Content-Length / Via / Transfer-Encoding / X-Amz-Cf-* / X-Edge-* など多数は削除不可（指定するとエラー）。**Server-Timing** はサンプリングレート 0〜100（小数点以下 4 桁まで）でヘッダーを付ける応答の割合を指定し、リクエストに `Pragma: server-timing` があればレートが 0 でも付く。オリジンが Server-Timing を返していれば、キャッシュミス時は CloudFront のメトリクスが追記された 1 本のヘッダーになり、キャッシュヒット時は CloudFront のメトリクスのみ（2026-09-26 に原文で確認。個別メトリクスの一覧は未確認）
- **Origin override**: 各 CORS / セキュリティヘッダーの設定。true ならオリジン応答に同じヘッダーがあってもポリシーの値で置き換え（オリジンの値を無視）、false ならオリジン応答のヘッダーを優先し、オリジン応答になければポリシーの値を追加する
- **管理レスポンスヘッダーポリシー**: `SimpleCORS`（Access-Control-Allow-Origin: *）、`CORS-With-Preflight`（プリフライトで Allow-Methods / Allow-Origin / Expose-Headers を追加）、`SecurityHeadersPolicy`（Referrer-Policy / Strict-Transport-Security max-age=31536000 / X-Content-Type-Options nosniff / X-Frame-Options SAMEORIGIN / X-XSS-Protection）、および CORS とセキュリティヘッダーを合わせた `CORS-and-SecurityHeadersPolicy`、`CORS-with-preflight-and-SecurityHeadersPolicy`。**管理ポリシーでは X-Content-Type-Options だけ Override origin が「はい」**で、それ以外はオリジンの値を優先する

## CloudFront: Continuous deployment（ステージングディストリビューション）
（2026-09-26 に原文で確認。CloudFront Developer Guide「Use CloudFront continuous deployment…」配下の各ページ）
- **目的**: 本番トラフィックの一部を新しい設定に流して検証し、問題なければ**プライマリに昇格**する（模擬トラフィックでのテストが不要）。
- **流れ**: プライマリ（現在本番を配信中）から**ステージングディストリビューション**を作成（最初はプライマリのコピー）→ **continuous deployment policy（トラフィック設定）** をプライマリにアタッチ → ステージングの設定を更新 → 監視 → **昇格**（ステージングの設定をプライマリにコピーし、ポリシーは無効化されて全トラフィックがプライマリへ）。昇格後は同じステージングを再利用できる。
- **ビューワーはステージングに直接アクセスできない**（DNS 名 / IP / CNAME 不可）。ビューワーはプライマリに送り、CloudFront がポリシーに従って一部をステージングへ振り分ける。
- **トラフィック設定の 2 種類**: **重みベース**（指定割合をステージングへ。**最大 15%**、CLI では 0.01〜0.15。**セッションスティッキネス**を有効にすると Cookie で同一セッションを同じ側に固定し、アイドル時間は 300〜3600 秒）と、**ヘッダーベース**（指定ヘッダーと値を含むリクエストだけステージングへ。ローカルテスト向け。ヘッダー名は **`aws-cf-cd-` プレフィックス**必須）。ポリシーやスティッキネスの有効 / 無効を切り替えると、全セッションがリセットされる。
- **変更できる設定**: キャッシュビヘイビア（デフォルト含む）、オリジン / オリジングループ、カスタムエラーレスポンス、地理的制限、デフォルトルートオブジェクト、ログ設定、コメント。参照先の外部リソース（キャッシュポリシー、レスポンスヘッダーポリシー、CloudFront Functions、Lambda@Edge）も更新できる。
- **キャッシュは共有されない**: ステージングの最初のリクエスト時はキャッシュが空。
- **クォータ**: ステージングディストリビューション 20 / アカウント、continuous deployment policy 20 / アカウント。
- **制約**: **HTTP/3 を有効にしたディストリビューションでは使えない**。プライマリが S3 に OAC を使っているなら、**バケットポリシーにステージングディストリビューションも許可**する。AWS WAF は、その ACL を初めて関連付ける / 関連付けを解除する操作ができない（先に continuous deployment policy を削除する。ステージングも一緒に削除される）。ピーク時などは、ポリシーの指定にかかわらず**全リクエストがプライマリへ**送られることがある。
- 試験の判断: 「本番の CloudFront 設定変更を、一部の実トラフィックで安全に検証してから切り替えたい」→ **continuous deployment（ステージング + 重み / ヘッダーベース）**。

## CloudFront: エッジ関数（CloudFront Functions と Lambda@Edge）
| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| 言語 | JavaScript（ECMAScript 5.1 準拠） | Node.js、Python |
| イベント | **ビューワーリクエスト / ビューワーレスポンスのみ** | ビューワー 2 種 + **オリジンリクエスト / オリジンレスポンス** |
| 実行時間 | サブミリ秒 | 最大 30 秒 |
| 規模 | 毎秒数百万リクエスト | リージョンあたり最大毎秒 10,000 |
| メモリ | 2 MB | 128 MB（ビューワー）/ 最大 10,240 MB（オリジン） |
| コードサイズ | 10 KB | 50 MB |
| ネットワーク / ファイルシステム / リクエストボディ | **不可** | **可** |
| 位置情報・デバイスデータ | 可 | ビューワー側は不可、オリジン側は可 |
| CloudFront KeyValueStore | 可（JavaScript ランタイム 2.0 のみ） | 不可 |

- CloudFront Functions の用途: **キャッシュキーの正規化、ヘッダー操作、URL のリダイレクト / 書き換え、JWT などのトークン検証**
- Lambda@Edge の用途: 数ミリ秒以上かかる処理、CPU / メモリの調整、サードパーティライブラリ（AWS SDK を含む）、外部サービスへのネットワークアクセス、ファイルシステムやリクエストボディへのアクセス
- Lambda@Edge は**単一のリージョンに発行**し（**us-east-1（バージニア北部）**。CloudFront Developer Guide）、ディストリビューションに関連付けると**世界中に自動でレプリケート**される

## CloudFront: その他（HTTPS・暗号化・地理的制限）
- **ACM 証明書を CloudFront で使うには、us-east-1（バージニア北部）で作成またはインポートする**。ACM の証明書を別リージョンから関連付けることはできない（リージョン間コピーもできない）
- **CloudFront〜オリジン間の HTTPS（カスタムオリジン）**（2026-09-26 に原文で確認）: **Origin Protocol Policy** は **HTTPS Only**（HTTPS のみ）か **Match Viewer**（ビューワーのプロトコルに合わせる。Viewer Protocol Policy が Redirect HTTP to HTTPS か HTTPS Only のときだけ選ぶ）。オリジンの証明書は、ELB なら **ACM 発行または ACM にインポートしたサードパーティ CA 発行**でよい。ELB 以外のオリジンは**信頼できるサードパーティ CA 発行が必須**（Mozilla の CA リスト準拠）。**自己署名証明書は不可**。証明書のドメイン名は、オリジンのドメイン名か、Host ヘッダーを転送する場合はその Host の値と一致させる。期限切れ・不正・自己署名・チェーン順序誤り・中間証明書欠落だと CloudFront は接続を切り、ビューワーに **502** を返す（`X-Cache: Error from cloudfront`）。**S3 ウェブサイトエンドポイントは HTTPS 非対応**なので、オリジンへ HTTPS にできない。通常の S3 バケットオリジンは既定が Match Viewer で、HTTPS を強制するなら Viewer Protocol Policy を Redirect HTTP to HTTPS / HTTPS Only にする（OAC 有効時は OAC の設定による）
- **ALB へのアクセスを CloudFront 経由に限定（シークレットヘッダー方式）**（同）: 公開 ALB では、①CloudFront の **Origin Custom Headers** でカスタムヘッダーを付与、②ALB リスナーに「そのヘッダーを含むなら転送」ルールを追加し、**デフォルトルールは固定レスポンス 403** にする。**ヘッダー名・値は秘密にする**（本番ではランダム値、認証情報として扱う。漏れると直接アクセスが CloudFront 経由に見えてしまう）。**HTTPS Only にして盗聴を防ぎ、ヘッダーを定期的にローテーション**（新ヘッダーを追加 → ALB ルール更新 → 旧ヘッダーを停止 → 旧ルール削除の順）。HTTPS Only 時は **Host ヘッダーをオリジンリクエストポリシーで転送**（AllViewer など）し、ALB に HTTPS リスナーと一致する証明書が必要。**ACM 証明書はビューワー〜CloudFront 用が us-east-1、ALB 用は ALB のあるリージョン**に別々に必要。より安全なのは **VPC オリジン**（プライベートサブネットの ALB）で、併用として上記のマネージドプレフィックスリストも使える
- **オリジンカスタムヘッダーの仕様**（同）: カスタムオリジンと S3 オリジンで使え、オリジンごとに設定できる。ビューワーリクエストに同名ヘッダーがあれば**上書き**する。**追加できないヘッダー**: Cache-Control / Connection / Content-Length / Cookie / Host / If-* / Range / Pragma / Transfer-Encoding / Via など、**`X-Amz-` 始まり、`X-Edge-` 始まり、X-Real-Ip**。Authorization ヘッダーは既定でオリジンに転送されない（キャッシュキーに含める、オリジンリクエストポリシーで転送、または AllViewer で転送。キャッシュキーに含めずに転送すると、認可済みと未認可のビューワーに同じキャッシュを返しうる）
- **独自ドメインの HTTPS 配信: SNI と専用 IP**（2026-09-26 に原文で確認）: 選択肢は **SNI（推奨）** と**エッジロケーションごとの専用 IP**。SNI は 2010 年以降にリリースされたブラウザ / クライアントが対応する TLS 拡張で、CloudFront は ClientHello の SNI のドメイン名からディストリビューションを特定して証明書を返す（IP はディストリビューション専用ではない。ドメインを即座に特定できないと接続を切る）。**SNI 非対応の古いクライアントも配信対象にするなら専用 IP**（全クライアントで動作）で、**追加の月額料金**が証明書の関連付け + ディストリビューション有効化の時点から発生する。専用 IP は**静的 IP ではなく変わりうる**（CloudFront エッジサーバーの範囲から動的に割り当て。変更通知は AWS Public IP Address Changes を SNS 購読）。**専用 IP 証明書の既定の上限は 2**（3 以上はサポートケースで申請）。1 ディストリビューションに関連付けられる証明書は 1 つ。SNI を使いたいが非対応ブラウザがある場合の代替: 専用 IP / CloudFront 既定証明書（`*.cloudfront.net` のドメイン名で配信。TLSv1 以降必須、SSLv3 不可）/ ブラウザのアップグレード / HTTP。単価は未確認
- **フィールドレベル暗号化**: POST リクエストの**特定フィールド（最大 10 個）**を、エッジで**公開鍵（RSA）**により暗号化。**リクエスト全体は暗号化できない**（フィールド単位）。オリジンから先のアプリ全体で暗号化されたままで、**秘密鍵を持つコンポーネントだけが復号**できる（例: 決済処理）。**オリジンはチャンクエンコーディングに対応が必要**。HTTPS によるビューワー〜オリジン間の暗号化に**追加**する層
- **地理的制限**: CloudFront の機能は**国単位で、ディストリビューション全体のファイルに適用**（ビヘイビアやパスごとには設定できない）。**許可リストは指定外の国をすべてブロック、拒否リストは指定外の国をすべて許可**。CloudFront の地理的制限は **AWS WAF や エッジ関数より先に評価される**（AWS ブログ）。**一部のファイルだけ、または国より細かい粒度で制限したい場合はサードパーティの位置情報サービス**を使う

## CloudFront: アクセスログ（標準ログとリアルタイムログ）
- **リアルタイムログ**（2026-09-26 に原文で確認）: リクエストから**数秒以内**に配信。設定できるのは**サンプリングレート（1〜100 の整数 %）**、**フィールド（1 レコード最大 40 個。CMCD フィールドを含む）**、**対象のキャッシュビヘイビア（パスパターン）**。配信先は **Kinesis Data Streams のみ**（`StreamType` の有効値は Kinesis）。S3 / Redshift / OpenSearch / サードパーティへは、自作コンシューマーか **Amazon Data Firehose** 経由。**CloudFront のリアルタイムログ料金に加えて Kinesis Data Streams の料金**がかかる。**ベストエフォート**で、遅れたり、まれに欠落したりする（課金・使用状況レポートの件数と一致しない）。コンシューマーはフィールドが**常に固定の順序**で届く前提で作る（後からフィールドを追加すると位置がずれる）。シャード数は秒間リクエスト数と 1 レコードの大きさ（通常約 500 バイト、全フィールドで約 1 KB）から見積もる。Kinesis 側でスロットリングされたらシャードを増やす。CloudFront は設定内の **IAM ロール**で書き込む
- **標準ログ（v2）**: 配信先は **CloudWatch Logs / Amazon Data Firehose / S3**（CloudWatch vended logs を使う）。フィールドを選べ（リアルタイムログのフィールドの一部も選べる）、出力形式は **JSON / Plain / w3c / Raw / Parquet（S3 のみ）**。形式は**作成時のみ指定でき、後から更新できない**（変えるなら配信を作り直す）。S3 では**オプトインリージョンへの配信、パーティション、Hive 互換パス**が使える。**クロスアカウント配信に対応**。CloudWatch API で有効化するときは **us-east-1** を指定する（配信先が別リージョンでも）。**有効化自体は無料**で、配信先の料金がかかる（S3 への配信に追加料金はなく S3 の保管・アクセス料金のみ。Parquet 変換は CloudWatch の料金）。Cookie ログは全配信先共通の設定
- **標準ログ（レガシー）**: S3 のみ。**バケットは ACL 有効が必須**で、**Object Ownership が「バケット所有者の強制」だと配信できない**。**オプトインリージョンのバケットは非対応**（v2 なら対応）。v2 を有効にしてもレガシーには影響せず併用できる（併用時は別バケットか別パスにする）
- **使い分け**: 数秒単位の監視・分析・対応が必要ならリアルタイムログ（Kinesis）。事後分析・監査で安く済ませるなら標準ログ（S3 + Athena）。リアルタイムログの `cs-uri-stem` はクエリ文字列を含むが、標準ログの `cs-uri-stem` は含まない（原文の注記）
- 標準ログの配信遅延時間・レガシー標準ログの詳細な仕様、リアルタイムログのシャード数の計算式の細部は未確認

## Global Accelerator
- 標準アクセラレーターは、AWS グローバルネットワーク経由で、**クライアントに最も近いリージョンのエンドポイント**に流す。**カスタムルーティングアクセラレーター**は、1 人以上のユーザーを**多数の宛先のうち特定のもの**に割り当てる
- **静的 IP**: **IPv4 で 2 つ**、デュアルスタックでは **IPv4 2 + IPv6 2 の計 4 つ**。**エッジネットワークからの anycast**。**自分の IP 範囲を持ち込む（BYOIP）** こともできる。アクセラレーターが存在する限り IP は変わらない（無効にしても保持される。**削除すると失う**）
- **エンドポイント**（標準）: **NLB、ALB、EC2 インスタンス、Elastic IP**
- **TCP 接続をエッジで終端し、ほぼ同時にエンドポイントへ新しい TCP 接続を確立**する。これにより応答時間の短縮とスループットの向上を実現する
- **ヘルスチェックとフェイルオーバー**: 標準アクセラレーターは全エンドポイントを継続的に監視し、**異常なエンドポイントから、新規接続を即座に別の正常なエンドポイントへ**向ける。**ヘルスチェックの設定を使うのは EC2 と Elastic IP のみ**。**ALB / NLB は、そのロードバランサー自体に設定済みのヘルスチェックを再利用**する（re:Post）。**正常なエンドポイントがないときは、リージョン内のすべてのエンドポイントに流す**
- **重みとトラフィックダイヤル**: エンドポイントの重みは **0〜255（既定 128）**。重みの比率で配分し、**0 にすると流さない**。**トラフィックダイヤル**は**エンドポイントグループ（リージョン）単位**で流量の割合を上げ下げ（性能テスト、スタックの更新など）。クライアント IP 保存時など、可用性のために**重みが上書きされる場合がある**
- **クライアント IP の保存**: 標準アクセラレーターで保存できるのは **ALB、EC2 インスタンス、セキュリティグループ付きの NLB**。**セキュリティグループなしの NLB と Elastic IP は保存不可**。カスタムルーティングでは**常に保存**される
- **カスタムルーティングアクセラレーター**: **VPC サブネット内の EC2 インスタンスのポート**にのみ流す。**地理的近接性やエンドポイントの健全性でルーティングせず、ヘルスチェックもフェイルオーバーもない**（宛先は自分が指定）。IPv4 のみ。用途: **ゲームのセッションなど、特定のユーザーを特定のサーバーに固定して割り当てる**

## 判断ポイント
- 「ALB の前段で、静的 IP を顧客のファイアウォールに許可してもらう」→ **Global Accelerator**（FAQ が静的 IP の要件を Global Accelerator の適した用途に挙げている。**ただし「CloudFront に静的 IP はない」は誤り**: CloudFront FAQ に **Anycast Static IPs** がある。許可リスト用途は IPv4 21 個（デュアルスタックは IPv4 21 + IPv6 21）、apex ドメイン用途は 3 個。同一アカウントの複数ディストリビューションで共有でき、**料金クラス All が必須・SNI 非対応の旧クライアントは不可・IPv6 は無効化が必要**（FAQ の例外）。BYOIP は /24 を 3 つ。HTTP で静的 IP 要件かつ CloudFront を使いたい場合はこれも選択肢だが、非 HTTP や決定的なリージョンフェイルオーバーは引き続き Global Accelerator）
- 「DNS キャッシュに影響されず、リージョン障害時にすばやく切り替え」→ **Global Accelerator**（DNS キャッシュの影響を避けられる点は Week2 ノート 08 を参照）
- 「グローバルなゲームの UDP トラフィック」→ **Global Accelerator**
- 「特定のプレイヤーを特定のゲームサーバー（EC2）に割り当てる」→ **カスタムルーティングアクセラレーター**
- 「S3 バケットを直接アクセス不可にして CloudFront 経由のみ、SSE-KMS も使う」→ **OAC**
- 「S3 が静的ウェブサイトエンドポイント」→ **OAC は使えない**（カスタムオリジン扱いで OAC / OAI は不可。原文）。OAC で保護するには通常のバケット（ウェブサイトエンドポイントでない）にする。ウェブサイトエンドポイントを使う場合の保護手段は未確認
- 「プライベートサブネットの ALB を CloudFront 経由のみで公開」→ **VPC オリジン**（またはマネージドプレフィックスリスト）
- 「会員が有料動画の HLS（多数のファイル）を見る。URL は変えたくない」→ **署名付き Cookie**
- 「単一のファイルダウンロードを期限付きで共有」→ **署名付き URL**
- 「署名者は何にする」→ **信頼されたキーグループ**（推奨）
- 「エッジで URL 書き換えや JWT 検証を大規模・低遅延で」→ **CloudFront Functions**
- 「エッジで外部 API / DB を呼ぶ、リクエストボディを読む」→ **Lambda@Edge**
- 「カード番号だけをエッジで暗号化して、バックエンドの途中で見えないように」→ **フィールドレベル暗号化**
- 「特定の国からのアクセスを遮断」→ **CloudFront の地理的制限**（ファイル単位・都市単位ならサードパーティ）（AWS WAF にも地理的一致（geo match）ルールステートメントがある。WAF Developer Guide。CloudFront の地理的制限との使い分けの詳細は未確認）
- 「CloudFront で独自ドメインの HTTPS。証明書は ACM」→ **us-east-1 で発行**
- 「CloudFront のオリジンフェイルオーバーで POST は？」→ **フェイルオーバーしない**（GET / HEAD / OPTIONS のみ）

## Q&A（答えを隠して考えてから確認）
### Q1. S3 バケットを CloudFront 経由のみで公開したい。SSE-KMS も使っている。どうする？
<details><summary>答え</summary>
OAC（origin access control）を使う。OAC は SSE-KMS や PUT / DELETE などの動的リクエストに対応し、OAI は非推奨。前提として S3 Object Ownership は「Bucket owner enforced」（新規バケットのデフォルト）にする。
</details>

### Q2. S3 を静的ウェブサイトエンドポイントとして設定している。OAC で保護できる？
<details><summary>答え</summary>
できない。静的ウェブサイトエンドポイントは CloudFront のカスタムオリジン扱いになり、OAC（OAI も）は使えない。
</details>

### Q3. プライベートサブネットの ALB を、CloudFront 経由でのみ公開したい。どうする？
<details><summary>答え</summary>
VPC オリジンを使う。CloudFront が唯一の入口になり、オリジンをパブリックにしなくてよい。パブリックなオリジンなら、マネージドプレフィックスリスト com.amazonaws.global.cloudfront.origin-facing をセキュリティグループのインバウンドで参照して絞る。
</details>

### Q4. 有料会員が HLS 動画（多数のファイル）を視聴する。URL は変えたくない。どうする？
<details><summary>答え</summary>
署名付き Cookie。複数の制限ファイルへのアクセスを許可でき、URL を変えずに済む。単一ファイルのダウンロードを期限付きで共有するなら署名付き URL。署名者は信頼されたキーグループが推奨。
</details>

### Q5. 顧客のファイアウォールに静的 IP を許可してもらう必要がある HTTP アプリを、複数リージョンで高速にフェイルオーバーさせたい。どうする？
<details><summary>答え</summary>
Global Accelerator。IPv4 の静的 IP が 2 つ（デュアルスタックは計 4 つ）で、anycast。異常なエンドポイントから新規接続を即座に別の正常なエンドポイントへ向ける。DNS キャッシュの影響も受けない。
</details>

### Q6. CloudFront のオリジンフェイルオーバーは、POST リクエストでも動く？ 既定のプライマリ接続試行の待ち時間は？
<details><summary>答え</summary>
動かない。GET / HEAD / OPTIONS のときだけフェイルオーバーする。既定ではプライマリへの接続を最大 30 秒（10 秒 × 3 回）試してからセカンダリへ切り替える。接続タイムアウトは 1〜10 秒、試行回数は 1〜3 回に変更できる。
</details>

## 未確認
- **CloudFront**: （オリジンリクエストポリシー / レスポンスヘッダーポリシー / 管理ポリシーの主要な内容は 2026-09-26 に原文で確認済み。「CloudFront: オリジンリクエストポリシー / レスポンスヘッダーポリシー / 管理ポリシー」節。カスタム / 削除ヘッダー・Server-Timing の仕様は 2026-09-26 に原文で確認済み（Server-Timing の個別メトリクス一覧は未確認）。管理キャッシュポリシー Amplify の細目は未確認。ポリシー作成上限は下記のとおり確認済み）、キャッシュキーの詳細（TTL とキャッシュポリシーの役割は 2026-09-26 に原文で確認済み。「CloudFront: キャッシュ期間（TTL）」節）、（キャッシュ無効化の課金は 2026-09-26 に原文で確認済み: 月あたり最初の 1,000 パスは無料で、超過分はパス単位で課金。ワイルドカード `/*` を含むパスも 1 パス扱い。無料枠はアカウント内の全ディストリビューション合計で、リクエストにまとめても各パスが個別にカウントされる。タグ無効化のアイテムも同じ無料枠を共有して 1 パス扱い。頻繁に更新するなら無効化よりバージョン付きファイル名が推奨（無効化の課金がなく、視聴者側のキャッシュにも影響されない）。単価は未確認）、**料金クラスごとのリージョン対応表と単価**（料金クラスの仕組み自体は 2026-09-26 に原文で確認済み: 既定は全エッジロケーション。PriceClass_100 / 200 / All があり、除外ロケーションの視聴者は遅延が増えうる。対象外ロケーションから配信された場合は、料金クラス内で最安のロケーションの料金が課金される。Anycast Static IPs は PriceClass_All 必須。対応表は原文が CloudFront pricing ページ参照のみ）、**Origin Shield の単価**（原文は「CloudFront pricing 参照」のみ。仕組み・リージョン・課金対象は 2026-09-26 に原文で確認済み）、（オリジンへの HTTPS 要件とカスタムヘッダー（ALB のシークレットヘッダー方式）は 2026-09-26 に原文で確認済み。「CloudFront: その他」節。カスタムヘッダーのクォータは 2026-09-26 に原文（CloudFront Quotas「Quotas on headers」）で確認済み: オリジンリクエストに追加できるカスタムヘッダーは 30 個（引き上げ申請可）、ヘッダー名は 256 文字、値は 1,783 文字、名前と値の合計 10,240 文字。レスポンスヘッダーポリシーのカスタムヘッダーは 10 個、カスタムポリシーはアカウントあたり 20 個、同一ポリシーを関連付けられるディストリビューションは 100。キャッシュビヘイビアで転送するヘッダーは 25 個（旧設定のヘッダー指定は 10 個）。これでレスポンスヘッダーポリシーの作成上限も確認済み）、**AWS WAF との統合**（WAF 自体を Week4 で別ノートにする予定）、**Lambda@Edge のレプリケーション元リージョン（us-east-1）と併用時の制約**、オリジンフェイルオーバーと Lambda@Edge の併用の詳細、（リアルタイムログ / 標準ログの仕組み・配信先・料金の考え方は 2026-09-26 に原文で確認済み。「CloudFront: アクセスログ」節。標準ログの配信遅延時間は未確認）、**mTLS / Connection Functions**、（SNI と専用 IP 独自 SSL の仕組み・専用 IP の上限・追加料金の有無は 2026-09-26 に原文で確認済み。「CloudFront: その他」節。専用 IP の単価は未確認）、（Continuous deployment の仕組み・トラフィック設定・クォータ・制約は 2026-09-26 に原文で確認済み。「CloudFront: Continuous deployment」節。監視（Monitor a staging distribution）の詳細は未確認）、**S3 のバケットポリシー（OAC 用）の書き方**
- **Global Accelerator**: **料金（固定 + データ転送プレミアム）**、**ヘルスチェックの間隔・しきい値・フェイルオーバー時間の数値**、**接続の衝突（connection collisions）の詳細**、**BYOIP の要件**、**Global Accelerator と CloudFront の併用**、**フローログ**、**IPv6 の対応範囲**
- **Route 53 との使い分け**: レイテンシールーティング + ヘルスチェックによる構成との比較（Week1 / Week2 のノートに一部あり）

