# Week1-2: VPC 間・VPC 外の接続（Peering / TGW / PrivateLink / Endpoint）

## 選択肢の比較
| 手段 | 特徴 | 制約 |
|---|---|---|
| **VPC ピアリング** | 1対1、低コスト、リージョン間・アカウント間可。プライベートIPで通信 | **推移的ルーティング不可**（A-B, B-C でも A-C は不可）。CIDR重複不可。エッジ間ルーティング（VPN/DX/IGW を他VPC経由で使う）不可 |
| **Transit Gateway (TGW)** | ハブ&スポーク。数千VPCと VPN/DX を集約。ルートテーブルでセグメント分離可。リージョン間はTGWピアリング。RAMで共有 | 時間課金+データ処理課金。TGWピアリングはルートを**静的**に設定。上限: 1TGWあたりアタッチメント5,000、ルート合計10,000、ルートテーブル20、ピアリング50（いずれも既定値）。VPCアタッチメントはAZあたり最大100Gbps |
| **PrivateLink（インターフェイスVPCエンドポイント）** | サービス単位で公開。**CIDR重複でも可**。一方向（コンシューマ→プロバイダ）。NLB/GWLB の背後のサービスを公開 | 接続元からのみ。VPC全体の疎通ではない |
| **ゲートウェイVPCエンドポイント** | **S3 と DynamoDB のみ**。無料。ルートテーブルにエントリ追加 | VPC外（オンプレ、他リージョン、ピアリング先）からは使えない |
| **VPN サイト間 / Client VPN** | インターネット経由のIPsec。TGW に終端すると ECMP で帯域を束ねられる | 標準は1トンネル最大1.25Gbps。**Large Bandwidth Tunnel は最大5Gbps だが TGW / Cloud WAN 接続のみ** |
| **Direct Connect (DX)** | 専用線。低遅延・安定。専用接続は1/10/100/400Gbps。ホスト型はパートナー経由で提供（50M〜25Gbps。1G以上は要件を満たすパートナーのみ。**1接続につきVIFは1つ**） | 開通に数週間〜。暗号化はしない（必要なら DX 上の VPN / MACsec） |

## 判断ポイント
- **CIDR が重複した VPC 間 / 他社へサービス提供** → PrivateLink
- **多数の VPC + オンプレを相互接続** → Transit Gateway（ピアリングはフルメッシュで破綻）
- **VPC 内からの S3 アクセスをインターネットに出さない** → ゲートウェイエンドポイント（無料）。オンプレ経由などで使いたいなら S3 のインターフェイスエンドポイント
- **共有サービス VPC（AD、共通ツール）を多数のVPCに提供** → TGW、または PrivateLink
- **VPC 外へのアウトバウンドをインスペクション** → TGW + 検査用VPC（Network Firewall / GWLB）。**Gateway Load Balancer** はサードパーティのアプライアンスを透過的に挟む
- **IPv6 のみのアウトバウンド** → Egress-only Internet Gateway（NAT の代わり）

## Direct Connect の構成
- **Private VIF**: 1つのVPC（Virtual Private Gateway）または **Direct Connect Gateway** 経由で複数VPC/リージョンへ
- **Transit VIF**: DX Gateway 経由で **TGW** に接続（多数のVPCを1本で）
- **Public VIF**: S3 などパブリックエンドポイントへ
- **DX Gateway**: 異なるリージョンの VPC に接続できるが、**VPC 同士の通信は仲介しない**
- **冗長化**: 最大の耐障害性は「別ロケーションに2本以上（各2本の計4本）」。バックアップは Site-to-Site VPN（安価）
- **暗号化が必要**: DX 上に IPsec VPN（Public VIF or Transit VIF 経由）、または MACsec（10/100/400Gbps の専用接続のみ）
- **リンクアグリゲーション（LAG）**: 同一ロケーションで帯域を束ねる。ロケーション障害には備えない

## セキュリティグループ / NACL
- SG はステートフル・Allow のみ・他SGを参照可（**同一リージョンのピアリング先のSGも参照可**）。NACL はステートレス・Allow/Deny・サブネット単位・番号順に評価

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
