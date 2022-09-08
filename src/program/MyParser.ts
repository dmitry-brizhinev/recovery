import {Stack} from 'immutable';
import type {CleanToken} from './CustomLexer';

type AtomType = 'vr' | 'cnst' | 'op' | 'nl';
type Atom = CleanToken;

type GrammarOption = readonly (AtomType | Grammar | 'self')[];
type Grammar = readonly [string, readonly GrammarOption[]];
const VC: Grammar = ['VC', [['vr'], ['cnst']]];
const EXP: Grammar = ['EXPRESSION', [[VC, 'op', 'self'], [VC]]];
const STA: Grammar = ['STATEMENT', [['vr', 'op', EXP]]];
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
