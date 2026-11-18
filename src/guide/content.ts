/**
 * Průvodce TypeBlocks - obsah. Každá kapitola má vysvětlení, "Proč?" a příklad v TypeScriptu,
 * který se při sestavení převede na bloky (tools/build.mjs).
 */

export interface Section {
  id: string;
  group: string;
  title: string;
  /** HTML odstavce */
  body: string;
  /** krátké "proč to tak je" */
  why?: string;
  /** příklad - normální TypeScript */
  code?: string;
  /** jde příklad spustit v prohlížeči? */
  run?: boolean;
  /** co si zkusit */
  tryIt?: string;
}

export const SECTIONS: Section[] = [
  {
    id: 'jak',
    group: 'Začínáme',
    title: 'Jak TypeBlocks funguje',
    body: `
<p><b>Bloky a kód jsou jedno a to samé.</b> Každý blok je kousek TypeScriptu. Když posuneš nebo změníš blok, změní se kód. Když změníš kód, změní se bloky.</p>
<p>Ve VS Code otevři jakýkoli soubor <code>.ts</code> a klikni na <b>tlačítko s kostičkami</b> vpravo nahoře. Soubor se ukáže jako bloky a vedle něj pořád vidíš normální kód. <b>Ctrl+S</b> ukládá jako vždycky. Tlačítko <b>Code</b> tě vrátí zpátky k textu.</p>
<p>Zkus to tady: klikni na blok a podívej se, který řádek kódu se rozsvítí. Přepiš text v bílém okénku a sleduj kód vpravo.</p>`,
    why: 'Bloky tě naučí, jak se program skládá, a kód vedle ukazuje, jak se to píše doopravdy. Postupně budeš číst kód i bez bloků.',
    code: `console.log("Ahoj, světe!");
console.log("Tohle je můj první program.");
`,
    run: true,
    tryIt: 'Změň text v bloku "say" a pak klikni na Spustit.',
  },
  {
    id: 'tvary',
    group: 'Začínáme',
    title: 'Tvary bloků',
    body: `
<p>Podle tvaru poznáš, kam blok patří:</p>
<ul>
<li><b>Klobouček</b> (kulatý vršek) - tady program začíná, např. <i>when Run clicked</i>.</li>
<li><b>Příkaz</b> (zoubek nahoře a dole) - udělá něco, skládá se pod sebe jako lego.</li>
<li><b>Céčko</b> (tvar písmene C) - obaluje jiné bloky: opakuj, pokud, funkce.</li>
<li><b>Kulatá hodnota</b> - číslo, text, výpočet. Vkládá se do okének.</li>
<li><b>Šestiúhelník</b> - odpověď <i>ano / ne</i> (<code>true</code> / <code>false</code>).</li>
<li><b>Hranatý blok</b> - celé pole (seznam věcí).</li>
</ul>`,
    why: 'Tvar ti nedovolí udělat nesmysl: šestiúhelník nevložíš tam, kam patří příkaz. Stejně tak TypeScript hlídá, aby věci k sobě pasovaly.',
    code: `async function main(): Promise<void> {
  let jablka: number[] = [3, 5, 8];
  if (jablka.length > 2) {
    console.log("Máme hodně jablek!");
  }
}
main();
`,
    run: true,
  },
  {
    id: 'promenne',
    group: 'Základy',
    title: 'Proměnné - krabičky na hodnoty',
    body: `
<p>Proměnná je <b>krabička se jménem</b>, do které si program něco uloží. Vytvoříš ji blokem <b>let</b> (nebo <b>const</b>):</p>
<ul>
<li><code>let</code> - obsah se může později změnit</li>
<li><code>const</code> - obsah zůstane navždy stejný</li>
</ul>
<p>Za dvojtečkou je <b>typ</b>: co do krabičky patří. <code>number</code> = číslo, <code>string</code> = text, <code>boolean</code> = ano/ne.</p>
<p>V paletě <b>Variables</b> klikni na <i>+ Make a variable</i>, napiš jméno a vyber typ.</p>`,
    why: 'Typ je jako nálepka na krabici. Když se pokusíš dát text do krabičky na čísla, TypeScript tě hned upozorní - dřív, než program spadne.',
    code: `let jmeno: string = "Eliška";
let vek: number = 12;
const skola: string = "ZŠ Liberec";
vek = vek + 1;
console.log(jmeno + " má " + vek + " let a chodí do " + skola);
`,
    run: true,
    tryIt: 'Změň věk na jiné číslo nebo přidej k vek jedničku ještě jednou.',
  },
  {
    id: 'vypis',
    group: 'Základy',
    title: 'Vypsat a zeptat se',
    body: `
<p><b>say</b> vypíše cokoli do konzole (<code>console.log</code>). <b>say ... in green</b> vypíše barevně.</p>
<p><b>ask ... and wait</b> položí otázku a počká, až odpovíš. Odpověď je vždycky text. Když chceš číslo, použij <b>ask number</b>.</p>
<p>Bloky, které čekají (ask, wait), musí být uvnitř kloboučku <b>when Run clicked</b> - ten z nich udělá <code>async function main()</code>.</p>`,
    why: 'Čekání na člověka trvá, a počítač mezitím nesmí zamrznout. Proto se píše await (počkej) a funkce kolem je async.',
    code: `async function main(): Promise<void> {
  let jmeno: string = await ask("Jak se jmenuješ?");
  sayColored("Ahoj, " + jmeno + "!", 32);
  let roky: number = Number(await ask("Kolik ti je let?"));
  console.log("Za 10 let ti bude " + (roky + 10));
}
main();
`,
    run: true,
  },
  {
    id: 'pocitani',
    group: 'Základy',
    title: 'Počítání a porovnávání',
    body: `
<p>Zelené bloky počítají: <b>+ - × ÷</b>, <b>mod</b> je zbytek po dělení (7 mod 3 = 1).</p>
<p>Porovnání dává odpověď ano/ne: <b>=</b> (<code>===</code>), <b>≠</b> (<code>!==</code>), <b>&lt; &gt; ≤ ≥</b>.</p>
<p><b>and</b> (<code>&&</code>) = platí obojí, <b>or</b> (<code>||</code>) = platí aspoň jedno, <b>not</b> (<code>!</code>) = obrátí ano/ne.</p>`,
    why: 'V TypeScriptu se porovnává třemi rovnítky ===, protože jedno rovnítko = znamená "ulož do proměnné".',
    code: `let body: number = 17;
console.log(body * 2);
console.log(body % 5);
console.log(body >= 15);
console.log(body > 10 && body < 20);
console.log(!(body === 17));
`,
    run: true,
  },
  {
    id: 'podminky',
    group: 'Základy',
    title: 'Podmínky - když ..., tak ...',
    body: `
<p>Blok <b>if</b> spustí vnitřek jen tehdy, když platí podmínka (šestiúhelník). Ozubeným kolečkem přidáš <b>else if</b> (jinak, když) a <b>else</b> (jinak).</p>`,
    why: 'Program se tak umí rozhodovat stejně jako ty: "když prší, vezmu si deštník, jinak ne".',
    code: `let znamka: number = 2;
if (znamka === 1) {
  console.log("Výborně!");
} else if (znamka <= 3) {
  console.log("Dobrá práce.");
} else {
  console.log("Příště to bude lepší.");
}
`,
    run: true,
    tryIt: 'Změň známku na 1 nebo 5 a spusť znovu.',
  },
  {
    id: 'cykly',
    group: 'Základy',
    title: 'Cykly - opakování',
    body: `
<ul>
<li><b>repeat 10 times</b> - zopakuje vnitřek přesně tolikrát</li>
<li><b>count i from 1 to 5</b> - počítá a v proměnné <code>i</code> máš aktuální číslo</li>
<li><b>repeat while / until</b> - opakuje, dokud platí (nebo dokud nezačne platit) podmínka</li>
<li><b>break</b> - okamžitě opakování ukončí</li>
</ul>`,
    why: 'Počítač se nikdy nenudí. Co bys musel napsat stokrát, napíšeš jednou a řekneš "opakuj".',
    code: `for (let i = 0; i < 3; i++) {
  console.log("Hip hip hurá!");
}
for (let n = 1; n <= 5; n++) {
  console.log(n + " × 2 = " + n * 2);
}
let penize: number = 10;
while (penize > 0) {
  penize -= 4;
}
console.log("Zbylo: " + penize);
`,
    run: true,
  },
  {
    id: 'pole',
    group: 'Pole',
    title: 'Pole - seznam věcí',
    body: `
<p>Pole je <b>očíslovaná řada krabiček</b>. Pozor: <b>počítá se od nuly!</b> První věc má index 0, druhá 1 ...</p>
<p>Hranatý blok <code>[ 0: ... 1: ... ]</code> ukazuje čísla nad každým místem. Tlačítkem <b>+</b> přidáš místo, <b>-</b> poslední ubereš.</p>
<p>Typ pole se píše s hranatými závorkami: <code>string[]</code> = pole textů, <code>number[]</code> = pole čísel.</p>
<p>Ve VS Code ti panel <b>Arrays at the start</b> ukáže každé pole jako řadu krabiček s čísly.</p>`,
    why: 'Od nuly se počítá, protože index říká, o kolik míst se máš od začátku posunout. První věc je posunutá o 0.',
    code: `let ovoce: string[] = ["jablko", "banán", "třešeň"];
console.log(ovoce[0]);
console.log(ovoce.length);
ovoce.push("kiwi");
ovoce[1] = "hruška";
ovoce.splice(0, 1);
console.log(ovoce.join(", "));
console.log(ovoce[ovoce.length - 1]);
`,
    run: true,
    tryIt: 'Přidej do pole další ovoce tlačítkem + v hranatém bloku.',
  },
  {
    id: 'projit',
    group: 'Pole',
    title: 'Projít celé pole',
    body: `
<p><b>for each ... in</b> vezme postupně každou věc z pole a pro každou spustí vnitřek. Proměnná (třeba <code>vec</code>) je vždy ta věc, na kterou se zrovna dívá.</p>
<p><b>with each ... do</b> dělá totéž zápisem <code>.forEach(...)</code>, se kterým se často potkáš v cizím kódu.</p>`,
    why: 'Nemusíš vědět, kolik věcí v poli je. Cyklus se postará, aby přišla na řadu každá.',
    code: `let zviratka: string[] = ["kočka", "pes", "křeček"];
for (const zvire of zviratka) {
  console.log("Mám rád zvíře: " + zvire);
}
zviratka.forEach((zvire) => {
  console.log(zvire + " má " + zvire.length + " písmen");
});
`,
    run: true,
  },
  {
    id: 'map',
    group: 'Metody polí',
    title: '.map - továrna na nové pole',
    body: `
<p>Blok <b>from ... make a new array: each item becomes ...</b> je jako <b>továrna</b>: každá věc projde dovnitř, změní se a vyjde ven. Výsledek je <b>nové pole, stejně dlouhé</b>. Staré pole zůstane, jak bylo.</p>
<p>V kódu: <code>pole.map((vec) => co_z_ní_bude)</code>. Šipka <code>=&gt;</code> čti jako "se změní na".</p>`,
    why: 'Často potřebuješ všechno přepočítat najednou: ceny se slevou, jména velkými písmeny, body krát dva. map to udělá jedním blokem.',
    code: `let ceny: number[] = [10, 25, 40];
let sDph: number[] = ceny.map((cena) => cena * 1.21);
console.log(sDph);
let jmena: string[] = ["eva", "petr"];
console.log(jmena.map((jmeno) => jmeno.toUpperCase()));
`,
    run: true,
  },
  {
    id: 'filter',
    group: 'Metody polí',
    title: '.filter - síto',
    body: `
<p><b>from ... keep only each item where ...</b> je <b>síto</b>: nechá jen věci, pro které platí podmínka. Výsledek je nové pole, většinou kratší.</p>
<p>V kódu: <code>pole.filter((vec) => podmínka)</code></p>`,
    why: 'Ze seznamu často chceš jen něco: nezaplacené objednávky, sudá čísla, žáky s jedničkou.',
    code: `let cisla: number[] = [3, 8, 11, 14, 20];
let suda: number[] = cisla.filter((c) => c % 2 === 0);
console.log(suda);
let slova: string[] = ["auto", "pes", "kolo", "slon"];
console.log(slova.filter((s) => s.length === 4));
`,
    run: true,
  },
  {
    id: 'some',
    group: 'Metody polí',
    title: '.some a .every - aspoň jeden? všichni?',
    body: `
<p><b>is there any ... where ...?</b> (<code>.some</code>) odpoví <b>ano</b>, když podmínku splní <b>aspoň jedna</b> věc.</p>
<p><b>is every ... such that ...?</b> (<code>.every</code>) odpoví <b>ano</b>, jen když ji splní <b>úplně všechny</b>.</p>`,
    why: 'Je ve třídě někdo nemocný? (some) Napsali úkol všichni? (every) Odpověď je vždy ano/ne, proto jsou bloky šestiúhelníky.',
    code: `let znamky: number[] = [1, 2, 1, 4, 2];
console.log(znamky.some((z) => z === 5));
console.log(znamky.some((z) => z >= 4));
console.log(znamky.every((z) => z <= 4));
`,
    run: true,
  },
  {
    id: 'find',
    group: 'Metody polí',
    title: '.find - najdi první',
    body: `
<p><b>first ... in ... where ...</b> (<code>.find</code>) vrátí <b>první věc</b>, která podmínku splní. Když žádná neexistuje, vrátí <code>undefined</code> (nic).</p>
<p><b>index of the first ...</b> (<code>.findIndex</code>) vrátí, <b>na kterém místě</b> je. Když tam není, vrátí -1.</p>`,
    why: 'Hledáš konkrétní věc - třeba prvního žáka, jehož jméno začíná na P.',
    code: `let zaci: string[] = ["Adam", "Petra", "Pavel", "Zoe"];
console.log(zaci.find((z) => z.startsWith("P")));
console.log(zaci.findIndex((z) => z === "Zoe"));
`,
    run: true,
  },
  {
    id: 'reduce',
    group: 'Metody polí',
    title: '.reduce - sečti všechno dohromady',
    body: `
<p><b>add up ... starting from ...</b> (<code>.reduce</code>) projde věci jednu po druhé a <b>skládá z nich jeden výsledek</b>. Proměnná <code>total</code> je "zatím mám", <code>item</code> je věc, která zrovna přichází.</p>
<p>Jako když hážeš mince do kasičky: začneš s 0, přidáš 5 - máš 5, přidáš 2 - máš 7 ...</p>`,
    why: 'Součet, celková cena, nejvyšší skóre - kdykoli chceš z celého pole jedno číslo.',
    code: `let mince: number[] = [5, 2, 10, 1];
let celkem: number = mince.reduce((total, minca) => total + minca, 0);
console.log("V kasičce je " + celkem + " Kč");
`,
    run: true,
  },
  {
    id: 'funkce',
    group: 'Funkce a objekty',
    title: 'Funkce - vlastní příkazy',
    body: `
<p>Funkce je <b>pojmenovaný kousek programu</b>, který můžeš použít kolikrát chceš. Za <b>with:</b> jsou <b>parametry</b> - věci, které funkci podáš.</p>
<p>Blok <b>return</b> vrátí výsledek. Typy parametrů a výsledku nastavíš pravým klikem na blok funkce: <i>Set parameter & return types...</i></p>`,
    why: 'Když něco děláš častěji, napíšeš to jednou jako funkci. Program je kratší a chyba se opravuje jen na jednom místě.',
    code: `function obsahObdelniku(a: number, b: number): number {
  return a * b;
}

function pozdrav(jmeno: string): string {
  return "Ahoj, " + jmeno + "!";
}

console.log(obsahObdelniku(3, 4));
console.log(pozdrav("Matěj"));
`,
    run: true,
  },
  {
    id: 'objekty',
    group: 'Funkce a objekty',
    title: 'Objekty a typy - jak vypadá objednávka',
    body: `
<p><b>Objekt</b> drží pohromadě věci, které k sobě patří: objednávka má položku, počet, cenu a jestli je zaplacená. Píše se do složených závorek <code>{ ... }</code>.</p>
<p>Modrý blok <b>type ... has:</b> popisuje, <b>jak má objekt vypadat</b> - jaké má vlastnosti a jakého typu.</p>
<p>Blok <b>pocet of objednavka</b> přečte jednu vlastnost (v kódu <code>objednavka.pocet</code>).</p>
<p>Tenhle příklad je celý bufet - pole objednávek a funkce s <code>.some</code>, <code>.map</code>, <code>.filter</code> a <code>.reduce</code>.</p>`,
    why: 'Díky typu ví TypeScript, že objednávka má vlastnost "pocet" - a když se překlepneš a napíšeš "poce", hned ti to řekne.',
    code: `type Objednavka = {
  polozka: string;
  pocet: number;
  cenaZaKus: number;
  zaplaceno: boolean;
};

let objednavky: Objednavka[] = [
  { polozka: "rohlík", pocet: 3, cenaZaKus: 4, zaplaceno: true },
  { polozka: "mléko", pocet: 1, cenaZaKus: 25, zaplaceno: false },
];

function maNezaplacene(seznam: Objednavka[]): boolean {
  return seznam.some((objednavka) => !objednavka.zaplaceno);
}

function trzba(seznam: Objednavka[]): number {
  return seznam
    .filter((objednavka) => objednavka.zaplaceno)
    .reduce((celkem, objednavka) => celkem + objednavka.pocet * objednavka.cenaZaKus, 0);
}

console.log(maNezaplacene(objednavky));
console.log(trzba(objednavky));
console.log(objednavky.map((objednavka) => objednavka.polozka));
`,
    run: true,
  },
  {
    id: 'kod',
    group: 'Ostatní',
    title: 'Co bloky (zatím) neumí',
    body: `
<p>Některé věci z TypeScriptu bloky nemají - třeba třídy (<code>class</code>), <code>import</code> nebo složitější zápisy. Takové části se ukážou jako <b>šedý blok "TS"</b> s původním textem.</p>
<p>Klikni na <b>tužku</b> a kód v něm můžeš upravit. <b>Nic se neztratí</b> - soubor se uloží přesně tak, jak má.</p>`,
    why: 'Můžeš tak otevřít jakýkoli projekt, i ten od učitele, a nic se nerozbije.',
    code: `class Pocitadlo {
  hodnota = 0;
  pricti(): void {
    this.hodnota++;
  }
}
console.log("Třídy zůstanou jako text.");
`,
    run: false,
  },
  {
    id: 'spusteni',
    group: 'Ostatní',
    title: 'Spuštění, konzole a testy',
    body: `
<p>Zelené tlačítko <b>Run</b> spustí soubor. Co program vypíše, objeví se v <b>konzoli</b>. Když se program na něco ptá, napiš odpověď do řádku se šipkou <b>›</b> a stiskni Enter.</p>
<p>Ikonkou rozložení v hlavičce konzole si ji dáš <b>dolů</b>, <b>doprava</b> nebo jako <b>kartu</b> vedle panelu s poli.</p>
<p>Tlačítko <b>Test</b> spustí <code>npm test</code> - testy, které ti připravil učitel. Zelená = všechno sedí, červená = někde je chyba.</p>`,
    why: 'Testy jsou jako kontrola úkolu: řeknou ti hned, jestli program dělá, co má.',
  },
];
