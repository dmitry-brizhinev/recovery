import {Cnst, DirtyLexerName, FilteredLexerNames, LexedToken, LexerName, Op, Sc, Vr} from "./CustomLexer";
import nearley from 'nearley';
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
# If-expression and if-receiver
ife -> "if" exp "then" exp "else" exp "endif"
ifr -> "if" exp "then" rec "else" rec "endif"

# General expression
exp -> exp2 | fnd
# Function definition expression
fnd -> vrl %rt exp | vrl %rt "struct"
# Compound expressions with binary operators
exp2 -> exp2 op2 exp1 mc2 | exp1 mc2
exp1 -> exp1 op1 exp0 mc1 | exp0 mc1
exp0 -> exp0 op0 vcf mc0 | vcf mc0

# Maybe whitespace
mws -> ws | null
ws -> %os | %ms
# Maybe (semi)colon
mc2 -> %ms %sc | null
mc1 -> %os %sc | null
mc0 -> %sc | null
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms
op1 -> %os %op | %op %os | %os %op %os
op0 -> %op
# Variable list
vrl -> vrl ws %vr | %vr | null
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | ife
# Receivers: the complement to expressions
rec -> %vr | ifr | %vr mws "." mws %vr
*/

export type ParserName = ParserOpts['type'];
const FilteredParserNames = ['doc', 'mws', 'ws', 'mc2', 'mc1', 'mc0', 'op2', 'op1', 'op0', 'vrl', 'vcf'] as const;
type FilteredParserName = typeof FilteredParserNames[number];
export type DirtyParserName = ParserName | FilteredParserName;

export function checkParserName(name: string): DirtyParserName {
  assert(name in cleaners, `Add ${name} to parser name list!`);
  return name as DirtyParserName;
}

const cleaners: {[key in DirtyParserName]: (name: key, rs: CleanerInput[]) => CleanerOutput | undefined} = {
  doc: flattenAndFilter,
  sta: filterAndLabel,
  ife: filterAndLabel,
  ifr: filterAndLabel,
  exp: filterAndLabel,
  fnd: filterAndLabel,
  exp2: filterAndLabel,
  exp1: filterAndLabel,
  exp0: filterAndLabel,
  mws: discard,
  ws: discard,
  mc2: filterAndUnwrapSingle,
  mc1: filterAndUnwrapSingle,
  mc0: filterAndUnwrapSingle,
  op2: filterAndUnwrapSingle,
  op1: filterAndUnwrapSingle,
  op0: filterAndUnwrapSingle,
  vrl: flattenAndFilter,
  vcf: filterAndUnwrapSingle,
  rec: filterAndLabel,
} as const;

export type Doc = Sta[];
export interface Sta {type: 'sta'; value: [Rec, Exp];}
export interface Ife {type: 'ife'; value: [Exp, Exp, Exp];}
export interface Ifr {type: 'ifr'; value: [Exp, Rec, Rec];}
export interface Exp {type: 'exp'; value: [Exp2] | [Fnd];}
export interface Fnd {type: 'fnd'; value: [Vrl, Exp] | [Vrl];}
export interface Exp2 {type: 'exp2'; value: [Exp2, Op, Exp1] | [Exp2, Op, Exp1, Sc] | [Exp1] | [Exp1, Sc];}
export interface Exp1 {type: 'exp1'; value: [Exp1, Op, Exp0] | [Exp1, Op, Exp0, Sc] | [Exp0] | [Exp0, Sc];}
export interface Exp0 {type: 'exp0'; value: [Exp0, Op, Vcf] | [Exp0, Op, Vcf, Sc] | [Vcf] | [Vcf, Sc];}
export type Vrl = Vr[];
export type Vcf = Vr | Cnst | Ife;
export interface Rec {type: 'rec'; value: [Vr | Ifr] | [Vr, Op, Vr];}

type ParserOpts = Sta | Ife | Ifr | Exp | Fnd | Exp2 | Exp1 | Exp0 | Rec;

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

function discard(name: 'mws' | 'ws', rs: CleanerInput[]): undefined {
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

function unwrapSingle(name: DirtyParserName, rs: CleanerInput[]): CleanerOutput {
  assert(rs.length === 1, `${name} had multiple children: ${JSON.stringify(rs)}`);
  return clean(rs[0]);
}

function filterAndUnwrapSingle(name: DirtyParserName, rs: CleanerInput[]): CleanerOutput | undefined {
  const r = rs.filter(cleaningFilter);
  if (r.length === 0) {
    return undefined;
  }
  return unwrapSingle(name, r);
}

function flattenAndFilter(name: 'vrl' | 'doc', rs: CleanerInput[]): CleanerOutput {
  return filterAndClean(rs.flat());
}

type Postprocessor = (data: CleanerInput[], loc?: number, reject?: {}) => CleanerOutput | undefined;

function getPostprocessor<T extends DirtyParserName>(name: T, rule: string): Postprocessor | undefined {
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