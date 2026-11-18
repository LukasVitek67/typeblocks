/** English version of the guide. Same chapter ids as the Czech one (content.ts). */
import type { Section } from './content';

export const SECTIONS_EN: Section[] = [
  {
    id: 'jak',
    group: 'Getting started',
    title: 'How TypeBlocks works',
    body: `
<p><b>Blocks and code are the same thing.</b> Every block is a piece of TypeScript. Move or change a block and the code changes. Change the code and the blocks change.</p>
<p>In VS Code open any <code>.ts</code> file and click the <b>blocks button</b> in the top-right corner. The file shows up as blocks, and the normal code stays visible next to it. <b>Ctrl+S</b> saves like always. The <b>Code</b> button takes you back to the text.</p>
<p>Try it right here: click a block and see which line of code lights up. Change the text in a white box and watch the code on the right.</p>`,
    why: 'Blocks teach you how a program is put together, and the code beside them shows how it is really written. Soon you will read code without the blocks.',
    code: `console.log("Hello, world!");
console.log("This is my first program.");
`,
    run: true,
    tryIt: 'Change the text in the "say" block, then click Run.',
  },
  {
    id: 'tvary',
    group: 'Getting started',
    title: 'Block shapes',
    body: `
<p>The shape tells you where a block belongs:</p>
<ul>
<li><b>Hat</b> (round top) - the program starts here, e.g. <i>when Run clicked</i>.</li>
<li><b>Command</b> (notch on top and bottom) - does something; stack them like lego.</li>
<li><b>C-shape</b> - wraps other blocks: repeat, if, function.</li>
<li><b>Round value</b> - a number, text or calculation. It plugs into the white slots.</li>
<li><b>Hexagon</b> - a <i>yes / no</i> answer (<code>true</code> / <code>false</code>).</li>
<li><b>Square block</b> - a whole array (a list of things).</li>
</ul>`,
    why: 'The shape will not let you do nonsense: a hexagon does not fit where a command belongs. TypeScript checks the same thing - that things fit together.',
    code: `async function main(): Promise<void> {
  let apples: number[] = [3, 5, 8];
  if (apples.length > 2) {
    console.log("We have lots of apples!");
  }
}
main();
`,
    run: true,
  },
  {
    id: 'promenne',
    group: 'Basics',
    title: 'Variables - boxes for values',
    body: `
<p>A variable is a <b>box with a name</b> where the program keeps something. You make one with the <b>let</b> block (or <b>const</b>):</p>
<ul>
<li><code>let</code> - the contents may change later</li>
<li><code>const</code> - the contents stay the same forever</li>
</ul>
<p>After the colon comes the <b>type</b>: what belongs in the box. <code>number</code> = a number, <code>string</code> = text, <code>boolean</code> = yes/no.</p>
<p>In the <b>Variables</b> palette click <i>+ Make a variable</i>, type a name and pick a type.</p>`,
    why: 'The type is a label on the box. If you try to put text into a box for numbers, TypeScript warns you right away - before the program crashes.',
    code: `let name: string = "Ellie";
let age: number = 12;
const school: string = "Springfield Elementary";
age = age + 1;
console.log(name + " is " + age + " and goes to " + school);
`,
    run: true,
    tryIt: 'Change the age, or add one to age one more time.',
  },
  {
    id: 'vypis',
    group: 'Basics',
    title: 'Say something and ask a question',
    body: `
<p><b>say</b> prints anything to the console (<code>console.log</code>). <b>say ... in green</b> prints in color.</p>
<p><b>ask ... and wait</b> asks a question and waits for your answer. The answer is always text. If you want a number, use <b>ask number</b>.</p>
<p>Blocks that wait (ask, wait) must be inside the <b>when Run clicked</b> hat - it turns them into <code>async function main()</code>.</p>`,
    why: 'Waiting for a person takes time, and the computer must not freeze meanwhile. That is why the code says await (wait for it) and the function around it is async.',
    code: `async function main(): Promise<void> {
  let name: string = await ask("What is your name?");
  sayColored("Hello, " + name + "!", 32);
  let years: number = Number(await ask("How old are you?"));
  console.log("In 10 years you will be " + (years + 10));
}
main();
`,
    run: true,
  },
  {
    id: 'pocitani',
    group: 'Basics',
    title: 'Math and comparing',
    body: `
<p>Green blocks calculate: <b>+ - × ÷</b>, and <b>mod</b> is the remainder after dividing (7 mod 3 = 1).</p>
<p>Comparing gives a yes/no answer: <b>=</b> (<code>===</code>), <b>≠</b> (<code>!==</code>), <b>&lt; &gt; ≤ ≥</b>.</p>
<p><b>and</b> (<code>&&</code>) = both are true, <b>or</b> (<code>||</code>) = at least one is true, <b>not</b> (<code>!</code>) = flips yes/no.</p>`,
    why: 'TypeScript compares with three equals signs ===, because a single = means "store in a variable".',
    code: `let points: number = 17;
console.log(points * 2);
console.log(points % 5);
console.log(points >= 15);
console.log(points > 10 && points < 20);
console.log(!(points === 17));
`,
    run: true,
  },
  {
    id: 'podminky',
    group: 'Basics',
    title: 'Conditions - if ..., then ...',
    body: `
<p>The <b>if</b> block runs its inside only when the condition (a hexagon) is true. With the gear you add <b>else if</b> and <b>else</b>.</p>`,
    why: 'This is how a program decides, just like you: "if it rains I take an umbrella, otherwise I do not".',
    code: `let grade: number = 2;
if (grade === 1) {
  console.log("Excellent!");
} else if (grade <= 3) {
  console.log("Good job.");
} else {
  console.log("Next time will be better.");
}
`,
    run: true,
    tryIt: 'Change the grade to 1 or 5 and run it again.',
  },
  {
    id: 'cykly',
    group: 'Basics',
    title: 'Loops - repeating',
    body: `
<ul>
<li><b>repeat 10 times</b> - repeats the inside exactly that many times</li>
<li><b>count i from 1 to 5</b> - counts, and the variable <code>i</code> holds the current number</li>
<li><b>repeat while / until</b> - repeats while (or until) a condition holds</li>
<li><b>break</b> - stops the repeating right away</li>
</ul>`,
    why: 'A computer never gets bored. What you would have to write a hundred times, you write once and say "repeat".',
    code: `for (let i = 0; i < 3; i++) {
  console.log("Hip hip hooray!");
}
for (let n = 1; n <= 5; n++) {
  console.log(n + " x 2 = " + n * 2);
}
let money: number = 10;
while (money > 0) {
  money -= 4;
}
console.log("Left: " + money);
`,
    run: true,
  },
  {
    id: 'pole',
    group: 'Arrays',
    title: 'Arrays - a list of things',
    body: `
<p>An array is a <b>numbered row of boxes</b>. Careful: <b>counting starts at zero!</b> The first thing has index 0, the second 1 ...</p>
<p>The square block <code>[ 0: ... 1: ... ]</code> shows the numbers above every place. The <b>+</b> button adds a place, <b>-</b> removes the last one.</p>
<p>The type of an array is written with square brackets: <code>string[]</code> = an array of texts, <code>number[]</code> = an array of numbers.</p>
<p>In VS Code the <b>Arrays at the start</b> panel shows each array as a row of boxes with their numbers.</p>`,
    why: 'Counting starts at zero because the index says how many places to move from the start. The first thing is moved by 0.',
    code: `let fruit: string[] = ["apple", "banana", "cherry"];
console.log(fruit[0]);
console.log(fruit.length);
fruit.push("kiwi");
fruit[1] = "pear";
fruit.splice(0, 1);
console.log(fruit.join(", "));
console.log(fruit[fruit.length - 1]);
`,
    run: true,
    tryIt: 'Add another fruit with the + button in the square block.',
  },
  {
    id: 'projit',
    group: 'Arrays',
    title: 'Go through the whole array',
    body: `
<p><b>for each ... in</b> takes every thing from the array one by one and runs its inside for each. The variable (say <code>thing</code>) is always the one it is looking at right now.</p>
<p><b>with each ... do</b> does the same with the <code>.forEach(...)</code> notation you will often meet in other people's code.</p>`,
    why: 'You do not have to know how many things are in the array. The loop makes sure every one gets its turn.',
    code: `let pets: string[] = ["cat", "dog", "hamster"];
for (const pet of pets) {
  console.log("I like the animal: " + pet);
}
pets.forEach((pet) => {
  console.log(pet + " has " + pet.length + " letters");
});
`,
    run: true,
  },
  {
    id: 'map',
    group: 'Array methods',
    title: '.map - a factory for a new array',
    body: `
<p>The block <b>from ... make a new array: each item becomes ...</b> is like a <b>factory</b>: every thing goes in, changes, and comes out. The result is a <b>new array of the same length</b>. The old array stays as it was.</p>
<p>In code: <code>array.map((thing) => what_it_becomes)</code>. Read the arrow <code>=&gt;</code> as "turns into".</p>`,
    why: 'You often need to recalculate everything at once: prices with a discount, names in capitals, points times two. map does it with one block.',
    code: `let prices: number[] = [10, 25, 40];
let withTax: number[] = prices.map((price) => price * 1.21);
console.log(withTax);
let names: string[] = ["eva", "peter"];
console.log(names.map((name) => name.toUpperCase()));
`,
    run: true,
  },
  {
    id: 'filter',
    group: 'Array methods',
    title: '.filter - a sieve',
    body: `
<p><b>from ... keep only each item where ...</b> is a <b>sieve</b>: it keeps only the things for which the condition is true. The result is a new array, usually a shorter one.</p>
<p>In code: <code>array.filter((thing) => condition)</code></p>`,
    why: 'From a list you often want just some of it: unpaid orders, even numbers, pupils with an A.',
    code: `let numbers: number[] = [3, 8, 11, 14, 20];
let even: number[] = numbers.filter((n) => n % 2 === 0);
console.log(even);
let words: string[] = ["car", "dog", "bike", "lion"];
console.log(words.filter((w) => w.length === 4));
`,
    run: true,
  },
  {
    id: 'some',
    group: 'Array methods',
    title: '.some and .every - at least one? all of them?',
    body: `
<p><b>is there any ... where ...?</b> (<code>.some</code>) answers <b>yes</b> when <b>at least one</b> thing meets the condition.</p>
<p><b>is every ... such that ...?</b> (<code>.every</code>) answers <b>yes</b> only when <b>absolutely all</b> of them meet it.</p>`,
    why: 'Is anyone in class sick? (some) Did everyone do the homework? (every) The answer is always yes/no, which is why these blocks are hexagons.',
    code: `let grades: number[] = [1, 2, 1, 4, 2];
console.log(grades.some((g) => g === 5));
console.log(grades.some((g) => g >= 4));
console.log(grades.every((g) => g <= 4));
`,
    run: true,
  },
  {
    id: 'find',
    group: 'Array methods',
    title: '.find - find the first one',
    body: `
<p><b>first ... in ... where ...</b> (<code>.find</code>) gives the <b>first thing</b> that meets the condition. If there is none, you get <code>undefined</code> (nothing).</p>
<p><b>index of the first ...</b> (<code>.findIndex</code>) tells you <b>at which place</b> it is. If it is not there, you get -1.</p>`,
    why: 'You look for one particular thing - say the first pupil whose name starts with P.',
    code: `let pupils: string[] = ["Adam", "Petra", "Paul", "Zoe"];
console.log(pupils.find((p) => p.startsWith("P")));
console.log(pupils.findIndex((p) => p === "Zoe"));
`,
    run: true,
  },
  {
    id: 'reduce',
    group: 'Array methods',
    title: '.reduce - add everything together',
    body: `
<p><b>add up ... starting from ...</b> (<code>.reduce</code>) goes through the things one by one and <b>builds one result</b> from them. The variable <code>total</code> is "what I have so far", <code>item</code> is the thing that is arriving right now.</p>
<p>Like dropping coins into a piggy bank: start with 0, add 5 - you have 5, add 2 - you have 7 ...</p>`,
    why: 'A sum, a total price, the highest score - whenever you want one number out of a whole array.',
    code: `let coins: number[] = [5, 2, 10, 1];
let total: number = coins.reduce((total, coin) => total + coin, 0);
console.log("The piggy bank holds " + total + " coins");
`,
    run: true,
  },
  {
    id: 'funkce',
    group: 'Functions and objects',
    title: 'Functions - your own commands',
    body: `
<p>A function is a <b>named piece of a program</b> that you can use as many times as you like. After <b>with:</b> come the <b>parameters</b> - things you hand to the function.</p>
<p>The <b>return</b> block gives back the result. Set the types of the parameters and of the result by right-clicking the function block: <i>Set parameter & return types...</i></p>`,
    why: 'When you do something often, you write it once as a function. The program gets shorter and a bug is fixed in one place only.',
    code: `function rectangleArea(a: number, b: number): number {
  return a * b;
}

function greet(name: string): string {
  return "Hello, " + name + "!";
}

console.log(rectangleArea(3, 4));
console.log(greet("Matt"));
`,
    run: true,
  },
  {
    id: 'objekty',
    group: 'Functions and objects',
    title: 'Objects and types - what an order looks like',
    body: `
<p>An <b>object</b> keeps things together that belong together: an order has an item, a count, a price and whether it is paid. It is written in curly braces <code>{ ... }</code>.</p>
<p>The blue block <b>type ... has:</b> describes <b>what an object should look like</b> - which properties it has and of what type.</p>
<p>The block <b>count of order</b> reads one property (in code <code>order.count</code>).</p>
<p>This example is a whole snack bar - an array of orders and functions with <code>.some</code>, <code>.map</code>, <code>.filter</code> and <code>.reduce</code>.</p>`,
    why: 'Thanks to the type TypeScript knows an order has a property "count" - and if you make a typo and write "cont", it tells you right away.',
    code: `type Order = {
  item: string;
  count: number;
  pricePerPiece: number;
  paid: boolean;
};

let orders: Order[] = [
  { item: "roll", count: 3, pricePerPiece: 4, paid: true },
  { item: "milk", count: 1, pricePerPiece: 25, paid: false },
];

function hasUnpaid(list: Order[]): boolean {
  return list.some((order) => !order.paid);
}

function income(list: Order[]): number {
  return list
    .filter((order) => order.paid)
    .reduce((total, order) => total + order.count * order.pricePerPiece, 0);
}

console.log(hasUnpaid(orders));
console.log(income(orders));
console.log(orders.map((order) => order.item));
`,
    run: true,
  },
  {
    id: 'kod',
    group: 'Other',
    title: 'What blocks cannot do (yet)',
    body: `
<p>Some parts of TypeScript have no blocks - for example classes (<code>class</code>), <code>import</code> or more complicated notation. Such parts show up as a <b>grey "TS" block</b> with the original text.</p>
<p>Click the <b>pencil</b> and you can edit the code inside. <b>Nothing is lost</b> - the file is saved exactly as it should be.</p>`,
    why: 'You can open any project, even one from your teacher, and nothing breaks.',
    code: `class Counter {
  value = 0;
  increase(): void {
    this.value++;
  }
}
console.log("Classes stay as text.");
`,
    run: false,
  },
  {
    id: 'spusteni',
    group: 'Other',
    title: 'Running, the console and tests',
    body: `
<p>The green <b>Run</b> button runs the file. Whatever the program prints appears in the <b>console</b>. When the program asks something, type the answer into the line with the arrow <b>›</b> and press Enter.</p>
<p>The layout icon in the console header puts it <b>at the bottom</b>, <b>on the right</b> or as a <b>card</b> next to the Arrays panel.</p>
<p>The <b>Test</b> button runs <code>npm test</code> - the tests your teacher prepared. Green = everything fits, red = there is a mistake somewhere.</p>`,
    why: 'Tests are like a check of your homework: they tell you right away whether the program does what it should.',
  },
];
