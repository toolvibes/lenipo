/** Styles of exported HTML files: readable on screen and on paper, no external resources. */
export const EXPORT_CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #fff; color: #1f2328; font: 16px/1.6 Georgia, "Source Serif 4", serif; }
main { max-width: 760px; margin: 0 auto; padding: 40px 24px; }
h1, h2, h3, h4, h5, h6, .tl-path, .tl-meta, table, nav { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
h1 { font-size: 30px; line-height: 1.2; margin: 0 0 4px; }
h2 { font-size: 22px; margin: 32px 0 8px; }
h3 { font-size: 18px; margin: 24px 0 6px; }
.tl-path, .tl-meta { margin: 0; color: #656d76; font-size: 13px; }
.tl-meta { margin-bottom: 24px; }
a { color: #0b57d0; }
code { font: 0.9em ui-monospace, "JetBrains Mono", Consolas, monospace; background: #f3f4f6; padding: 0 3px; border-radius: 3px; }
pre { background: #f6f8fa; padding: 12px 14px; border-radius: 6px; overflow: auto; }
pre code { background: none; padding: 0; }
figure { margin: 16px 0; }
figcaption { color: #656d76; font-size: 13px; }
img { max-width: 100%; height: auto; }
.tl-image[data-align="center"] { text-align: center; }
.tl-image[data-align="right"] { text-align: right; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
th, td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f6f8fa; }
blockquote { margin: 12px 0; padding-left: 14px; border-left: 3px solid #d0d7de; color: #424a53; }
.tl-panel, .tl-section { margin: 12px 0; padding: 10px 14px; border-left: 4px solid #8c959f; background: #f6f8fa; border-radius: 4px; }
.tl-panel[data-kind="info"] { border-color: #0b57d0; background: #eef4fd; }
.tl-panel[data-kind="note"] { border-color: #8250df; background: #f5f0ff; }
.tl-panel[data-kind="warning"] { border-color: #bf8700; background: #fff8e5; }
.tl-panel[data-kind="success"] { border-color: #1a7f37; background: #ebf7ee; }
.tl-columns { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
.tl-columns[data-columns="1-1-1"] { grid-template-columns: 1fr 1fr 1fr; }
.tl-columns[data-columns="1-2"] { grid-template-columns: 1fr 2fr; }
.tl-columns[data-columns="2-1"] { grid-template-columns: 2fr 1fr; }
.tl-status { font: 600 11px system-ui, sans-serif; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; background: #eaeef2; }
.tl-status[data-color="blue"] { background: #ddeafe; }
.tl-status[data-color="green"] { background: #dcf3e2; }
.tl-status[data-color="yellow"] { background: #fff1c2; }
.tl-status[data-color="red"] { background: #ffe1df; }
.tl-status[data-color="purple"] { background: #efe5ff; }
.tl-issue { font-family: ui-monospace, Consolas, monospace; font-size: 0.9em; }
.tl-mention { font-weight: 600; }
.tl-macro-note { color: #656d76; font-style: italic; }
.tl-tasks { list-style: none; padding-left: 4px; }
.tl-contents { margin-bottom: 32px; }
.tl-contents ol { padding-left: 20px; }
@page { size: A4; margin: 18mm 16mm; }
@media print {
  main { max-width: none; padding: 0; }
  .tl-break { break-before: page; }
  table, pre, figure, .tl-panel { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
}
`;
