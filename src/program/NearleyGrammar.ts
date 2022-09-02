import type {DirtyLexerName, LexedToken} from "./CustomLexer";
import type * as nearley from 'nearley';
import {assert} from "../util/Utils";
import {FilteredParserNames, RenamedParserNames, type DirtyParserName} from './ParserOutput.generated';
import {splitGrammar, type ParsedSymbol} from './GrammarParser';

function checkParserName(name: string): DirtyParserName {
  assert(FilteredParserNames.has(name) || RenamedParserNames.has(name), `Unknown parser name ${name}`);
  return name as DirtyParserName;
}

type NearleySymbol = {type: DirtyLexerName;} | {test: (t: LexedToken) => boolean;} | DirtyParserName; // | {literal: string;};

function parseSymbol(t: ParsedSymbol): NearleySymbol {
  if ('token' in t) {
    return {type: t.token};
  } else if ('literal' in t) {
    return {test: v => v.value === t.literal};
  }
  return checkParserName(t.rule);
}

export function compileGrammar(grammar: string, getPostprocessor: (name: DirtyParserName) => nearley.Postprocessor | undefined): nearley.CompiledRules {
  const result: nearley.CompiledRules = {ParserRules: [], ParserStart: ''};
  for (const {name: nn, rules} of splitGrammar(grammar)) {
    const name = checkParserName(nn);
    if (!result.ParserStart) result.ParserStart = name;
    assert(rules.length >= 1);
    for (const rule of rules) {
      const symbols = rule.map(parseSymbol);
      const postprocess = getPostprocessor(name);
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
