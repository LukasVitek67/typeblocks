/** Program for a brand-new file. */
export const STARTER_TS = `let name: string = ask("What's your name?");
sayColored("Hello, " + name, 32);

let fruits: string[] = ["apple", "banana", "cherry"];
fruits.push("kiwi");
for (const fruit of fruits) {
  console.log(fruit);
  pause(0.5);
}
console.log("I know " + fruits.length + " fruits");
`;
