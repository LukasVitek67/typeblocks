/**
 * Types are picked from a list, never typed by hand.
 * The list = the basic types + their arrays + types made with a "type ... has:" block
 * + any other type the opened file already uses (so nothing gets lost).
 */
import * as Blockly from 'blockly';
import { tr } from '../i18n';

/** Value of the "no type - TypeScript works it out" choice. */
export const NO_TYPE = '-';

const BASIC = ['number', 'string', 'boolean', 'any'];
const LABELS: Record<string, string> = {
  [NO_TYPE]: 'auto (TypeScript guesses)',
  number: 'number',
  string: 'text (string)',
  boolean: 'yes/no (boolean)',
  any: 'anything (any)',
  'number[]': 'array of numbers (number[])',
  'string[]': 'array of texts (string[])',
  'boolean[]': 'array of yes/no (boolean[])',
  'any[]': 'array of anything (any[])',
};

/** Types used in the opened file that are not in the basic list. */
const fromFile = new Set<string>();
let workspace: Blockly.Workspace | undefined;

export function setTypeWorkspace(ws: Blockly.Workspace): void {
  workspace = ws;
}

/** Before blocks are loaded: remember every type the file uses (the lists must contain them). */
export function collectTypes(state: unknown): void {
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    if (typeof o.type === 'string' && /^(ts_let|ts_as|ts_type)$/.test(o.type) && o.fields && typeof o.fields === 'object') {
      for (const [k, val] of Object.entries(o.fields as Record<string, unknown>)) {
        if ((k === 'TYPE' || /^T\d+$/.test(k)) && typeof val === 'string') addType(val);
      }
    }
    for (const val of Object.values(o)) visit(val);
  };
  visit(state);
}

export function addType(t: string): void {
  const v = t.trim();
  if (v && v !== NO_TYPE && !BASIC.includes(v) && !LABELS[v]) fromFile.add(v);
}

/** Names from "type ... has:" blocks in the workspace. */
function shapeNames(): string[] {
  if (!workspace) return [];
  return workspace
    .getBlocksByType('ts_type', false)
    .map((b) => String(b.getFieldValue('NAME') ?? '').trim())
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
}

export function typeLabel(v: string): string {
  if (LABELS[v]) return tr(LABELS[v]);
  const arr = /^(.+)\[\]$/.exec(v);
  if (arr) return `${tr('array of')} ${arr[1]} (${v})`;
  return v;
}

/** All choices: [value, ...]. withAuto adds the "TypeScript guesses" choice first. */
export function typeValues(withAuto: boolean): string[] {
  const shapes = shapeNames();
  const out = [
    ...(withAuto ? [NO_TYPE] : []),
    ...BASIC,
    ...shapes,
    'number[]',
    'string[]',
    'boolean[]',
    ...shapes.map((s) => s + '[]'),
    'any[]',
    ...[...fromFile],
  ];
  return [...new Set(out)];
}

/** Options for a Blockly dropdown. */
export function typeMenu(withAuto: boolean): Blockly.MenuGenerator {
  return function (this: Blockly.FieldDropdown) {
    const current = this?.getValue?.();
    if (typeof current === 'string') addType(current);
    return typeValues(withAuto).map((v) => [typeLabel(v), v] as [string, string]);
  };
}

/** A type dropdown that also accepts types it has not seen yet (they are added to the list). */
export class TypeDropdown extends Blockly.FieldDropdown {
  protected override doClassValidation_(value?: string): string | null {
    if (typeof value !== 'string' || !value) return null;
    addType(value);
    return value;
  }
  /** On the block itself the automatic type is just "auto" - the long explanation stays in the menu. */
  protected override getText_(): string | null {
    return this.getValue() === NO_TYPE ? tr('auto') : super.getText_();
  }
}

/** Swaps a text field named TYPE for a dropdown (used by blocks defined in JSON). */
export function registerTypeExtension(): void {
  if (Blockly.Extensions.isRegistered('tb_type_dropdown')) return;
  Blockly.Extensions.register('tb_type_dropdown', function (this: Blockly.Block) {
    for (const input of this.inputList) {
      const i = input.fieldRow.findIndex((f) => f.name === 'TYPE');
      if (i < 0) continue;
      const old = String(input.fieldRow[i].getValue() ?? '');
      input.removeField('TYPE');
      const field = new TypeDropdown(typeMenu(this.type === 'ts_let'));
      input.insertFieldAt(i, field as unknown as Blockly.Field, 'TYPE');
      field.setValue(this.type === 'ts_let' && !old ? NO_TYPE : old || 'number');
      break;
    }
  });
}
