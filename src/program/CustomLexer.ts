import * as moo from 'moo';
import {assert} from '../util/Utils';
import {Set as ISet} from 'immutable';

const OpRegex = /^[-+*/%=]$/;
const VarRegex = /^[a-z]\w+$/;
const ConstRegex = /^\d+(?:\.\d+)?$/;

const trim = (s: string) => s.trim();
const primOps = ['-', '+', '*', '/', '//', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||'] as const;
export type PrimOps = typeof primOps[number];
const kws = ['if', 'then', 'else', 'elif', 'endif', 'struct', 'do', 'end', 'return', 'while', 'for', 'in', 'break', 'continue'];
const brs = ['{', '}', '(', ')', '[', ']'];
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

const lexerSpec: {[key in DirtyLexerName]: moo.Rules[string]} = {
  nl: {match: /(?:#.*)?\n/, lineBreaks: true},
  rt: {match: / *-> */, value: trim},
  op: primOps as any,
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
  vr: /[idbsctofam][A-Z]\w*/,
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

export type LexedToken = {
  type: DirtyLexerName,
  value: string,
  text?: string,
  offset?: number,
  col?: number,
  line?: number,
  lineBreaks?: number,
};

export function checkLexerName(name: string): DirtyLexerName {
  assert(name in lexerSpec, `Add ${name} to lexer name list!`);
  return name as DirtyLexerName;
}

export type ValueT = NumT | StrT | FunT | TupT | ObjT | ArrT | MayT;
export type AnyT = ValueT | NulT;
export type NumT = 'i' | 'd' | 'b';
export type StrT = 's' | 'c';
export type FunT = 'f';
export type TupT = 't';
export type ObjT = 'o';
export type ArrT = 'a';
export type MayT = 'm';
export type NulT = '_';
export type LexerName = LexerOpts['type'];
const FilteredLexerNames_ = ['nl', 'os', 'ms', 'kw', 'rt', 'eq', 'cm', 'br', 'ta', 'qm'] as const;
export type FilteredLexerName = typeof FilteredLexerNames_[number];
export const FilteredLexerNames = ISet<string>(FilteredLexerNames_);
export type DirtyLexerName = LexerName | FilteredLexerName;
export type VrName = `${ValueT}${string}`;
export function tt(name: VrName): ValueT {return name.charAt(0) as ValueT;}
export interface Vr {
  type: 'vr';
  value: VrName;
}
interface Eq {
  type: 'eq';
  value: '=';
}
export interface Op {
  type: 'op';
  value: PrimOps;
}
export interface Sc {
  type: 'sc';
  value: ';';
}
export interface Cnst {
  type: 'cnst';
  value: string;
}
export interface Nu {
  type: 'nu';
  value: '_';
}
export interface Tc {
  type: 'tc';
  value: string;
}
export interface Tp {
  type: 'tp';
  value: NumT | StrT;
}
export interface Cm {
  type: 'cm';
  value: ',';
}
export interface Cl {
  type: 'cl';
  value: ':' | '::';
}
export interface Dt {
  type: 'dt';
  value: '.';
}
export type LexerOpts = Vr | Tc | Tp | Cl | Dt | Op | Sc | Cnst | Nu;




interface Err {
  type: 'err';
  value: string;
}
interface Line {
  type: 'nl';
  value: '';
}

export type Atom = Vr | Eq | Op | Cnst | Err | Line;
export type AtomType = Atom['type'];

function a<T extends Atom>(type: T['type'], value: T['value']): {type: T['type'], value: T['value'];} {
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
    return atom === '=' ? a<Eq>('eq', atom) : a<Op>('op', atom as any);
  } else if (VarRegex.test(atom)) {
    return a<Vr>('vr', atom as any);
  } else if (ConstRegex.test(atom)) {
    return a<Cnst>('cnst', atom);
  } else {
    return a<Err>('err', atom);
  }
}
