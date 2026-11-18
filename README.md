# TypeBlocks

**See and edit any TypeScript file as Scratch-style drag-and-drop blocks, right inside VS Code.**
No extra files: the blocks are just another view of your `.ts` file, and every change is saved as normal TypeScript.

![TypeBlocks: blocks on the left, the same file as normal code on the right](docs/screenshot.png)

## Install (one line)

**Windows** - paste into PowerShell:

```powershell
irm https://raw.githubusercontent.com/LukasVitek67/typeblocks/main/install.ps1 | iex
```

**macOS / Linux** - paste into a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/LukasVitek67/typeblocks/main/install.sh | sh
```

**By hand:** download `typeblocks-x.y.z.vsix` from [Releases](https://github.com/LukasVitek67/typeblocks/releases/latest), then in VS Code: *Extensions* -> `...` -> *Install from VSIX...*

Needs VS Code 1.90 or newer. Nothing else - Run uses the Node.js that is built into VS Code.

## Use

1. Open a `.ts` file as usual.
2. Click the **blocks button** in the editor's top-right toolbar (or right-click the file -> *Open as Blocks*).
3. Drag, drop, edit. The code next to the blocks changes live; **Ctrl+S** saves the `.ts` file as always.
4. Click **Code** to go back to the normal text editor.

**Run** compiles the file and runs it in the **console** at the bottom of the blocks editor (no Node install needed): colored output, a live timer, and a line to type answers for `ask` blocks. Drag its edge to resize, double-click the header to fold it.

The layout button in the console header puts it **at the bottom (full width)**, **on the right (full height)**, or as a **card above / below the Arrays card**. The **Test** button runs `npm test` from the nearest `package.json` that has a `test` script, right in the console.

## What becomes blocks

- variables (`let/const name: type = value`), `x = ...`, `x += ...`, `x++`
- `if / else if / else`, `while`, `for (let i = 0; i < n; i++)` (repeat), `for (let i = a; i <= b; i++)` (count), `for (const x of list)`, `break`, `continue`
- functions with typed parameters and return types, calls, `return`
- math, comparisons, `&&` `||` `!`, ternary, `typeof`, `as`
- text: `+`, `.length`, `.includes`, `.toUpperCase()`, `.split()`, `String()`, `Number()`
- comments (`// ...`) and blank lines are kept

### Arrays - made easy

- an array literal is a row of numbered slots `[ 0:(a) 1:(b) ]` with **+ / -** buttons
- plain-English blocks with icons: *add to the end / start*, *insert at index*, *set item at index*, *remove item at index*, *remove the last / first item*, *sort / reverse*, *item at index*, *last item*, *length*, *contains*, *index of*, *join with*, *for each item in*
- the **Arrays** panel shows every array you create as a row of boxes with its indexes
- indexes start at 0, exactly like TypeScript

### Everything else

Classes, interfaces, imports, arrow functions, template strings, ... are shown as grey **TS code** blocks with the original text (click the pencil to edit). Nothing is ever lost.

Formatting of the parts that became blocks is normalized when you change something (2-space indent, double quotes, `;`). Same-line comments move onto their own line.

## Settings

| Setting | Default | |
|---|---|---|
| `typeblocks.openTsBeside` | `true` | also show the code next to the blocks |
| `typeblocks.colorStripes` | `true` | color each code line like the block that made it |
| `typeblocks.runIn` | `panel` | `panel` = built-in console, `terminal` = a VS Code terminal |
| `typeblocks.nodePath` | `""` | use your own `node` for Run |

## Develop

```bash
npm install
npm run build      # bundles + browser preview (preview/index.html)
npm test           # TS -> blocks -> TS round trips: stable, tsc --strict, runs
npm run package    # -> typeblocks-x.y.z.vsix
```

Built on [Blockly](https://github.com/google/blockly) (Apache-2.0) and the TypeScript compiler API.
