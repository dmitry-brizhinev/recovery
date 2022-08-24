import * as moo from 'moo';
import {assert} from '../util/Utils';

const OpRegex = /^[-+*/%=]$/;
const VarRegex = /^[a-z]\w+$/;
const ConstRegex = /^\d+(?:\.\d+)?$/;

const trim = (s: string) => s.trim();
const primOps = ['-', '+', '*', '/', '//', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||'] as const;
export type PrimOps = typeof primOps[number];
const kws = ['if', 'then', 'else', 'elif', 'endif', 'struct'] as const;
const kwrx = [
  {match: /if +/, value: trim},
  {match: / +then +/, value: trim},
  {match: / +else +/, value: trim},
  {match: / +elif +/, value: trim},
  {match: / +endif/, value: trim},
  {match: /struct +/, value: trim},
];

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
  nl: {match: /(?: *#.*\n| *\n)+/, lineBreaks: true},
  rt: {match: / *-> */, value: trim},
  op: primOps as any,
  sc: [';'],
  dt: ['.'],
  cm: [','],
  cl: ['::', ':'],
  eq: {match: / *= *(?!=)/, value: trim},
  kw: kwrx,
  ms: /  +/,
  os: ' ',
  br: ['{', '}', '(', ')'],
  vr: /[idbsctofa][A-Z]\w*/,
  tc: /[A-Z]\w*/,
  cnst: /\d+(?:\.\d+)?|true|false|'[^\n']+'|"[^\n"]+"/,
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

export type ValueT = NumT | StrT | FunT | TupT | ObjT | ArrT;
export type NumT = 'i' | 'd' | 'b';
export type StrT = 's' | 'c';
export type FunT = 'f';
export type TupT = 't';
export type ObjT = 'o';
export type ArrT = 'a';
export type LexerName = LexerOpts['type'];
export type LexerLiterals = (Eq | Op | Sc | Rt | Kw)['value'];
export const FilteredLexerNames = ['nl', 'os', 'ms', 'kw', 'rt', 'eq', 'br', 'ta'] as const;
export type FilteredLexerName = typeof FilteredLexerNames[number];
export type DirtyLexerName = LexerName | FilteredLexerName;
export type VrName = Vr['value'];
export interface Vr {
  type: 'vr';
  value: `${ValueT}${string}`;
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
interface Rt {
  type: 'rt';
  value: '->';
}
interface Kw {
  type: 'kw';
  value: typeof kws[number];
}
export type LexerOpts = Vr | Tc | Tp | Cl | Cm | Dt | Op | Sc | Cnst;




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
