
import {assert, numToLetter, unreachable} from '../util/Utils';
import type {Op, Sc, PrimOps, Vr, VrName} from './CustomLexer';
import type {Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec, Var, Typ, Ttp, Ftp, Expo} from './NearleyParser';
import {compile, type CompilationResult} from './TsComp';

export default class RootCompiler {
  private results: string[] = ['const rrr: string[] = [];'];
  private compiler = new Compiler();

  compile(sta: Sta): string {
    const [main, extra] = this.compiler.compile(sta);
    this.results.push(main, extra);
    return main;
  }

  async finish(): Promise<CompilationResult> {
    this.results.push('rrr.join("\\n");export {};');

    const result = await compile(this.results.join('\n'));

    if (result.outputText.endsWith('export {};\n')) {
      result.outputText = result.outputText.split('export {};')[0];
    }

    return result;
  }
}

class Compiler {
  private knownVars = new Set<VrName>();

  compile(sta: Sta): [string, string] {
    const right = this.express(sta.value[1]);
    return this.resolveReceiver(sta.value[0], right);
  }

  private resolveReceiver(rc: Rec, right: string): [string, string] {
    if (rc.value.length === 1) {
      const rec = rc.value[0];
      const l = rec.value[0].value;
      const left = this.knownVars.has(l) ? l : `let ${this.maybeAnnotate(rec)}`;
      this.knownVars.add(l);
      return [`${left} = ${right}`, `rrr.push(\`${l} = \${${l}}\`);`];
    } else {
      const l = this.express(rc.value[0]);
      const r = rc.value[1].value;
      const v = `(${l}).${r}`;
      return [`${v} = ${right}`, `rrr.push(\`${v} = \${${v}}\`);`];
    }
  }


  private exprOrVcf(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Expo | Vcf): string {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(exp);
    }
    return this.express(exp);
  }

  private implicitAnnotation(vr: Vr): string | undefined {
    const n = vr.value;
    switch (n.charAt(0)) {
      case 'i': return 'number';
      case 'd': return 'number';
      case 'b': return 'boolean';
      case 's': return 'string';
      case 'c': return 'string';
      default: return undefined;
    }
  }

  private ttpValues(ttp: Ttp): string[] {
    const l = ttp.value[0];
    const r = ttp.value[2];
    if (l.type !== 'ttp') return [this.annotation(l), this.annotation(r)];
    const vals = this.ttpValues(l);
    vals.push(this.annotation(r));
    return vals;
  }

  private parseFtp(ftp: Ftp): string {
    let ret: string;
    let args: string[];
    if (ftp.value.length === 2) {
      ret = this.annotation(ftp.value[1]);
      args = ftp.value[0].flatMap(t => t.type === 'op' ? [] : [t]).map((t, i) => `${numToLetter('a', i)}:(${this.annotation(t)})`);
      return `(${args.join(',')}) => (${ret})`;
    } else {
      ret = this.annotation(ftp.value[0]);
      args = [];
      return `() => (${ret})`;
    }
  }

  private annotation(typ: Typ): string {
    if (typ.type === 'tp') {
      switch (typ.value) {
        case 'i': return 'number';
        case 'd': return 'number';
        case 'b': return 'boolean';
        case 's': return 'string';
        case 'c': return 'string';
        default: return unreachable(typ);
      }
    } else if (typ.type === 'tc') {
      return typ.value;
    } else if (typ.type === 'atp') {
      return `(${this.annotation(typ.value[0])})[]`;
    } else if (typ.type === 'ttp') {
      const vs = this.ttpValues(typ);
      return `[(${vs.join('),(')})]`;
    } else if (typ.type === 'ftp') {
      return this.parseFtp(typ);
    } else {
      return unreachable(typ);
    }
  }

  private maybeAnnotate(v: Var): string {
    const [vr, typ] = v.value;
    const a = typ ? this.annotation(typ) : this.implicitAnnotation(vr);
    const aa = a ? `:(${a})` : '';
    return `${vr.value}${aa}`;
  }

  private express(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Expo): string {
    if (exp.type === 'fnd') {
      const args = exp.value[0].map(vr => this.maybeAnnotate(vr)).join(', ');
      if (exp.value[1].type !== 'tc') {
        const ret = exp.value.length === 3 ? exp.value[2] : exp.value[1];
        return `((${args}) => (${this.express(ret)}))`;
      } else {
        const rawArgs = exp.value[0].map(vr => vr.value[0].value).join(', ');
        return `((${args}) => ({${rawArgs}}))`;
      }
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(exp.value[0]);
      const right = exp.value[1];
      if (right.type === 'sc') {
        return this.doMonoOp(left, right);
      } else {
        return `(${left}).${right.value}`;
      }
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
    } else if (vcf.type === 'exp') {
      return this.express(vcf);
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.express(c);
      return `(${cond})?(${this.express(y)}):(${this.express(n)})`;
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
      return `[(${left}),(${right})]`;  ///// TODO TODOTODO TODO
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
