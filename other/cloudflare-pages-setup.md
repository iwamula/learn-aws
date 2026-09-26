# スマホで見る: Cloudflare Pages + Access の設定手順

`docs/` はコミット済みの静的HTMLなので、ビルド不要でそのまま配信できる。設定は Cloudflare のダッシュボードで行う（コード変更は不要）。

## 1. Pages プロジェクトを作る
1. https://dash.cloudflare.com にログイン（無ければ無料アカウントを作成）
2. Workers & Pages → Create → Pages → Connect to Git → GitHub の `iwamula/learn-aws` を選択
3. ビルド設定
   - Production branch: `main`
   - Framework preset: None
   - Build command: 空欄
   - Build output directory: `docs`
4. Save and Deploy。`https://<プロジェクト名>.pages.dev` が発行される

以降は `main` に push するたびに自動デプロイされる。HTML を更新したら `npm run build:html` → コミット → push。

## 2. Access で非公開にする
Pages の `*.pages.dev` はそのままだと誰でも見られるので、Access で保護する。
1. Zero Trust（https://one.dash.cloudflare.com）を開く。初回はチーム名を決め、Free プラン（50ユーザーまで無料）を選ぶ
2. Access → Applications → Add an application → Self-hosted
3. Application domain: `<プロジェクト名>.pages.dev`（プレビュー用 `*.<プロジェクト名>.pages.dev` も保護したければ別途追加）
4. Policy: Action = Allow、Include = Emails → 自分のメールアドレス
5. Login method は One-time PIN（既定）でよい

## 3. スマホで確認
URL を開く → メールアドレスを入力 → 届いたコードを入力。セッション期間（既定24時間）内は再認証不要。

## 注意
- GitHub リポジトリ `iwamula/learn-aws` は **PUBLIC**。Access で守れるのはサイトだけで、`notes/` の Markdown と `docs/` の HTML は GitHub 上で誰でも読める。サイトも含めて非公開にしたい場合は、リポジトリを private にする（Cloudflare 側の GitHub 連携は private リポジトリにも対応）
- `qa/` は gitignore 済みなので、公開されない
