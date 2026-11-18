/**
 * Translations. English text is the key; a missing Czech entry simply stays English.
 * Language comes from the page (window.TB_LANG), or ?lang=cs in the browser preview.
 */
export type Lang = 'en' | 'cs';

let lang: Lang = 'en';

export function setLang(l: string | undefined): void {
  lang = l === 'cs' ? 'cs' : 'en';
}

export function getLang(): Lang {
  return lang;
}

if (typeof window !== 'undefined') {
  const w = window as unknown as { TB_LANG?: string };
  let q: string | null = null;
  try {
    q = new URLSearchParams(window.location.search).get('lang');
  } catch {
    /* no location */
  }
  setLang(q ?? w.TB_LANG);
}

/** Translate an English UI text. */
export function tr(s: string): string {
  return lang === 'cs' ? CS[s] ?? s : s;
}

/** Translate and fill in {0} {1} ... */
export function trf(s: string, ...args: (string | number)[]): string {
  return tr(s).replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)]));
}

const CS: Record<string, string> = {
  // ---- toolbox ----
  Events: 'Události',
  Control: 'Řízení',
  Console: 'Konzole',
  Operators: 'Operátory',
  Text: 'Text',
  Variables: 'Proměnné',
  Arrays: 'Pole',
  Functions: 'Funkce',
  Objects: 'Objekty',
  Code: 'Kód',
  'Describe what an object looks like:': 'Popiš, jak objekt vypadá:',
  'Make one:': 'Vytvoř objekt:',
  'Read or change a property:': 'Přečti nebo změň vlastnost:',
  'Types:': 'Typy:',

  // ---- blocks ----
  'when %1 Run clicked': 'po kliknutí na %1 Spustit',
  'every %1 seconds': 'každých %1 sekund',
  'wait %1 seconds': 'čekej %1 sekund',
  'repeat %1 times': 'opakuj %1 krát',
  'count %1 from %2 to %3': 'počítej %1 od %2 do %3',
  forever: 'pořád dokola',
  'return %1': 'vrať %1',
  'stop program': 'zastav program',
  'say %1': 'řekni %1',
  'say %1 in %2': 'řekni %1 barvou %2',
  'ask %1 and wait': 'zeptej se %1 a počkej',
  'ask number %1': 'zeptej se na číslo %1',
  'not %1': 'ne %1',
  'pick random %1 to %2': 'náhodné číslo od %1 do %2',
  '%1 contains %2 ?': '%1 obsahuje %2 ?',
  'length of %1': 'délka %1',
  'number from %1': 'číslo z %1',
  'text from %1': 'text z %1',
  '%1 in %2': '%1 jako %2',
  '%1 add %2 to the end of %3': '%1 přidej %2 na konec pole %3',
  '%1 add %2 to the start of %3': '%1 přidej %2 na začátek pole %3',
  '%1 insert %2 at index %3 of %4': '%1 vlož %2 na pozici %3 do pole %4',
  '%1 remove item at index %2 of %3': '%1 odeber prvek na pozici %2 z pole %3',
  '%1 remove the %2 item of %3': '%1 odeber %2 prvek pole %3',
  '%1 set item at index %2 of %3 to %4': '%1 nastav prvek na pozici %2 v poli %3 na %4',
  '%1 for each %2 in %3': '%1 pro každý %2 v %3',
  '%1 item at index %2 of %3': '%1 prvek na pozici %2 z pole %3',
  '%1 last item of %2': '%1 poslední prvek pole %2',
  '%1 length of %2': '%1 délka pole %2',
  '%1 %2 contains %3 ?': '%1 %2 obsahuje %3 ?',
  '%1 index of %2 in %3': '%1 pozice %2 v poli %3',
  '%1 join %2 with %3': '%1 spoj %2 pomocí %3',
  'split %1 by %2': 'rozděl %1 podle %2',
  'starts with': 'začíná na',
  'ends with': 'končí na',
  'text.startsWith(part) / text.endsWith(part) - does the text begin / end with it?': 'text.startsWith(část) / text.endsWith(část) - začíná, nebo končí text tím?',
  '%1 from %2 make a new array: each %3 becomes %4': '%1 z %2 udělej nové pole: každé %3 se změní na %4',
  '%1 from %2 keep only each %3 where %4': '%1 z %2 nech jen každé %3, kde %4',
  '%1 is there any %2 in %3 where %4 ?': '%1 je v %3 nějaké %2, pro které platí %4 ?',
  '%1 is every %2 in %3 such that %4 ?': '%1 platí pro každé %2 v %3, že %4 ?',
  '%1 first %2 in %3 where %4': '%1 první %2 v %3, kde %4',
  '%1 index of the first %2 in %3 where %4': '%1 pozice prvního %2 v %3, kde %4',
  '%1 add up %2 starting from %3 : %4 + each %5 gives %6': '%1 sečti %2 od hodnoty %3 : %4 + každé %5 dá %6',
  '%1 with each %2 in %3 do': '%1 s každým %2 v %3 udělej',
  '%1 of %2': '%1 z %2',
  'set %1 of %2 to %3': 'nastav %1 z %2 na %3',
  'type of %1': 'typ %1',
  '%1 is a %2 ?': '%1 je %2 ?',
  'has:': 'má:',

  // ---- dropdown options ----
  red: 'červená', green: 'zelená', yellow: 'žlutá', blue: 'modrá', magenta: 'fialová', cyan: 'tyrkysová',
  and: 'a', or: 'nebo', 'or else (??)': 'nebo jinak (??)', mod: 'zbytek',
  last: 'poslední', first: 'první', sort: 'seřaď', reverse: 'obrať',
  UPPERCASE: 'VELKÝMI', lowercase: 'malými',
  '== (loose)': '== (volné)', '!= (loose)': '!= (volné)',

  // ---- tooltips ----
  'Starts here when you press Run. Becomes async function main() { ... } main();': 'Tady program začne, když stiskneš Spustit. V kódu je to async function main() { ... } main();',
  'Runs the blocks below again and again. Becomes setInterval(...).': 'Spouští bloky pod sebou pořád dokola. V kódu je to setInterval(...).',
  'Pause. Becomes await sleep(seconds).': 'Pauza. V kódu je to await sleep(sekundy).',
  'for (let i = 0; i < times; i++) { ... }': 'Zopakuje vnitřek tolikrát, kolik zadáš: for (let i = 0; i < kolikrat; i++) { ... }',
  'for (let i = from; i <= to; i++) { ... }': 'Počítá od jednoho čísla k druhému; v proměnné máš aktuální číslo: for (let i = od; i <= do; i++) { ... }',
  'while (true) { ... } - put a wait or a break inside!': 'while (true) { ... } - dovnitř dej čekání nebo break, jinak to nikdy neskončí!',
  'Leave the function (and give back a value, if one is plugged in).': 'Opustí funkci (a vrátí hodnotu, pokud je nějaká vložená).',
  'Print to the console. Becomes console.log(...).': 'Vypíše do konzole. V kódu je to console.log(...).',
  'Print in color.': 'Vypíše barevně.',
  'Ask a question in the terminal; gives back the answer as a string.': 'Zeptá se v konzoli; odpověď je text.',
  'Ask a question and turn the answer into a number.': 'Zeptá se a odpověď změní na číslo.',
  'A comment: a note for people, the computer skips it.': 'Komentář: poznámka pro lidi, počítač ji přeskočí.',
  'Create a variable. let = can change later, const = never changes. The type says what it holds (leave it empty to let TypeScript guess).':
    'Vytvoří proměnnou. let = může se později změnit, const = nikdy se nezmění. Typ říká, co v ní je (nech prázdný a TypeScript to uhodne).',
  'Math. + also joins text.': 'Počítání. + také spojuje texty.',
  'Compare two values: true or false.': 'Porovná dvě hodnoty: ano (true) nebo ne (false).',
  'and = both true, or = at least one true.': 'a = platí obojí, nebo = platí aspoň jedno.',
  'Whole random number between the two values (both included).': 'Náhodné celé číslo mezi dvěma hodnotami (obě krajní se počítají).',
  'value.includes(part) - works for text and arrays.': 'hodnota.includes(část) - funguje pro text i pole.',
  'An array: a numbered row of values. The first one is index 0. Use + and - to add or remove slots.':
    'Pole: očíslovaná řada hodnot. První má index 0. Tlačítky + a - přidáš nebo ubereš místo.',
  'list.push(item) - the array gets 1 longer.': 'pole.push(věc) - pole bude o 1 delší.',
  'list.unshift(item) - every other item moves up one index.': 'pole.unshift(věc) - všechno ostatní se posune o jedno místo dál.',
  'list.splice(index, 1) - the first item is index 0.': 'pole.splice(index, 1) - první prvek má index 0.',
  'list[index] = item': 'pole[index] = věc',
  'list[index] - the first item is index 0.': 'pole[index] - první prvek má index 0.',
  'list.length - how many items it has.': 'pole.length - kolik má prvků.',
  'list.pop() removes the last item, list.shift() the first one.': 'pole.pop() odebere poslední prvek, pole.shift() první.',
  'list.sort() puts items in order, list.reverse() flips the order.': 'pole.sort() seřadí prvky, pole.reverse() obrátí pořadí.',
  'for (const item of list) { ... } - runs once per item.': 'for (const vec of pole) { ... } - proběhne jednou pro každý prvek.',
  'list.indexOf(item) - gives -1 if it is not there.': 'pole.indexOf(věc) - vrátí -1, když tam věc není.',
  'list.join(separator) - all items glued into one text.': 'pole.join(oddělovač) - všechny prvky slepí do jednoho textu.',
  'text.split(separator) - cuts text into an array.': 'text.split(oddělovač) - rozseká text na pole.',
  'list.map(...) - like a factory: every item goes in, a changed item comes out. The new array is just as long.':
    'pole.map(...) - jako továrna: každá věc vstoupí, změněná vyjde. Nové pole je stejně dlouhé.',
  'list.filter(...) - like a sieve: only the items where the condition is true stay.': 'pole.filter(...) - jako síto: zůstanou jen věci, pro které podmínka platí.',
  'list.some(...) - true if at least ONE item matches.': 'pole.some(...) - ano, když vyhovuje aspoň JEDNA věc.',
  'list.every(...) - true only if ALL items match.': 'pole.every(...) - ano, jen když vyhovují VŠECHNY věci.',
  'list.find(...) - the first item that matches (or undefined if none does).': 'pole.find(...) - první věc, která vyhovuje (nebo undefined, když žádná).',
  'list.findIndex(...) - where the first matching item is (or -1).': 'pole.findIndex(...) - kde je první vyhovující věc (nebo -1).',
  'list.reduce(...) - goes through the items one by one and builds one result, e.g. a sum. "total" is the result so far.':
    'pole.reduce(...) - projde věci jednu po druhé a složí z nich jeden výsledek, např. součet. "total" je výsledek zatím.',
  'list.forEach(...) - runs the blocks inside once for every item.': 'pole.forEach(...) - spustí vnitřek jednou pro každou věc.',
  'object.property - one value stored inside an object, e.g. "price of order" is order.price': 'objekt.vlastnost - jedna hodnota uložená v objektu, např. "cena z objednávka" je objednavka.cena',
  'object.property = value': 'objekt.vlastnost = hodnota',
  'An object: named values that belong together, e.g. an order with an item name, a count and a price.':
    'Objekt: pojmenované hodnoty, které k sobě patří, např. objednávka s položkou, počtem a cenou.',
  'Describes what an object looks like: which properties it has and what type each one is. TypeScript then checks you use it right.':
    'Popisuje, jak objekt vypadá: jaké má vlastnosti a jakého typu. TypeScript pak hlídá, že ho používáš správně.',
  'typeof value - "number", "string", "boolean", ...': 'typeof hodnota - "number", "string", "boolean", ...',
  'Type assertion: tells TypeScript the type. Does NOT convert the value.': 'Řekne TypeScriptu typ. Hodnotu NEPŘEVEDE.',
  'Any TypeScript value, written by hand.': 'Libovolná hodnota v TypeScriptu, napsaná ručně.',
  'TypeScript written as text. Click the pencil to edit it.': 'TypeScript zapsaný jako text. Klikni na tužku a uprav ho.',
  'A for loop written the TypeScript way.': 'Cyklus for zapsaný po typescriptovsku.',

  // ---- blockly builtin overrides ----
  function: 'funkce',
  'with:': 's:',
  return: 'vrať',
  'repeat while': 'opakuj dokud platí',
  'repeat until': 'opakuj dokud neplatí',
  'set %1 to %2': 'nastav %1 na %2',
  'change %1 by %2': 'změň %1 o %2',

  // ---- flyouts & dialogs ----
  '+ Make a variable': '+ Vytvořit proměnnou',
  '+ Make an array': '+ Vytvořit pole',
  'Create it (once):': 'Vytvoř ji (jednou):',
  'Use it:': 'Použij ji:',
  'An array is a numbered row of values. The first one is number 0.': 'Pole je očíslovaná řada hodnot. První má číslo 0.',
  'Change it:': 'Změň ho:',
  'Look inside it:': 'Podívej se dovnitř:',
  'Do something with every item (item = the one it is looking at now):': 'Udělej něco s každou věcí (item = ta, na kterou se zrovna díváme):',
  'The whole array:': 'Celé pole:',
  'Right-click a function block to set its types.': 'Pravým klikem na funkci nastavíš typy.',
  'Edit TypeScript': 'Upravit TypeScript',
  Save: 'Uložit',
  'Ctrl+Enter saves.': 'Ctrl+Enter uloží.',
  'New array': 'Nové pole',
  'New variable': 'Nová proměnná',
  'What will the array hold? (an array of strings is written string[])': 'Co bude pole obsahovat? (pole textů se píše string[])',
  'What kind of value will it hold?': 'Jaká hodnota v ní bude?',
  Create: 'Vytvořit',
  '"{0}" can\'t be a name': '"{0}" nemůže být jméno',
  'Use letters, digits and _ (no spaces, not starting with a digit).': 'Používej písmena, číslice a _ (bez mezer, nesmí začínat číslicí).',
  '"{0}" already exists.': '"{0}" už existuje.',
  'Type of parameter "{0}"': 'Typ parametru "{0}"',
  'e.g. number, string, boolean, string[]': 'např. number, string, boolean, string[]',
  'What does {0} give back?': 'Co vrací {0}?',
  'Leave empty to let TypeScript work it out.': 'Nech prázdné a TypeScript to zjistí sám.',
  'Set parameter & return types...': 'Nastavit typy parametrů a výsledku...',
  Cancel: 'Zrušit',
  Delete: 'Smazat',
  'starts with {0} item': 'začíná s {0} prvkem',
  'starts with {0} items': 'začíná s {0} prvky',
  'empty array []': 'prázdné pole []',
  Restart: 'Znovu',
  Run: 'Spustit',
  'Could not show these blocks: {0}': 'Tyto bloky se nepodařilo zobrazit: {0}',

  // ---- updater ----
  'TypeBlocks {0} is up to date.': 'TypeBlocks {0} je aktuální.',
  Update: 'Aktualizovat',
  Later: 'Později',
  'Skip this version': 'Přeskočit tuto verzi',
  'Open release page': 'Otevřít stránku vydání',
  'TypeBlocks {0} is available (you have {1}).': 'Je dostupný TypeBlocks {0} (máš {1}).',
  'Could not check for updates: {0}': 'Nepodařilo se zjistit aktualizace: {0}',
  'Updating TypeBlocks to {0} ...': 'Aktualizuji TypeBlocks na {0} ...',
  Reload: 'Načíst znovu',
  'TypeBlocks was updated to {0}. Reload VS Code to start using it.': 'TypeBlocks byl aktualizován na {0}. Načti VS Code znovu a začneš ho používat.',

  // ---- header & console ----
  Tidy: 'Uspořádat',
  'Tidy up block positions': 'Uspořádá bloky pod sebe',
  'Back to the normal TypeScript editor': 'Zpět do běžného editoru TypeScriptu',
  Stop: 'Stop',
  'Stop the program': 'Zastaví program',
  'Run this file in the terminal': 'Spustí tento soubor',
  'Guide: how everything works (with examples)': 'Průvodce: jak co funguje (s příklady)',
  Guide: 'Průvodce',
  'Switch language': 'Přepnout jazyk',
  'Arrays at the start': 'Pole na začátku',
  'Show / hide': 'Zobrazit / skrýt',
  'Drag to resize': 'Tažením změníš velikost',
  "Run the project's tests (npm test)": 'Spustí testy projektu (npm test)',
  Test: 'Test',
  'Where the console sits': 'Kde je konzole',
  'Bottom, full width': 'Dole, přes celou šířku',
  'Right, full height': 'Vpravo, přes celou výšku',
  'Card, above Arrays': 'Karta nad panelem Pole',
  'Card, below Arrays': 'Karta pod panelem Pole',
  Clear: 'Vymazat',
  'type an answer, then Enter': 'napiš odpověď a stiskni Enter',
  'Press Run - what your program prints shows up here.': 'Stiskni Spustit - co program vypíše, uvidíš tady.',
  Running: 'Běží',
  Testing: 'Testuje',
  Finished: 'Hotovo',
  Stopped: 'Zastaveno',
  Error: 'Chyba',
  'Tests passed': 'Testy prošly',
  'Tests failed': 'Testy neprošly',
  restarted: 'spuštěno znovu',
  'stopped after {0}': 'zastaveno po {0}',
  'finished in {0}': 'hotovo za {0}',
  'ended with error {0} after {1}': 'skončilo chybou {0} po {1}',
  'tests passed in {0}': 'testy prošly za {0}',
  'tests failed (exit {0}) after {1}': 'testy neprošly (kód {0}) po {1}',
  'Run the tests: {0}': 'Spustí testy: {0}',
  'No package.json with a "test" script found next to this file': 'Vedle tohoto souboru není package.json se skriptem "test"',
  min: 'min',
};
