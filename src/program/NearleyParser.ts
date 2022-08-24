import type {Cl, Cm, Cnst, DirtyLexerName, Dt, LexedToken, LexerName, Op, Sc, Tc, Tp, Vr} from "./CustomLexer";
import {FilteredLexerNames} from "./CustomLexer";
import * as nearley from 'nearley';
import {assert} from "../util/Utils";
import compileGrammar from "./NearleyGrammar";

/*
@preprocessor typescript
@{% const lexer: any = {has: () => true}; %}
@lexer lexer

# Whole document
doc -> sta %nl doc | %nl doc | sta %nl | sta | %nl
# Assignment statement
sta -> rec %eq exp
# Receivers: the complement to expressions
rec -> var | exp %dt %vr

# If-expression
ife -> ifs ifn
ifn -> "endif" | "else" exp "endif" | "elif" exp "then" exp ifn
ifs -> "if" exp "then" exp
# General expression
exp -> exa2 | fnd
# Function definition expression
fnd -> vrl %rt typ ws exp | vrl %rt exp | vrl %rt "struct" %tc
# Compound expressions with binary operators
exa2 -> exc2 #| arr2
#arr2 -> ars2 %ms "]"
exc2 -> exl2 sc2      | exl2
exl2 -> exl2 cl2 emo2 | emo2
emo2 -> exo2 | exm2 | ars2 %ms "]"
ars2 -> ars2 cm2 exo2 | "[" %ms exo2
exm2 -> exm2 cm2 exo2 | cm2 exo2
exo2 -> exo2 op2 exa1 | exa1
# One space
exa1 -> exc1 #| arr1
#arr1 -> ars1 %os "]"
exc1 -> exl1 sc1      | exl1
exl1 -> exl1 cl1 emo1 | emo1
emo1 -> exo1 | exm1 | ars1 %os "]"
ars1 -> ars1 cm1 exo1 | "[" %os exo1
exm1 -> exm1 cm1 exo1 | cm1 exo1
exo1 -> exo1 op1 exa0 | exa0
# No spaces
exa0 -> exc0 #| arr0
#arr0 -> ars0 "]"
exc0 -> exl0 sc0      | exl0
exl0 -> exl0 cl0 emo0 | emo0
emo0 -> exo0 | exm0 | ars0 "]"
ars0 -> ars0 cm0 exo0 | "[" exo0
exm0 -> exm0 cm0 exo0 | cm0 exo0
exo0 -> exo0 op0 dot  | dot
# Dot operator
dot -> vcf | vcf %dt %vr
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | ife | "(" mws exp mws ")" | arre
arre -> "[" mws "]"

# Maybe whitespace
mws -> ws | null
ws -> %os | %ms
# Semicolon
sc2 -> %ms %sc
sc1 -> %os %sc
sc0 -> %sc
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms
op1 -> %os %op | %op %os | %os %op %os
op0 -> %op
# Comma
cm2 -> %ms %cm mws | %os %cm %ms | %cm %ms
cm1 -> %os %cm | %cm %os | %os %cm %os
cm0 -> %cm
# Colon / double-colon
cl2 -> %ms %cl mws | %os %cl %ms | %cl %ms
cl1 -> %os %cl | %cl %os | %os %cl %os
cl0 -> %cl
# Type annotations
typ -> "{" ctp "}" | %tc | %tp
ctp -> ftp | ttp | atp
ttp -> %cm typ | ttp %cm typ
atp -> "a" typ
ftp -> %rt typ | tps %rt typ
tps -> typ | tps ":" typ
# Variable with type annotation
var -> %vr | %vr mws typ
# Variable list
vrl -> vrl ws var | var | null
*/

export type ParserName = ParserOpts['type'];
const FilteredParserNames = ['doc', 'exp', 'exa0', 'exa1', 'exa2', 'emo0', 'emo1', 'emo2', 'vcf', 'mws', 'ws', 'sc2', 'sc1', 'sc0', 'op2', 'op1', 'op0', 'cm2', 'cm1', 'cm0', 'cl2', 'cl1', 'cl0', 'typ', 'ctp', 'tps', 'vrl'] as const;
type FilteredParserName = typeof FilteredParserNames[number];
export type DirtyParserName = ParserName | FilteredParserName;

export function checkParserName(name: string): DirtyParserName {
  assert(name in cleaners, `Add ${name} to parser name list!`);
  return name as DirtyParserName;
}

const cleaners: {[key in DirtyParserName]: (name: key, rs: CleanerInput[]) => CleanerOutput | undefined} = {
  doc: flattenAndFilter,
  sta: filterAndLabel,
  rec: filterAndLabelOrUnwrap,
  ife: filterAndLabel,
  ifn: filterAndLabel,
  ifs: filterAndLabel,
  exp: filterAndUnwrapSingle,
  fnd: filterAndLabel,
  exa0: filterAndUnwrapSingle, exa1: filterAndUnwrapSingle, exa2: filterAndUnwrapSingle,
  //  arr0: filterAndUnwrapSingle, arr1: filterAndUnwrapSingle, arr2: filterAndUnwrapSingle,
  ars0: filterAndLabel, ars1: filterAndLabel, ars2: filterAndLabel,
  exc0: filterAndLabelOrUnwrap, exc1: filterAndLabelOrUnwrap, exc2: filterAndLabelOrUnwrap,
  exl0: filterAndLabelOrUnwrap, exl1: filterAndLabelOrUnwrap, exl2: filterAndLabelOrUnwrap,
  emo0: filterAndUnwrapSingle, emo1: filterAndUnwrapSingle, emo2: filterAndUnwrapSingle,
  exm0: filterAndLabelOrUnwrap, exm1: filterAndLabelOrUnwrap, exm2: filterAndLabelOrUnwrap,
  exo0: filterAndLabelOrUnwrap, exo1: filterAndLabelOrUnwrap, exo2: filterAndLabelOrUnwrap,
  dot: filterAndLabelOrUnwrap,
  vcf: filterAndUnwrapSingle,
  arre: filterAndLabel,
  mws: discard,
  ws: discard,
  sc2: filterAndUnwrapSingle,
  sc1: filterAndUnwrapSingle,
  sc0: filterAndUnwrapSingle,
  op2: filterAndUnwrapSingle,
  op1: filterAndUnwrapSingle,
  op0: filterAndUnwrapSingle,
  cm2: filterAndUnwrapSingle,
  cm1: filterAndUnwrapSingle,
  cm0: filterAndUnwrapSingle,
  cl2: filterAndUnwrapSingle,
  cl1: filterAndUnwrapSingle,
  cl0: filterAndUnwrapSingle,
  typ: filterAndUnwrapSingle,
  ctp: filterAndUnwrapSingle,
  ttp: filterAndLabel,
  atp: filterAndLabel,
  ftp: filterAndLabel,
  tps: flattenAndFilter,
  var: filterAndLabel,
  vrl: flattenAndFilter,
} as const;

export type Doc = Sta[];
export interface Sta {type: 'sta'; value: [Rec | Var, Exp];}
export interface Rec {type: 'rec'; value: [Exp, Dt, Vr];}
export interface Ife {type: 'ife'; value: [Ifs, Ifn];}
export interface Ifn {type: 'ifn'; value: [] | [Exp] | [Exp, Exp, Ifn];}
export interface Ifs {type: 'ifs'; value: [Exp, Exp];}
// export interface Exp {type: 'exp'; value: [ExAny] | [Fnd];}
export interface Fnd {type: 'fnd'; value: [Vrl, Exp] | [Vrl, Typ, Exp] | [Vrl, Tc];}

export interface Exc {type: 'exc0' | 'exc1' | 'exc2'; value: [AnyExp, Sc];}
export interface Exl {type: 'exl0' | 'exl1' | 'exl2'; value: [AnyExp, Cl, AnyExp];}
export interface Exm {type: 'exm0' | 'exm1' | 'exm2'; value: [AnyExp, Cm, AnyExp] | [Cm, AnyExp];}
export interface Exo {type: 'exo0' | 'exo1' | 'exo2'; value: [AnyExp, Op, AnyExp];}

export interface Dot {type: 'dot'; value: [Vcf, Dt, Vr];}
export interface Arr {type: 'ars0' | 'ars1' | 'ars2' | 'arre'; value: [Arr, Cm, AnyExp] | [AnyExp] | [];}

export type Typ = Ftp | Ttp | Atp | Tc | Tp;
export interface Ttp {type: 'ttp'; value: [Cm, Typ] | [Ttp, Cm, Typ];}
export interface Atp {type: 'atp'; value: [Typ];}
export interface Ftp {type: 'ftp'; value: [Typ] | [Tps, Typ];}
export type Tps = (Typ | Cl)[];
export interface Var {type: 'var'; value: [Vr] | [Vr, Typ];}
export type Vrl = Var[];

type Vcf = AnyExp;
type Exp = AnyExp;
export type AnyExp = Exm | Exo | Dot | Exc | Exl | Vr | Cnst | Ife | Fnd | Arr;

type ParserOpts = Sta | Rec | Ife | Ifn | Ifs | Fnd | Arr | Exc | Exl | Exm | Exo | Dot | Ttp | Atp | Ftp | Var;



type ParsedRule = {
  type: DirtyParserName,
  value: Processed[],
};

type CleanedRule = {type: ParserName, value: Processed[];};
type DirtyRule = ParsedRule;
type CleanedToken = {type: LexerName, value: string;};
type DirtyToken = {type: DirtyLexerName, value: string;};

type CleanerInput = Raw;
type CleanerOutput = Processed | Processed[];

type Raw = LexedToken | ParsedRule;
type Processed = DirtyToken | DirtyRule;
type Clean = CleanedRule | CleanedToken;

function discard(_name: FilteredParserName, _rs: CleanerInput[]): undefined {
  return undefined;
}

function cleaningFilter(e: Raw): boolean {
  return e != null && (Array.isArray(e) ||
    !((FilteredParserNames as readonly string[]).includes(e.type) || (FilteredLexerNames as readonly string[]).includes(e.type)));
}

function clean(e: Raw): DirtyToken | DirtyRule {
  if (Array.isArray(e)) return e;
  const {type, value} = e;
  return {type, value} as any;
}

function filterAndClean(rs: Raw[]): Clean[] {
  const x = rs.filter(cleaningFilter).map(clean);
  return x as any;
}

function filterAndLabel(name: ParserName, rs: CleanerInput[]): CleanerOutput {
  const r = filterAndClean(rs);
  return {type: name, value: r};
}

function filterAndLabelOrUnwrap(name: ParserName, rs: CleanerInput[]): CleanerOutput {
  const r = filterAndClean(rs);
  if (r.length === 1) return unwrapSingle(name, r);
  return {type: name, value: r};
}

function unwrapSingle(name: DirtyParserName, rs: CleanerInput[]): CleanerOutput {
  assert(rs.length === 1, `${name} had multiple children: ${JSON.stringify(rs)}`);
  return clean(rs[0]);
}

function filterAndUnwrapSingle(name: FilteredParserName, rs: CleanerInput[]): CleanerOutput | undefined {
  const r = rs.filter(cleaningFilter);
  if (r.length === 0) {
    return undefined;
  }
  return unwrapSingle(name, r);
}

function flattenAndFilter(_name: 'vrl' | 'doc' | 'tps', rs: CleanerInput[]): CleanerOutput {
  return filterAndClean(rs.flat());
}

type Postprocessor = (data: CleanerInput[], loc?: number, reject?: {}) => CleanerOutput | undefined;

function getPostprocessor<T extends DirtyParserName>(name: T, _rule: string): Postprocessor | undefined {
  return cleaners[name].bind(undefined, name);
}

const compiled: {v?: nearley.CompiledRules;} = {};

export interface Parser {
  parseLine: (line: string) => Promise<Sta[]>;
  finish: () => Promise<void>;
}

export class NearleyParser implements Parser {
  private constructor(private readonly parser: nearley.Parser) {}
  private statements: number = 0;

  static async start(lexer: nearley.Lexer): Promise<NearleyParser> {
    const grammar = nearley.Grammar.fromCompiled(compiled.v || (compiled.v = await compileGrammar(getPostprocessor)));
    return new NearleyParser(new nearley.Parser(grammar, {lexer}));
  }

  async parseLine(line: string): Promise<Sta[]> {
    this.parser.feed(line);
    const result = this.parser.results as Sta[][];
    if (result.length === 1) {
      const full = result[0];
      const part = full.slice(this.statements);
      this.statements = full.length;
      return part;
    } else {
      return [];
    }
  }

  async finish(): Promise<void> {
    const result = this.parser.results;
    if (result.length === 0) {
      // Trigger an error from the parser internals:
      this.parser.feed('|unexpected end of input|');
    }

    if (result.length > 1) {
      const [a, b] = compareParses(result[0], result[1]);
      //const a = JSON.stringify(result[0]);
      //const b = JSON.stringify(result[1]);
      throw new Error(`Unexpected ambiguous parse (${result.length})(${a === b})\na:${a}\nb:${b}`);
    }
  }
}

function compareParses(a: Doc, b: Doc): [string, string] {
  if (a.length > b.length) {
    return [visualiseNode(a[b.length]), 'null'];
  } else if (b.length > a.length) {
    return ['null', visualiseNode(b[a.length])];
  } else {
    for (const [i, as] of a.entries()) {
      const bs = b[i];
      const aa = visualiseNode(as);
      const bb = visualiseNode(bs);
      if (aa !== bb) {
        return [aa, bb];
      }
    }
  }
  return ['??', '??'];
}

type Node = {type: string, value: Node | string;} | Node[];

export function visualiseNode(n: Node): string {
  if (Array.isArray(n)) {
    return `[${n.map(visualiseNode).join(',')}]`;
  } else {
    const value = typeof n.value === 'string' ? n.value : visualiseNode(n.value);
    return `{${n.type}:${value}}`;
  }
}
