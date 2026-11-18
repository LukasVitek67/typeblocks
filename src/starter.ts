/** Program for a brand-new file. */
export const STARTER_TS = `async function main(): Promise<void> {
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
`;
