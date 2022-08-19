import moo from 'moo';
import {assert} from '../util/Utils';

const OpRegex = /^[-+*/%=]$/;
const VarRegex = /^[a-z]\w+$/;
const ConstRegex = /^\d+(?:\.\d+)?$/;

const trim = (s: string) => s.trim();
const primOps = ['-', '+', '*', '/', '//', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||'] as const;
const compOps = ['.:', '.', '::', ':', ','] as const;
export type PrimOps = typeof primOps[number];
export type CompOps = typeof compOps[number];
const kws = ['if', 'then', 'else', 'elif', 'endif', 'struct'] as const;
const kwrx = [
  {match: /if +/, value: trim},
  {match: / +then +/, value: trim},
  {match: / +else +/, value: trim},
  {match: / +elif +/, value: trim},
  {match: / +endif/, value: trim},
  {match: /struct/},
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
  op: primOps.concat(compOps as any) as any,
  sc: [';'],
  eq: {match: / *= *(?!=)/, value: trim},
  kw: kwrx,
  ms: /  +/,
  os: ' ',
  vr: /(?:[idbsctor]|[fa][idbsctorfa]?)[A-Z]\w*/,
  cnst: /\d+(?:\.\d+)?|true|false|'[^\n']+'|"[^\n"]+"/,
  //word: { match: /[a-z]+/, type: moo.keywords({ times: "x" }) },
  //times:  /\*/,
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

export type ValueType = StrType | NumType | FunType | TupType | ObjType | ArrType;
export type StrType = 's' | 'c';
export type NumType = 'i' | 'd' | 'b';
export type FunType = 'f' | 'r';
export type TupType = 't';
export type ObjType = 'o';
export type ArrType = 'a';
export type LexerName = LexerOpts['type'];
export type LexerLiterals = (Eq | Op | Sc | Rt | Kw)['value'];
export const FilteredLexerNames = ['nl', 'os', 'ms', 'kw', 'rt', 'eq'] as const;
export type FilteredLexerName = typeof FilteredLexerNames[number];
export type DirtyLexerName = LexerName | FilteredLexerName;
export interface Vr {
  type: 'vr';
  value: `${ValueType}${string}`;
}
interface Eq {
  type: 'eq';
  value: '=';
}
export interface Op {
  type: 'op';
  value: PrimOps | CompOps;
}
export interface Sc {
  type: 'sc';
  value: ';';
}
export interface Cnst {
  type: 'cnst';
  value: string;
}
interface Rt {
  type: 'rt';
  value: '->';
}
interface Kw {
  type: 'kw';
  value: typeof kws[number];
}
export type LexerOpts = Vr | Op | Sc | Cnst;




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