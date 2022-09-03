
import {assert, throwIfNull, unreachable, type Callback} from '../util/Utils';
import type {NumT, StrT, FunT, TupT, ObjT, ArrT, PrimOps, VrName, ValueT, NulT, MayT} from './CustomLexer';
import type {ArrayExpression, ArrType, Assignment, BinaryOperation, Block, BlockStatement, Break, Constant, Constructor, Continue, DefinedVariable, Do, DoWhile, Expression, Field, For, FunctionBind, FunctionBindArg, FunctionExpression, FunType, If, NarrowedExpression, NewVariable, NumType, ObjType, Receiver, Return, Statement, Tuple, TupType, While, Body} from './ParsePostprocessor';
import {Map as IMap} from 'immutable';

interface Nul {
  readonly t: NulT;
}
const Null: Nul = {t: '_'};
interface Num {
  readonly t: NumT;
  readonly value: number;
}
interface Str {
  readonly t: StrT;
  readonly value: string;
}
interface Fun {
  readonly t: FunT;
  readonly args: VrName[];
  readonly applied: Value[];
  readonly context?: ExecContext | undefined;
  readonly selfref?: {name: VrName; value: Fun;} | undefined;
  readonly ret: Expression | 'struct';
}
interface Tup {
  readonly t: TupT;
  readonly values: Value[];
}
class Obj {
  readonly t: ObjT = 'o';
  constructor(private fields: IMap<VrName, Value>) {}

  getMember(name: VrName): Value | undefined {
    return this.fields.get(name);
  }
  setMember(name: VrName, v: Value) {
    this.fields = this.fields.set(name, v);
  }
}
interface Arr {
  readonly t: ArrT;
  readonly values: Value[];
}
interface May {
  readonly t: MayT;
  readonly value: Value;
}
type Values = {
  _: Nul,
  d: Num,
  i: Num,
  b: Num,
  s: Str,
  c: Str,
  f: Fun,
  t: Tup,
  o: Obj,
  a: Arr,
  m: May,
};
type Value = Values[ValueT | '_'];//Nul | Num | Str | Fun | Tup | Obj | Arr | May;

class ExecContext {
  constructor(private readonly parent: ExecContext | undefined) {}
  private readonly vars = new Map<VrName, Value>();

  getVar(vr: VrName): Value | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Value) {
    this.vars.set(vr, val);
  }
  localVars() {
    return IMap(this.vars);
  }
}

function iss(val: Value): Str | undefined {
  return val.t === 's' || val.t === 'c' ? val : undefined;
}

function checkn(val: Value): Num {
  assert(val.t === 'b' || val.t === 'i' || val.t === 'd', `${val.t} is not numeric`);
  return val;
}

export default class RootExecutor {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  run(sta: Statement): string[] {
    const rs: string[] = [];
    new Executor(this.rootContext, r => rs.push(r)).statement(sta);
    return rs;
  }
}

type RecVal = VrName | [Obj, VrName] | null;

function valRep(v: Value): string {
  return v.t === 'f' ? `function` :
    v.t === 't' ? `tuple` :
      v.t === 'o' ? `object` :
        v.t === 'a' ? `array` :
          v.t === '_' ? 'null' :
            `${v.value}`;
}

function recRep(r: RecVal): string {
  if (Array.isArray(r)) {
    return `${valRep(r[0])}.${r[1]}`;
  }
  return r ?? '_';
}

class Executor {
  constructor(private readonly context: ExecContext,
    private readonly printer: Callback<string>) {}
  private currentVar?: VrName | undefined;

  statement(s: Statement): Value {
    switch (s.kind) {
      case 'assignment': return this.assignment(s);
      case 'return': return this.returnstatement(s);
      case 'break': return this.break(s);
      case 'continue': return this.continue(s);
      case 'expression': return this.expression(s.expression);
      case 'block': return this.blockstatement(s);
      default: return unreachable(s);
    }
  }

  private assignment(sta: Assignment): Value {
    const left = this.receiver(sta.receiver);
    if (!Array.isArray(left) && left?.charAt(0) === 'f') {
      this.currentVar = left;
    }
    let right = this.expression(sta.expression);
    if (this.currentVar && right.t === 'f') {
      right = {...right, selfref: {name: this.currentVar, value: right}};
      assert(right.selfref);
      right.selfref.value = right;
    }
    this.currentVar = undefined;
    this.assign(left, right);
    return right;
  }

  private assign(left: RecVal, right: Value): void {
    if (Array.isArray(left)) {
      left[0].setMember(left[1], right);
    } else if (left != null) {
      this.context.setVar(left, right);
    }
    this.printer(`${recRep(left)} = ${valRep(right)}`);
  }

  private returnstatement(r: Return): Value {
    return this.expression(r.expression); // TODO
  }

  private break(_b: Break): Value {
    // TODO
    return Null;
  }

  private continue(_c: Continue): Value {
    // TODO
    return Null;
  }

  private blockstatement(b: BlockStatement): Value {
    return this.block(b.block);
  }

  private block(b: Block): Value {
    switch (b.kind) {
      case 'if': return this.if(b);
      case 'while': return this.while(b);
      case 'dowhile': return this.dowhile(b);
      case 'for': return this.for(b);
      case 'do': return this.do(b);
      default: return unreachable(b);
    }
  }

  private if(e: If): Value {
    for (const {cond, body} of [e.first, ...e.elifs]) {
      const c = this.expressionB(cond);
      if (c.value) {
        return this.body(body);
      }
    }
    if (e.last) {
      return this.body(e.last);
    }
    return Null;
  }

  private while(e: While): Value {
    const {cond, body} = e;
    let v: Value = Null;
    while (this.expressionB(cond).value) {
      v = this.body(body);
    };
    return v;
  }

  private dowhile(e: DoWhile): Value {
    const {cond, body} = e;
    let v: Value;
    do {
      v = this.body(body);
    } while (this.expressionB(cond).value);
    return v;
  }

  private for(f: For): Value {
    const {name, iter, body} = f;
    const a = this.expressionA(iter);
    let vv: Value = Null;
    for (const v of a.values) {
      this.context.setVar(name, v);
      vv = this.body(body);
    }
    return vv;
  }

  private do(d: Do): Value {
    return this.body(d.body);
  }

  private body(b: Body): Value {
    let v: Value = Null;
    for (const s of b) {
      v = this.statement(s);
    }
    return v;
  }

  private receiver(r: Receiver): RecVal {
    switch (r.kind) {
      case 'definition': return this.definition(r);
      case 'variable': return this.varReceiver(r);
      case 'field': return this.fieldReceiver(r);
      case 'discard': return null;
      default: return unreachable(r);
    }
  }

  private definition(v: NewVariable): RecVal {
    return v.name;
  }

  private varReceiver(v: DefinedVariable): RecVal {
    return v.name;
  }

  private fieldReceiver(f: Field): RecVal {
    const obj = this.expressionO(f.obj);
    const name = f.name;
    return [obj, name];
  }

  private expressionT(exp: NarrowedExpression<TupType>): Tup {
    const v = this.expression(exp);
    assert(v.t === exp.type.t);
    return v;
  }

  private expressionF(exp: NarrowedExpression<FunType>): Fun {
    const v = this.expression(exp);
    assert(v.t === exp.type.t);
    return v;
  }

  private expressionB(exp: NarrowedExpression<NumType>): Num {
    const v = this.expression(exp);
    assert(v.t === exp.type.t);
    return v;
  }

  private expressionO(exp: NarrowedExpression<ObjType>): Obj {
    const v = this.expression(exp);
    assert(v.t === exp.type.t);
    return v;
  }

  private expressionA(exp: NarrowedExpression<ArrType>): Arr {
    const v = this.expression(exp);
    assert(v.t === exp.type.t);
    return v;
  }

  private expression(exp: Expression): Value {
    const v = this.expressionInner(exp);
    assert(exp.type.t === 'm' || exp.type.t === '_' || v.t === exp.type.t, `Expected ${exp.kind} expression to produce ${exp.type.t} but got ${v.t}`);
    return v;
  }

  private expressionInner(exp: Expression): Value {
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

  private variable(v: DefinedVariable): Value {
    return throwIfNull(this.context.getVar(v.name), `undefined variable ${v.name}`);
  }

  private field(f: Field): Value {
    const obj = this.expressionO(f.obj);
    return throwIfNull(obj.getMember(f.name), `Unknown object member ${f.name}`);
  }

  private constant(c: Constant): Num | Str | Nul {
    const t = c.type.t;
    const v = c.value;
    if (t === 'b') {
      return {t, value: v === 'true' ? 1 : 0};
    } else if (t === 'c' || t === 's') {
      return {t, value: v.slice(1, -1)};
    } else if (t === 'd') {
      return {t, value: Number.parseFloat(v)};
    } else if (t === 'i') {
      return {t, value: Number.parseInt(v)};
    } else if (t === '_') {
      return Null;
    } else {
      return unreachable(t);
    }
  }

  private callable(f: FunctionExpression | Constructor): Fun {
    const args = f.args;
    if (f.kind === 'function') {
      return {t: 'f', args, applied: [], context: this.context, ret: f.body};
    } else {
      return {t: 'f', args, applied: [], ret: 'struct'};
    }
  }

  private binary(b: BinaryOperation): Value {
    const {left, op, right, type} = b;
    const l = this.expression(left);
    const r = this.expression(right);

    let ll; let rr;
    if (op.value === '+' && (ll = iss(l)) && (rr = iss(r))) {
      return {t: 's', value: ll.value + rr.value};
    } else {
      const ll = checkn(l);
      const rr = checkn(r);
      assert(type.t === 'b' || type.t === 'i' || type.t === 'd');
      const value = doOpValues(op.value, ll.value, rr.value);
      return {t: type.t, value};
    }
  }

  private tuple(tt: Tuple): Tup {
    const values = tt.elements.map(e => this.expression(e));
    return {t: 't', values};
  }

  private array(a: ArrayExpression): Arr {
    const values = a.elements.map(e => this.expression(e));
    return {t: 'a', values};
  }

  private bindfun(f: FunctionBind): Value {
    const {func, args, call} = f;
    let ff = this.expressionF(func);
    const as = args.flatMap(a => this.funcArg(a));
    ff = {...ff, applied: ff.applied.concat(as)};
    if (!call) return ff;

    return this.callfun(ff);
  }

  private funcArg(arg: FunctionBindArg): Value[] {
    if (arg.tupleSize != null) {
      return this.expressionT(arg.exp).values;
    } else {
      return [this.expression(arg.exp)];
    }
  }

  private callfun(fun: Fun): Value {
    const innerContext = new ExecContext(fun.context);
    for (const [i, a] of fun.applied.entries()) {
      innerContext.setVar(fun.args[i], a);
    }
    if (fun.ret === 'struct') {
      return this.makeStruct(innerContext);
    } else {
      if (fun.selfref) {
        innerContext.setVar(fun.selfref.name, fun.selfref.value);
      }
      return new Executor(innerContext, this.printer).expression(fun.ret);
    }
  }

  private makeStruct(fields: ExecContext): Obj {
    return new Obj(fields.localVars());
  }
}

function doOpValues(op: PrimOps, l: number, r: number): number {
  switch (op) {
    case '+': return l + r;
    case '-': return l - r;
    case '*': return l * r;
    case '/': return l / r;
    case '//': return Math.trunc(l / r);
    case '%': return l % r;
    case '!=': return l !== r ? 1 : 0;
    case '==': return l === r ? 1 : 0;
    case '<<': return l < r ? 1 : 0;
    case '>>': return l > r ? 1 : 0;
    case '<=': return l <= r ? 1 : 0;
    case '>=': return l >= r ? 1 : 0;
    case '&&': return l && r;
    case '||': return l || r;
    default: return unreachable(op);
  }
}

/* 
assignment/closest shared superclass tests
Maybe type <- better lexer properties for var?
break/continue/return - proper context
generic types,

owner/borrow/move (rust style semantics so you can find new/delete points)
mutable/readonly/const
pure (for functions)

Either/Union types,
methods + method calls,
Abstract roots, join and split them, shared? saver and top-level data
test assertions,
grammar Instructions that allow named properties instead of value array
Variables have - current type, assignable type (annotation or inferred). One time check of var name compatibility.
- ????? auto generate 0/1/2 space precedence copies? And then add more operator precedence?????
- ?????????????? parsing based on tokens instead of operators, flat expression with precedence computed later????????
Lazy mode functions inside which things behave like haskell
labels for blocks and break

*/
