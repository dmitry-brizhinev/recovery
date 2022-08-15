import { Atom, AtomType, checkLexerName, Cnst, DirtyLexerName, FilteredLexerNames, LexerName, Op, Sc, Vr } from "./CustomLexer";
import { Stack } from 'immutable';
import nearley from 'nearley';
import { assert } from "../util/Utils";

const grammar = `
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
fnd -> vrl %rt exp
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
rec -> %vr | ifr
`;

export type ParserName = ParserOpts['type'];
const FilteredParserNames = ['doc', 'mws', 'ws', 'mc2', 'mc1', 'mc0', 'op2', 'op1', 'op0', 'vrl', 'vcf', 'rec'] as const;
type FilteredParserName = typeof FilteredParserNames[number];
export type DirtyParserName = ParserName | FilteredParserName;

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
  ws:  discard,
  mc2: filterAndUnwrapSingle,
  mc1: filterAndUnwrapSingle,
  mc0: filterAndUnwrapSingle,
  op2: filterAndUnwrapSingle,
  op1: filterAndUnwrapSingle,
  op0: filterAndUnwrapSingle,
  vrl: flattenAndFilter,
  vcf: filterAndUnwrapSingle,
  rec: filterAndUnwrapSingle,
} as const;

export type Doc = Sta[];
export interface Sta {type: 'sta'; value: [Rec, Exp];}
export interface Ife {type: 'ife'; value: [Exp, Exp, Exp];}
export interface Ifr {type: 'ifr'; value: [Exp, Rec, Rec];}
export interface Exp {type: 'exp'; value: [Exp2] | [Fnd];}
export interface Fnd {type: 'fnd'; value: [Vrl, Exp];}
export interface Exp2 {type: 'exp2'; value: [Exp2, Op, Exp1] | [Exp2, Op, Exp1, Sc] | [Exp1] | [Exp1, Sc];}
export interface Exp1 {type: 'exp1'; value: [Exp1, Op, Exp0] | [Exp1, Op, Exp0, Sc] | [Exp0] | [Exp0, Sc];}
export interface Exp0 {type: 'exp0'; value: [Exp0, Op, Vcf]  | [Exp0, Op, Vcf,  Sc] | [Vcf]  | [Vcf,  Sc];}
export type Vrl = Vr[];
export type Vcf = Vr | Cnst | Ife;
export type Rec = Vr | Ifr;

type ParserOpts = Sta | Ife | Ifr | Exp | Fnd | Exp2 | Exp1 | Exp0;

type ParsedToken = {
  type: DirtyLexerName,
  value: string,
  text?: string,
  offset?: number,
  col?: number,
  line?: number, 
  lineBreaks?: number,
};

type ParsedRule = {
  type: DirtyParserName,
  value: Processed[],
};

// type Cleaned = LexerOpts | ParserOpts;

type CleanedRule = {type: ParserName, value: Processed[]};
type DirtyRule = ParsedRule
type CleanedToken = {type: LexerName, value: string};
type DirtyToken = {type: DirtyLexerName, value: string};

type CleanerInput = Raw;
type CleanerOutput = Processed | Processed[];

type Raw = ParsedToken | ParsedRule;
type Processed = DirtyToken | DirtyRule;
type Clean = CleanedRule | CleanedToken;

function checkParserName(name: string): DirtyParserName {
  assert(name in cleaners, `Add ${name} to parser name list!`);
  return name as DirtyParserName;
}

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

function getPostprocessor<T extends DirtyParserName>(name: T, rule: string, symbols: Symbol[]): Postprocessor | undefined {
  return cleaners[name].bind(undefined, name);
}

type Symbol = {type: DirtyLexerName} | {literal: string} | {test: (t: ParsedToken) => boolean} | DirtyParserName;

function parseSymbol(t: string): Symbol {
  if (t.startsWith('%')) {
    return {type: checkLexerName(t.substring(1))};
  } else if (t.startsWith('"') && t.endsWith('"')) {
    const value = t.substring(1,t.length-1);
    return {test: v => v.value === value};
  }
  return checkParserName(t);
}
function makeGrammar(): nearley.CompiledRules {
  const result: nearley.CompiledRules = {ParserRules: [], ParserStart: ''};
  for (const gg of grammar.trim().split('\n')) {
    const g = gg.split('#')[0].trim();
    if (g.length === 0) continue;
    const gs = g.split(' -> ');
    assert(gs.length === 2, g);
    const [nn, ruless] = gs;
    const name = checkParserName(nn);
    if (!result.ParserStart) result.ParserStart = name;
    const rules = ruless.split(' | ');
    assert(rules.length >= 1, g);
    for (const rule of rules) {
      const tokens = rule.split(/ +/);
      assert(tokens.length >= 1, g);
      const symbols = tokens.filter(t => t !== 'null').map(parseSymbol);
      const postprocess = getPostprocessor(name, rule, symbols);
      result.ParserRules.push({name, symbols, postprocess});
    }
  }
  return result;
}

/** source of the grammar reader:
 * 
 *             // Advance all tokens that expect the symbol
            var literal = token.text !== undefined ? token.text : token.value;
            var value = lexer.constructor === StreamLexer ? token.value : token;
            var scannable = column.scannable;
            for (var w = scannable.length; w--; ) {
                var state = scannable[w];
                var expect = state.rule.symbols[state.dot];
                // Try to consume the token
                // either regex or literal
                if (expect.test ? expect.test(value) :
                    expect.type ? expect.type === token.type
                                : expect.literal === literal) {
                    // Add it
                    var next = state.nextState({data: value, token: token, isToken: true, reference: n - 1});
                    nextColumn.states.push(next);
                }
            }
 * 
 * 
*/

export function nearleyParser(code: string, lexer: nearley.Lexer): string | Doc[] {
  const grammar = nearley.Grammar.fromCompiled(makeGrammar());
  const parser = new nearley.Parser(grammar, {lexer});

  try {
    parser.feed(code);
    if (parser.results.length === 0) {
      // Trigger an error from the parser internals:
      parser.feed('|unexpected end of input|');
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      return `${e.name}: ${e.message}`;
    } else {
      throw e;
    }
  }
  return parser.results;
}

type GrammarOption = readonly (AtomType | Grammar | 'self')[];
type Grammar = readonly [string, readonly GrammarOption[]];
const VC: Grammar = ['VC', [['vr'], ['cnst']]];
const EXP: Grammar = ['EXPRESSION', [[VC, 'op', 'self'], [VC]]];
const STA: Grammar = ['STATEMENT', [['vr', 'eq', EXP]]];
const LL: Grammar = ['LINE', [[STA, 'nl']]];
const LLL: Grammar = ['DOCUMENT', [['nl', 'self'], [LL, 'self'], []]];

function parseGrammar(code: Stack<Atom>, g: Grammar): [Stack<Atom>, string] | undefined {
  const name = g[0];
  for (const gg of g[1]) {
    const result = parseInner(code, g, gg);
    if (!result) continue;

    const [cc, t] = result;
    return [cc, `${name}[${t}]`];
  }
  return undefined;
}
function parseInner(code: Stack<Atom>, g: Grammar, gg: GrammarOption): [Stack<Atom>, string] | undefined {
  const results = [];
  for (const e of gg) {
    if (Array.isArray(e) && typeof e !== 'string') {
      const result = parseGrammar(code, e);
      if (!result) return undefined;
      code = result[0];
      results.push(result[1]);
    } else if (e === 'self') {
      parseGrammar(code, g);
      const result = parseGrammar(code, g);
      if (!result) return undefined;
      code = result[0];
      results.push(result[1]);
    } else {
      if (code.isEmpty()) {
        return undefined;
      } else if (code.first()?.type === e) {
        code = code.shift();
        results.push(e);
        continue;
      } else {
        return undefined;
      }
    }
  }
  return [code, results.join(',')];
}
export function myParser(code: Atom[]): string {
  const result = parseGrammar(Stack(code), LLL);
  if (!result) return 'PARSE FAILED';
  const [cc, t] = result;
  if (!cc.isEmpty()) return 'PARSE INCOMPLETE: ' + t;
  return t;
}