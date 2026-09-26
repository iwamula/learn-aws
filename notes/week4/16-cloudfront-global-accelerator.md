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
- **フィールドレベル暗号化**: POST リクエストの**特定フィールド（最大 10 個）**を、エッジで**公開鍵（RSA）**により暗号化。**リクエスト全体は暗号化できない**（フィールド単位）。オリジンから先のアプリ全体で暗号化されたままで、**秘密鍵を持つコンポーネントだけが復号**できる（例: 決済処理）。**オリジンはチャンクエンコーディングに対応が必要**。HTTPS によるビューワー〜オリジン間の暗号化に**追加**する層
- **地理的制限**: CloudFront の機能は**国単位で、ディストリビューション全体のファイルに適用**（ビヘイビアやパスごとには設定できない）。**許可リストは指定外の国をすべてブロック、拒否リストは指定外の国をすべて許可**。CloudFront の地理的制限は **AWS WAF や エッジ関数より先に評価される**（AWS ブログ）。**一部のファイルだけ、または国より細かい粒度で制限したい場合はサードパーティの位置情報サービス**を使う

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
- **CloudFront**: オリジンリクエストポリシー / レスポンスヘッダーポリシー、キャッシュポリシーの管理ポリシー一覧とキャッシュキーの詳細（TTL とキャッシュポリシーの役割は 2026-09-26 に原文で確認済み。「CloudFront: キャッシュ期間（TTL）」節）、（キャッシュ無効化の課金は 2026-09-26 に原文で確認済み: 月あたり最初の 1,000 パスは無料で、超過分はパス単位で課金。ワイルドカード `/*` を含むパスも 1 パス扱い。無料枠はアカウント内の全ディストリビューション合計で、リクエストにまとめても各パスが個別にカウントされる。タグ無効化のアイテムも同じ無料枠を共有して 1 パス扱い。頻繁に更新するなら無効化よりバージョン付きファイル名が推奨（無効化の課金がなく、視聴者側のキャッシュにも影響されない）。単価は未確認）、**料金クラスごとのリージョン対応表と単価**（料金クラスの仕組み自体は 2026-09-26 に原文で確認済み: 既定は全エッジロケーション。PriceClass_100 / 200 / All があり、除外ロケーションの視聴者は遅延が増えうる。対象外ロケーションから配信された場合は、料金クラス内で最安のロケーションの料金が課金される。Anycast Static IPs は PriceClass_All 必須。対応表は原文が CloudFront pricing ページ参照のみ）、**Origin Shield の単価**（原文は「CloudFront pricing 参照」のみ。仕組み・リージョン・課金対象は 2026-09-26 に原文で確認済み）、**オリジンへの HTTPS 要件とカスタムヘッダー（ALB のシークレットヘッダー方式）**、**AWS WAF との統合**（WAF 自体を Week4 で別ノートにする予定）、**Lambda@Edge のレプリケーション元リージョン（us-east-1）と併用時の制約**、オリジンフェイルオーバーと Lambda@Edge の併用の詳細、**リアルタイムログ / 標準ログ**、**mTLS / Connection Functions**、**SNI と専用 IP 独自 SSL**、**Continuous deployment（ステージングディストリビューション）**、**S3 のバケットポリシー（OAC 用）の書き方**
- **Global Accelerator**: **料金（固定 + データ転送プレミアム）**、**ヘルスチェックの間隔・しきい値・フェイルオーバー時間の数値**、**接続の衝突（connection collisions）の詳細**、**BYOIP の要件**、**Global Accelerator と CloudFront の併用**、**フローログ**、**IPv6 の対応範囲**
- **Route 53 との使い分け**: レイテンシールーティング + ヘルスチェックによる構成との比較（Week1 / Week2 のノートに一部あり）

