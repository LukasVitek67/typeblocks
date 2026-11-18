// A tiny shop: prices and a shopping list.
const prices: number[] = [12, 5, 30];
let basket: string[] = ["bread", "milk"];

function total(list: number[]): number {
  let sum = 0;
  for (const p of list) {
    sum += p;
  }
  return sum;
}

basket.push("cheese");
console.log("Basket: " + basket.join(", "));
console.log("Total: " + total(prices));
if (basket.includes("milk")) {
  console.log("Don't forget the milk!");
}
