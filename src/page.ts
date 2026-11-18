/** Webview page markup. Shared by the extension and the browser preview (no vscode import here). */
export function pageHtml(o: { csp?: string; nonce?: string; css: string; js: string; blocklyMedia: string; previewWorkspace?: object }): string {
  const n = o.nonce ? ` nonce="${o.nonce}"` : '';
  const preview = o.previewWorkspace ? `window.PREVIEW_WORKSPACE = ${JSON.stringify(o.previewWorkspace).replace(/</g, '\\u003c')};` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${o.csp ? `<meta http-equiv="Content-Security-Policy" content="${o.csp}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${o.css}">
<title>TypeBlocks</title>
</head>
<body>
<header id="bar">
  <div class="brand">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="12" height="7" rx="2" fill="#EF7D1A"/><rect x="6" y="12" width="16" height="7" rx="2" fill="#2F7FDB"/><path d="M6 10h4v2H6z" fill="#EF7D1A"/></svg>
    <b>TypeBlocks</b><span id="fileName" class="file">program.ts</span>
  </div>
  <div class="actions">
    <button id="cleanUp" class="ghost" title="Tidy up block positions">Tidy</button>
    <button id="showCode" class="ghost" title="Back to the normal TypeScript editor"><i class="code">&lt;/&gt;</i>Code</button>
    <button id="stop" class="stop" disabled title="Stop the program"><i class="sq"></i>Stop</button>
    <button id="run" class="run" title="Run this file in the terminal"><i class="tri"></i><span>Run</span></button>
  </div>
</header>
<div id="banner" hidden></div>
<div id="work">
  <div id="stage">
    <main id="blockly"></main>
    <div id="floatStack">
      <aside id="arrays" hidden>
        <button id="arraysToggle" class="arraysHead" title="Show / hide">Arrays at the start <span class="chev"></span></button>
        <div id="arraysBody"></div>
      </aside>
    </div>
  </div>
</div>
<section id="console" class="folded" aria-label="Console">
  <div id="conResize" title="Drag to resize"></div>
  <div id="conHead">
    <div id="conStatus" data-kind="idle"><i></i><span>Console</span></div>
    <span id="conTime"></span>
    <span class="grow"></span>
    <button id="conTest" class="pill" title="Run the project's tests (npm test)"><svg viewBox="0 0 16 16"><path d="M6 2h4M6.8 2v4.2L3.4 12.3A1.2 1.2 0 0 0 4.5 14h7a1.2 1.2 0 0 0 1.1-1.7L9.2 6.2V2M5 10h6"/></svg><span>Test</span></button>
    <div class="layoutWrap">
      <button id="conLayout" class="icon" title="Where the console sits" aria-haspopup="menu"><svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 9.5h12"/></svg></button>
      <div id="layoutMenu" role="menu" hidden>
        <button role="menuitemradio" data-layout="bottom"><svg viewBox="0 0 20 16"><rect x="1.5" y="1.5" width="17" height="13" rx="2"/><rect x="1.5" y="10" width="17" height="4.5" class="fill"/></svg>Bottom, full width</button>
        <button role="menuitemradio" data-layout="right"><svg viewBox="0 0 20 16"><rect x="1.5" y="1.5" width="17" height="13" rx="2"/><rect x="12.5" y="1.5" width="6" height="13" class="fill"/></svg>Right, full height</button>
        <button role="menuitemradio" data-layout="float-above"><svg viewBox="0 0 20 16"><rect x="1.5" y="1.5" width="17" height="13" rx="2"/><rect x="11" y="4" width="6" height="4" rx="1" class="fill"/><rect x="11" y="9" width="6" height="3.5" rx="1"/></svg>Card, above Arrays</button>
        <button role="menuitemradio" data-layout="float-below"><svg viewBox="0 0 20 16"><rect x="1.5" y="1.5" width="17" height="13" rx="2"/><rect x="11" y="3.5" width="6" height="3.5" rx="1"/><rect x="11" y="8" width="6" height="4.5" rx="1" class="fill"/></svg>Card, below Arrays</button>
      </div>
    </div>
    <button id="conClear" class="icon" title="Clear"><svg viewBox="0 0 16 16"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.5h5.8l.6-9.5"/></svg></button>
    <button id="conFold" class="icon" title="Show / hide"><svg viewBox="0 0 16 16"><path d="M4 10l4-4 4 4"/></svg></button>
  </div>
  <div id="conBody">
    <pre id="conOut"></pre>
    <form id="conForm" autocomplete="off"><span class="caret">&rsaquo;</span><input id="conInput" spellcheck="false" placeholder="type an answer, then Enter" disabled></form>
  </div>
</section>
<div id="modal" hidden>
  <div class="card" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <h2 id="mTitle"></h2>
    <p id="mMsg" hidden></p>
    <input id="mInput" spellcheck="false" autocomplete="off" hidden>
    <textarea id="mCode" spellcheck="false" hidden></textarea>
    <div id="mTypes" class="chips" hidden></div>
    <div class="row">
      <button id="mDanger" class="danger" hidden></button>
      <span class="grow"></span>
      <button id="mCancel" class="ghost">Cancel</button>
      <button id="mOk" class="primary">OK</button>
    </div>
  </div>
</div>
<script${n}>window.BLOCKLY_MEDIA = ${JSON.stringify(o.blocklyMedia)};${preview}</script>
<script${n} src="${o.js}"></script>
</body>
</html>`;
}
