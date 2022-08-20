
import {assert, unreachable} from '../util/Utils';
import type {Op, Sc, PrimOps, Vr} from './CustomLexer';
import type {Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec} from './NearleyParser';
import toJS from './TsComp';

export default class RootCompiler {
  private results: string[] = ['const rrr: string[] = [];'];
  private compiler = new Compiler();

  compile(sta: Sta): string {
    const [main, extra] = this.compiler.compile(sta);
    this.results.push(main, extra);
    return main;
  }

  finish(): string {
    this.results.push('rrr.join("\\n");');
    const result = toJS(this.results.join('\n'));
    if (result.diagnostics?.length) {
      return JSON.stringify(result.diagnostics);
    }
    return result.outputText;
  }
}

class Compiler {
  private knownVars = new Set<Vr['value']>();

  compile(sta: Sta): [string, string] {
    const right = this.express(sta.value[1]);
    return this.resolveReceiver(sta.value[0], right);
  }

  private resolveReceiver(rc: Rec, right: string): [string, string] {
    if (rc.value.length === 1) {
      const rec = rc.value[0];
      if (rec.type === 'var') {
        const l = rec.value[0].value;
        const dec = this.knownVars.has(l) ? '' : 'let ';
        this.knownVars.add(l);
        return [`${dec}${l} = ${right}`, `rrr.push(\`${l} = \${${l}}\`);`];
      }
      const cond = this.express(rec.value[0]);
      const [y] = this.resolveReceiver(rec.value[1], 'c');
      const [n] = this.resolveReceiver(rec.value[2], 'c');
      const inner = `((${cond})?(${y}):(${n}))`;
      return right === 'c' ? [`${inner}`, ''] : [`{const c = ${right};${inner};}`, `rrr.push('ifs = something')`];
    } else {
      assert(rc.value[1].value === '.');
      const l = rc.value[0].value;
      const r = rc.value[2].value;
      const v = `${l}.${r}`;
      return [`${v} = ${right}`, `rrr.push(\`${v} = \${${v}}\`);`];
    }
  }


  private exprOrVcf(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Vcf): string {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(exp);
    }
    return this.express(exp);
  }

  private express(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd): string {
    if (exp.type === 'fnd') {
      if (exp.value[1].type !== 'tc') {
        const args = exp.value[0].map(vr => vr.value[0].value).join(', ');
        const ret = exp.value.length === 3 ? exp.value[2] : exp.value[1];
        return `((${args}) => (${this.express(ret)}))`;
      } else {
        const args = exp.value[0].map(vr => `${vr.value[0].value}`).join(', ');
        return `((${args}) => ({${args}}))`;
      }
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(exp.value[0]);
      const sc = exp.value[1];
      return this.doMonoOp(left, sc);
    } else {
      const left = this.exprOrVcf(exp.value[0]);
      const op = exp.value[1];
      const right = this.exprOrVcf(exp.value[2]);
      const sc = exp.value.length === 4 ? exp.value[3] : undefined;
      const result = this.doOp(op, left, right);
      if (!sc) return result;
      return this.doMonoOp(result, sc);
    }
  }

  private evalVcf(vcf: Vcf): string {
    if (vcf.type === 'vr') {
      return vcf.value;
    } else if (vcf.type === 'cnst') {
      return vcf.value;
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.express(c);
      return `((${cond})?(${this.express(y)}):(${this.express(n)})`;
    } else {
      return unreachable(vcf);
    }
  }

  private doMonoOp(val: string, sc: Sc): string {
    assert(sc.value === ';');
    return `((${val})())`;
  }

  private doOp(op: Op, left: string, right: string): string {
    if (op.value === ':') {
      return `(${left}).bind(undefined,(${right}))`;
    } else if (op.value === '::') {
      return `(${left}).bind(undefined,...(${right}))`;
    } else if (op.value === ',') {
      return `[(${left}),(${right})].flat()`;
    } else if (op.value === '.' || op.value === '.:') {
      assert(op.value === '.');
      return `(${left}).${right}`;
    } else if (op.value === '//') {
      return `Math.trunc((${left})/(${right}))`;
    } else {
      return `(${left})${this.translateOp(op.value)}(${right})`;
    }
  }

  private translateOp(op: PrimOps): string {
    switch (op) {
      case '!=': return '!==';
      case '==': return '===';
      case '<<': return '<';
      case '>>': return '>';
      case '//': return '/';

      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
      case '<=':
      case '>=':
      case '&&':
      case '||': return op;
      default: return unreachable(op);
    }
  }
}
