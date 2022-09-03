
import {Seq} from 'immutable';
import {numToLetter, unreachable} from '../util/Utils';
import type {PrimOps, VrName, VrType} from './CustomLexer';
import type {Type, BinaryOperation, Constant, Constructor, Body, DefinedVariable, Expression, Field, FunctionBind, FunctionExpression, If, NewVariable, Receiver, Statement, Tuple, FunType, FunctionBindArg, ArrayExpression, Assignment, Return, Do, DoWhile, While, For, Break, Continue, BlockStatement, Block} from './ParsePostprocessor';
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
      case 'return': return [this.returnstatement(s), ''];
      case 'break': return [this.break(s), ''];
      case 'continue': return [this.continue(s), ''];
      case 'expression': return [this.expression(s.expression), ''];
      case 'block': return [this.blockstatement(s), ''];
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

  private returnstatement(r: Return): string {
    const e = this.expression(r.expression);
    return `return ${e}`;
  }

  private break(_b: Break): string {
    return 'break';
  }

  private continue(_c: Continue): string {
    return 'continue';
  }

  private blockstatement(b: BlockStatement): string {
    return this.block(b.block);
  }

  private block(b: Block): string {
    switch (b.kind) {
      case 'if': return this.if(b);
      case 'while': return this.while(b);
      case 'dowhile': return this.dowhile(b);
      case 'for': return this.for(b);
      case 'do': return this.do(b);
      default: unreachable(b);
    }
  }

  private if(e: If): string {
    const {first, elifs, last} = e;
    const c = this.expression(first.cond);
    const b = this.body(first.body);

    const els = elifs.map(({cond, body}) => `else if (${this.expression(cond)}) ${this.body(body)}`).join(' ');
    const l = last ? ` else ${this.body(last)}` : '';
    return `if (${c}) ${b} ${els}${l}`;
  }

  /**
  private ifexp(e: IfExpression): string {
    const c = this.expressionp(e.cond);
    const y = this.expressionp(e.ifYes);
    const n = this.expressionp(e.ifNo);
    return `${c}?${y}:${n}`;
  }*/

  private dowhile(e: DoWhile): string {
    const c = this.expression(e.cond);
    const b = this.body(e.body);
    return `do ${b} while(${c})`;
  }

  private while(e: While): string {
    const c = this.expression(e.cond);
    const b = this.body(e.body);
    return `while(${c}) ${b}`;
  }

  private for(f: For): string {
    const n = f.name;
    const a = this.expressionp(f.iter);
    const b = this.body(f.body);
    return `for (const ${n} of ${a}) ${b}`;
  }

  private do(d: Do): string {
    return this.body(d.body);
  }

  private body(b: Body): string {
    const ss = b.map(s => this.statement(s)).join('\n');
    return `{\n${ss}\n}`;
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
    const left = `let ${this.maybeAnnotate(v.name, v.vrtype, v.type)}`;
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

  private defsAnnotate(name: VrName, type: Type) {
    const a = annotationp(type);
    const aa = `:${a}`;
    return `${name}${aa}`;
  }

  private maybeAnnotate(name: VrName, vrtype: VrType, type?: Type | undefined): string {
    const a = type ? annotationp(type) : implicitAnnotation(vrtype);
    const aa = a ? `:${a}` : '';
    return `${name}${aa}`;
  }

  private expression(exp: Expression): string {
    switch (exp.kind) {
      case 'variable': return this.variable(exp);
      case 'field': return this.field(exp);
      case 'constant': return this.constant(exp);
      case 'function': return this.callable(exp);
      case 'constructor': return this.callable(exp);
      case 'binary': return this.binary(exp);
      case 'tuple': return this.tuple(exp);
      case 'bind': return this.bindfun(exp);
      case 'array': return this.array(exp);
      case 'block': return this.block(exp.block);
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
      case 'array': return this.expression(exp);
      case 'block':
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

  private callable(f: FunctionExpression | Constructor): string {
    const argNames = f.args;
    const argTypes = f.type.args;
    const args = Seq(argNames).zipWith(this.defsAnnotate, Seq(argTypes)).join(', ');
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

function implicitAnnotation(n: VrType): string | undefined {
  switch (n.core) {
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
  return t.t === 'f' || t.t === 'm' ? `(${annotation(t)})` : annotation(t);
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
    case 'm': return `${annotationp(t.subtype)} | undefined`;
    default: return unreachable(t);
  }
}
