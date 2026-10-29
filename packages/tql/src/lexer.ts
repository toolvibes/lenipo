export type TokenKind = 'word' | 'string' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

export interface Token {
  kind: TokenKind;
  /** The source text of the token, quotes included. */
  text: string;
  /** Unquoted and unescaped value; equals `text` for everything but strings. */
  value: string;
  start: number;
  end: number;
  /** A string whose closing quote is missing (only reported, the lexer keeps going). */
  unterminated?: boolean;
}

/** Characters that end an unquoted word. */
const DELIMITERS = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '"',
  "'",
  '(',
  ')',
  ',',
  '=',
  '!',
  '<',
  '>',
  '~',
]);

const TWO_CHAR_OPERATORS = ['!=', '!~', '>=', '<=', '&&', '||'];
const ONE_CHAR_OPERATORS = ['=', '>', '<', '~', '!'];

/** Splits a query into tokens. Never throws: unterminated strings are flagged on the token. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index] as string;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const start = index;
    if (char === '"' || char === "'") {
      let value = '';
      index += 1;
      let terminated = false;
      while (index < text.length) {
        const current = text[index] as string;
        if (current === '\\' && index + 1 < text.length) {
          value += text[index + 1];
          index += 2;
        } else if (current === char) {
          index += 1;
          terminated = true;
          break;
        } else {
          value += current;
          index += 1;
        }
      }
      tokens.push({
        kind: 'string',
        text: text.slice(start, index),
        value,
        start,
        end: index,
        ...(terminated ? {} : { unterminated: true }),
      });
      continue;
    }
    if (char === '(' || char === ')' || char === ',') {
      index += 1;
      const kind = char === '(' ? 'lparen' : char === ')' ? 'rparen' : 'comma';
      tokens.push({ kind, text: char, value: char, start, end: index });
      continue;
    }
    const pair = text.slice(index, index + 2);
    if (TWO_CHAR_OPERATORS.includes(pair)) {
      index += 2;
      tokens.push({ kind: 'op', text: pair, value: pair, start, end: index });
      continue;
    }
    if (ONE_CHAR_OPERATORS.includes(char)) {
      index += 1;
      tokens.push({ kind: 'op', text: char, value: char, start, end: index });
      continue;
    }
    while (index < text.length && !DELIMITERS.has(text[index] as string)) {
      // `&&` and `||` end a word even without surrounding spaces.
      const next = text.slice(index, index + 2);
      if (next === '&&' || next === '||') break;
      index += 1;
    }
    const word = text.slice(start, index);
    tokens.push({ kind: 'word', text: word, value: word, start, end: index });
  }
  tokens.push({ kind: 'eof', text: '', value: '', start: text.length, end: text.length });
  return tokens;
}
