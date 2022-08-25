
import {assert, throwIfNull, unreachable, type Callback} from '../util/Utils';
import type {NumT, StrT, FunT, TupT, ObjT, ArrT, PrimOps, VrName, ValueT, NulT} from './CustomLexer';
import type {ArrayExpression, ArrType, Assignment, BinaryOperation, Constant, Constructor, DefinedVariable, DoExpression, DoWhile, Expression, Field, ForStatement, FunctionBind, FunctionBindArg, FunctionExpression, FunType, IfExpression, NarrowedExpression, NewVariable, NumType, ObjType, Receiver, Return, Statement, Tuple, TupType, WhileDo} from './ParsePostprocessor';
import {Map as IMap} from 'immutable';

interface Nul {
  readonly t: NulT;
}
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
  readonly context?: ContextSnapshot | undefined;
  readonly selfref?: {name: VrName; value: Fun;} | undefined;
  readonly ret: Expression | 'struct';
}
interface Tup {
  readonly t: TupT;
  readonly values: Value[];
}
class Obj {
  readonly t: ObjT = 'o';
  constructor(private fields: IMap<VrName, Value>,
    private readonly methods: IMap<VrName, Fun> = IMap()) {}

  getMember(name: VrName): Value | undefined {
    return this.fields.get(name) ?? this.methods.get(name);
  }
  setMember(name: VrName, v: Value) {
    this.fields = this.fields.set(name, v);
  }
}
interface Arr {
  readonly t: ArrT;
  readonly values: Value[];
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
};
type Value = Values[ValueT | '_'];//Nul | Num | Str | Fun | Tup | Obj | Arr;

class ContextSnapshot {
  constructor(
    private readonly parent: ContextSnapshot | undefined,
    readonly vars: IMap<VrName, Value>) {}

  getVar(vr: VrName): Value | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
}

class ExecContext {
  constructor(private readonly parent: ContextSnapshot | undefined) {}
  private readonly vars = new Map<VrName, Value>();

  getVar(vr: VrName): Value | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Value) {
    this.vars.set(vr, val);
  }
  snapshot(): ContextSnapshot {
    return new ContextSnapshot(this.parent, IMap(this.vars));
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

  statement(s: Statement): void {
    switch (s.kind) {
      case 'assignment': this.assignment(s); return;
      case 'return': this.return(s); return;
      case 'if': this.ifexp(s.expression); return;
      case 'dowhile': this.dowhile(s); return;
      case 'whiledo': this.whiledo(s); return;
      case 'for': this.for(s); return;
      default: unreachable(s);
    }
  }

  private assignment(sta: Assignment): void {
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
  }

  private assign(left: RecVal, right: Value): void {
    if (Array.isArray(left)) {
      left[0].setMember(left[1], right);
    } else if (left != null) {
      this.context.setVar(left, right);
    }
    this.printer(`${recRep(left)} = ${valRep(right)}`);
  }

  private return(r: Return): Value {
    return this.expression(r.expression);
  }

  private dowhile(e: DoWhile): void {
    const {cond, body} = e;
    do {
      this.expression(body);
    } while (this.expressionB(cond).value);
  }

  private whiledo(e: WhileDo): void {
    const {cond, body} = e;
    while (this.expressionB(cond).value) {
      this.expression(body);
    };
  }

  private for(f: ForStatement): void {
    const {name, iter, body} = f;
    const a = this.expressionA(iter);
    for (const v of a.values) {
      this.context.setVar(name, v);
      this.expression(body);
    }
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
    assert(v.t === exp.type.t, `Expected ${exp.kind} expression to produce ${exp.type.t} but got ${v.t}`);
    return v;
  }

  private expressionInner(exp: Expression): Value {
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
      return {t};
    } else {
      return unreachable(t);
    }
  }

  private ifexp(e: IfExpression): Value {
    const {cond, ifYes, ifNo} = e;
    const c = this.expressionB(cond);
    if (c.value) {
      return this.expression(ifYes);
    } else {
      return this.expression(ifNo);
    }
  }

  private callable(f: FunctionExpression | Constructor): Fun {
    const args = f.args;
    if (f.kind === 'function') {
      return {t: 'f', args, applied: [], context: this.context.snapshot(), ret: f.body};
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
      return this.makeStruct(innerContext.snapshot());
    } else {
      if (fun.selfref) {
        innerContext.setVar(fun.selfref.name, fun.selfref.value);
      }
      return new Executor(innerContext, this.printer).expression(fun.ret);
    }
  }

  private makeStruct(fields: ContextSnapshot): Obj {
    return new Obj(fields.vars);
  }

  private do(d: DoExpression): Value {
    for (const s of d.statements) {
      this.statement(s);
    }
    return {t: '_'};
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


iX = if true then return 1 else 2 endif

iX = if true then
  iY = 8
elif false then 12 else
  iY = 7
  return 9
endif

if true then
  iX = 2
else
  iX = 3
endif

fA = -> do
  iX = 5
  return iX + 1
end

iX = fA;

fB = iX -> do
  _ = if true then _ else return 5 endif
  if iX == 2 then
    return 9
  elif iX == 6 then
    return 10
  else
    return 20
  endif
end


generic types,
Tighter parser types

Maybe and Either/Union types,
methods + method calls,
Abstract roots, join and split them, shared? saver and top-level data
test assertions,
*/
