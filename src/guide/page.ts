/** Markup of the guide page (used inside VS Code and for the web version in docs/guide). */
import { setLang } from '../i18n';

const TEXT = {
  cs: {
    title: 'TypeBlocks - průvodce',
    sub: 'průvodce',
    desc: 'Průvodce TypeBlocks: jak se z bloků stává TypeScript - s živými příklady.',
    h1: 'Z bloků se stává <span>TypeScript</span>',
    intro: 'Každý blok je kousek opravdového kódu. V každé kapitole si můžeš bloky posouvat, měnit a <b>spustit</b> - a vpravo hned vidíš, jak se to píše v TypeScriptu.',
    toc: 'Obsah',
    legend: ['Události', 'Řízení', 'Konzole', 'Operátory', 'Text', 'Proměnné', 'Pole', 'Funkce', 'Objekty', 'Kód'],
  },
  en: {
    title: 'TypeBlocks - guide',
    sub: 'guide',
    desc: 'TypeBlocks guide: how blocks become TypeScript - with live examples.',
    h1: 'Blocks become <span>TypeScript</span>',
    intro: 'Every block is a piece of real code. In every chapter you can move and change the blocks and <b>run</b> them - and on the right you see how it is written in TypeScript.',
    toc: 'Contents',
    legend: ['Events', 'Control', 'Console', 'Operators', 'Text', 'Variables', 'Arrays', 'Functions', 'Objects', 'Code'],
  },
};
const COLORS = ['#E09A0B', '#EF7D1A', '#8A63E8', '#2BA358', '#0E9E98', '#E0503A', '#C8396A', '#BE52C8', '#2F7FDB', '#5F6B7A'];

export function guidePageHtml(o: {
  csp?: string;
  nonce?: string;
  css: string[];
  scripts: string[];
  blocklyMedia: string;
  lang?: string;
  /** link to the other language (web version only) */
  alt?: { href: string; label: string };
}): string {
  const lang = o.lang === 'en' ? 'en' : 'cs';
  setLang(lang);
  const t = TEXT[lang];
  const n = o.nonce ? ` nonce="${o.nonce}"` : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
${o.csp ? `<meta http-equiv="Content-Security-Policy" content="${o.csp}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.desc}">
${o.css.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head>
<body class="guide">
<header class="gHead">
  <div class="brand">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="12" height="7" rx="2" fill="#EF7D1A"/><rect x="6" y="12" width="16" height="7" rx="2" fill="#2F7FDB"/><path d="M6 10h4v2H6z" fill="#EF7D1A"/></svg>
    <b>TypeBlocks</b><span class="sub">${t.sub}</span>
  </div>
  <div class="gLinks">${o.alt ? `<a class="langLink" href="${o.alt.href}">${o.alt.label}</a>` : ''}<a class="ghLink" href="https://github.com/LukasVitek67/typeblocks" target="_blank" rel="noopener">GitHub</a></div>
</header>
<div class="gWrap">
  <nav id="toc" aria-label="${t.toc}"></nav>
  <main id="content">
    <div class="hero">
      <h1>${t.h1}</h1>
      <p>${t.intro}</p>
      <div class="legend">
        ${t.legend.map((l, i) => `<span style="--c:${COLORS[i]}">${l}</span>`).join('')}
      </div>
    </div>
  </main>
</div>
<script${n}>window.TB_LANG = ${JSON.stringify(lang)};window.BLOCKLY_MEDIA = ${JSON.stringify(o.blocklyMedia)};</script>
${o.scripts.map((s) => `<script${n} src="${s}"></script>`).join('\n')}
</body>
</html>`;
}
