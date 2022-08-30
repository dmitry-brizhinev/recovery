import type {Cl, Cm, Cnst, DirtyLexerName, Dt, LexedToken, LexerName, Nu, Op, Sc, Tc, Tp, Vr} from "./CustomLexer";
import {FilteredLexerNames} from "./CustomLexer";
import * as nearley from 'nearley';
import {assert} from "../util/Utils";
import {fetchGrammar, default as compileGrammar} from "./NearleyGrammar";
import parseGrammar from './GrammarParser';

export type ParserName = ParserOpts['type'];
const FilteredParserNames = ['doc', 'mnl', 'wnl', 'bls', 'sta', 'sep', 'eob', 'blo', 'ifl', 'ifn', 'exp', 'eod', 'exa0', 'exa1', 'exa2', 'emo0', 'emo1', 'emo2', 'vcf', 'mws', 'ws', 'sc2', 'sc1', 'sc0', 'op2', 'op1', 'op0', 'cm2', 'cm1', 'cm0', 'cl2', 'cl1', 'cl0', 'typ', 'tps', 'vrl'] as const;
type FilteredParserName = typeof FilteredParserNames[number];
export type DirtyParserName = ParserName | FilteredParserName;

export function checkParserName(name: string): DirtyParserName {
  assert(name in cleaners, `Add ${name} to parser name list!`);
  return name as DirtyParserName;
}

const cleaners: {[key in DirtyParserName]: (name: key, rs: CleanerInput[]) => CleanerOutput | undefined} = {
  doc: filterAndUnwrapSingle,
  mnl: discard,
  wnl: discard,
  ass: filterAndLabel,
  ret: filterAndLabel,
  brk: filterAndLabel,
  cnt: filterAndLabel,
  bls: filterAndUnwrapSingle,
  sta: filterAndUnwrapSingle,
  sep: discard,
  rec: filterAndLabelOrUnwrap,
  eob: filterAndUnwrapSingle,
  blo: flattenAndFilter,
  ife: filterAndLabel,
  ifl: filterAndUnwrapSingle,
  ifn: flattenAndFilter,
  ifb: filterAndLabel,
  dow: filterAndLabel,
  wdo: filterAndLabel,
  for: filterAndLabel,
  doo: filterAndLabel,
  exp: filterAndUnwrapSingle,
  eod: filterAndUnwrapSingle,
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
  mtp: filterAndLabel,
  ttp: filterAndLabel,
  atp: filterAndLabel,
  ftp: filterAndLabel,
  tps: flattenAndFilter,
  var: filterAndLabel,
  vrl: flattenAndFilter,
} as const;

export type Doc = Blo;
export interface Ass {type: 'ass'; value: [Rec | Var | Nu, Exp];}
export interface Ret {type: 'ret'; value: [Exp];}
export interface Brk {type: 'brk'; value: [];}
export interface Cnt {type: 'cnt'; value: [];}
export interface Rec {type: 'rec'; value: [Exp, Dt, Vr];}
export interface Ife {type: 'ife'; value: [Ifb, Ifn, Eob] | [Ifb, Ifn];}
export type Ifn = Ifb[];
export interface Ifb {type: 'ifb'; value: [Exp, Eob];}
export interface Dow {type: 'dow'; value: [Eob, Exp];}
export interface Wdo {type: 'wdo'; value: [Exp, Eob];}
export interface For {type: 'for'; value: [Var, Exp, Eob];}
export type Eob = Exp | Blo;
export type Bls = Ife | Dow | Wdo | For | Doo;
export type Eod = AnyExp;
export type Sta = Ass | Ret | Brk | Cnt | Exp;
export type Blo = Sta[];
export interface Doo {type: 'doo'; value: [Eob];}
// export interface Exp {type: 'exp'; value: [ExAny] | [Fnd];}
export interface Fnd {type: 'fnd'; value: [Vrl, Eod] | [Vrl, Typ, Eod] | [Vrl, Tc];}

export interface Exc {type: 'exc0' | 'exc1' | 'exc2'; value: [AnyExp, Sc];}
export interface Exl {type: 'exl0' | 'exl1' | 'exl2'; value: [AnyExp, Cl, AnyExp];}
export interface Exm {type: 'exm0' | 'exm1' | 'exm2'; value: [AnyExp, Cm, AnyExp] | [Cm, AnyExp];}
export interface Exo {type: 'exo0' | 'exo1' | 'exo2'; value: [AnyExp, Op, AnyExp];}

export interface Dot {type: 'dot'; value: [Vcf, Dt, Vr];}
export interface Arr {type: 'ars0' | 'ars1' | 'ars2' | 'arre'; value: [Arr, Cm, AnyExp] | [AnyExp] | [];}

export type Typ = Ftp | Ttp | Atp | Tc | Tp | Mtp;
export interface Mtp {type: 'mtp'; value: [Typ];}
export interface Ttp {type: 'ttp'; value: [Cm, Typ] | [Ttp, Cm, Typ];}
export interface Atp {type: 'atp'; value: [Typ];}
export interface Ftp {type: 'ftp'; value: [Typ] | [Tps, Typ];}
export type Tps = (Typ | Cl)[];
export interface Var {type: 'var'; value: [Vr] | [Vr, Typ];}
export type Vrl = Var[];

type Vcf = AnyExp;
type Exp = AnyExp;
export type AnyExp = Exm | Exo | Dot | Exc | Exl | Vr | Cnst | Nu | Bls | Fnd | Arr;

type ParserOpts = Ass | Ret | Brk | Cnt | Rec | Doo | Ife | Ifb | Dow | Wdo | For | Fnd | Arr | Exc | Exl | Exm | Exo | Dot | Ttp | Atp | Ftp | Mtp | Var;



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

function flattenAndFilter(_name: 'vrl' | 'blo' | 'ifn' | 'tps', rs: CleanerInput[]): CleanerOutput {
  return filterAndClean(rs.flat());
}

type Postprocessor = (data: CleanerInput[], loc?: number, reject?: {}) => CleanerOutput | undefined;

function getPostprocessor<T extends DirtyParserName>(name: T, _rule: string): Postprocessor | undefined {
  return cleaners[name].bind(undefined, name);
}

const compiled: {v?: nearley.CompiledRules;} = {};

export interface Parser {
  parseLine: (line: string) => Promise<Ass[]>;
  finish: () => Promise<void>;
}

export async function generateTypes() {
  const grammar = await fetchGrammar();
  return parseGrammar(grammar);
}

export class NearleyParser implements Parser {
  private constructor(private readonly parser: nearley.Parser) {}
  private statements: number = 0;

  static async start(lexer: nearley.Lexer): Promise<NearleyParser> {
    const grammar = nearley.Grammar.fromCompiled(compiled.v || (compiled.v = await compileGrammar(getPostprocessor)));
    return new NearleyParser(new nearley.Parser(grammar, {lexer}));
  }

  async parseLine(line: string): Promise<Ass[]> {
    this.parser.feed(line);
    const result = this.parser.results as Ass[][];
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
