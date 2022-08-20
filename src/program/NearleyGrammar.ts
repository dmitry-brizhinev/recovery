import {checkLexerName, DirtyLexerName, LexedToken} from "./CustomLexer";
import type * as nearley from 'nearley';
import {assert} from "../util/Utils";
import {checkParserName, DirtyParserName} from "./NearleyParser";
import grammarPath from './grammar.ne';

type Symbol = {type: DirtyLexerName;} | {literal: string;} | {test: (t: LexedToken) => boolean;} | DirtyParserName;

function parseSymbol(t: string): Symbol {
  if (t.startsWith('%')) {
    return {type: checkLexerName(t.substring(1))};
  } else if (t.startsWith('"') && t.endsWith('"')) {
    const value = t.substring(1, t.length - 1);
    return {test: v => v.value === value};
  }
  return checkParserName(t);
}

async function fetchGrammar(): Promise<string> {
  const response = await fetch(grammarPath);
  return await response.text();
}

export default async function compileGrammar(getPostprocessor: (name: DirtyParserName, rule: string) => nearley.Postprocessor | undefined): Promise<nearley.CompiledRules> {
  const result: nearley.CompiledRules = {ParserRules: [], ParserStart: ''};
  for (const gg of (await fetchGrammar()).trim().split('\n')) {
    const g = gg.split(/[#@]/)[0].trim();
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
      const postprocess = getPostprocessor(name, rule);
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
