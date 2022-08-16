import moo from 'moo';
import { assert } from '../util/Utils';

const OpRegex = /^[-+*/%=]$/;
const VarRegex = /^[a-z]\w+$/;
const ConstRegex = /^\d+(?:\.\d+)?$/;

const trim = (s:string) => s.trim();
const ops = ['-', '+', '*', '/', '//', '%', '==', '!=', '<<', '>>', '<=', '>=', '&&', '||', ':'] as const;
const kws = ['if', 'then', 'else', 'elif', 'endif'] as const;
const kwrx = [
{match: /if +/, value: trim},
{match: / +then +/, value: trim},
{match: / +else +/, value: trim},
{match: / +elif +/, value: trim},
{match: / +endif/, value: trim},
];

const lexerSpec: {[key in DirtyLexerName]: moo.Rules[string]} = {
  nl:     { match: /\n+/, lineBreaks: true },
  rt:     { match: / *-> */, value: trim},
  op:     ops as any,
  sc:     [';'],
  eq:     { match: / *= *(?!=)/, value: trim},
  kw:     kwrx,
  ms:     /  +/,
  os:     ' ',
  vr:     /f?[idb][A-Z]\w*/,
  cnst:   /(?:\d+(?:\.\d+)?|true|false)/,
  //word: { match: /[a-z]+/, type: moo.keywords({ times: "x" }) },
  //times:  /\*/,
};
export function mooLexer() { return moo.compile(lexerSpec);}

export function checkLexerName(name: string): DirtyLexerName {
  assert(name in lexerSpec, `Add ${name} to lexer name list!`);
  return name as DirtyLexerName;
}

export type ValueType = 'i' | 'd' | 'b';
export type LexerName = LexerOpts['type'];
export type LexerLiterals = (Eq | Op | Sc | Rt | Kw)['value'];
export const FilteredLexerNames = ['nl' , 'os' , 'ms' , 'kw', 'rt', 'eq'] as const;
export type FilteredLexerName = typeof FilteredLexerNames[number];
export type DirtyLexerName = LexerName | FilteredLexerName;
export interface Vr {
  type: 'vr';
  value: `${'f' | ''}${ValueType}${string}`;
}
interface Eq {
  type: 'eq';
  value: '=';
}
export interface Op {
  type: 'op';
  value: typeof ops[number];
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

function a<T extends Atom>(type: T['type'], value: T['value']): {type: T['type'], value: T['value']} {
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