import type {LexedToken, Lexer, TokenLocation} from "./CustomLexer";
import {cleanLexedToken, getLoc as getLexLoc} from "./CustomLexer";
import * as nearley from 'nearley';
import {assert, unreachable} from "../util/Utils";
import {compileGrammar} from "./NearleyGrammar";
import {generateTypesFrom} from './GrammarParser';
import {FilteredParserNames, RenamedParserNames, FinalParserNames, instructions, renames, type FinalParserName, type RenamedParserName, type DirtyParserName, type Start, type WLoc, type Outputs} from './ParserOutput.generated';
import grammarPath from './grammar.ne';

async function fetchGrammar(): Promise<string> {
  const response = await fetch(grammarPath);
  return await response.text();
}

function isCleanParserName(name: string) {
  return FinalParserNames.has(name);
}

function cleanParserName(name: DirtyParserName): FinalParserName {
  assert(RenamedParserNames.has(name), `Dirty parser name ${name}`);
  assert(name in renames);
  return renames[name as RenamedParserName];
}

interface RemovedVal extends WLoc {d: 'd';}
type Inputs = Outputs | LexedToken | RemovedVal;

function combineLoc(a: TokenLocation | null, b: TokenLocation | null): TokenLocation | null {
  if (!a) return b;
  if (!b) return a;
  assert(a.sl <= b.sl);
  assert(a.sl < b.sl || a.sc <= b.sc);
  const sl = a.sl;
  const sc = a.sc;
  if (!a.el && !b.el && a.sl === b.sl) {
    assert(b.ec >= a.ec);
    return {sl, sc, ec: b.ec};
  }
  const ael = a.el ?? a.sl;
  const bel = b.el ?? b.sl;
  assert(bel >= ael);
  assert(bel > ael || b.ec >= a.ec);

  return {sl, sc, ec: b.ec, el: bel};
}

function getLoc(vs: Inputs[]): TokenLocation | null {
  let result: TokenLocation | null = null;
  for (const v of vs) {
    let loc;
    if (Array.isArray(v)) {
      loc = getLoc(v);
    } else if ('loc' in v) {
      loc = v.loc;
    } else {
      loc = getLexLoc(v);
    }
    result = combineLoc(result, loc);
  }
  return result;
}

function postprocessFilter(v: Inputs): Outputs[] {
  if ('d' in v) return [];
  if (Array.isArray(v)) return [v];
  if ('text' in v) {
    assert(!Array.isArray(v.value));
    return cleanLexedToken(v);
  }
  if (isCleanParserName(v.type)) {
    assert(Array.isArray(v.value));
    assert(!FilteredParserNames.has(v.type));
    return [v];
  } else {
    assert(!Array.isArray(v.value));
    return [v];
  }
}

function postprocess(name: DirtyParserName, data: Inputs[]): RemovedVal | Outputs {
  const i = instructions[name];
  const loc = getLoc(data); // TODO could attach loc to ff/fu/fm cases
  const d = data.flatMap(postprocessFilter);
  switch (i) {
    case 'd': assert(FilteredParserNames.has(name)); return {d: 'd', loc};
    case 'fu': assert(FilteredParserNames.has(name)); assert(d.length === 1, `${name} had ${d.length} children`); return d[0];
    case 'ff': assert(FilteredParserNames.has(name)); return d.flat();
    case 'fm': assert(RenamedParserNames.has(name)); if (d.length === 1) return d[0]; else return {type: cleanParserName(name), value: d, loc};
    case 'fl': return {type: cleanParserName(name), value: d, loc};
    default: return unreachable(i);
  }
}

function getPostprocessor(name: DirtyParserName) {
  return postprocess.bind(undefined, name);
}

// const compiled: {v?: nearley.CompiledRules;} = {};

export interface Parser {
  parseLine(line: string): Promise<Start>;
  finish(): Promise<void>;
  errorLoc(): TokenLocation | undefined;
}

export async function generateTypes() {
  return generateTypesFrom(await fetchGrammar());
}

export class NearleyParser implements Parser {
  private constructor(
    private readonly parser: nearley.Parser,
    private readonly lexer: Lexer,
  ) {}
  private statements: number = 0;

  static async start(lexer: Lexer): Promise<NearleyParser> {
    const grammar = nearley.Grammar.fromCompiled(compileGrammar(await fetchGrammar(), getPostprocessor));
    return new NearleyParser(new nearley.Parser(grammar, {lexer}), lexer);
  }

  errorLoc(): TokenLocation | undefined {
    return this.lexer.errorToken && getLexLoc(this.lexer.errorToken);
  }

  async parseLine(line: string): Promise<Start> {
    this.parser.feed(line);
    const result = this.parser.results as Start[];
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

function compareParses(a: Start, b: Start): [string, string] {
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
