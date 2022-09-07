import * as moo from 'moo';
import {assert} from '../util/Utils';
import {Set as ISet} from 'immutable';

const OpRegex = /^[-+*/%=]$/;
const ConstRegex = /^\d+(?:\.\d+)?$/;

const trim = (s: string) => s.trim();
const primOps = ['-', '+', '*', '/', '//', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||'] as const;
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

const vrRegex = /[idbsctofamg][A-Z]\w*/;
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
  ta: 'a',
  //word: { match: /[a-z]+/, type: moo.keywords({ times: "x" }) },
  // {Abb = f:i:b:a;} {r:i:a;->Bob}
  //times:  /\*/,    fX {f:i:b:a;->f:b}
};
export function mooLexer() {return moo.compile(lexerSpec);}

function assertCleanLexerName(name: string): asserts name is LexerName {
  assert(!FilteredLexerNames.has(checkLexerName(name)), `Dirty lexer name ${name}`);
}

export interface LexedToken {
  type: DirtyLexerName;
  value: string;
  text: string;
  offset: number;
  col: number;
  line: number;
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
export function cleanLexedToken(v: LexedToken): [CleanToken | Vr] | [] {
  if (FilteredLexerNames.has(v.type)) return [];
  assertCleanLexerName(v.type);
  const {type, value} = v;
  const loc = getLoc(v);
  const clean: CleanToken = {type, value, loc};
  if (type === 'vr') {
    return [tt(clean)];
  } else {
    return [clean];
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
const FilteredLexerNames_ = ['nl', 'os', 'ms', 'kw', 'ad', 'rt', 'eq', 'cm', 'dt', 'br', 'ta', 'qm'] as const;
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




interface Err {
  type: 'err';
  value: string;
}
interface Line {
  type: 'nl';
  value: '';
}

export type Atom = Vr | Op | Cnst | Err | Line;
export type AtomType = Atom['type'];

function a<T extends Atom>(type: T['type'], value: T['value']): any {
  return {type, value};
}

export function myLexer(code: string): Atom[] {
  return code.replaceAll(/\n\n+/g, '\n\n').split('\n').flatMap(parseLine);
}
function parseLine(line: string): Atom[] {
  if (line === '') return [a<Line>('nl', line)];

  const result = line.split(/\s+/).filter(a => a).map(parseAtom);
  result.push(a<Line>('nl', ''));
  return result;
}
function parseAtom(atom: string): Atom {
  if (OpRegex.test(atom)) {
    return atom === '=' ? a<Op>('op', atom as any) : a<Op>('op', atom as any);
  } else if (vrRegex.test(atom)) {
    return a<Vr>('vr', atom as any);
  } else if (ConstRegex.test(atom)) {
    return a<Cnst>('cnst', atom);
  } else {
    return a<Err>('err', atom);
  }
}
