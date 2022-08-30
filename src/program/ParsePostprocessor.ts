
import {assert, assertNonNull, unreachable, throwIfNull} from '../util/Utils';
import type {Op, Sc, NumT, StrT, Vr, FunT, TupT, ObjT, ArrT, PrimOps, VrName, Cnst, Cl, NulT, Nu, MayT, ValueT} from './CustomLexer';
import type {Dot, Fnd, Ass, Rec, Var, Typ, Ttp, Ftp, Ife, AnyExp, Exm, Ifn, Arr, Ret, Sta, Eob, Dow, Wdo, For as ForP, Doo, Brk, Cnt, Bls, Ifb} from './NearleyParser';
import {Map as IMap} from 'immutable';

export interface NumType {
  readonly t: NumT;
}
export interface StrType {
  readonly t: StrT;
}
export interface NulType {
  readonly t: NulT;
}
const Nul: NulType = {t: '_'};
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

export interface MayType {
  readonly t: MayT;
  readonly subtype: Type;
}

export type Type = NumType | StrType | NulType | FunType | TupType | ObjType | ArrType | MayType;
type AnyT = Type['t'];

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
function checkaa(val: Expression): NarrowedExpression<ArrType> {
  assert(val.type.t === 'a', `${val.type.t} is not an array`);
  return val as NarrowedExpression<ArrType>;
}
function isff(val: NewVariable): val is NewVariableFun {
  return val.type?.t === 'f';
}

function iss(t: AnyT): StrT | undefined {
  return t === 's' || t === 'c' ? t : undefined;
}
function isn(t: AnyT): NumT | undefined {
  return t === 'b' || t === 'i' || t === 'd' ? t : undefined;
}

function checkFirstAssignment(target: VrName, source: Type) {
  const tt = target.charAt(0) as ValueT;
  if (tt === 'm') return;
  assert(tt === source.t);
}

export type Statement = Assignment | Return | Break | Continue | BlockStatement | ExpressionStatement;

export interface Assignment {
  kind: 'assignment';
  type: Type;
  receiver: Receiver;
  expression: Expression;
}

export interface Return {
  kind: 'return';
  type: NulType;
  returnType: Type; // TODO TODO TODO
  expression: Expression;
}

export interface Break {
  kind: 'break';
  type: NulType;
}

export interface Continue {
  kind: 'continue';
  type: NulType;
}

export interface BlockStatement {
  kind: 'block';
  type: Type;
  block: Block;
}

export interface ExpressionStatement {
  kind: 'expression';
  type: Type;
  expression: Expression;
}

export type Receiver = Discard | NewVariable | DefinedVariable | Field;

export interface Discard {
  kind: 'discard';
}

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

export type Block = Do | If | For | While | DoWhile;

export type Body = Statement[];

export interface Do {
  kind: 'do';
  type: Type;
  body: Body;
}
interface IfCase {
  cond: NarrowedExpression<NumType>;
  body: Body;
}
export interface If {
  kind: 'if';
  type: Type;
  first: IfCase;
  elifs: IfCase[];
  last: Body | undefined;
}
export interface For {
  kind: 'for';
  type: Type;
  name: VrName;
  iter: NarrowedExpression<ArrType>;
  body: Body;
}
export interface While {
  kind: 'while';
  type: Type;
  cond: NarrowedExpression<NumType>;
  body: Body;
}
export interface DoWhile {
  kind: 'dowhile';
  type: Type;
  cond: NarrowedExpression<NumType>;
  body: Body;
}

type ExpNarrow<T extends Type> = {type: T;};
export type NarrowedExpression<T extends Type> = ExpNarrow<T> & Expression;
export type Expression = DefinedVariable | Field | BlockExpression | Constant | FunctionExpression | Constructor | BinaryOperation | Tuple | ArrayExpression | FunctionBind;

export interface Constant {
  kind: 'constant';
  type: NumType | StrType | NulType;
  value: string;
}

export interface BlockExpression {
  kind: 'block';
  type: Type;
  block: Block;
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

export interface ArrayExpression {
  kind: 'array';
  type: ArrType;
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

  statement(s: Sta): Statement {
    switch (s.type) {
      case 'ass': return this.assignment(s);
      case 'ret': return this.returnn(s);
      case 'brk': return this.break(s);
      case 'cnt': return this.continue(s);
      case 'ife':
      case 'dow':
      case 'wdo':
      case 'for':
      case 'doo': return this.blockstatement(s);
      default: return this.expstatement(s);
    }
  }

  private assignment(sta: Ass): Assignment {
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
    return {kind, type: expression.type, receiver, expression};
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
    } else if (left.kind === 'discard') {
      // Any assignment is fine
    } else {
      unreachable(left);
    }
  }

  private receiver(r: Rec | Var | Nu): Receiver {
    switch (r.type) {
      case 'var': return this.varReceiver(r);
      case 'rec': return this.field(r);
      case 'nu': return {kind: 'discard'};
      default: return unreachable(r);
    }
  }

  private returnn(r: Ret): Return {
    const kind = 'return';
    const expression = this.expression(...r.value);
    return {kind, type: Nul, returnType: expression.type, expression};
  }

  private break(_r: Brk): Break {
    return {kind: 'break', type: Nul};
  }

  private continue(_c: Cnt): Continue {
    return {kind: 'continue', type: Nul};
  }

  private blockstatement(sta: Bls): BlockStatement {
    const kind = 'block';
    const block = this.block(sta);
    const type = block.type;
    return {kind, type, block};
  }

  private expstatement(exp: AnyExp): ExpressionStatement {
    const kind = 'expression';
    const expression = this.expression(exp);
    const type = expression.type;
    return {kind, type, expression};
  }

  private block(b: Bls): Block {
    switch (b.type) {
      case 'ife': return this.if(b);
      case 'dow': return this.dowhile(b);
      case 'wdo': return this.while(b);
      case 'for': return this.for(b);
      case 'doo': return this.do(b);
      default: return unreachable(b);
    }
  }

  private if(e: Ife): If {
    const kind = 'if';
    const first = this.ifb(e.value[0]);
    const elifs = this.ifn(e.value[1]);
    const last = e.value.length === 3 ? this.body(e.value[2]) : undefined;

    let type = this.bodytype(first.body);
    for (const c of elifs) type = this.mergeTypes(type, this.bodytype(c.body));
    if (last) type = this.mergeTypes(type, this.bodytype(last));

    return {kind, type, first, elifs, last};
  }

  private ifb(b: Ifb): IfCase {
    const [c, y] = b.value;
    const cond = checkbb(this.expression(c));
    const body = this.body(y);
    return {cond, body};
  }

  private ifn(n: Ifn): IfCase[] {
    return n.map(b => this.ifb(b));
  }

  private dowhile(e: Dow): DoWhile {
    const kind = 'dowhile';
    const cond = checkbb(this.expression(e.value[1]));
    const body = this.body(e.value[0]);
    const type = this.bodytype(body);
    return {kind, cond, type, body};
  }

  private while(e: Wdo): While {
    const kind = 'while';
    const cond = checkbb(this.expression(e.value[0]));
    const body = this.body(e.value[1]);
    const type = this.mergeTypes(Nul, this.bodytype(body));
    return {kind, cond, type, body};
  }

  private for(f: ForP): For {
    const kind = 'for';
    const name: VrName = f.value[0].value[0].value;
    const iter = checkaa(this.expression(f.value[1]));
    const body = this.body(f.value[2]);
    const type = this.mergeTypes(Nul, this.bodytype(body));
    return {kind, name, iter, type, body};
  }

  private do(d: Doo): Do {
    const kind = 'do';
    const body = this.body(d.value[0]);
    const type = this.bodytype(body);
    return {kind, type, body};
  }

  private body(e: Eob): Body {
    if (Array.isArray(e)) {
      return e.map(s => this.statement(s));
    } else {
      return [this.expstatement(e)];
    }
  }

  private bodytype(b: Body): Type {
    return b.length === 0 ? Nul : b[b.length - 1].type;
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
      case '_': return;
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
      case 'm':
        if (source.t === '_') return;
        this.checkAssignment(target.subtype, source.t === 'm' ? source.subtype : source);
        return;
      default: unreachable(target, 'checkAssignment');
    }
  }
  private mergeTypes(a: Type, b: Type): Type {
    try {
      this.checkAssignment(a, b);
      return a;
    } catch (e) {}
    try {
      this.checkAssignment(b, a);
      return b;
    } catch (e) {}
    return Nul;
  }

  private expression(exp: AnyExp): Expression {
    switch (exp.type) {
      case 'nu':
      case 'cnst': return this.constant(exp);
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
      case 'arre':
      case 'ars0':
      case 'ars1':
      case 'ars2': return this.array(exp);
      case 'ife':
      case 'dow':
      case 'wdo':
      case 'for':
      case 'doo': return this.blockexpression(exp);
      default: return unreachable(exp);
    }
  }

  private constantType(value: string): NumType | StrType | NulType {
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
    } else if (value === '_') {
      return Nul;
    } else {
      return {t: 'i'};
    }
  }

  private constant(c: Cnst | Nu): Constant {
    const kind = 'constant';
    const value = c.value;
    const type = this.constantType(value);
    return {kind, type, value};
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

  private array(a: Arr): ArrayExpression {
    const kind = 'array';
    const t = 'a';
    if (a.value.length === 0) {
      return {kind, type: {t, subtype: Nul}, elements: []};
    } else if (a.value.length === 1) {
      const el = this.expression(a.value[0]);
      return {kind, type: {t, subtype: el.type}, elements: [el]};
    } else {
      const [aa, , e] = a.value;
      const aaa = this.array(aa);
      const el = this.expression(e);
      this.checkAssignment(aaa.type.subtype, el.type);
      return {kind, type: aaa.type, elements: aaa.elements.concat(el)};
    }
  }

  private blockexpression(b: Bls): BlockExpression {
    const kind = 'block';
    const block = this.block(b);
    const type = block.type;
    return {kind, type, block};
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

  private doOpTypes(op: PrimOps, l: AnyT, r: AnyT): NumT | StrT | undefined {
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
    case 'mtp': return {t: 'm', subtype: parseTypeAnnotation(typ.value[0])};
    default: unreachable(typ, (typ as any).type);
  }
}

function unwrapVar(vvr: Var): Type | undefined {
  const vr = vvr.value[0];
  if (vvr.value.length === 1) {
    const t = vr.value.charAt(0) as ValueT;
    switch (t) {
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return {t};
      case 't':
      case 'o':
      case 'f':
      case 'a':
      case 'm': return undefined;
      default: return unreachable(t, `Invalid type ${t}`);
    }
  } else {
    const t = parseTypeAnnotation(vvr.value[1]);
    checkFirstAssignment(vr.value, t);
    return t;
  }
}
