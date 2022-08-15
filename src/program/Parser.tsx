import { myLexer, mooLexer } from './CustomLexer';
import { Doc, myParser, nearleyParser } from './CustomParser';

export default function parse(code: string, mine?: boolean): string | Doc {
  if (mine) {
    return myParser(myLexer(code));
  }
  const result = nearleyParser(code, mooLexer());
  if (typeof result === 'string') {
    return result;
  }

  if (result.length > 1) {
    const [a,b] = compareParses(result[0], result[1]);
    //const a = JSON.stringify(result[0]);
    //const b = JSON.stringify(result[1]);
    return `Unexpected ambiguous parse (${result.length})(${a === b})\na:${a}\nb:${b}`;
  }
  return result[0];
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

type Node = {type: string, value: Node | string} | Node[];

export function visualiseNode(n: Node): string {
  if (Array.isArray(n)) {
    return `[${n.map(visualiseNode).join(',')}]`;
  } else {
    const value = typeof n.value === 'string' ? n.value : visualiseNode(n.value);
    return `{${n.type}:${value}}`;
  }
}

