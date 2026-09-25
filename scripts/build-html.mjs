// notes/**/*.md を docs/ に HTML として出力する。md は読み取り専用。
// 使い方: npm run build:html [-- --watch]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, watch } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "notes");
const outDir = join(root, "docs");

const css = `
:root{--bg:#fff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--code:#f6f8fa;--accent:#0969da;--quote:#ddf4ff}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--code:#161b22;--accent:#4493f8;--quote:#10233a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;display:flex}
nav{position:sticky;top:0;align-self:flex-start;width:260px;flex:none;height:100vh;overflow:auto;padding:24px 16px;border-right:1px solid var(--line);font-size:14px}
nav a{display:block;color:var(--muted);text-decoration:none;padding:2px 0}
nav a:hover{color:var(--accent)}
nav a.h3{padding-left:14px;font-size:13px}
main{max-width:920px;min-width:0;padding:32px 40px 80px}
h1,h2,h3{line-height:1.35}
h2{margin-top:2.2em;padding-bottom:.3em;border-bottom:1px solid var(--line)}
h3{margin-top:1.8em}
a{color:var(--accent)}
code{background:var(--code);padding:.15em .35em;border-radius:4px;font-size:.9em}
pre{background:var(--code);padding:14px 16px;border-radius:6px;overflow:auto;line-height:1.5}
pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:.4em 1em;border-left:4px solid var(--accent);background:var(--quote);border-radius:0 6px 6px 0}
blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}
.tbl{overflow-x:auto;margin:1em 0}
table{border-collapse:collapse;font-size:14.5px;line-height:1.6}
th,td{border:1px solid var(--line);padding:6px 12px;vertical-align:top}
th{background:var(--code);text-align:left;white-space:nowrap}
tr:nth-child(even) td{background:color-mix(in srgb,var(--code) 50%,transparent)}
hr{border:0;border-top:1px solid var(--line)}
@media (max-width:860px){body{display:block}nav{position:static;width:auto;height:auto;border:0}main{padding:16px}}
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const stripTags = (s) => s.replace(/<[^>]+>/g, "");

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

const page = (title, nav, body, rootRel) => `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head>
<body><nav><a href="${rootRel}index.html"><b>← 一覧</b></a>${nav}</nav><main>${body}</main></body></html>`;

function convert(md) {
  const toc = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        if (depth === 2 || depth === 3) {
          const id = `s${toc.length}`;
          toc.push({ id, depth, text: stripTags(html) });
          return `<h${depth} id="${id}">${html}</h${depth}>\n`;
        }
        return `<h${depth}>${html}</h${depth}>\n`;
      },
    },
  });
  return { marked, toc };
}

function build() {
  const files = walk(srcDir).sort();
  const index = {};
  for (const f of files) {
    const rel = relative(srcDir, f);
    const md = readFileSync(f, "utf8");
    const { marked, toc } = convert(md);
    let body = marked.parse(md);
    body = body
      .replace(/<table>/g, '<div class="tbl"><table>')
      .replace(/<\/table>/g, "</table></div>")
      .replace(/href="([^"#:]+)\.md(#[^"]*)?"/g, 'href="$1.html$2"');
    const title = (md.match(/^#\s+(.+)$/m) || [, rel])[1];
    const depthUp = rel.split(sep).length + 1; // docs/notes/weekN/x.html → docs/index.html
    const rootRel = "../".repeat(depthUp);
    const nav = toc.map((t) => `<a class="h${t.depth}" href="#${t.id}">${esc(t.text)}</a>`).join("");
    const out = join(outDir, "notes", rel.replace(/\.md$/, ".html"));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, page(title, nav, body, rootRel));
    const week = dirname(rel);
    (index[week] ||= []).push({ title, href: `notes/${rel.replace(/\.md$/, ".html")}` });
  }
  const list = Object.entries(index)
    .map(([w, items]) => `<h2>${esc(w)}</h2><ul>${items.map((i) => `<li><a href="${i.href}">${esc(i.title)}</a></li>`).join("")}</ul>`)
    .join("");
  writeFileSync(join(outDir, "index.html"), page("SAP-C02 ノート", "", `<h1>SAP-C02 ノート</h1>${list}`, ""));
  console.log(`built ${files.length} notes → docs/`);
}

build();
if (process.argv.includes("--watch")) {
  let t;
  watch(srcDir, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(build, 200);
  });
  console.log("watching notes/ ...");
}
