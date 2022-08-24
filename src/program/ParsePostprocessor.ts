
import {assert, assertNonNull, unreachable, throwIfNull} from '../util/Utils';
import type {Op, Sc, NumT, StrT, Vr, FunT, TupT, ObjT, ArrT, PrimOps, VrName, Cnst, Cl} from './CustomLexer';
import type {Dot, Fnd, Sta, Rec, Var, Typ, Ttp, Ftp, Ife, AnyExp, Exm} from './NearleyParser';
import {Map as IMap} from 'immutable';

export interface NumType {
  readonly t: NumT;
}
export interface StrType {
  readonly t: StrT;
}
export interface FunType {
  readonly t: FunT;
  readonly args: Type[];
  readonly ret: Type;
}
export interface ConType {
  readonly name: string;
  readonly fields: IMap<VrName, Type>;
}
export interface TupType {
  readonly t: TupT;
  readonly values: Type[];
}
export interface ObjType {
  readonly t: ObjT;
  readonly con: string;
}
export interface ArrType {
  readonly t: ArrT;
  readonly subtype: Type;
}

export type Type = NumType | StrType | FunType | TupType | ObjType | ArrType;
type AnyType = Type['t'];

class ContextSnapshot {
  constructor(
    private readonly parent: ContextSnapshot | undefined,
    private readonly vars: IMap<VrName, Type>,
    private readonly cons: IMap<string, ConType>,
    private readonly currentVar?: NewVariableFun | undefined) {}

  getVarOrRecursive(vr: VrName): Type | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.type && this.currentVar.name === vr) {
      return this.currentVar.type;
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): Type | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }

  getCon(s: string): ConType | undefined {
    return this.cons.get(s) || this.parent?.getCon(s);
  }
}

class ExecContext {
  constructor(private readonly parent: ContextSnapshot | undefined) {}
  private readonly vars = new Map<VrName, Type>();
  private readonly cons = new Map<string, ConType>();
  currentVar?: NewVariableFun | undefined;

  getVarOrRecursive(vr: VrName): Type | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.type && this.currentVar.name === vr) {
      return this.currentVar.type;
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): Type | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Type) {
    this.vars.set(vr, val);
  }
  snapshot(): ContextSnapshot {
    return new ContextSnapshot(this.parent, IMap(this.vars), IMap(this.cons), this.currentVar);
  }
  getCon(s: string): ConType | undefined {
    return this.cons.get(s) || this.parent?.getCon(s);
  }
  setCon(s: string, c: ConType) {
    this.cons.set(s, c);
  }
}

function checktt(val: Expression): NarrowedExpression<TupType> {
  assert(val.type.t === 't', `${val.type.t} is not a tuple`);
  return val as NarrowedExpression<TupType>;
}
function checkoo(val: Expression): NarrowedExpression<ObjType> {
  assert(val.type.t === 'o', `${val.type.t} is not an object`);
  return val as NarrowedExpression<ObjType>;
}
function checkff(val: Expression): NarrowedExpression<FunType> {
  assert(val.type.t === 'f', `${val.type.t} is not a function`);
  return val as NarrowedExpression<FunType>;
}
function checkbb(val: Expression): NarrowedExpression<NumType> {
  assert(val.type.t === 'b', `${val.type.t} is not a boolean`);
  return val as NarrowedExpression<NumType>;
}
function isff(val: NewVariable): val is NewVariableFun {
  return val.type?.t === 'f';
}

function iss(t: AnyType): StrT | undefined {
  return t === 's' || t === 'c' ? t : undefined;
}
function isn(t: AnyType): NumT | undefined {
  return t === 'b' || t === 'i' || t === 'd' ? t : undefined;
}

function checkFirstAssignment(target: VrName, source: Type) {
  assert(target.charAt(0) === source.t);
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
  type?: Type | undefined; // TODO
  name: VrName;
}

type NewVariableFun = NewVariable & ExpNarrow<FunType>;

export interface DefinedVariable {
  kind: 'variable';
  type: Type; // todo: add the concept of the 'currently assigned' type vs the general declared type that might be wider
  name: VrName; // And possibly for fields as well
}

export interface Field {
  kind: 'field';
  type: Type;
  name: VrName;
  obj: NarrowedExpression<ObjType>;
}


/*
function ttest() {
  type TTT = Fun | Num | Str;
  type AA<T extends TTT> = {k: 'a', readonly r: T['type'], a: number, t: T;};
  type A = AA<Fun> | AA<Num> | AA<Str>;
  type B<T extends TTT> = {k: 'b', b: number, t: T;};
  type C<T extends TTT> = {k: 'c', c: number, t: Fun & T;};
  type D<T extends TTT> = {k: 'd', d: number, t: Num & T;};

  type XX<T extends TTT> = B<T> | C<T> | D<T>;
  //function rr(r: X): asserts r is R {}
  function aa(a: AA<TTT>): AA<Fun> | null {
    if (a.r === 'f' && a.t.type === 'f') {
      const t = a.t;
      return {...a, r: t.type, t};
    }
    return null;
  }
  function rrr(a: XX<TTT>): XX<Fun> | null {
    if (a.t.type === 'f') {
      const t = a.t;
      return {...a, t};
    }
    return null;
  }
  //if (r.t.type === 'f') return r;
}
*/

type ExpNarrow<T extends Type> = {type: T;};
export type NarrowedExpression<T extends Type> = ExpNarrow<T> & Expression;
export type Expression = Constant | DefinedVariable | Field | IfExpression | FunctionExpression | Constructor | BinaryOperation | Tuple | FunctionBind;

export interface Constant {
  kind: 'constant';
  type: NumType | StrType;
  value: string;
}

export interface IfExpression {
  kind: 'if';
  type: Type;
  cond: NarrowedExpression<NumType>;
  ifYes: Expression;
  ifNo: Expression;
}

export interface BinaryOperation {
  kind: 'binary';
  type: Type;
  left: Expression;
  right: Expression;
  op: Op;
}

export interface Tuple {
  kind: 'tuple';
  type: TupType;
  elements: Expression[];
}

export interface FunctionExpression {
  kind: 'function';
  type: FunType;
  args: VrName[];
  body: Expression;
}

export interface Constructor {
  kind: 'constructor';
  type: FunType;
  args: VrName[];
  name: string;
}

export interface FunctionBind {
  kind: 'bind';
  type: Type;
  call: boolean;
  func: NarrowedExpression<FunType>;
  args: FunctionBindArg[];
}

export type FunctionBindArg = FunctionBindArgTup | FunctionBindArgNorm;
interface FunctionBindArgTup {
  exp: NarrowedExpression<TupType>;
  tupleSize: number;
}
interface FunctionBindArgNorm {
  exp: Expression;
  tupleSize?: undefined;
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

    if (receiver.kind === 'definition' && isff(receiver)) {
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

  private checkReceiverAssignment(left: Receiver, right: Type) {
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

  private checkConAssignment(target: ConType, source: ConType) {
    for (const [n, f] of target.fields) {
      const s = source.fields.get(n);
      assertNonNull(s);
      this.checkAssignment(f, s);
    }
    assert(target.name === source.name);
  }
  private checkAssignment(target: Type, source: Type) {
    const t = target.t;
    switch (t) {
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': assert(t === source.t, `Assigning ${source.t} to ${t}`); return;
      case 't':
        assert(t === source.t, `Assigning ${source.t} to ${t}`);
        assert(target.values.length === source.values.length);
        target.values.forEach((v, i) => this.checkAssignment(v, source.values[i]));
        return;
      case 'o':
        assert(t === source.t, `Assigning ${source.t} to ${t}`);
        const tcon = this.context.getCon(target.con);
        const scon = this.context.getCon(source.con);
        assertNonNull(tcon);
        assertNonNull(scon);
        this.checkConAssignment(tcon, scon);
        return;
      case 'f':
        assert(t === source.t, `Assigning ${source.t} to ${t}`);
        this.checkAssignment(target.ret, source.ret);
        assert(target.args.length === source.args.length);
        target.args.forEach((v, i) => this.checkAssignment(source.args[i], v));
        return;
      case 'a':
        assert(t === source.t, `Assigning ${source.t} to ${t}`);
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

  private constantType(value: string): NumType | StrType {
    if (value === 'true') {
      return {t: 'b'};
    } else if (value === 'false') {
      return {t: 'b'};
    } else if (value.startsWith('"')) {
      return {t: 's'};
    } else if (value.startsWith("'")) {
      return {t: value.length === 3 ? 'c' : 's'};
    } else if (value.includes('.')) {
      return {t: 'd'};
    } else {
      return {t: 'i'};
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
    const cond = checkbb(this.expression(c));
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
    const obj = checkoo(this.expression(d.value[0]));
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
      const type: FunType = {t: 'f', args: argValues, ret: body.type};
      return {kind, args: argNames, type, body};
    } else {
      const kind = 'constructor';
      const fields = IMap(args.map(a => [a.name, a.value]));
      const name = f.value[1].value;
      const con: ConType = {fields, name};
      this.context.setCon(name, con);
      const ret: ObjType = {t: 'o', con: name};
      const type: FunType = {t: 'f', args: argValues, ret};
      return {kind, args: argNames, type, name};
    }
  }

  private bindfun(l: AnyExp, op: Cl, r: AnyExp): FunctionBind & ExpNarrow<FunType> {
    const kind = 'bind';
    const call = false;
    let func = checkff(this.expression(l));
    const curried = op.value === '::';
    const {args, ret} = func.type;
    let type: FunType;
    let argExps: FunctionBindArg[];
    if (curried) {
      const arg = checktt(this.expression(r));
      assert(args.length >= arg.type.values.length, 'Too many arguments');
      arg.type.values.forEach((a, i) => this.checkAssignment(args[i], a));
      type = {t: 'f', args: args.slice(arg.type.values.length), ret};
      argExps = [{exp: arg, tupleSize: arg.type.values.length}];
    } else {
      const arg = this.expression(r);
      assert(args.length >= 1, 'Too many arguments');
      this.checkAssignment(args[0], arg.type);
      type = {t: 'f', args: args.slice(1), ret};
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
    let func = checkff(this.expression(e));
    assert(func.type.args.length === 0, `Function missing ${func.type.args.length} arguments`);
    const args = func.kind === 'bind' ? func.args : [];
    const type = func.type.ret;
    func = func.kind === 'bind' ? func.func : func;
    return {kind, type, call, func, args};
  }

  private tuple(e: Exm): Tuple {
    const kind = 'tuple';
    const t = 't';
    if (e.value.length === 3) {
      const tt = checktt(this.expression(e.value[0]));
      assert(tt.kind === 'tuple');
      const v = this.expression(e.value[2]);
      return {kind, type: {t, values: tt.type.values.concat(v.type)}, elements: tt.elements.concat(v)};
    } else {
      const v = this.expression(e.value[1]);
      return {kind, type: {t, values: [v.type]}, elements: [v]};
    }
  }

  private binary(l: AnyExp, op: Op, r: AnyExp): BinaryOperation {
    const kind = 'binary';
    const left = this.expression(l);
    const right = this.expression(r);
    const t = this.doOpTypes(op.value, left.type.t, right.type.t);
    assert(t, `type ${left.type.t} cannot ${op} with type ${right.type.t}`);
    const type = {t};
    return {kind, type, left, right, op};
  }

  private doOpTypes(op: PrimOps, l: AnyType, r: AnyType): NumT | StrT | undefined {
    if (op === '+' && iss(l) && iss(r)) {
      return 's';
    }
    let ll; let rr;
    if ((ll = isn(l)) && (rr = isn(r))) {
      return this.doNumOpTypes(op, ll, rr);
    }
    return undefined;
  }

  private doNumOpTypes(op: PrimOps, l: NumT, r: NumT): NumT | undefined {
    type T = NumT;

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


function ttpValues(ttp: Ttp): Type[] {
  if (ttp.value.length === 2) return [parseTypeAnnotation(ttp.value[1])];
  const [l, , r] = ttp.value;
  const vals = ttpValues(l);
  vals.push(parseTypeAnnotation(r));
  return vals;
}

function parseFtp(ftp: Ftp): FunType {
  let ret;
  let args: Type[];
  if (ftp.value.length === 2) {
    ret = parseTypeAnnotation(ftp.value[1]);
    args = ftp.value[0].flatMap(t => t.type === 'cl' ? [] : [t]).map(t => parseTypeAnnotation(t));
  } else {
    ret = parseTypeAnnotation(ftp.value[0]);
    args = [];
  }
  return {t: 'f', args, ret};
}

function parseTypeAnnotation(typ: Typ): Type {
  switch (typ.type) {
    case 'tp': return {t: typ.value};
    case 'tc': return {t: 'o', con: typ.value};
    case 'atp': return {t: 'a', subtype: parseTypeAnnotation(typ.value[0])};
    case 'ttp': return {t: 't', values: ttpValues(typ)};
    case 'ftp': return parseFtp(typ);
    default: unreachable(typ, (typ as any).type);
  }
}

function unwrapVar(vvr: Var): Type | undefined {
  const vr = vvr.value[0];
  if (vvr.value.length === 1) {
    const t = vr.value.charAt(0);
    switch (t) {
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return {t};
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
