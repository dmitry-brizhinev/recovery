
import {assert, throwIfNull, unreachable, type Callback} from '../util/Utils';
import type {PrimOps, VrName} from './CustomLexer';
import type {Module, ArrayExpression, ArrType, Assignment, BinaryOperation, Block, BlockStatement, Break, Constant, Constructor, Continue, DefinedVariable, Do, DoWhile, Expression, Field, For, FunctionBind, FunctionBindArg, FunctionExpression, FunType, If, NarrowedExpression, NewVariable, NumType, ObjType, Receiver, Return, Statement, Tuple, TupType, While, Body, NulType, TopType, BotType, StrType, MayType, Type} from './ParsePostprocessor';
import {pt, ContextType} from './ParsePostprocessor';
import {Map as IMap} from 'immutable';

interface Nul {
  readonly type: NulType;
}
const NulV: Nul = {type: {t: '_'}};
interface Top {
  readonly type: TopType;
}
// const TopV: Top = {type: {t: '*'}};
interface Bot {
  readonly type: BotType;
}
const BotV: Bot = {type: {t: '-'}};
interface Num {
  readonly type: NumType;
  readonly value: number;
}
interface Str {
  readonly type: StrType;
  readonly value: string;
}
interface Fun {
  readonly type: FunType;
  readonly args: VrName[];
  readonly applied: Value[];
  readonly selfref?: {name: VrName; value: Fun;} | undefined;
  readonly ret: Expression | string;
}
interface Tup {
  readonly type: TupType;
  readonly values: Value[];
}
class Obj {
  constructor(
    readonly type: ObjType,
    private fields: IMap<VrName, Value>) {}

  getMember(name: VrName): Value | undefined {
    return this.fields.get(name);
  }
  setMember(name: VrName, v: Value) {
    this.fields = this.fields.set(name, v);
  }
}
interface Arr {
  readonly type: ArrType;
  readonly values: Value[];
}
interface May {
  readonly type: MayType;
  readonly value: Value;
}
type Value = Nul | Top | Bot | Num | Str | Fun | Tup | Obj | Arr | May;

type NarrowedValue<T extends Type> =
  T extends ObjType ? Obj
  : T extends NumType ? Num
  : T extends FunType ? Fun
  : T extends TupType ? Tup
  : T extends ArrType ? Arr
  : Value;

class ExecContext {
  constructor(
    private readonly parent: ExecContext | undefined,
    readonly module: Module,
    readonly type: ContextType) {}
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

  static newModule(module: Module): ExecContext {
    return new ExecContext(undefined, module, ContextType.Block);
  }

  newChild(t: ContextType): ExecContext {
    switch (t) {
      case ContextType.Block:
      case ContextType.Loop:
        return new ExecContext(this, this.module, t);
      case ContextType.Function:
        return new ExecContext(undefined, this.module, t);
    }
  }

  haveAbove(t: ContextType): boolean {
    return this.type === t || !!this.parent?.haveAbove(t);
  }
}

function iss(val: Value): Str | undefined {
  return val.type.t === 's' || val.type.t === 'c' ? val as Str : undefined;
}
function isf(val: Value): val is Fun {
  return val.type.t === 'f';
}

function checkn(val: Value): Num {
  assert(val.type.t === 'b' || val.type.t === 'i' || val.type.t === 'd', `${pt(val.type)} is not numeric`);
  return val as Num;
}

export default class RootExecutor {
  private readonly rootContext: ExecContext;
  constructor(module: Module) {
    this.rootContext = ExecContext.newModule(module);
  }

  run(sta: Statement): string[] {
    const rs: string[] = [];
    new Executor(this.rootContext, r => rs.push(r)).statement(sta);
    return rs;
  }
}

type RecVal = VrName | [Obj, VrName] | null;

function valRep(v: Value): string {
  return 'value' in v && typeof (v.value) !== 'object' ? `${v.value}` : pt(v.type);

}

function recRep(r: RecVal): string {
  if (Array.isArray(r)) {
    return `${valRep(r[0])}.${r[1]}`;
  }
  return r ?? '_';
}

class Executor {
  constructor(
    private readonly context: ExecContext,
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
    if (!Array.isArray(left) && left?.charAt(0) === 'f') {  // TODO this is dodgy
      this.currentVar = left;
    }
    let right = this.expression(sta.expression);
    if (this.currentVar && isf(right)) {
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

  private returnstatement(_r: Return): Bot {
    //return this.expression(r.expression); // TODO
    return BotV;
  }

  private break(_b: Break): Bot {
    // TODO
    return BotV;
  }

  private continue(_c: Continue): Bot {
    // TODO
    return BotV;
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
      const c = this.expressionT(cond);
      if (c.value) {
        return this.body(body, ContextType.Block);
      }
    }
    if (e.last) {
      return this.body(e.last, ContextType.Block);
    }
    return NulV;
  }

  private while(e: While): Value {
    const {cond, body} = e;
    let v: Value = NulV;
    while (this.expressionT(cond).value) {
      v = this.body(body, ContextType.Loop);
    };
    return v;
  }

  private dowhile(e: DoWhile): Value {
    const {cond, body} = e;
    let v: Value;
    do {
      v = this.body(body, ContextType.Loop);
    } while (this.expressionT(cond).value);
    return v;
  }

  private for(f: For): Value {
    const {name, iter, body} = f;
    const a = this.expressionT(iter);
    let vv: Value = NulV;
    for (const v of a.values) { // TODO Outer context where the setvar works!!
      this.context.setVar(name, v);
      vv = this.body(body, ContextType.Loop);
    }
    return vv;
  }

  private do(d: Do): Value {
    return this.body(d.body, ContextType.Block);
  }

  private body(b: Body, c: ContextType): Value {
    const inner = new Executor(this.context.newChild(c), this.printer);
    let v: Value = NulV;
    for (const s of b) {
      v = inner.statement(s);
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
    const obj = this.expressionT(f.obj);
    const name = f.name;
    return [obj, name];
  }

  private expressionT<T extends Type>(exp: NarrowedExpression<T>): NarrowedValue<T> {
    return this.expression(exp) as any;
  }

  private expression(exp: Expression): Value {
    const v = this.expressionInner(exp);
    this.context.module.assertAssign(exp.type, v.type, `Expected ${exp.kind} expression to produce ${pt(exp.type)} but got ${pt(v.type)}`);
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
    const obj = this.expressionT(f.obj);
    return throwIfNull(obj.getMember(f.name), `Unknown object member ${f.name}`);
  }

  private constant(c: Constant): Num | Str | Nul {
    const type = c.type;
    const v = c.value;
    if (type.t === 'b') {
      return {type, value: v === 'true' ? 1 : 0};
    } else if (type.t === 'c' || type.t === 's') {
      return {type, value: v.slice(1, -1)};
    } else if (type.t === 'd') {
      return {type, value: Number.parseFloat(v)};
    } else if (type.t === 'i') {
      return {type, value: Number.parseInt(v)};
    } else if (type.t === '_') {
      return NulV;
    } else {
      return unreachable(type.t);
    }
  }

  private callable(f: FunctionExpression | Constructor): Fun {
    const args = f.args;
    if (f.kind === 'function') {
      return {type: f.type, args, applied: [], ret: f.body};
    } else {
      return {type: f.type, args, applied: [], ret: f.name};
    }
  }

  private binary(b: BinaryOperation): Value {
    const {left, op, right, type} = b;
    const l = this.expression(left);
    const r = this.expression(right);

    let ll; let rr;
    if (op.value === '+' && (ll = iss(l)) && (rr = iss(r))) {
      assert(type.t === 's');
      return {type, value: ll.value + rr.value};
    } else {
      const ll = checkn(l);
      const rr = checkn(r);
      assert(type.t === 'b' || type.t === 'i' || type.t === 'd');
      const value = doOpValues(op.value, ll.value, rr.value);
      return {type, value};
    }
  }

  private tuple(tt: Tuple): Tup {
    const values = tt.elements.map(e => this.expression(e));
    return {type: tt.type, values};
  }

  private array(a: ArrayExpression): Arr {
    const values = a.elements.map(e => this.expression(e));
    return {type: a.type, values};
  }

  private bindfun(f: FunctionBind): Value {
    const {func, args, call} = f;
    let ff = this.expressionT(func);
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
    const innerContext = this.context.newChild(ContextType.Function);
    for (const [i, a] of fun.applied.entries()) {
      innerContext.setVar(fun.args[i], a);
    }
    if (typeof (fun.ret) === 'string') {
      return this.makeStruct(fun.ret, innerContext);
    } else {
      if (fun.selfref) {
        innerContext.setVar(fun.selfref.name, fun.selfref.value);
      }
      return new Executor(innerContext, this.printer).expression(fun.ret);
    }
  }

  private makeStruct(con: string, fields: ExecContext): Obj {
    return new Obj({t: 'o', con}, fields.localVars());
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
Variables have - current type, assignable type (annotation or inferred). One time check of var name compatibility.
grammar Instructions that allow named properties instead of value array
- ????? auto generate 0/1/2 space precedence copies? And then add more operator precedence?????
- ?????????????? parsing based on tokens instead of operators, flat expression with precedence computed later????????
Lazy mode functions inside which things behave like haskell
labels for blocks and break

*/
