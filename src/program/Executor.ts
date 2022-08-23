
import {assert, throwIfNull, unreachable} from '../util/Utils';
import type {NumType, StrType, FunType, TupType, ObjType, ArrType, PrimOps, VrName} from './CustomLexer';
import type {BinaryOperation, Constant, Constructor, DefinedVariable, Expression, Field, FunctionBind, FunctionBindArg, FunctionExpression, IfExpression, NewVariable, Receiver, Statement, Tuple} from './ParsePostprocessor';
import {Map as IMap} from 'immutable';

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
  readonly context?: ContextSnapshot | undefined;
  readonly selfref?: {name: VrName; value: Fun;} | undefined;
  readonly ret: Expression | 'struct';
}
interface Tup {
  readonly type: TupType;
  readonly values: Value[];
}
class Obj {
  readonly type: ObjType = 'o';
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
  readonly type: ArrType;
  readonly values: Value[];
}
type Value = Num | Str | Fun | Tup | Obj | Arr;

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

function ist(val: Value): val is Tup {
  return val.type === 't';
}
function checkt(val: Value): asserts val is Tup {
  assert(ist(val), `${val.type} is not a tuple`);
}
function iso(val: Value): val is Obj {
  return val.type === 'o';
}
function checko(val: Value): asserts val is Obj {
  assert(iso(val), `${val.type} is not an object`);
}
function isf(val: Value): val is Fun {
  return val.type === 'f';
}
function checkf(val: Value): asserts val is Fun {
  assert(isf(val), `${val.type} is not a function`);
}
function iss(val: Value): val is Str {
  return val.type === 's' || val.type === 'c';
}
function checks(val: Value): asserts val is Str {
  assert(iss(val), `${val.type} is not stringy`);
}

function checkn(val: Value): asserts val is Num {
  assert(val.type === 'b' || val.type === 'i' || val.type === 'd', `${val.type} is not numeric`);
}

export default class RootExecutor {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  run(sta: Statement): string | undefined {
    return new Executor(this.rootContext).run(sta);
  }
}

type RecVal = VrName | [Obj, VrName];

function valRep(v: Value): string {
  return isf(v) ? `function` :
    v.type === 't' ? `tuple` :
      v.type === 'o' ? `object` :
        v.type === 'a' ? `array` :
          `${v.value}`;
}

function recRep(r: RecVal): string {
  if (Array.isArray(r)) {
    return `${valRep(r[0])}.${r[1]}`;
  }
  return r;
}

class Executor {
  constructor(private readonly context: ExecContext) {}
  private currentVar?: VrName | undefined;

  run(sta: Statement): string | undefined {
    const left = this.receiver(sta.receiver);
    if (!Array.isArray(left) && left.charAt(0) === 'f') {
      this.currentVar = left;
    }
    let right = this.expression(sta.expression);
    if (this.currentVar && right.type === 'f') {
      right = {...right, selfref: {name: this.currentVar, value: right}};
      assert(right.selfref);
      right.selfref.value = right;
    }
    this.currentVar = undefined;
    return this.assign(left, right);
  }

  private assign(left: RecVal, right: Value): string | undefined {
    if (Array.isArray(left)) {
      left[0].setMember(left[1], right);
    } else {
      this.context.setVar(left, right);
    }
    return `${recRep(left)} = ${valRep(right)}`;
  }

  private receiver(r: Receiver): RecVal {
    switch (r.kind) {
      case 'definition': return this.definition(r);
      case 'variable': return this.varReceiver(r);
      case 'field': return this.fieldReceiver(r);
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
    const obj = this.expression(f.obj);
    checko(obj);
    const name = f.name;
    return [obj, name];
  }

  private expression(exp: Expression): Value {
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
      default: return unreachable(exp);
    }
  }

  private variable(v: DefinedVariable): Value {
    return throwIfNull(this.context.getVar(v.name), `undefined variable ${v.name}`);
  }

  private field(f: Field): Value {
    const obj = this.expression(f.obj);
    checko(obj);
    return throwIfNull(obj.getMember(f.name), `Unknown object member ${f.name}`);
  }

  private constant(c: Constant): Num | Str {
    const type = c.type.type;
    const v = c.value;
    if (type === 'b') {
      return {type, value: v === 'true' ? 1 : 0};
    } else if (type === 'c' || type === 's') {
      return {type, value: v.slice(1, -1)};
    } else if (type === 'd') {
      return {type, value: Number.parseFloat(v)};
    } else if (type === 'i') {
      return {type, value: Number.parseInt(v)};
    } else {
      return unreachable(type);
    }
  }

  private ifexp(e: IfExpression): Value {
    const {cond, ifYes, ifNo} = e;
    const c = this.expression(cond);
    checkn(c);
    if (c.value) {
      return this.expression(ifYes);
    } else {
      return this.expression(ifNo);
    }
  }

  private callable(f: FunctionExpression | Constructor): Fun {
    const args = f.args;
    if (f.kind === 'function') {
      return {type: 'f', args, applied: [], context: this.context.snapshot(), ret: f.body};
    } else {
      return {type: 'f', args, applied: [], ret: 'struct'};
    }
  }

  private binary(b: BinaryOperation): Value {
    const {left, op, right, type} = b;
    const l = this.expression(left);
    const r = this.expression(right);

    if (op.value === '+' && iss(l)) {
      checks(r);
      return {type: 's', value: l.value + r.value};
    } else {
      checkn(l);
      checkn(r);
      assert(type.type === 'b' || type.type === 'i' || type.type === 'd');
      const value = doOpValues(op.value, l.value, r.value);
      return {type: type.type, value};
    }
  }

  private tuple(t: Tuple): Tup {
    const es = t.elements.map(e => this.expression(e));
    return {type: 't', values: es};
  }

  private bindfun(f: FunctionBind): Value {
    const {func, args, call} = f;
    let ff = this.expression(func);
    checkf(ff);
    const as = args.flatMap(a => this.funcArg(a));
    ff = {...ff, applied: ff.applied.concat(as)};
    if (!call) return ff;

    return this.callfun(ff);
  }

  private funcArg(arg: FunctionBindArg): Value[] {
    const a = this.expression(arg.exp);
    const s = arg.tupleSize;
    if (s != null) {
      checkt(a);
      return a.values;
    } else {
      return [a];
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
      return new Executor(innerContext).expression(fun.ret);
    }
  }

  private makeStruct(fields: ContextSnapshot): Obj {
    return new Obj(fields.vars);
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
Todos:
Abstract roots, join and split them, shared? saver and top-level data
Parser type checking
arrays,
generic types,
methods + method calls,
Maybe and Either/Union types,
test assertions,
do ... end (with 'return'!!)
*/
/*


*/


