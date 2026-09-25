# Week1-3: ハイブリッド DNS と Route 53

## Route 53 の基本
- **ルーティングポリシー**: シンプル / 加重 / レイテンシー / フェイルオーバー / 位置情報 / 地理的近接（バイアス指定可）/ IPベース / 複数値応答
- **ヘルスチェック**: エンドポイント、他のヘルスチェックの集計、CloudWatch アラーム。**プライベートなリソースは直接チェックできない**ので CloudWatch アラームを使う
- **Alias レコード**: ゾーン頂点（example.com）に使える。CloudFront / ELB / S3 静的サイト等を指す。クエリ課金なし。CNAME は頂点に置けない

## ハイブリッド DNS: Route 53 Resolver
- **Inbound Endpoint**: オンプレ → AWS（オンプレの DNS が VPC の名前を引く）
- **Outbound Endpoint + 転送ルール**: AWS → オンプレ（VPC から `corp.example.com` をオンプレDNSへ転送）
- ルールは **RAM で組織内に共有**でき、複数アカウントのVPCに関連付けられる
- **プライベートホストゾーン (PHZ)**: VPC に関連付けて内部名を解決。**別アカウントのVPC**へ関連付けるには認可（`CreateVPCAssociationAuthorization`）＋関連付けが必要
- VPC の `enableDnsHostnames` / `enableDnsSupport` を有効にしないと PHZ は機能しない
- 多数のVPC/アカウントの構成では、DNS 集約 VPC に Resolver を置き、TGW 経由で各VPCが利用する構成がよく出る

## 判断ポイント
- 「オンプレの端末が AWS の EC2 のプライベート名を引きたい」→ Resolver Inbound Endpoint
- 「AWS からオンプレの AD ドメインを引きたい」→ Outbound Endpoint + 転送ルール
- 「全アカウントに同じ転送ルールを配りたい」→ RAM 共有
- 「リージョン障害時に別リージョンへ切り替え」→ フェイルオーバー + ヘルスチェック（または Application Recovery Controller）
- 「世界中のユーザーに最寄りへ」→ レイテンシールーティング。「国ごとに出し分け・規制対応」→ 位置情報

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
