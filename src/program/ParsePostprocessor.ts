
import {assert, assertNonNull, unreachable, throwIfNull} from '../util/Utils';
import type {Op, Sc, NumType, StrType, Vr, FunType, TupType, ObjType, ArrType, PrimOps, VrName, Cnst, Cl} from './CustomLexer';
import type {Dot, Fnd, Sta, Rec, Var, Typ, Ttp, Ftp, Ife, AnyExp, Exm} from './NearleyParser';
import {Map as IMap} from 'immutable';

export interface Num {
  readonly type: NumType;
}
export interface Str {
  readonly type: StrType;
}
export interface Fun {
  readonly type: FunType;
  readonly args: Value[];
  readonly ret: Value;
}
export interface Con {
  readonly name: string;
  readonly fields: IMap<VrName, Value>;
}
export interface Tup {
  readonly type: TupType;
  readonly values: Value[];
}
export interface Obj {
  readonly type: ObjType;
  readonly con: string;
}
export interface Arr {
  readonly type: ArrType;
  readonly subtype: Value;
}

export type Value = Num | Str | Fun | Tup | Obj | Arr;

class ContextSnapshot {
  constructor(
    private readonly parent: ContextSnapshot | undefined,
    private readonly vars: IMap<VrName, Value>,
    private readonly cons: IMap<string, Con>,
    private readonly currentVar?: NewVariable | DefinedVariable | undefined) {}

  getVarOrRecursive(vr: VrName): Value | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.type) {
      const {name, type} = this.currentVar;
      return name === vr && isf(type) ? type : undefined;
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): Value | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }

  getCon(s: string): Con | undefined {
    return this.cons.get(s) || this.parent?.getCon(s);
  }
}

class ExecContext {
  constructor(private readonly parent: ContextSnapshot | undefined) {}
  private readonly vars = new Map<VrName, Value>();
  private readonly cons = new Map<string, Con>();
  currentVar?: NewVariable | undefined;

  getVarOrRecursive(vr: VrName): Value | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.type) {
      const {name, type} = this.currentVar;
      return name === vr && isf(type) ? type : undefined;
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): Value | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Value) {
    this.vars.set(vr, val);
  }
  snapshot(): ContextSnapshot {
    return new ContextSnapshot(this.parent, IMap(this.vars), IMap(this.cons), this.currentVar);
  }
  getCon(s: string): Con | undefined {
    return this.cons.get(s) || this.parent?.getCon(s);
  }
  setCon(s: string, c: Con) {
    this.cons.set(s, c);
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

function checkb(val: Value): asserts val is Num {
  assert(val.type === 'b', `${val.type} is not a boolean`);
}

function checkFirstAssignment(target: VrName, source: Value) {
  assert(target.charAt(0) === source.type);
}

export type Statement = Assignment;

export interface Assignment {
  kind: 'assignment';
  receiver: Receiver;
  expression: Expression;
}

export type Receiver = NewVariable | DefinedVariable | Field;

export interface NewVariable {
  kind: 'definition';
  type?: Value | undefined;
  name: VrName;
}

export interface DefinedVariable {
  kind: 'variable';
  type: Value; // todo: add the concept of the 'currently assigned' type vs the general declared type that might be wider
  name: VrName; // And possibly for fields as well
}


export interface Field {
  kind: 'field';
  type: Value;
  name: VrName;
  obj: Expression;
}

export type Expression = Constant | DefinedVariable | Field | IfExpression | FunctionExpression | Constructor | BinaryOperation | Tuple | FunctionBind;

export interface Constant {
  kind: 'constant';
  type: Num | Str;
  value: string;
}

export interface IfExpression {
  kind: 'if';
  type: Value;
  cond: Expression;
  ifYes: Expression;
  ifNo: Expression;
}

export interface BinaryOperation {
  kind: 'binary';
  type: Value;
  left: Expression;
  right: Expression;
  op: Op;
}

export interface Tuple {
  kind: 'tuple';
  type: Tup;
  elements: Expression[];
}

export interface FunctionExpression {
  kind: 'function';
  type: Fun;
  args: VrName[];
  body: Expression;
}

export interface Constructor {
  kind: 'constructor';
  type: Fun;
  args: VrName[];
  name: string;
}

export interface FunctionBind {
  kind: 'bind';
  type: Value;
  call: boolean;
  func: Expression;
  args: FunctionBindArg[];
}

export interface FunctionBindArg {
  exp: Expression;
  tupleSize?: number | undefined;
}

export class RootPostprocessor {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  convert(sta: Sta): Statement {
    return new Postprocessor(this.rootContext).statement(sta);
  }
}

class Postprocessor {
  constructor(private readonly context: ExecContext) {}

  statement(sta: Sta): Statement {
    const kind = 'assignment';
    const receiver = this.receiver(sta.value[0]);

    if (receiver.kind === 'definition' && receiver.type && isf(receiver.type)) {
      this.context.currentVar = receiver;
    }
    const expression = this.expression(sta.value[1]);
    this.context.currentVar = undefined;

    this.checkReceiverAssignment(receiver, expression.type);
    if (receiver.kind === 'definition') {
      this.context.setVar(receiver.name, receiver.type ?? expression.type);
    }
    return {kind, receiver, expression};
  }

  private checkReceiverAssignment(left: Receiver, right: Value) {
    if (left.kind === 'field') {
      this.checkAssignment(left.type, right);
    } else if (left.kind === 'definition') {
      if (left.type) {
        this.checkAssignment(left.type, right);
      } else {
        checkFirstAssignment(left.name, right);
      }
    } else if (left.kind === 'variable') {
      this.checkAssignment(left.type, right);
    } else {
      unreachable(left);
    }
  }

  private receiver(r: Rec | Var): Receiver {
    switch (r.type) {
      case 'var': return this.varReceiver(r);
      case 'rec': return this.field(r);
      default: return unreachable(r);
    }
  }

  private varReceiver(v: Var): DefinedVariable | NewVariable {
    const name = v.value[0].value;
    const value = this.context.getVar(name);
    if (value) {
      const kind = 'variable'; // definition
      return {kind, type: value, name};
    } else {
      const kind = 'definition';
      const type = unwrapVar(v);
      return {kind, type, name};
    }
  }

  private checkConAssignment(target: Con, source: Con) {
    for (const [n, f] of target.fields) {
      const s = source.fields.get(n);
      assertNonNull(s);
      this.checkAssignment(f, s);
    }
    assert(target.name === source.name);
  }
  private checkAssignment(target: Value, source: Value) {
    const t = target.type;
    switch (t) {
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': assert(t === source.type, `Assigning ${source.type} to ${t}`); return;
      case 't':
        assert(t === source.type, `Assigning ${source.type} to ${t}`);
        assert(target.values.length === source.values.length);
        target.values.forEach((v, i) => this.checkAssignment(v, source.values[i]));
        return;
      case 'o':
        assert(t === source.type, `Assigning ${source.type} to ${t}`);
        const tcon = this.context.getCon(target.con);
        const scon = this.context.getCon(source.con);
        assertNonNull(tcon);
        assertNonNull(scon);
        this.checkConAssignment(tcon, scon);
        return;
      case 'f':
        assert(t === source.type, `Assigning ${source.type} to ${t}`);
        this.checkAssignment(target.ret, source.ret);
        assert(target.args.length === source.args.length);
        target.args.forEach((v, i) => this.checkAssignment(source.args[i], v));
        return;
      case 'a':
        assert(t === source.type, `Assigning ${source.type} to ${t}`);
        this.checkAssignment(target.subtype, source.subtype);
        return;
      default: unreachable(target, 'checkAssignment');
    }
  }

  private expression(exp: AnyExp): Expression {
    switch (exp.type) {
      case 'cnst': return this.constant(exp);
      case 'ife': return this.ifexp(exp);
      case 'vr': return this.variable(exp);
      case 'fnd': return this.callable(exp);
      case 'dot': return this.field(exp);
      case 'exc0':
      case 'exc1':
      case 'exc2': return this.callfun(...exp.value);
      case 'exm0':
      case 'exm1':
      case 'exm2': return this.tuple(exp);
      case 'exl0':
      case 'exl1':
      case 'exl2': return this.bindfun(...exp.value);
      case 'exo0':
      case 'exo1':
      case 'exo2': return this.binary(...exp.value);
      default: return unreachable(exp);
    }
  }

  private constantType(value: string): Num | Str {
    if (value === 'true') {
      return {type: 'b'};
    } else if (value === 'false') {
      return {type: 'b'};
    } else if (value.startsWith('"')) {
      return {type: 's'};
    } else if (value.startsWith("'")) {
      return {type: value.length === 3 ? 'c' : 's'};
    } else if (value.includes('.')) {
      return {type: 'd'};
    } else {
      return {type: 'i'};
    }
  }

  private constant(c: Cnst): Constant {
    const kind = 'constant';
    const value = c.value;
    const type = this.constantType(value);
    return {kind, type, value};
  }

  private ifexp(e: Ife): IfExpression {
    const kind = 'if';
    const [c, y, n] = e.value;
    const cond = this.expression(c);
    checkb(cond.type);
    const ifYes = this.expression(y);
    const ifNo = this.expression(n);
    this.checkAssignment(ifYes.type, ifNo.type);
    const type = ifYes.type;
    return {kind, type, cond, ifYes, ifNo};
  }

  private variable(v: Vr): DefinedVariable {
    const kind = 'variable';
    const name = v.value;
    const type = this.context.getVarOrRecursive(name);
    assert(type, `undefined variable ${name}`);
    return {kind, type, name};
  }

  private field(d: Dot | Rec): Field {
    const kind = 'field';
    const obj = this.expression(d.value[0]);
    checko(obj.type);
    const con = this.context.getCon(obj.type.con);
    assertNonNull(con);
    const name = d.value[2].value;
    const type = con.fields.get(name);
    assert(type, `Unknown object member ${name}`);
    return {kind, type, name, obj};

  }

  private callable(f: Fnd): FunctionExpression | Constructor {
    const args = f.value[0].map(vr => ({value: throwIfNull(unwrapVar(vr), `Need a type annotation on ${vr.value}`), name: vr.value[0].value}));
    const argValues = args.map(a => a.value);
    const argNames = args.map(a => a.name);
    if (f.value[1].type !== 'tc') {
      const kind = 'function';
      const innerContext = new ExecContext(this.context.snapshot());
      args.forEach(v => innerContext.setVar(v.name, v.value));
      const typ = f.value.length === 3 ? f.value[1] : undefined;
      const ret = typ && parseTypeAnnotation(typ);
      const inn = f.value.length === 3 ? f.value[2] : f.value[1];
      const body = new Postprocessor(innerContext).expression(inn);
      ret && this.checkAssignment(ret, body.type);
      const type: Fun = {type: 'f', args: argValues, ret: body.type};
      return {kind, args: argNames, type, body};
    } else {
      const kind = 'constructor';
      const fields = IMap(args.map(a => [a.name, a.value]));
      const name = f.value[1].value;
      const con: Con = {fields, name};
      this.context.setCon(name, con);
      const ret: Obj = {type: 'o', con: name};
      const type: Fun = {type: 'f', args: argValues, ret};
      return {kind, args: argNames, type, name};
    }
  }

  private bindfun(l: AnyExp, op: Cl, r: AnyExp): FunctionBind {
    const kind = 'bind';
    const call = false;
    let func = this.expression(l);
    const curried = op.value === '::';
    const arg = this.expression(r);
    checkf(func.type);
    const {args, ret} = func.type;
    let type: Fun;
    let argExps: FunctionBindArg[];
    if (curried) {
      checkt(arg.type);
      assert(args.length >= arg.type.values.length, 'Too many arguments');
      arg.type.values.forEach((a, i) => this.checkAssignment(args[i], a));
      type = {type: 'f', args: args.slice(arg.type.values.length), ret};
      argExps = [{exp: arg, tupleSize: arg.type.values.length}];
    } else {
      assert(args.length >= 1, 'Too many arguments');
      this.checkAssignment(args[0], arg.type);
      type = {type: 'f', args: args.slice(1), ret};
      argExps = [{exp: arg}];
    }
    if (func.kind === 'bind') {
      argExps = func.args.concat(argExps);
      func = func.func;
    }
    return {kind, type, call, func, args: argExps};
  }

  private callfun(e: AnyExp, _sc: Sc): FunctionBind {
    const kind = 'bind';
    const call = true;
    let func = this.expression(e);
    checkf(func.type);
    assert(func.type.args.length === 0, `Function missing ${func.type.args.length} arguments`);
    const args = func.kind === 'bind' ? func.args : [];
    const type = func.type.ret;
    func = func.kind === 'bind' ? func.func : func;
    return {kind, type, call, func, args};
  }

  private tuple(e: Exm): Tuple {
    const kind = 'tuple';
    const type = 't';
    if (e.value.length === 3) {
      const tt = this.expression(e.value[0]);
      assert(tt.kind === 'tuple');
      checkt(tt.type);
      const v = this.expression(e.value[2]);
      return {kind, type: {type, values: tt.type.values.concat(v.type)}, elements: tt.elements.concat(v)};
    } else {
      const v = this.expression(e.value[1]);
      return {kind, type: {type, values: [v.type]}, elements: [v]};
    }
  }

  private binary(l: AnyExp, op: Op, r: AnyExp): BinaryOperation {
    const kind = 'binary';
    const left = this.expression(l);
    const right = this.expression(r);
    let type: Value;
    if (op.value === '+' && iss(left.type)) {
      checks(right.type);
      type = {type: 's'};
    } else {
      checkn(left.type);
      checkn(right.type);
      const tt = this.doOpTypes(op.value, left.type.type, right.type.type);
      assert(tt, `type ${left.type.type} cannot ${op} with type ${right.type.type}`);
      type = {type: tt};
    }
    return {kind, type, left, right, op};
  }

  private doOpTypes(op: PrimOps, l: NumType, r: NumType): NumType | undefined {
    type T = NumType;

    const not = (l: T, ...ts: T[]) => ts.every(t => t !== l);
    const one = (l: T, ...ts: T[]) => ts.some(t => t === l);

    switch (op) {
      case '+': return l === r && not(l, 'b') ? l : undefined;
      case '-':
      case '*': return l === r && not(l, 'b') ? l : undefined;
      case '/': return l === r && one(l, 'd') ? l : undefined;
      case '//':
      case '%': return l === r && one(l, 'i') ? l : undefined;
      case '!=':
      case '==': return l === r ? 'b' : undefined;
      case '<<':
      case '>>':
      case '<=':
      case '>=': return l === r && not(l, 'b') ? 'b' : undefined;
      case '&&':
      case '||': return l === r && one(l, 'b') ? l : undefined;
      default: return unreachable(op, 'doOpTypes');
    }
  }
}


function ttpValues(ttp: Ttp): Value[] {
  if (ttp.value.length === 2) return [parseTypeAnnotation(ttp.value[1])];
  const [l, , r] = ttp.value;
  const vals = ttpValues(l);
  vals.push(parseTypeAnnotation(r));
  return vals;
}

function parseFtp(ftp: Ftp): Fun {
  let ret;
  let args: Value[];
  if (ftp.value.length === 2) {
    ret = parseTypeAnnotation(ftp.value[1]);
    args = ftp.value[0].flatMap(t => t.type === 'cl' ? [] : [t]).map(t => parseTypeAnnotation(t));
  } else {
    ret = parseTypeAnnotation(ftp.value[0]);
    args = [];
  }
  return {type: 'f', args, ret};
}

function parseTypeAnnotation(typ: Typ): Value {
  switch (typ.type) {
    case 'tp': return {type: typ.value};
    case 'tc': return {type: 'o', con: typ.value};
    case 'atp': return {type: 'a', subtype: parseTypeAnnotation(typ.value[0])};
    case 'ttp': return {type: 't', values: ttpValues(typ)};
    case 'ftp': return parseFtp(typ);
    default: unreachable(typ, (typ as any).type);
  }
}

function unwrapVar(vvr: Var): Value | undefined {
  const vr = vvr.value[0];
  if (vvr.value.length === 1) {
    const t = vr.value.charAt(0);
    switch (t) {
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return {type: t};
      case 't':
      case 'o':
      case 'f':
      case 'a': return undefined;
      default: assert(false, 'Invalid type ', t);
    }
  } else {
    const t = parseTypeAnnotation(vvr.value[1]);
    checkFirstAssignment(vr.value, t);
    return t;
  }
}
