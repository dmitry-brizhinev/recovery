
import {Seq} from 'immutable';
import {numToLetter, unreachable} from '../util/Utils';
import type {PrimOps, VrName} from './CustomLexer';
import type {Type, BinaryOperation, Constant, Constructor, DefinedVariable, Expression, Field, FunctionBind, FunctionExpression, IfExpression, NewVariable, Receiver, Statement, Tuple, FunType, FunctionBindArg, ArrayExpression, Assignment, Return, DoExpression} from './ParsePostprocessor';
import {compile, type CompilationResult} from './TsComp';

export default class RootCompiler {
  private results: string[] = ['const r: string[] = []; let _: any;'];
  private compiler = new Compiler();

  compile(sta: Statement): string {
    const [main, extra] = this.compiler.statement(sta);
    this.results.push(main, extra);
    return main;
  }

  async finish(): Promise<CompilationResult> {
    this.results.push('r.join("\\n");export {};');

    const result = await compile(this.results.join('\n'));

    if (result.outputText.endsWith('export {};\n')) {
      result.outputText = result.outputText.split('export {};')[0];
    }

    return result;
  }
}

class Compiler {
  statement(s: Statement): [string, string] {
    switch (s.kind) {
      case 'assignment': return this.assignment(s);
      case 'return': return [this.return(s), ''];
      case 'if': return [this.ifexp(s.expression), ''];
      default: return unreachable(s);
    }
  }

  private assignment(sta: Assignment): [string, string] {
    const right = this.expression(sta.expression);
    const rec = this.receiver(sta.receiver);

    if (rec != null) {
      const [dec, v] = rec;
      return [`${dec} = ${right}`, `r.push(\`${v} = \${${v}}\`);`];
    } else {
      return [`_ = ${right}`, `r.push(\`_ = \${_}\`);`];
    }
  }

  private return(r: Return): string {
    const e = this.expression(r.expression);
    return `return ${e}`;
  }

  private receiver(r: Receiver): [string, string] | null {
    switch (r.kind) {
      case 'definition': return this.definition(r);
      case 'variable': return this.varReceiver(r);
      case 'field': return this.fieldReceiver(r);
      case 'discard': return null;
      default: return unreachable(r);
    }
  }

  private definition(v: NewVariable): [string, string] {
    const l = v.name;
    const left = `let ${this.maybeAnnotate(v.name, v.type)}`;
    return [left, l];
  }

  private varReceiver(v: DefinedVariable): [string, string] {
    const l = v.name;
    return [l, l];
  }

  private fieldReceiver(f: Field): [string, string] {
    const v = this.field(f);
    return [v, v];
  }

  private maybeAnnotate(name: VrName, type?: Type | undefined): string {
    const a = type ? annotationp(type) : implicitAnnotation(name);
    const aa = a ? `:${a}` : '';
    return `${name}${aa}`;
  }

  private expression(exp: Expression): string {
    switch (exp.kind) {
      case 'variable': return this.variable(exp);
      case 'field': return this.field(exp);
      case 'constant': return this.constant(exp);
      case 'if': return this.ifexp(exp);
      case 'function': return this.callable(exp);
      case 'constructor': return this.callable(exp);
      case 'binary': return this.binary(exp);
      case 'tuple': return this.tuple(exp);
      case 'bind': return this.bindfun(exp);
      case 'array': return this.array(exp);
      case 'do': return this.do(exp);
      default: return unreachable(exp);
    }
  }

  private expressionp(exp: Expression): string {
    switch (exp.kind) {
      case 'variable':
      case 'field':
      case 'constant':
      case 'tuple':
      case 'bind':
      case 'array':
      case 'do': return this.expression(exp);
      case 'if':
      case 'function':
      case 'constructor':
      case 'binary': return `(${this.expression(exp)})`;
      default: return unreachable(exp);
    }
  }

  private variable(v: DefinedVariable): string {
    return v.name;
  }

  private field(f: Field): string {
    const obj = this.expressionp(f.obj);
    return `${obj}.${f.name}`;
  }

  private constant(c: Constant): string {
    return c.value === '_' ? 'undefined' : c.value;
  }

  private ifexp(e: IfExpression): string {
    const c = this.expressionp(e.cond);
    const y = this.expressionp(e.ifYes);
    const n = this.expressionp(e.ifNo);
    return `${c}?${y}:${n}`;
  }

  private callable(f: FunctionExpression | Constructor): string {
    const argNames = f.args;
    const argTypes = f.type.args;
    const args = Seq(argNames).zipWith(this.maybeAnnotate, Seq(argTypes)).join(', ');
    if (f.kind === 'function') {
      const r = this.expression(f.body);
      return `(${args}) => (${r})`;
    } else {
      const rawArgs = f.args.join(', ');
      return `(${args}) => ({${rawArgs}})`;
    }
  }

  private binary(b: BinaryOperation): string {
    const {left, op, right} = b;
    const l = this.expressionp(left);
    const r = this.expressionp(right);
    if (op.value === '//') {
      return `Math.trunc(${l}/${r})`;
    } else {
      const o = translateOp(op.value);
      return `${l}${o}${r}`;
    }
  }

  private tuple(t: Tuple): string {
    const es = t.elements.map(e => this.expressionp(e)).join(', ');
    return `[${es}]`;
  }

  private array(a: ArrayExpression): string {
    const es = a.elements.map(e => this.expressionp(e)).join(', ');
    return `[${es}]`;
  }

  private bindfun(f: FunctionBind): string {
    const {func, args, call} = f;
    const ff = this.expressionp(func);
    const as = args.map(a => this.funcArg(a)).join(', ');
    if (call) {
      return `${ff}(${as})`;
    } else {
      return `${ff}.bind(undefined,${as})`;
    }
  }

  private funcArg(arg: FunctionBindArg): string {
    const s = arg.tupleSize;
    if (s != null) {
      return `...${this.expressionp(arg.exp)}`;
    } else {
      return this.expression(arg.exp);
    }
  }

  private do(d: DoExpression): string {
    const ss = d.statements.map(s => this.statement(s)).join('\n');
    return `{\n${ss}\n}`;
  }
}

function translateOp(op: PrimOps): string {
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

function implicitAnnotation(n: VrName): string | undefined {
  switch (n.charAt(0)) {
    case 'i': return 'number';
    case 'd': return 'number';
    case 'b': return 'boolean';
    case 's': return 'string';
    case 'c': return 'string';
    default: return undefined;
  }
}

function parseFun(f: FunType): string {
  const ret = annotationp(f.ret);
  const args = f.args.map((t, i) => `${numToLetter('a', i)}:${annotationp(t)}`);
  return `(${args.join(',')}) => ${ret}`;
}

function annotationp(t: Type): string {
  return t.t === 'f' ? `(${annotation(t)})` : annotation(t);
}

function annotation(t: Type): string {
  switch (t.t) {
    case '_': return 'undefined';
    case 'i': return 'number';
    case 'd': return 'number';
    case 'b': return 'boolean';
    case 's': return 'string';
    case 'c': return 'string';
    case 't': return `[${t.values.map(annotationp).join(',')}]`;
    case 'a': return `${annotationp(t.subtype)}[]`;
    case 'o': return t.con;
    case 'f': return parseFun(t);
    default: return unreachable(t);
  }
}
