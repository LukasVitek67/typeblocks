/**
 * Recipes ("Recepty"): small ready-made programs with a plain explanation.
 * The code is real TypeScript; the build turns every recipe into blocks
 * (src/webview/presets.data.json), so a recipe always looks exactly like the code it stands for.
 */

export type PresetGroup = 'arrays' | 'math' | 'functions';

export interface PresetText {
  title: string;
  /** what it does and how - one or two short sentences */
  text: string;
  /** something to try after inserting it */
  tip: string;
  code: string;
}

export interface Preset {
  id: string;
  group: PresetGroup;
  cs: PresetText;
  en: PresetText;
}

export const PRESET_GROUPS: Record<PresetGroup, { cs: string; en: string }> = {
  arrays: { cs: 'Pole - seznamy věcí', en: 'Arrays - lists of things' },
  math: { cs: 'Počítání', en: 'Math' },
  functions: { cs: 'Funkce, které počítají', en: 'Functions that calculate' },
};

const c = (lines: string[]) => lines.join('\n') + '\n';

export const PRESETS: Preset[] = [
  // ------------------------------------------------------------ arrays
  {
    id: 'list-make',
    group: 'arrays',
    cs: {
      title: 'Udělej seznam a přidej do něj',
      text: 'Pole je jako krabička s přihrádkami: každá věc má svoje místo. „Přidej na konec“ (push) dá novou věc za tu poslední.',
      tip: 'Přidej do seznamu svoje oblíbené ovoce.',
      code: c(['const ovoce: string[] = ["jablko", "banán"];', 'ovoce.push("kiwi");', 'console.log(ovoce);']),
    },
    en: {
      title: 'Make a list and add to it',
      text: 'An array is like a box with slots: every thing has its own place. "Add to the end" (push) puts a new thing after the last one.',
      tip: 'Add your favourite fruit to the list.',
      code: c(['const fruits: string[] = ["apple", "banana"];', 'fruits.push("kiwi");', 'console.log(fruits);']),
    },
  },
  {
    id: 'list-each',
    group: 'arrays',
    cs: {
      title: 'Projdi každou věc v seznamu',
      text: 'Smyčka „pro každé“ bere věci ze seznamu jednu po druhé a s každou udělá to, co je uvnitř.',
      tip: 'Vypiš místo „Mám rád“ něco jiného.',
      code: c(['const ovoce: string[] = ["jablko", "banán", "kiwi"];', 'for (const kus of ovoce) {', '  console.log("Mám rád " + kus);', '}']),
    },
    en: {
      title: 'Go through every thing in a list',
      text: 'The "for each" loop takes the things from the list one by one and does what is inside with each of them.',
      tip: 'Print something else instead of "I like".',
      code: c(['const fruits: string[] = ["apple", "banana", "kiwi"];', 'for (const fruit of fruits) {', '  console.log("I like " + fruit);', '}']),
    },
  },
  {
    id: 'list-count',
    group: 'arrays',
    cs: {
      title: 'Kolik věcí je v seznamu?',
      text: '„Délka“ (length) řekne, kolik věcí v seznamu je. První věc má pořadí 0, druhá 1 a tak dál.',
      tip: 'Vypiš i první věc: blok „věc číslo 0“.',
      code: c(['const ovoce: string[] = ["jablko", "banán", "kiwi"];', 'console.log("Počet: " + ovoce.length);', 'console.log("První: " + ovoce[0]);']),
    },
    en: {
      title: 'How many things are in the list?',
      text: '"Length" tells you how many things the list has. The first thing is number 0, the second is 1, and so on.',
      tip: 'Change 0 to 2 to get the third thing.',
      code: c(['const fruits: string[] = ["apple", "banana", "kiwi"];', 'console.log("Count: " + fruits.length);', 'console.log("First: " + fruits[0]);']),
    },
  },
  {
    id: 'list-has',
    group: 'arrays',
    cs: {
      title: 'Je to v seznamu?',
      text: '„Obsahuje“ (includes) odpoví ano, nebo ne (true / false). Podle odpovědi se pustí horní, nebo spodní část bloku „pokud“.',
      tip: 'Zeptej se na věc, která v seznamu není.',
      code: c([
        'const ovoce: string[] = ["jablko", "banán"];',
        'if (ovoce.includes("kiwi")) {',
        '  console.log("Kiwi máme!");',
        '} else {',
        '  console.log("Kiwi nemáme.");',
        '}',
      ]),
    },
    en: {
      title: 'Is it in the list?',
      text: '"Includes" answers yes or no (true / false). The answer decides whether the top or the bottom part of the "if" block runs.',
      tip: 'Ask for a thing that is not in the list.',
      code: c(['const fruits: string[] = ["apple", "banana"];', 'if (fruits.includes("kiwi")) {', '  console.log("We have kiwi!");', '} else {', '  console.log("No kiwi.");', '}']),
    },
  },
  {
    id: 'list-filter',
    group: 'arrays',
    cs: {
      title: 'Nech jen některé (filter)',
      text: 'filter projde seznam a nechá jen věci, pro které platí podmínka. Vznikne nový seznam, původní zůstane stejný.',
      tip: 'Změň 6 na 10 a sleduj, co zbude.',
      code: c(['const cisla: number[] = [3, 8, 12, 5];', 'const velka = cisla.filter((c) => c > 6);', 'console.log(velka);']),
    },
    en: {
      title: 'Keep only some (filter)',
      text: 'filter goes through the list and keeps only the things for which the condition is true. You get a new list; the old one stays the same.',
      tip: 'Change 6 to 10 and see what is left.',
      code: c(['const numbers: number[] = [3, 8, 12, 5];', 'const big = numbers.filter((n) => n > 6);', 'console.log(big);']),
    },
  },
  {
    id: 'list-map',
    group: 'arrays',
    cs: {
      title: 'Změň každou věc (map)',
      text: 'map udělá nový, stejně dlouhý seznam: každou věc promění podle pravidla. Tady každé číslo vynásobí dvěma.',
      tip: 'Místo krát 2 dej krát 10.',
      code: c(['const cisla: number[] = [1, 2, 3];', 'const dvakrat = cisla.map((c) => c * 2);', 'console.log(dvakrat);']),
    },
    en: {
      title: 'Change every thing (map)',
      text: 'map makes a new list of the same length: it changes every thing by a rule. Here it multiplies every number by two.',
      tip: 'Use times 10 instead of times 2.',
      code: c(['const numbers: number[] = [1, 2, 3];', 'const doubled = numbers.map((n) => n * 2);', 'console.log(doubled);']),
    },
  },
  {
    id: 'list-sum',
    group: 'arrays',
    cs: {
      title: 'Sečti všechna čísla (reduce)',
      text: 'reduce jde seznamem a průběžně si drží výsledek. Začne od 0 a ke „zatím celkem“ přičte každé další číslo.',
      tip: 'Spočítej součin: dej krát a začni od 1.',
      code: c(['const cisla: number[] = [4, 7, 9];', 'const soucet = cisla.reduce((celkem, c) => celkem + c, 0);', 'console.log(soucet);']),
    },
    en: {
      title: 'Add up all numbers (reduce)',
      text: 'reduce walks through the list and keeps a running result. It starts at 0 and adds every number to the "total so far".',
      tip: 'Make a product: use times and start at 1.',
      code: c(['const numbers: number[] = [4, 7, 9];', 'const sum = numbers.reduce((total, n) => total + n, 0);', 'console.log(sum);']),
    },
  },
  {
    id: 'list-max',
    group: 'arrays',
    cs: {
      title: 'Najdi největší číslo',
      text: 'Pamatujeme si zatím největší číslo. Když ve smyčce narazíme na větší, zapamatujeme si to nové.',
      tip: 'Najdi nejmenší: otoč znaménko > na <.',
      code: c([
        'const cisla: number[] = [4, 15, 9];',
        'let nejvetsi = cisla[0];',
        'for (const c of cisla) {',
        '  if (c > nejvetsi) {',
        '    nejvetsi = c;',
        '  }',
        '}',
        'console.log(nejvetsi);',
      ]),
    },
    en: {
      title: 'Find the biggest number',
      text: 'We remember the biggest number so far. When the loop finds a bigger one, we remember the new one.',
      tip: 'Find the smallest: flip > to <.',
      code: c(['const numbers: number[] = [4, 15, 9];', 'let biggest = numbers[0];', 'for (const n of numbers) {', '  if (n > biggest) {', '    biggest = n;', '  }', '}', 'console.log(biggest);']),
    },
  },
  // ------------------------------------------------------------ math
  {
    id: 'math-calc',
    group: 'math',
    cs: {
      title: 'Kalkulačka: + - × ÷',
      text: 'Čísla si uložíme do proměnných a a b. Pak s nimi počítáme: + sčítá, - odčítá, × násobí a ÷ dělí.',
      tip: 'Změň čísla a sleduj výstup v konzoli.',
      code: c(['const a = 12;', 'const b = 4;', 'console.log(a + b);', 'console.log(a - b);', 'console.log(a * b);', 'console.log(a / b);']),
    },
    en: {
      title: 'Calculator: + - × ÷',
      text: 'We store two numbers in the variables a and b. Then we calculate: + adds, - subtracts, × multiplies and ÷ divides.',
      tip: 'Change the numbers and watch the console.',
      code: c(['const a = 12;', 'const b = 4;', 'console.log(a + b);', 'console.log(a - b);', 'console.log(a * b);', 'console.log(a / b);']),
    },
  },
  {
    id: 'math-order',
    group: 'math',
    cs: {
      title: 'Co se počítá dřív?',
      text: 'Násobení má přednost před sčítáním, stejně jako v matematice. Blok vložený uvnitř jiného bloku se spočítá první, jako závorka.',
      tip: 'Porovnej oba výsledky - proč se liší?',
      code: c(['console.log(2 + 3 * 4);', 'console.log((2 + 3) * 4);']),
    },
    en: {
      title: 'What is calculated first?',
      text: 'Multiplying goes before adding, just like in math. A block placed inside another block is calculated first, like brackets.',
      tip: 'Compare the two results - why are they different?',
      code: c(['console.log(2 + 3 * 4);', 'console.log((2 + 3) * 4);']),
    },
  },
  {
    id: 'math-counter',
    group: 'math',
    cs: {
      title: 'Počítadlo bodů',
      text: '„let“ znamená, že se proměnná smí měnit. „Změň o“ přičte číslo k tomu, co v proměnné už je.',
      tip: 'Uber body: změň o -3.',
      code: c(['let body = 0;', 'body += 10;', 'body += 5;', 'console.log("Body: " + body);']),
    },
    en: {
      title: 'Score counter',
      text: '"let" means the variable may change. "Change by" adds a number to what is already in the variable.',
      tip: 'Take points away: change by -3.',
      code: c(['let score = 0;', 'score += 10;', 'score += 5;', 'console.log("Score: " + score);']),
    },
  },
  {
    id: 'math-even',
    group: 'math',
    cs: {
      title: 'Sudé, nebo liché? (zbytek %)',
      text: '% dá zbytek po dělení. Když po dělení dvěma nic nezbyde (zbytek je 0), číslo je sudé.',
      tip: 'Zkus různá čísla: 10, 13, 0.',
      code: c(['const cislo = 7;', 'if (cislo % 2 === 0) {', '  console.log("sudé");', '} else {', '  console.log("liché");', '}']),
    },
    en: {
      title: 'Even or odd? (remainder %)',
      text: '% gives the remainder after dividing. When nothing is left after dividing by two (the remainder is 0), the number is even.',
      tip: 'Try different numbers: 10, 13, 0.',
      code: c(['const num = 7;', 'if (num % 2 === 0) {', '  console.log("even");', '} else {', '  console.log("odd");', '}']),
    },
  },
  {
    id: 'math-average',
    group: 'math',
    cs: {
      title: 'Průměr známek',
      text: 'Průměr = součet ÷ počet. Součet udělá reduce, počet řekne délka seznamu.',
      tip: 'Přidej do seznamu další známku.',
      code: c(['const znamky: number[] = [1, 2, 1, 3];', 'const soucet = znamky.reduce((celkem, z) => celkem + z, 0);', 'console.log(soucet / znamky.length);']),
    },
    en: {
      title: 'Average of marks',
      text: 'Average = sum ÷ count. reduce makes the sum, the length of the list is the count.',
      tip: 'Add another mark to the list.',
      code: c(['const marks: number[] = [1, 2, 1, 3];', 'const sum = marks.reduce((total, m) => total + m, 0);', 'console.log(sum / marks.length);']),
    },
  },
  {
    id: 'math-dice',
    group: 'math',
    cs: {
      title: 'Hod kostkou',
      text: '„Náhodné číslo od 1 do 6“ dá při každém spuštění jiné číslo - jako opravdová kostka.',
      tip: 'Spusť program několikrát. Pak udělej kostku do 20.',
      code: c(['const hod = Math.floor(Math.random() * (6 - 1 + 1)) + 1;', 'console.log("Padlo: " + hod);']),
    },
    en: {
      title: 'Roll a dice',
      text: '"Random number from 1 to 6" gives a different number every run - just like a real dice.',
      tip: 'Run it a few times. Then make a 20-sided dice.',
      code: c(['const roll = Math.floor(Math.random() * (6 - 1 + 1)) + 1;', 'console.log("You rolled: " + roll);']),
    },
  },
  {
    id: 'math-ask',
    group: 'math',
    cs: {
      title: 'Zeptej se na číslo a počítej',
      text: '„Zeptej se na číslo“ počká, až v konzoli napíšeš odpověď. Pak s ní můžeš počítat jako s každým jiným číslem.',
      tip: 'Spočítej, kolik ti bylo před 5 lety.',
      code: c(['const vek = Number(await ask("Kolik ti je let?"));', 'console.log("Za 10 let ti bude " + (vek + 10));']),
    },
    en: {
      title: 'Ask for a number and calculate',
      text: '"Ask for a number" waits until you type an answer in the console. Then you can calculate with it like with any other number.',
      tip: 'Work out how old you were 5 years ago.',
      code: c(['const age = Number(await ask("How old are you?"));', 'console.log("In 10 years you will be " + (age + 10));']),
    },
  },
  // ------------------------------------------------------------ functions
  {
    id: 'fn-add',
    group: 'functions',
    cs: {
      title: 'Funkce, která sčítá',
      text: 'Funkce je pojmenovaný recept. Dostane čísla (a, b), spočítá výsledek a „vrátí“ ho. Pak ji použiješ, kolikrát chceš.',
      tip: 'Zavolej ji ještě jednou s jinými čísly.',
      code: c(['function secti(a: number, b: number): number {', '  return a + b;', '}', 'console.log(secti(2, 3));', 'console.log(secti(10, 5));']),
    },
    en: {
      title: 'A function that adds',
      text: 'A function is a recipe with a name. It gets numbers (a, b), works out the result and "returns" it. Then you can use it as often as you like.',
      tip: 'Call it once more with other numbers.',
      code: c(['function add(a: number, b: number): number {', '  return a + b;', '}', 'console.log(add(2, 3));', 'console.log(add(10, 5));']),
    },
  },
  {
    id: 'fn-area',
    group: 'functions',
    cs: {
      title: 'Obsah obdélníku',
      text: 'Obsah = šířka × výška. Funkce má hezké jméno, takže z „obsah(4, 3)“ hned poznáš, co se počítá.',
      tip: 'Přidej funkci pro obvod: 2 × (šířka + výška).',
      code: c(['function obsah(sirka: number, vyska: number): number {', '  return sirka * vyska;', '}', 'console.log("Obsah: " + obsah(4, 3));']),
    },
    en: {
      title: 'Area of a rectangle',
      text: 'Area = width × height. The function has a good name, so "area(4, 3)" tells you right away what is calculated.',
      tip: 'Add a function for the perimeter: 2 × (width + height).',
      code: c(['function area(width: number, height: number): number {', '  return width * height;', '}', 'console.log("Area: " + area(4, 3));']),
    },
  },
  {
    id: 'fn-even',
    group: 'functions',
    cs: {
      title: 'Funkce ano/ne: je číslo sudé?',
      text: 'Funkce nemusí vracet číslo. Tahle vrací ano/ne (boolean), takže se hodí přímo do bloku „pokud“.',
      tip: 'Udělej podobnou funkci „jeVelke“ pro čísla větší než 100.',
      code: c(['function jeSude(n: number): boolean {', '  return n % 2 === 0;', '}', 'console.log(jeSude(4));', 'console.log(jeSude(7));']),
    },
    en: {
      title: 'A yes/no function: is it even?',
      text: 'A function does not have to return a number. This one returns yes/no (boolean), so it fits straight into an "if" block.',
      tip: 'Make a similar function "isBig" for numbers over 100.',
      code: c(['function isEven(n: number): boolean {', '  return n % 2 === 0;', '}', 'console.log(isEven(4));', 'console.log(isEven(7));']),
    },
  },
  {
    id: 'fn-average',
    group: 'functions',
    cs: {
      title: 'Funkce: průměr seznamu',
      text: 'Funkce může dostat celý seznam. Uvnitř sečte čísla a vydělí je jejich počtem.',
      tip: 'Zavolej ji se svými známkami.',
      code: c([
        'function prumer(cisla: number[]): number {',
        '  const soucet = cisla.reduce((celkem, c) => celkem + c, 0);',
        '  return soucet / cisla.length;',
        '}',
        'console.log(prumer([2, 4, 9]));',
      ]),
    },
    en: {
      title: 'Function: average of a list',
      text: 'A function can get a whole list. Inside, it adds up the numbers and divides by how many there are.',
      tip: 'Call it with your own marks.',
      code: c(['function average(numbers: number[]): number {', '  const sum = numbers.reduce((total, n) => total + n, 0);', '  return sum / numbers.length;', '}', 'console.log(average([2, 4, 9]));']),
    },
  },
  {
    id: 'fn-temp',
    group: 'functions',
    cs: {
      title: 'Převod °C na °F',
      text: 'Vzorec stačí napsat jednou do funkce. Pak převádíš, kolik chceš: °F = °C × 9 ÷ 5 + 32.',
      tip: 'Kolik °F je 100 °C?',
      code: c(['function naFahrenheit(celsius: number): number {', '  return celsius * 9 / 5 + 32;', '}', 'console.log(naFahrenheit(20));']),
    },
    en: {
      title: 'Convert °C to °F',
      text: 'Write the formula once, inside a function. Then convert as often as you like: °F = °C × 9 ÷ 5 + 32.',
      tip: 'How many °F is 100 °C?',
      code: c(['function toFahrenheit(celsius: number): number {', '  return celsius * 9 / 5 + 32;', '}', 'console.log(toFahrenheit(20));']),
    },
  },
];
