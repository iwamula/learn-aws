# 進捗と次のタスク（最終更新: 2026-09-25）

## 完了
- [x] README にロードマップ作成（試験日 2026-10-24）
- [x] Week1 ノート 01〜04（Organizations/SCP、VPC接続、ハイブリッドDNS、IAM評価）
- [x] `qa/iam.md` の Q1・Q2 に回答
- [x] Week1 ノートの初回事実確認（`other/fact-check-log.md`）
- [x] Week1 残りノート作成: 05 Control Tower/Identity Center、06 DX 冗長構成、07 セキュリティサービス組織横断集約 — 2026-09-25
- [x] 未確認項目の裏取り（Control Tower コントロール種別、TGW 上限、ホスト型DX、PHZ/Resolver）— 2026-09-25

## 次にやること（優先順）
- [ ] 残りの未確認: Resolver の数値上限、Route 53 Profiles、TGW ピアリングの静的ルート（`other/fact-check-log.md` 参照。優先度低）
- [ ] Week1 新規ノート05〜07の未確認項目を裏取り: Macie/Inspector/Detective/Firewall Manager の委任管理者、DX Gateway あたりの TGW 数（6 vs 3）、LAG の条件、組織証跡の改ざん防止策
- [ ] 01 ノート末尾のクイズ形式Q&Aを残すか整理するか、ユーザーに確認
- [ ] Week2 ノート（可用性・DR・データ層）の作成へ

## メモ
- ユーザーは各ノートで気になった点を `Qn` として書き込み、AIに事実確認させる運用（クイズ形式ではない）
- `aws-core` プラグイン導入済みだが、aws-mcp は 2026-09-25 のセッションで接続でき、`search_documentation` が使えた（原文チャンクを返す）。docs.aws.amazon.com は curl でも取得可（ページ名が不明な場合は search_documentation でURLを探す）
- 今回の裏取り分（ノート01〜03、fact-check-log、todo）は未コミット。コミットはユーザーの依頼があってから
