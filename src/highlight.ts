/** Tiny TypeScript highlighter (guide + recipe cards). */

const KW = new Set('const let var function return if else for while of in async await new typeof as type interface export import from class true false null undefined break continue this'.split(' '));
const TYPES = new Set('number string boolean void any unknown Promise'.split(' '));

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(line: string): string {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(=>|===|!==|[{}()[\];,.:<>=+\-*/%!&|?])/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    last = m.index + m[0].length;
    const [tok, com, str, num, word] = m;
    if (com) out += `<span class="t-com">${esc(tok)}</span>`;
    else if (str) out += `<span class="t-str">${esc(tok)}</span>`;
    else if (num) out += `<span class="t-num">${tok}</span>`;
    else if (word) {
      const next = line.slice(last).trimStart()[0];
      if (KW.has(word)) out += `<span class="t-kw">${word}</span>`;
      else if (TYPES.has(word) || /^[A-Z]/.test(word)) out += `<span class="t-type">${word}</span>`;
      else if (next === '(') out += `<span class="t-fn">${word}</span>`;
      else out += `<span class="t-id">${word}</span>`;
    } else out += `<span class="t-op">${esc(tok)}</span>`;
  }
  return out + esc(line.slice(last));
}
