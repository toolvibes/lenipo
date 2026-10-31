/**
 * Variables in templates (W-TPL-02, TL-27, E-108): {{date}}, {{author}}, {{space}}, {{title}}
 * and input variables {{input:Name}} asked for when a page is created.
 */

const VARIABLE = /\{\{\s*(date|author|space|title|input:([^}]{1,60}))\s*\}\}/g;

/** The names of the input variables in a title and a document, in order of appearance. */
export function inputsOf(title: string, content: unknown): string[] {
  const names: string[] = [];
  const scan = (text: string) => {
    for (const match of text.matchAll(VARIABLE)) {
      const name = match[2]?.trim();
      if (name && !names.includes(name)) names.push(name);
    }
  };
  scan(title);
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const value = node as { text?: unknown; attrs?: Record<string, unknown>; content?: unknown[] };
    if (typeof value.text === 'string') scan(value.text);
    // Macro settings such as an issue query may hold variables too.
    for (const attr of Object.values(value.attrs ?? {})) if (typeof attr === 'string') scan(attr);
    for (const child of value.content ?? []) walk(child);
  };
  walk(content);
  return names;
}

export interface VariableValues {
  date: string;
  author: string;
  space: string;
  title: string;
  inputs: Record<string, string>;
}

export function fillText(text: string, values: VariableValues): string {
  return text.replace(VARIABLE, (_, name: string, input: string | undefined) => {
    if (input !== undefined) return values.inputs[input.trim()] ?? '';
    return values[name as 'date' | 'author' | 'space' | 'title'];
  });
}

/** A copy of a document with the variables filled in its text and string attributes. */
export function fillDocument<T>(content: T, values: VariableValues): T {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const value = node as { text?: unknown; attrs?: Record<string, unknown>; content?: unknown[] };
    const next: Record<string, unknown> = { ...value };
    if (typeof value.text === 'string') next.text = fillText(value.text, values);
    if (value.attrs) {
      next.attrs = Object.fromEntries(
        Object.entries(value.attrs).map(([key, attr]) => [
          key,
          typeof attr === 'string' ? fillText(attr, values) : attr,
        ]),
      );
    }
    if (Array.isArray(value.content)) next.content = value.content.map(walk);
    // An issue macro takes a key only; anything else leaves it to be chosen (TL-28).
    if (next.type === 'issue' && next.attrs) {
      const key = String((next.attrs as { key?: unknown }).key ?? '')
        .trim()
        .toUpperCase();
      next.attrs = {
        ...(next.attrs as object),
        key: /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/.test(key) ? key : '',
      };
    }
    // Text that became empty would make an invalid node.
    if (next.type === 'text' && next.text === '') return null;
    if (Array.isArray(next.content))
      next.content = (next.content as unknown[]).filter((child) => child !== null);
    return next;
  };
  return walk(content) as T;
}
