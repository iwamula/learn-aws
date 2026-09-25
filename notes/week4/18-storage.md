# Week4-18: S3 詳細 / Storage Gateway / FSx / EFS（ストレージ）

出典（2026-09-26 に aws-mcp の search_documentation で原文を確認）: S3 User Guide「S3 Glacier storage classes」「Object Lock」「Batch Replication」「Delete marker replication」「Multi-Region Access Point の権限」、S3 FAQ、S3 Replication 機能ページ / PutBucketReplication API、Storage Gateway FAQ / Volume Gateway ユーザーガイド / ドキュメント概要、FSx「Help me choose」ページ、FSx for Lustre FAQ / re:Post、FSx for Windows「Accessing your data」、FSx for ONTAP FAQ / ユーザーガイド、EFS ユーザーガイド「Features」/ 機能ページ、re:Post（EFS スループットモード）、CloudFront DG（MRAP と OAC）。AWS ブログはノート内に明記

## 選定の早見表
| 要件 | 選択 |
|---|---|
| オンプレのファイルを NFS / SMB で S3 に保存（オブジェクトとして直接参照したい） | **S3 File Gateway** |
| オンプレの SMB ファイル共有を FSx for Windows File Server に低遅延で | **FSx File Gateway** |
| オンプレに iSCSI ブロックストレージ、データは S3 に置く（頻繁なデータだけローカルキャッシュ） | **Volume Gateway（キャッシュ型）** |
| オンプレに iSCSI、全データをローカルに置き、S3 へ非同期バックアップ | **Volume Gateway（保管型）** |
| 既存のテープバックアップ運用を維持、テープを S3 / Glacier へ | **Tape Gateway** |
| Windows ワークロード、SMB、Active Directory、DFS | **FSx for Windows File Server** |
| HPC / ML の高スループット、S3 と連携 | **FSx for Lustre** |
| NFS + SMB + iSCSI のマルチプロトコル、NetApp 機能（SnapMirror など） | **FSx for NetApp ONTAP** |
| Linux の共有 NFS ファイルシステム（マルチ AZ） | **EFS** |
| リージョン内の複数 AZ から同時に使う共有ファイル | **EFS または FSx（Multi-AZ）**。EBS は単一 AZ |

## S3 ストレージクラス（アーカイブ系）
| クラス | 最小保存期間 | 想定アクセス頻度 | 取り出し時間 |
|---|---|---|---|
| **Glacier Instant Retrieval** | **90 日** | 四半期に 1 回 | **ミリ秒**（アーカイブではない） |
| **Glacier Flexible Retrieval** | **90 日** | 半年に 1 回 | **数分〜12 時間**（アーカイブ） |
| **Glacier Deep Archive** | **180 日** | 年 1 回 | **9〜48 時間**（アーカイブ） |
- 最小期間より前に削除・上書き・別クラスへ移行しても、**残りの期間分が課金**される
- Deep Archive は最も安価（ブログ: 約 $1 / TB / 月）。長期の**コンプライアンス・デジタルアーカイブ**向け
- Intelligent-Tiering とライフサイクルは Week3 ノート 14 を参照

## S3 レプリケーション（補足。基本は Week2 ノート 09）
- **デフォルトでは、ソースでの削除は削除マーカーがソースにのみ作られ、宛先には複製されない**（誤削除・悪意ある削除から宛先を守るため）。**削除マーカーのレプリケーション**を有効にすると宛先でも削除される。**タグベースのルールでは非対応**、**S3 RTC の 15 分 SLA の対象外**、**ライフサイクルの期限切れで作られた削除マーカーは複製されない**
- **S3 Replication Time Control（RTC）**: ほとんどのオブジェクトを数秒で、**99.99% を 15 分以内**に複製。**SLA は 99.9% を 15 分以内（月間）**。メトリクスとイベント通知を含む。CRR にも SRR にも使える
- **S3 Batch Replication**: **既存のオブジェクトの複製**に使う（ライブレプリケーションは新規オブジェクトのみ）。**ソースバケットにレプリケーション設定が既にあること**が前提。マニフェスト（S3 生成、または Inventory / CSV）が必要で、**S3 生成のマニフェストはソースと同じリージョン**に保存される。実行中は**ライフサイクルルールを無効にすることを推奨**（宛先が完全なレプリカにならないことがある）。**宛先からバージョン ID 指定で削除したオブジェクトの再複製は不可**（ソースを Batch Copy でその場コピーして新バージョンを作る）
- 判断: 「既存オブジェクトも別リージョンへ複製したい」→ **Batch Replication**、「15 分以内の複製を SLA で保証」→ **RTC**、「宛先を誤削除から守る」→ **削除マーカーは既定で複製されない**

## S3 Object Lock
- **WORM（write-once-read-many）**モデル。**バージョニングが有効なバケットでのみ**動作。保護は**指定したオブジェクトバージョン**だけに適用される
- **保持期間（retention period）**: 固定（保持期限日を指定）または可変（イベントホールドとその期間。ホールド解除時に保持期限日が設定される）。オブジェクト単位、またはバケットの**既定保持期間**で設定。バケットポリシーで **`s3:object-lock-remaining-retention-days`** 条件キーを使い、許容する保持期間の範囲を制限できる
- **保持モード**:
  - **ガバナンスモード**: 特別な権限を持つユーザーだけがロック設定の変更・削除ができる。保持期間の**テストに使える**
  - **コンプライアンスモード**: **root ユーザーを含め誰も**上書き・削除できない。**モードの変更も保持期間の短縮もできない**
- **リーガルホールド**: 保持期間と同じ保護だが**期限がなく、明示的に解除するまで有効**。保持期間とは**独立**（両方、片方だけ、なしのどれも可）
- 規制対応: **SEC 17a-4、CFTC、FINRA** について Cohasset Associates の評価を受けている
- 判断: 「root ユーザーでも保持期間中は削除できないようにしたい（規制）」→ **コンプライアンスモード**、「特定のユーザーだけ例外的に削除できる」→ **ガバナンスモード**、「訴訟のため期限を決めずに保全」→ **リーガルホールド**

## S3 マルチリージョン アクセスポイント / アクセスポイント / Transfer Acceleration
- **Multi-Region Access Point（MRAP）**: **複数リージョンのバケットにまたがるグローバルエンドポイント**。**ネットワーク遅延が最も小さいバケットにリクエストをルーティング**。内部で **Global Accelerator** を使うため、**Transfer Acceleration を別途有効にする必要はない**（ブログ）。**CRR と組み合わせる**と、最も遅延の小さいコピーへ動的にルーティングできる（FAQ）。インターネット・VPC・オンプレのリクエストに対応
- **Transfer Acceleration との違い（FAQ）**: Transfer Acceleration は**単一バケット**への長距離転送を高速化。MRAP は**複数リージョンの複数バケット**にまたがる
- **MRAP の権限**: クロスアカウントのリクエストは **MRAP ポリシー、IAM ポリシー、（ルーティング先の）バケットポリシー**のすべてが許可する必要がある。**同一アカウントは IAM ポリシーだけ**でよい。MRAP ポリシーで **VPC からのリクエストのみ**に制限できる。MRAP のポリシーの制限は、**MRAP 経由のリクエストにだけ**適用され、バケットへの直接アクセスは変わらない
- **CloudFront の OAC で MRAP をオリジンに**できる。ただし**オプトインリージョンのバケットを含む MRAP は非対応**
- **アクセスポイント**: 1 バケットあたり最大 **10,000**（ブログ）。それぞれに固有の権限とネットワーク制御。**同一アカウントまたは信頼する別アカウントのバケット**にリンクできる。アクセスポイントポリシーは**リソースベースで、バケットポリシーと合わせて評価**される

## Storage Gateway
| タイプ | インターフェイス | データの置き場所 |
|---|---|---|
| **S3 File Gateway** | NFS / SMB | **S3 にオブジェクトとして保存**（ローカルキャッシュ）。S3 から直接オブジェクトとして参照でき、バケットポリシーも適用できる。監査ログを出力 |
| **FSx File Gateway** | SMB | **FSx for Windows File Server** |
| **Volume Gateway** | iSCSI（ブロック） | **キャッシュ型**: 主データは S3、頻繁なデータをローカルキャッシュ / **保管型**: 主データはローカル、S3 へ非同期バックアップ |
| **Tape Gateway** | iSCSI の仮想テープライブラリ（VTL） | 仮想テープは S3 に保存、**Glacier / Glacier Deep Archive にアーカイブ** |
- **Volume Gateway**: ボリュームのポイントインタイムコピーは **EBS スナップショット**として AWS に保存され、**AWS Backup** で保持を管理できる。EBS スナップショットは **Volume Gateway のボリュームにも EBS ボリュームにも復元可能**
- **キャッシュ型ボリューム**: **1 GiB〜32 TiB**、ゲートウェイあたり最大 **32 ボリューム、合計 1,024 TiB（1 PiB）**。書き込みはまず**ローカルのキャッシュストレージ**に置かれ、その後 S3 へアップロードされる。ローカル用の**キャッシュストレージとアップロードバッファ**を割り当てる
- 判断: 「オンプレのアプリのバックアップ先を、既存のバックアップソフトを変えずに AWS へ」→ **Tape Gateway**、「オンプレの NAS を S3 のデータレイクに取り込む」→ **S3 File Gateway**、「オンプレの SMB 共有を FSx for Windows に置き、拠点でキャッシュ」→ **FSx File Gateway**（ブログの表現。FSx File Gateway から FSx への直接アクセスへ切り替える手順のブログもあるが、位置づけの変化は未確認）

## FSx
| | Windows File Server | Lustre | NetApp ONTAP | OpenZFS |
|---|---|---|---|---|
| 配置 | **Single-AZ / Multi-AZ** | **Single-AZ のみ**（Persistent / Scratch） | **Single-AZ / Multi-AZ** | **Single-AZ / Multi-AZ** |
| 可用性 SLA（原文） | Multi-AZ **99.99%**、Single-AZ **99.5%** | Single-AZ **99.5%** | Multi-AZ **99.99%**、Single-AZ **99.9%** | Multi-AZ **99.99%**、Single-AZ **99.5%** |
| リージョン間レプリケーション | なし（バックアップはクロスリージョン / クロスアカウント可） | S3 のクロスリージョンレプリケーション経由 | **NetApp SnapMirror** | なし（バックアップはクロスリージョン可） |
| スナップショット | ✓ | なし（バックアップのみ） | ✓（+ インスタント クローン） | ✓（+ インスタント クローン） |
- **Windows File Server**: **DFS Namespaces** に対応（複数のファイルシステムを 1 つのフォルダ構造にまとめる。リンクターゲットにファイルシステムの DNS 名を設定）
- **Lustre**: **スクラッチ**は一時的なデータ向けで、**データは複製されず、サーバー障害で失われる**。**永続**はデータが複製され、障害時にサーバーが置き換えられる。**スクラッチ → 永続の変換は不可**（S3 を経由して移行）。**スクラッチはバックアップ不可**。**S3 のバケット / プレフィックスとデータリポジトリ関連付け（DRA）で連携**（1 ファイルシステムあたり最大 8 つ。自動インポート / エクスポートを選べる。scratch_1 は非対応）。**複数のファイルシステムを同じ S3 バケットにリンクできる**が、同じファイルを複数で更新した場合の競合は**アプリ側で調整**が必要
- **ONTAP**: **NFS、SMB、iSCSI、NVMe/TCP** に対応（iSCSI は HA ペア 6 個以下）。SVM ごとにエンドポイントがある。**Multi-AZ のオンプレアクセスは VPN / Direct Connect + Transit Gateway**。オンプレとのキャッシュは **NetApp FlexCache / Global File Cache**
- 判断: 「Lustre のデータを S3 の永続的な保存先と同期」→ **DRA**、「スクラッチの Lustre が障害で失われるのが許容できない」→ **永続**、「ONTAP のリージョン間 DR」→ **SnapMirror**

## EFS
- **ストレージクラス**（原文）: **Standard**（SSD、サブミリ秒、複数 AZ）、**Infrequent Access（IA）**（四半期に数回）、**Archive**（年に数回以下）。**One Zone / One Zone-IA** は単一 AZ に冗長保存され、**AWS Backup で自動バックアップ**される。**ファイルシステム作成後にストレージクラスは変更できない**（コンソールのヘルプパネルの記述。Standard と One Zone の間の変更も不可という趣旨）
- **ライフサイクル管理**: 既定の推奨ポリシーは **Standard → IA が 30 日アクセスなし、→ Archive が 90 日アクセスなし**。**EFS Intelligent-Tiering**で IA / Archive から Standard へ戻せる。Archive は **Elastic スループット**が前提で、Archive へ移行するポリシーがあると**スループットモードを Bursting / Provisioned に変更できない**
- **スループットモード**: **Bursting**（スループットが保存量に比例、バーストクレジット）、**Provisioned**（保存量と独立して指定。**常時安定した高スループット**向け）、**Elastic**（自動でスケールし、**転送量（GiB）で課金**。**負荷が読めない・スパイクする**場合に向く。**General Purpose パフォーマンスモードが必要**）。Provisioned でも、保存量から得られるベースラインの方が高ければ Bursting 相当になる
- 判断: 「アクセスが予測できずスパイクする」→ **Elastic**、「常に一定の高スループットが必要」→ **Provisioned**、「バーストクレジットが枯渇する」→ **Elastic / Provisioned へ変更**（`BurstCreditBalance` を監視）、「コスト削減のため単一 AZ でよい」→ **One Zone**

## 判断ポイント
- 「オンプレから S3 へファイルを NFS / SMB で書き込み、S3 側でも直接オブジェクトとして使う」→ **S3 File Gateway**
- 「既存のテープバックアップを AWS に置き換え」→ **Tape Gateway**
- 「オンプレの iSCSI ボリュームで、全データを常にローカルに置く」→ **Volume Gateway 保管型**、「ローカルは頻繁なデータだけ」→ **キャッシュ型**
- 「規制で root も削除不可の WORM」→ **Object Lock コンプライアンスモード**（バージョニング必須）
- 「複数リージョンのバケットへ、最寄りのバケットに自動ルーティング」→ **MRAP（+ CRR）**
- 「複製の遅延を 15 分以内に保証」→ **S3 RTC**（SLA は 99.9%）
- 「既存オブジェクトを別バケットへ複製」→ **Batch Replication**
- 「Windows のファイル共有（AD、DFS、SMB）」→ **FSx for Windows**、「HPC / 機械学習の高スループット」→ **FSx for Lustre**（S3 と連携）、「NFS + SMB + iSCSI」→ **FSx for ONTAP**
- 「Linux の共有ファイル、複数 AZ のインスタンスから」→ **EFS**

## 未確認
- **S3**: Standard-IA / One Zone-IA の最小期間・最小サイズ、**S3 Express One Zone**、Glacier の取り出しオプション（Expedited / Standard / Bulk）と料金、ライフサイクル移行の制約、**S3 Inventory / Storage Lens**、**Object Lambda**、**署名付き URL**、**バケットポリシーによる VPC エンドポイント制限**、**SSE-S3 / SSE-KMS / DSSE-KMS の詳細**、**MFA Delete**、**Multi-part upload の上限**、**Byte-range fetch**、**CRR のクロスアカウント時の所有者オーバーライド**、**Block Public Access**、**Access Points の VPC 制限**
- **Storage Gateway**: **FSx File Gateway の今後の扱い**（原文で最新状況を要確認）、**ホスト先（オンプレ VM / EC2 / ハードウェアアプライアンス）**、**帯域制限**、**Volume Gateway の保管型の上限**、**S3 File Gateway のキャッシュ更新**（RefreshCache）、S3 ストレージクラスの選択
- **FSx**: **Windows の AD 連携（AWS Managed Microsoft AD / セルフマネージド）**、**Windows の Multi-AZ フェイルオーバー**、**Lustre のスループット階層**、**ONTAP の階層化（容量プール）**、**OpenZFS の用途**、**FSx のバックアップ**
- **EFS**: **パフォーマンスモード（General Purpose / Max I/O）**、**リージョン間レプリケーション**、**マウントターゲットとセキュリティグループ**、**アクセスポイント**、**転送中 / 保管時の暗号化**、**EFS の料金**、**AWS DataSync でのデータ移行**
- **選定全般**: EBS / インスタンスストア / EFS / FSx の総合比較

## 疑問・確認したい点
