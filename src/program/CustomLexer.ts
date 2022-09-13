import * as moo from 'moo';
import {assert} from '../util/Utils';
import {Set as ISet} from 'immutable';

const trim = (s: string) => s.trim();
const primOps = ['-', '+', '*', '//', '/', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||'] as const;
export type PrimOps = typeof primOps[number];
const kws = ['if', 'then', 'else', 'elif', 'overload', 'struct', 'do', 'end', 'return', 'while', 'for', 'in', 'break', 'continue'];
const brs = ['{', '}', '(', ')', '[', ']', '<', '>'];
const cls = ['::', ':'];
export const literalLookup = {kw: kws, br: brs, cl: cls};

/*
  moo.compile({
    IDEN: {match: /[a-zA-Z]+/, type: moo.keywords({
      KW: ['while', 'if', 'else', 'moo', 'cows'],
    })},
    SPACE: {match: /\s+/, lineBreaks: true},
  })

    name: {match: /[a-zA-Z]+/, type: moo.keywords({
      'kw-class': 'class',
      'kw-def': 'def',
      'kw-if': 'if',
    })},
*/
//word: { match: /[a-z]+/, type: moo.keywords({ times: "x" }) },
//times:  /\*/,

type ConvertedRule = {match: RegExp | string, transform?: typeof trim | undefined};
type ConvertedToken = {type: DirtyLexerName, rules: ConvertedRule[]};
type ConvertedSpec = ConvertedToken[];
function convertRule(r: string | RegExp | moo.Rule | moo.ErrorRule | moo.FallbackRule): ConvertedRule {
  if (typeof r === 'string') return {match: r};
  if (r instanceof RegExp) return {match: r};
  if ('match' in r) {
    const m = r.match;
    if (m && !Array.isArray(m)) {
      return {match: m, transform: r.value};
    }
  }
  throw new Error('Unhappy lexer rule ' + JSON.stringify(r));
}
function convertRules(v: moo.Rules[string]): ConvertedRule[] {
  if (Array.isArray(v)) {
    return v.map(convertRule);
  } else {
    return [convertRule(v)];
  }
}
function convertSpec(spec: typeof lexerSpec): ConvertedSpec {
  return Object.entries(spec).map(([k, v]) => ({type: checkLexerName(k), rules: convertRules(v)}));
}

export interface Lexer extends nearley.Lexer {
  readonly errorToken?: LexedToken | undefined;
}

interface MyLexerState {
  /** The column where the match begins, starting from 1. */
  col: number;
  /** The line number of the beginning of the match, starting from 1. */
  line: number;
}
class MyLexer implements Lexer {
  static initialState(): MyLexerState {
    return {line: 1, col: 1};
  }

  private state: MyLexerState = MyLexer.initialState();
  /** The number of bytes from the start of the buffer where the match starts. */
  private offset: number = 0;
  private data: string = '';
  public errorToken?: LexedToken | undefined;
  constructor(private readonly spec: ConvertedSpec) {}

  /**
   * When you reach the end of Moo's internal buffer, next() will return undefined.
   * You can always reset() it and feed it more data when that happens.
   *
   * Returns e.g. {type, value, line, col, …}. Only the value attribute is required.
   */
  next(): LexedToken | undefined {
    const line = this.state.line;
    const col = this.state.col;
    const offset = this.offset;
    const trimmed = this.data.slice(offset);
    // console.log(this.data.replaceAll('\n', '\\n'), trimmed.replaceAll('\n', '\\n'));
    if (!trimmed) return undefined;

    for (const {type, rules} of this.spec) {
      for (const {match, transform} of rules) {
        let end = 0;
        if (typeof match === 'string') {
          if (!trimmed.startsWith(match)) continue;
          end = offset + match.length;
        } else {
          const sticky = new RegExp(match, 'y');
          if (!sticky.test(trimmed)) continue;
          end = offset + sticky.lastIndex;
        }
        const text = this.data.slice(offset, end);
        const value = transform?.(text) ?? text;
        const lineBreaks = text.match(/\n/g)?.length ?? 0;

        if (lineBreaks) {
          const lastLine = text.lastIndexOf('\n');
          this.state.col = text.length - lastLine;
          this.state.line += lineBreaks;
        } else {
          this.state.col += text.length;
        }
        this.offset = end;
        //console.log(`'${text.replaceAll('\n', '\\n')}'`, 'col', col, this.state.col);
        return {
          type,
          value,
          text,
          offset,
          /** The column where the match begins, starting from 1. */
          col,
          /** The line number of the beginning of the match, starting from 1. */
          line,
          /** The number of line breaks found in the match. */
          lineBreaks,
        };
      }
    }
    const error: LexedToken = {
      type: 'nl',
      value: trimmed.trimEnd(),
      text: trimmed.trimEnd(),
      offset,
      col,
      line,
      lineBreaks: 0,
    };
    throw new Error(this.formatError(error, 'invalid syntax'))
  }

  /**
   * Empty the internal buffer of the lexer, and set the line, column, and offset counts back to their initial value.
   *
   * Sets the internal buffer to data, and restores line/col/state info taken from save().
   */
  reset(data: string, state?: MyLexerState): void {
    this.data = data;
    this.offset = 0;
    this.state = state ?? MyLexer.initialState();
  }

  /**
   * Returns an object describing the current line/col etc. This allows us
   * to preserve this information between feed() calls, and also to support Parser#rewind().
   * The exact structure is lexer-specific; nearley doesn't care what's in it.
   */
  save(): MyLexerState {
    return this.state;
  }

  /**
   * Returns a string with an error message describing the line/col of the offending token.
   * You might like to include a preview of the line in question.
   */
  formatError(token: LexedToken, message?: string): string {
    this.errorToken = token;
    return `${message} at line ${token.line} col ${token.col}:

  ${this.data.trimEnd()}
  ${' '.repeat(token.offset)}^`;
  }
}

export function parseLexerError(e: Error): TokenLocation | undefined {
  const match = /^(?:Syntax error|invalid syntax) at line (\d+) col (\d+):\n\n[ ] (.+)\n[ ] +\^/.exec(e.message);
  if (!match || !match[1] || !match[2] || !match[3]) return undefined;
  const line = Number.parseInt(match[1]);
  const col = Number.parseInt(match[2]);
  const ll = match[3];
  return {sl: line - 1, sc: col - 1, ec: ll.length};
}

const vrRegex = /[idbsctofamgφ][A-Z]\w*/;
const lexerSpec: {[key in DirtyLexerName]: moo.Rules[string]} = {
  nl: {match: /(?:#.*)?\n/, lineBreaks: true},
  rt: {match: / *-> */, value: trim},
  op: primOps as any,
  ad: ['&'],
  sc: [';'],
  dt: ['.'],
  cm: [','],
  cl: cls,
  qm: ['?'],
  eq: {match: / *= *(?!=)/, value: trim},
  kw: kws,
  ms: /  +/,
  os: ' ',
  br: brs,
  vr: vrRegex,
  tg: /[A-Z]\w*T(?!\w)|T(?!\w)/,
  tc: /[A-Z]\w*/,
  cnst: /\d+(?:\.\d+)?|true|false|'[^\n']+'|"[^\n"]+"/,
  nu: ['_'],
  tp: /[idbsc]/,
};
export function mooLexer() {return moo.compile(lexerSpec);}
export function myLexer() {return new MyLexer(convertSpec(lexerSpec));}

function assertCleanLexerName(name: string): asserts name is LexerName {
  assert(!FilteredLexerNames.has(checkLexerName(name)), `Dirty lexer name ${name}`);
}

export interface LexedToken {
  type: DirtyLexerName;
  value: string;
  text: string;
  /** The number of bytes from the start of the buffer where the match starts. */
  offset: number;
  /** The column where the match begins, starting from 1. */
  col: number;
  /** The line number of the beginning of the match, starting from 1. */
  line: number;
  /** The number of line breaks found in the match. (Always zero if this rule has lineBreaks: false.) */
  lineBreaks: number;
};
export interface TokenLocation {
  sl: number;
  sc: number;
  ec: number;
  el?: number | undefined;
}
export interface CleanToken {
  type: LexerName;
  value: string;
  loc: TokenLocation;
}
export function getLoc(t: LexedToken): TokenLocation {
  const sl = t.line - 1;
  const sc = t.col - 1;
  if (t.lineBreaks) {
    const el = sl + t.lineBreaks;
    const ec = t.text.length - t.text.lastIndexOf('\n') - 1;
    return {sl, sc, ec, el};
  } else {
    return {sl, sc, ec: sc + t.text.length};
  }
}
export function cleanLexedToken(v: LexedToken): CleanToken | Vr | undefined {
  if (FilteredLexerNames.has(v.type)) return undefined;
  assertCleanLexerName(v.type);
  const {type, value} = v;
  const loc = getLoc(v);
  const clean: CleanToken = {type, value, loc};
  if (type === 'vr') {
    return tt(clean);
  } else {
    return clean;
  }
}

export function checkLexerName(name: string): DirtyLexerName {
  assert(name in lexerSpec, `Add ${name} to lexer name list!`);
  return name as DirtyLexerName;
}

type ValueT = NumT | StrT | FunT | TupT | ObjT | ArrT | MayT | GenT;
// export type AnyT = ValueT | NulT | TopT | BotT;
export type NumT = 'i' | 'd' | 'b';
export type StrT = 's' | 'c';
export type FunT = 'f';
export type TupT = 't';
export type ObjT = 'o';
export type ArrT = 'a';
export type MayT = 'm';
export type GenT = 'g';
export type NulT = '_';
export type TopT = '*';
export type BotT = '-';
export type LexerName = LexerOpts['type'];
const FilteredLexerNames_ = ['nl', 'os', 'ms', 'kw', 'ad', 'rt', 'eq', 'cm', 'dt', 'br', 'qm'] as const;
export type FilteredLexerName = typeof FilteredLexerNames_[number];
export const FilteredLexerNames = ISet<string>(FilteredLexerNames_);
export type DirtyLexerName = LexerName | FilteredLexerName;

export type VrName = `${ValueT}${string}`;
export interface VrType {core: ValueT;};
function tt(v: CleanToken): Vr {
  const {type, value, loc} = v;
  assert(type === 'vr');
  assert(vrRegex.test(value));
  const t = value.charAt(0) as ValueT;
  const vrtype = {core: t};
  return {type, value: value as VrName, loc, vrtype};
}

export interface Vr extends CleanToken {
  type: 'vr';
  value: VrName;
  vrtype: VrType;
}
export interface Op extends CleanToken {
  type: 'op';
  value: PrimOps;
}
export interface Sc extends CleanToken {
  type: 'sc';
  value: ';';
}
export interface Cnst extends CleanToken {
  type: 'cnst';
  value: string;
}
export interface Nu extends CleanToken {
  type: 'nu';
  value: '_';
}
export interface Tc extends CleanToken {
  type: 'tc';
  value: string;
}
export interface Tg extends CleanToken {
  type: 'tg';
  value: string;
}
export interface Tp extends CleanToken {
  type: 'tp';
  value: NumT | StrT;
}
export interface Cl extends CleanToken {
  type: 'cl';
  value: ':' | '::';
}
export type LexerOpts = Vr | Tc | Tg | Tp | Cl | Op | Sc | Cnst | Nu;
