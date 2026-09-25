# Week1-2: VPC 間・VPC 外の接続（Peering / TGW / PrivateLink / Endpoint）

## 選択肢の比較
| 手段 | 特徴 | 制約 |
|---|---|---|
| **VPC ピアリング** | 1対1、低コスト、リージョン間・アカウント間可。プライベートIPで通信 | **推移的ルーティング不可**（A-B, B-C でも A-C は不可）。CIDR重複不可。エッジ間ルーティング（VPN/DX/IGW を他VPC経由で使う）不可 |
| **Transit Gateway (TGW)** | ハブ&スポーク。数千VPCと VPN/DX を集約。ルートテーブルでセグメント分離可。リージョン間はTGWピアリング。RAMで共有 | 時間課金+データ処理課金。TGWピアリングはルートを**静的**に設定（ピアリングアタッチメントを指す静的ルートをルートテーブルに追加。伝播は不可。各 TGW に一意の ASN を推奨）。上限: 1TGWあたりアタッチメント5,000、ルート合計10,000、ルートテーブル20、ピアリング50（いずれも既定値）。VPCアタッチメントはAZあたり最大100Gbps |
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

## Q&A（答えを隠して考えてから確認）
### Q1. CIDR が重複している複数の VPC やパートナー企業に、特定のサービスだけを公開したい。どうする？
<details><summary>答え</summary>
PrivateLink（インターフェイスVPCエンドポイント）。CIDR が重複していても使え、サービス単位・一方向（コンシューマ→プロバイダ）で公開できる。NLB/GWLB の背後のサービスを公開する。
</details>

### Q2. VPC A-B、B-C をピアリングした。A から C へ通信できる？
<details><summary>答え</summary>
できない。VPC ピアリングは推移的ルーティング不可。多数の VPC を相互接続するなら Transit Gateway を使う（ピアリングはフルメッシュで破綻する）。
</details>

### Q3. VPC 内の EC2 から S3 へのアクセスをインターネットに出さず、コストもかけたくない。どうする？
<details><summary>答え</summary>
ゲートウェイVPCエンドポイント（S3 と DynamoDB のみ、無料、ルートテーブルにエントリ追加）。ただしオンプレ・他リージョン・ピアリング先からは使えないので、オンプレ経由などで使うなら S3 のインターフェイスエンドポイントにする。
</details>

### Q4. VPC からのアウトバウンド通信を、サードパーティのアプライアンスで透過的に検査したい。どうする？
<details><summary>答え</summary>
TGW + 検査用 VPC を構成し、Gateway Load Balancer（GWLB）でアプライアンスを透過的に挟む。AWS のサービスなら Network Firewall も使える。
</details>

### Q5. 数十の VPC とオンプレを Direct Connect 1 本でまとめて接続したい。どの VIF と構成？
<details><summary>答え</summary>
Transit VIF + Direct Connect Gateway + Transit Gateway。Private VIF は1つの VGW、または DX Gateway 経由で複数 VPC/リージョンに届くが、多数 VPC の集約には Transit VIF + TGW が向く。なお DX Gateway は VPC 同士の通信は仲介しない。
</details>

### Q6. 数値確認。Site-to-Site VPN の標準トンネルの最大帯域は？ 5Gbps の Large Bandwidth Tunnel はどこに接続できる？
<details><summary>答え</summary>
標準は1トンネル最大 1.25Gbps。Large Bandwidth Tunnel は最大 5Gbps だが、TGW / Cloud WAN 接続のみ。TGW に終端すれば ECMP で複数トンネルの帯域を束ねることもできる。
</details>

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
