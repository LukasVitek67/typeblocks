async function main(): Promise<void> {
  let name: string = await ask("What's your name?");
  sayColored("Hello, " + name, 32);

  let fruits: string[] = ["apple", "banana", "cherry"];
  fruits.push("kiwi");
  for (const fruit of fruits) {
    console.log(fruit);
    await sleep(0.5);
  }
  console.log("I know " + fruits.length + " fruits");
}
main();

// ---- TypeBlocks helpers (used by the blocks above) ----
declare const process: any;
declare function require(name: string): any;

async function ask(question: string): Promise<string> {
  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + " ", (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

function sayColored(value: unknown, color: number): void {
  console.log(`\x1b[${color}m${String(value)}\x1b[0m`);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
