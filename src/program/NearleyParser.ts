import {checkLexerName, type LexedToken, type LexerName} from "./CustomLexer";
import {FilteredLexerNames} from "./CustomLexer";
import * as nearley from 'nearley';
import {assert, unreachable} from "../util/Utils";
import {fetchGrammar, default as compileGrammar} from "./NearleyGrammar";
import parseGrammar from './GrammarParser';
import {FilteredParserNames, RenamedParserNames, FinalParserNames, instructions, renames, type FinalParserName, type RenamedParserName, type DirtyParserName, type Start} from './ParserOutput.generated';

function assertCleanParserName(name: string): asserts name is FinalParserName {
  assert(FinalParserNames.has(name), `Unknown final parser name ${name}`);
}

function cleanParserName(name: DirtyParserName): FinalParserName {
  assert(RenamedParserNames.has(name), `Dirty parser name ${name}`);
  assert(name in renames);
  return renames[name as RenamedParserName];
}

function assertCleanLexerName(name: string): asserts name is LexerName {
  assert(!FilteredLexerNames.has(checkLexerName(name)), `Dirty lexer name ${name}`);
}

type RuleOutput = {type: FinalParserName, value: (RuleOutput | FlatOutput | CleanToken)[];};
type FlatOutput = (RuleOutput | CleanToken)[];
type CleanToken = {type: LexerName, value: string;};

function postprocessFilter(v: RuleOutput | FlatOutput | LexedToken | undefined): (RuleOutput | FlatOutput | CleanToken)[] {
  if (v == null) return [];
  if (Array.isArray(v)) return [v];
  if (FilteredLexerNames.has(v.type)) return [];
  assert(!FilteredParserNames.has(v.type));
  if (Array.isArray(v.value)) {
    assertCleanParserName(v.type);
    return [v];
  } else {
    assertCleanLexerName(v.type);
    return [{type: v.type, value: v.value}];
  }
}

function postprocess(name: DirtyParserName, data: (RuleOutput | FlatOutput | LexedToken | undefined)[]): undefined | RuleOutput | FlatOutput | CleanToken {
  const i = instructions[name];
  const d = data.flatMap(postprocessFilter);
  switch (i) {
    case 'd': assert(FilteredParserNames.has(name)); return undefined;
    case 'fu': assert(FilteredParserNames.has(name)); assert(d.length === 1, `${name} had ${d.length} children`); return d[0];
    case 'ff': assert(FilteredParserNames.has(name)); return d.flat();
    case 'fm': assert(RenamedParserNames.has(name)); if (d.length === 1) return d[0]; else return {type: cleanParserName(name), value: d};
    case 'fl': return {type: cleanParserName(name), value: d};
    default: return unreachable(i);
  }
}

function getPostprocessor<T extends DirtyParserName>(name: T, _rule: string) {
  return postprocess.bind(undefined, name);
}

const compiled: {v?: nearley.CompiledRules;} = {};

export interface Parser {
  parseLine: (line: string) => Promise<Start>;
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
