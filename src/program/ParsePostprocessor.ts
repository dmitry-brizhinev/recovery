
import {assert, assertNonNull, unreachable, throwIfNull} from '../util/Utils';
import type {Op, Sc, NumT, StrT, Vr, FunT, TupT, ObjT, ArrT, PrimOps, VrName, VrType, Cnst, Cl, NulT, Nu, MayT, TopT, BotT} from './CustomLexer';
import type {Dot, Fnd, Ass, Rec, Var, Typ, Ttp, Ftp, Ife, Exm, Arr, Ret, Sta, Dow, Wdo, For as ForP, Doo, Brk, Cnt, Bls, Ifb, Exp, Cnd, Ond, Ftpo} from './ParserOutput.generated';
import {Map as IMap} from 'immutable';
import {zip, zipShorter} from '../util/Zip';

type AnyExp = Exp;

export interface NulType {
  readonly t: NulT;
}
const Nul: NulType = {t: '_'};
export interface TopType {
  readonly t: TopT;
}
const Top: TopType = {t: '*'};
export interface BotType {
  readonly t: BotT;
}
const Bot: BotType = {t: '-'};
export interface NumType {
  readonly t: NumT;
}
export interface StrType {
  readonly t: StrT;
}
export interface FunSignature {
  readonly args: Type[];
  readonly ret: Type;
}
export interface FunType {
  readonly t: FunT;
  readonly sigs: FunSignature[];
}
export interface SimpleFunType extends FunType {
  readonly t: FunT;
  readonly sigs: [FunSignature];
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

export type Type = NulType | TopType | BotType | NumType | StrType | FunType | TupType | ObjType | ArrType | MayType;

export function pt(t: Type): string {
  switch (t.t) {
    case '_':
    case '*':
    case '-':
    case 'i':
    case 'd':
    case 'b':
    case 's':
    case 'c': return t.t;
    case 't': return `{,${t.values.map(pt).join(',')}}`;
    case 'o': return t.con;
    case 'f': return `{${t.sigs.map(t => `${t.args.map(pt).join(':')}->${pt(t.ret)}`).join(' & ')}}`;
    case 'a': return `[${pt(t.subtype)}]`;
    case 'm': return `${pt(t.subtype)}?`;
    default: return unreachable(t, `Invalid type ${t}`);
  }
}

function checktt(val: Expression): NarrowedExpression<TupType> {
  assert(val.type.t === 't', `${pt(val.type)} is not a tuple`);
  return val as NarrowedExpression<TupType>;
}
function checkoo(val: Expression): NarrowedExpression<ObjType> {
  assert(val.type.t === 'o', `${pt(val.type)} is not an object`);
  return val as NarrowedExpression<ObjType>;
}
function checkff(val: Expression): NarrowedExpression<FunType> {
  assert(val.type.t === 'f', `${pt(val.type)} is not a function`);
  return val as NarrowedExpression<FunType>;
}
function checkbb(val: Expression): NarrowedExpression<NumType> {
  assert(val.type.t === 'b', `${pt(val.type)} is not a boolean`);
  return val as NarrowedExpression<NumType>;
}
function checkii(val: Expression): NarrowedExpression<NumType> {
  assert(val.type.t === 'i', `${pt(val.type)} is not an integer`);
  return val as NarrowedExpression<NumType>;
}
function checkss(val: Expression): NarrowedExpression<StrType> {
  assert(val.type.t === 's', `${pt(val.type)} is not a string`);
  return val as NarrowedExpression<StrType>;
}
function checkaa(val: Expression): NarrowedExpression<ArrType> {
  assert(val.type.t === 'a', `${pt(val.type)} is not an array`);
  return val as NarrowedExpression<ArrType>;
}
function isff(val: NewVariable): val is NewVariableFun {
  return val.type?.t === 'f';
}

function iss(type: Type): StrT | undefined {
  return type.t === 's' || type.t === 'c' ? type.t : undefined;
}
function isn(type: Type): NumT | undefined {
  return type.t === 'b' || type.t === 'i' || type.t === 'd' ? type.t : undefined;
}

function checkFirstAssignment(name: VrName, target: VrType, source: Type) {
  const t = target.core;
  assert(t === 'm' || t === source.t, `Can't assign type ${pt(source)} to ${name}`);
}

function checkValidTypeAnnotation(name: VrName, target: VrType, annotation: Type) {
  const t = target.core;
  assert(t === annotation.t, `Variable name ${name} incompatible with type annotation ${pt(annotation)}.`);
}

export type Statement = Assignment | Return | Break | Continue | BlockStatement | ExpressionStatement;

export interface Assignment {
  kind: 'assignment';
  type: Type;
  returnType: Type;
  receiver: Receiver;
  expression: Expression;
}

export interface Return {
  kind: 'return';
  type: BotType;
  returnType: Type;
  expression: Expression;
}

export interface Break {
  kind: 'break';
  type: BotType;
  returnType: BotType;
}

export interface Continue {
  kind: 'continue';
  type: BotType;
  returnType: BotType;
}

export interface BlockStatement {
  kind: 'block';
  type: Type;
  returnType: Type;
  block: Block;
}

export interface ExpressionStatement {
  kind: 'expression';
  type: Type;
  returnType: Type;
  expression: Expression;
}

export type Receiver = Discard | NewVariable | DefinedVariable | Field | StringElement | TupleElement | ArrayElement;

export interface Discard {
  kind: 'discard';
}

export interface NewVariable {
  kind: 'definition';
  type?: Type | undefined; // TODO
  name: VrName;
  vrtype: VrType;
}

type NewVariableFun = NewVariable & ExpNarrow<FunType>;

export interface DefinedVariable {
  kind: 'variable';
  type: Type; // todo: add the concept of the 'currently assigned' type vs the general declared type that might be wider
  returnType: BotType;
  name: VrName; // And possibly for fields as well
}

export interface Field {
  kind: 'field';
  type: Type;
  returnType: Type;
  name: VrName;
  obj: NarrowedExpression<ObjType>;
}

export interface StringElement {
  kind: 'selement';
  type: StrType;
  returnType: Type;
  index: NarrowedExpression<NumType>;
  str: NarrowedExpression<StrType>;
}

export interface TupleElement {
  kind: 'telement';
  type: Type;
  returnType: Type;
  index: number;
  tup: NarrowedExpression<TupType>;
}

export interface ArrayElement {
  kind: 'aelement';
  type: Type;
  returnType: Type;
  index: NarrowedExpression<NumType>;
  arr: NarrowedExpression<ArrType>;
}

export type Block = Do | If | For | While | DoWhile;

export type Body = Statement[];

export interface Do {
  kind: 'do';
  type: Type;
  returnType: Type;
  body: Body;
}
interface IfCase {
  cond: NarrowedExpression<NumType>;
  body: Body;
}
export interface If {
  kind: 'if';
  type: Type;
  returnType: Type;
  first: IfCase;
  elifs: IfCase[];
  last: Body | undefined;
}
export interface For {
  kind: 'for';
  type: Type;
  returnType: Type;
  name: VrName;
  iter: NarrowedExpression<ArrType>;
  body: Body;
}
export interface While {
  kind: 'while';
  type: Type;
  returnType: Type;
  cond: NarrowedExpression<NumType>;
  body: Body;
}
export interface DoWhile {
  kind: 'dowhile';
  type: Type;
  returnType: Type;
  cond: NarrowedExpression<NumType>;
  body: Body;
}

type ExpNarrow<T extends Type> = {type: T;};
export type NarrowedExpression<T extends Type> = ExpNarrow<T> & Expression;
export type Expression = DefinedVariable | Field | StringElement | TupleElement | ArrayElement | BlockExpression | Constant | FunctionExpression | Constructor | BinaryOperation | Tuple | ArrayExpression | FunctionBind;

export interface Constant {
  kind: 'constant';
  type: NumType | StrType | NulType;
  returnType: BotType;
  value: string;
}

export interface BlockExpression {
  kind: 'block';
  type: Type;
  returnType: Type;
  block: Block;
}

export interface BinaryOperation {
  kind: 'binary';
  type: Type;
  returnType: Type;
  left: Expression;
  right: Expression;
  op: Op;
}

export interface Tuple {
  kind: 'tuple';
  type: TupType;
  returnType: Type;
  elements: Expression[];
}

export interface ArrayExpression {
  kind: 'array';
  type: ArrType;
  returnType: Type;
  elements: Expression[];
}

export interface FunctionOverload {
  args: VrName[];
  body: Expression;
}

export interface FunctionExpression {
  kind: 'function';
  type: FunType;
  returnType: BotType;
  sigs: FunctionOverload[];
}

export interface ConstructorOverload {
  args: VrName[];
  name: string;
}

export interface Constructor {
  kind: 'constructor';
  type: SimpleFunType;
  returnType: BotType;
  sigs: [ConstructorOverload];
}

export interface FunctionBind {
  kind: 'bind';
  type: Type;
  returnType: Type;
  call: boolean;
  func: NarrowedExpression<FunType>;
  args: Expression[];
}

export abstract class Module {
  protected abstract getRequiredCon(s: string): ConType;

  assertAssign(target: Type, source: Type, message?: string) {
    assert(this.canAssign(target, source), message ?? `Assigning ${pt(source)} to ${pt(target)}`);
  }
  private invariant(target: Type, source: Type): boolean {
    return this.canAssign(target, source) && this.canAssign(source, target);
  }
  canAssign(target: Type, source: Type): boolean {
    if (source.t === '-') return true;
    const t = target.t;
    switch (t) {
      case '*': return true;
      case '-': return false;
      case '_':
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return t === source.t;
      case 't':
        return t === source.t && target.values.length === source.values.length &&
          zip(target.values, source.values).every(([tv, sv]) => this.invariant(tv, sv));
      case 'o':
        return t === source.t && target.con === source.con;
      case 'f':
        return t === source.t && target.sigs.length === source.sigs.length &&
          zip(target.sigs, source.sigs).every(([target, source]) =>
            this.canAssign(target.ret, source.ret)
            && target.args.length === source.args.length
            && zip(target.args, source.args).every(([ta, sa]) => this.canAssign(sa, ta)));
      case 'a':
        return t === source.t && this.invariant(target.subtype, source.subtype);
      case 'm':
        if (source.t === '_') return true;
        if (source.t === 'm') return this.canAssign(target.subtype, source.subtype);
        return this.canAssign(target.subtype, source);
      default: unreachable(target, 'checkAssignment');
    }
  }
  commonSupertype(a: Type, b: Type): Type {
    if (b.t === Bot.t) return a;
    if (a.t === Bot.t) return b;
    if (a.t === Top.t || b.t === Top.t) return Top;
    if (a.t === Nul.t && b.t === Nul.t) return Nul;
    if (a.t === Nul.t && b.t === 'm') return b;
    if (b.t === Nul.t && a.t === 'm') return a;
    if (a.t === Nul.t) return {t: 'm', subtype: b};
    if (b.t === Nul.t) return {t: 'm', subtype: a};
    if (this.canAssign(a, b)) return a;
    if (this.canAssign(b, a)) return b;
    return Top;
  }
}

class ModuleContext extends Module {
  private readonly cons = new Map<string, ConType>();

  getRequiredCon(s: string): ConType {
    const c = this.cons.get(s);
    assertNonNull(c, `Unknown type name ${s}`);
    return c;
  }
  setNewCon(s: string, c: ConType) {
    assert(!this.cons.has(s), `Duplicate type definition ${s}`);
    this.cons.set(s, c);
  }
}

export const enum ContextType {
  Block = 0,
  Loop = 1,
  Function = 2,
}

class ExecContext {
  private constructor(
    private readonly parent: ExecContext | undefined,
    readonly module: ModuleContext,
    readonly type: ContextType) {
  }
  private readonly vars = new Map<VrName, Type>();

  static newModule(): ExecContext {
    return new ExecContext(undefined, new ModuleContext(), ContextType.Block);
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

  currentVar?: NewVariableFun | undefined;

  getVar(vr: VrName): Type | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Type) {
    this.vars.set(vr, val);
  }

}

export class RootPostprocessor {
  private readonly rootContext = ExecContext.newModule();

  convert(sta: Sta): Statement {
    return new Postprocessor(this.rootContext).statement(sta);
  }

  module(): Module {
    return this.rootContext.module;
  }
}

class Postprocessor {
  constructor(private readonly context: ExecContext) {}

  private comSup(a: Type, b: Type): Type {
    return this.context.module.commonSupertype(a, b);
  }

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
      this.context.setVar(receiver.name, receiver.type ?? this.inferUnannotatedType(receiver.name, receiver.vrtype, expression.type));
    }
    return {kind, type: expression.type, returnType: expression.returnType, receiver, expression};
  }

  private inferUnannotatedType(vrName: VrName, vrType: VrType, assigned: Type): Type {
    if (vrType.core === 'm') {
      assert(assigned.t !== '_', `Need type annotation on ${vrName}`);
      if (assigned.t === 'm') return assigned;
      return {t: 'm', subtype: assigned};
    } else {
      return assigned;
    }
  }

  private checkReceiverAssignment(left: Receiver, right: Type) {
    if (left.kind === 'field' || left.kind === 'selement' || left.kind === 'aelement' || left.kind === 'telement' || left.kind === 'variable') {
      this.context.module.assertAssign(left.type, right);
    } else if (left.kind === 'definition') {
      if (left.type) {
        this.context.module.assertAssign(left.type, right);
      } else {
        checkFirstAssignment(left.name, left.vrtype, right);
      }
    } else if (left.kind === 'discard') {
      // Any assignment is fine
    } else {
      unreachable(left);
    }
  }

  private receiver(r: Rec | Var | Nu): Receiver {
    switch (r.type) {
      case 'var': return this.varReceiver(r);
      case 'dot': return this.dot(r);
      case 'nu': return {kind: 'discard'};
      default: return unreachable(r);
    }
  }

  private returnn(r: Ret): Return {
    assert(this.context.haveAbove(ContextType.Function), 'No function to return from');
    const kind = 'return';
    const expression = this.expression(...r.value);
    return {kind, type: Bot, returnType: expression.type, expression};
  }

  private break(_r: Brk): Break {
    assert(this.context.haveAbove(ContextType.Loop), 'No loop to break out of');
    return {kind: 'break', type: Bot, returnType: Bot};
  }

  private continue(_c: Cnt): Continue {
    assert(this.context.haveAbove(ContextType.Loop), 'No loop to continue in');
    return {kind: 'continue', type: Bot, returnType: Bot};
  }

  private blockstatement(sta: Bls): BlockStatement {
    const kind = 'block';
    const block = this.block(sta);
    const type = block.type;
    const returnType = block.returnType;
    return {kind, type, returnType, block};
  }

  private expstatement(exp: AnyExp): ExpressionStatement {
    const kind = 'expression';
    const expression = this.expression(exp);
    const type = expression.type;
    const returnType = expression.returnType;
    return {kind, type, returnType, expression};
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
    const last = e.value.length === 3 ? this.body(e.value[2], ContextType.Block) : undefined;

    let type = this.bodytype(first.body);
    let returnType = this.comSup(first.cond.returnType, this.bodyreturntype(first.body));
    for (const c of elifs) {
      type = this.comSup(type, this.bodytype(c.body));
      returnType = this.comSup(returnType, this.comSup(c.cond.returnType, this.bodyreturntype(c.body)));
    }
    type = this.comSup(type, last ? this.bodytype(last) : Nul);
    returnType = this.comSup(returnType, last ? this.bodyreturntype(last) : Bot);

    return {kind, type, returnType, first, elifs, last};
  }

  private ifb(b: Ifb): IfCase {
    const [c, y] = b.value;
    const cond = checkbb(this.expression(c));
    const body = this.body(y, ContextType.Block);
    return {cond, body};
  }

  private ifn(n: Ifb[]): IfCase[] {
    return n.map(b => this.ifb(b));
  }

  private dowhile(e: Dow): DoWhile {
    const kind = 'dowhile';
    const cond = checkbb(this.expression(e.value[1]));
    const body = this.body(e.value[0], ContextType.Loop);
    const type = this.bodytype(body);
    const returnType = this.comSup(cond.returnType, this.bodyreturntype(body));
    return {kind, cond, type, returnType, body};
  }

  private while(e: Wdo): While {
    const kind = 'while';
    const cond = checkbb(this.expression(e.value[0]));
    const body = this.body(e.value[1], ContextType.Loop);
    const type = this.comSup(Nul, this.bodytype(body));
    const returnType = this.comSup(cond.returnType, this.bodyreturntype(body));
    return {kind, cond, type, returnType, body};
  }

  private for(f: ForP): For {
    const kind = 'for';
    const name: VrName = f.value[0].value[0].value;
    const iter = checkaa(this.expression(f.value[1]));
    const body = this.body(f.value[2], ContextType.Loop);
    const type = this.comSup(Nul, this.bodytype(body));
    const returnType = this.comSup(iter.returnType, this.bodyreturntype(body));
    return {kind, name, iter, type, returnType, body};
  }

  private do(d: Doo): Do {
    const kind = 'do';
    const body = this.body(d.value[0], ContextType.Block);
    const type = this.bodytype(body);
    const returnType = this.bodyreturntype(body);
    return {kind, type, returnType, body};
  }

  private body(e: Sta[], c: ContextType): Body {
    const inner = new Postprocessor(this.context.newChild(c));
    return e.map(s => inner.statement(s));
  }

  private bodytype(b: Body): Type {
    return b.length === 0 ? Nul : b[b.length - 1].type;
  }

  private bodyreturntype(b: Body): Type {
    let t: Type = Bot;
    for (const s of b) {
      t = this.comSup(t, s.returnType);
    }
    return t;
  }

  private varReceiver(v: Var): DefinedVariable | NewVariable {
    const name = v.value[0].value;
    const value = this.context.getVar(name);
    if (value) {
      const kind = 'variable'; // definition
      return {kind, type: value, returnType: Bot, name};
    } else {
      const kind = 'definition';
      const type = unwrapVar(v);
      const vrtype = v.value[0].vrtype;
      return {kind, type, vrtype, name};
    }
  }

  private expression(exp: AnyExp): Expression {
    switch (exp.type) {
      case 'nu':
      case 'cnst': return this.constant(exp);
      case 'vr': return this.variable(exp);
      case 'fnd': return this.functionexp(exp);
      case 'cnd': return this.constructorexp(exp);
      case 'ond': return this.overloads(exp);
      case 'dot': return this.dot(exp);
      case 'exc': return this.callfun(...exp.value);
      case 'exm': return this.tuple(exp);
      case 'exl': return this.bindfun(...exp.value);
      case 'exo': return this.binary(...exp.value);
      case 'arr': return this.array(exp);
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
    const returnType = Bot;
    return {kind, type, returnType, value};
  }

  private variable(v: Vr): DefinedVariable {
    const kind = 'variable';
    const name = v.value;
    const type = this.context.getVar(name);
    assert(type, `undefined variable ${name}`);
    const returnType = Bot;
    return {kind, type, returnType, name};
  }

  private dot(d: Dot): Field | StringElement | TupleElement | ArrayElement {
    const left = this.expression(d.value[0]);
    const right = d.value[1];
    if (left.type.t === 'o') {
      const obj = checkoo(left);
      assert(right.type === 'vr', `Cannot access object field with constant ${right.value}`);
      const con = this.context.module.getRequiredCon(obj.type.con);
      const name = right.value;
      const type = con.fields.get(name);
      assert(type, `Unknown object member ${name}`);
      const returnType = obj.returnType;
      return {kind: 'field', type, returnType, name, obj};
    } else if (left.type.t === 'a') {
      const arr = checkaa(left);
      const index = checkii(this.expression(right));
      return {kind: 'aelement', type: arr.type.subtype, returnType: arr.returnType, index, arr};
    } else if (left.type.t === 's') {
      const str = checkss(left);
      const index = checkii(this.expression(right));
      return {kind: 'selement', type: {t: 'c'}, returnType: str.returnType, index, str};
    } else {
      const tup = checktt(left);
      assert(right.type === 'cnst', `Cannot index tuple with variable ${right.value}`);
      const c = this.constant(right);
      assert(c.type.t === 'i', `Cannot index tuple with non-integer ${c.value}`);
      const index = Number.parseInt(c.value);
      assert(index >= 0 && index < tup.type.values.length, `Index ${c.value} out of bounds for tuple of size ${tup.type.values.length}`);
      const type = tup.type.values[index];
      return {kind: 'telement', type, returnType: tup.returnType, index, tup};
    }
  }

  private argTypes(f: Fnd | Cnd): Type[] {
    return f.value[0].map(vr => throwIfNull(unwrapVar(vr), `Need a type annotation on ${vr.value[0].value}`));
  }

  private argNames(f: Fnd | Cnd): VrName[] {
    return f.value[0].map(vr => vr.value[0].value);
  }

  private functionexp(f: Fnd): FunctionExpression {
    const kind = 'function';
    const argTypes = this.argTypes(f);
    const argNames = this.argNames(f);

    const innerContext = this.context.newChild(ContextType.Function);
    zip(argNames, argTypes).forEach(v => innerContext.setVar(...v));
    if (this.context.currentVar) {
      innerContext.setVar(this.context.currentVar.name, this.context.currentVar.type);
    }
    const typ = f.value.length === 3 ? f.value[1] : undefined;
    const ret = typ && parseTypeAnnotation(typ);
    const inn = f.value.length === 3 ? f.value[2] : f.value[1];
    const body = new Postprocessor(innerContext).expression(inn);
    const bodyRet = this.comSup(body.type, body.returnType);
    ret && this.context.module.assertAssign(ret, bodyRet);
    const type: SimpleFunType = {t: 'f', sigs: [{args: argTypes, ret: bodyRet}]};
    return {kind, sigs: [{args: argNames, body}], type, returnType: Bot};
  }

  private constructorexp(f: Cnd): Constructor {
    const kind = 'constructor';
    const argTypes = this.argTypes(f);
    const argNames = this.argNames(f);

    const fields = IMap(zip(argNames, argTypes));
    const name = f.value[1].value;
    const con: ConType = {fields, name};
    this.context.module.setNewCon(name, con);
    const ret: ObjType = {t: 'o', con: name};
    const type: SimpleFunType = {t: 'f', sigs: [{args: argTypes, ret}]};

    return {kind, sigs: [{args: argNames, name}], type, returnType: Bot};
  }

  private overloads(o: Ond): FunctionExpression {
    const kind = 'function';
    const fs = o.value[0].map(f => this.functionexp(f));
    assert(fs.length);
    const sigs = fs.flatMap(f => f.sigs);
    const tsigs = fs.flatMap(f => f.type.sigs);
    assert(tsigs.length);
    const type: FunType = {t: 'f', sigs: tsigs};
    return {kind, sigs, type, returnType: Bot};
  }

  private filterSigsAndApply(f: FunType, as: Expression[]): FunSignature[] {
    return f.sigs.filter(sig => {
      if (sig.args.length < as.length) return false;
      if (zipShorter(sig.args, as).some(([s, a]) => !this.context.module.canAssign(s, a.type))) return false;
      return true;
    }).map(({args, ret}) => ({args: args.slice(as.length), ret}));
  }

  private bindfuncn(func: NarrowedExpression<FunType>, args: Expression[]): FunctionBind & ExpNarrow<FunType> {
    const kind = 'bind';
    const call = false;

    const sigs = this.filterSigsAndApply(func.type, args);
    assert(sigs.length, 'Invalid arguments');
    const type: FunType = {t: 'f', sigs};
    const returnType = args.reduce((t, a) => this.comSup(t, a.returnType), func.returnType);

    if (func.kind === 'bind') {
      args = func.args.concat(args);
      func = func.func;
    }
    return {kind, type, returnType, call, func, args};
  }

  private bindfuncc(f: NarrowedExpression<FunType>, tup: NarrowedExpression<TupType>): FunctionBind & ExpNarrow<FunType> {
    const args: TupleElement[] = tup.type.values.map((type, index) => ({kind: 'telement', type, returnType: tup.returnType, index, tup}));
    return this.bindfuncn(f, args);
  }

  private bindfun(l: AnyExp, op: Cl, r: AnyExp): FunctionBind & ExpNarrow<FunType> {
    let func = checkff(this.expression(l));
    const curried = op.value === '::';
    if (curried) {
      const arg = checktt(this.expression(r));
      return this.bindfuncc(func, arg);
    } else {
      const arg = this.expression(r);
      return this.bindfuncn(func, [arg]);
    }
  }

  private callfun(e: AnyExp, _sc: Sc): FunctionBind {
    const kind = 'bind';
    const call = true;
    let func = checkff(this.expression(e));
    const matchingOverload = func.type.sigs.find(s => s.args.length === 0);
    assert(matchingOverload, `Function needs more arguments`);
    const args = func.kind === 'bind' ? func.args : [];
    const type = matchingOverload.ret;
    const returnType = func.returnType;
    func = func.kind === 'bind' ? func.func : func;
    return {kind, type, returnType, call, func, args};
  }

  private tuple(e: Exm): Tuple {
    const kind = 'tuple';
    const t = 't';
    if (e.value.length === 2) {
      const tt = checktt(this.expression(e.value[0]));
      assert(tt.kind === 'tuple');
      const v = this.expression(e.value[1]);
      const returnType = this.comSup(tt.returnType, v.returnType);
      return {kind, type: {t, values: tt.type.values.concat(v.type)}, returnType, elements: tt.elements.concat(v)};
    } else {
      const v = this.expression(e.value[0]);
      const returnType = v.returnType;
      return {kind, type: {t, values: [v.type]}, returnType, elements: [v]};
    }
  }

  private array(a: Arr): ArrayExpression {
    const kind = 'array';
    const t = 'a';
    if (a.value.length === 0) {
      return {kind, type: {t, subtype: Bot}, returnType: Bot, elements: []};
    } else if (a.value.length === 1) {
      const el = this.expression(a.value[0]);
      return {kind, type: {t, subtype: el.type}, returnType: el.returnType, elements: [el]};
    } else {
      const [aa, e] = a.value;
      const aaa = this.array(aa);
      const el = this.expression(e);
      const subtype = this.comSup(aaa.type.subtype, el.type);
      const returnType = this.comSup(aaa.returnType, el.returnType);
      return {kind, type: {t, subtype}, returnType, elements: aaa.elements.concat(el)};
    }
  }

  private blockexpression(b: Bls): BlockExpression {
    const kind = 'block';
    const block = this.block(b);
    const type = block.type;
    const returnType = block.returnType;
    return {kind, type, returnType, block};
  }

  private binary(l: AnyExp, op: Op, r: AnyExp): BinaryOperation {
    const kind = 'binary';
    const left = this.expression(l);
    const right = this.expression(r);
    const returnType = this.comSup(left.returnType, right.returnType);
    const type = this.doOpTypes(op.value, left.type, right.type);
    assert(type, `type ${pt(left.type)} cannot ${op} with type ${pt(right.type)}`);
    return {kind, type, returnType, left, right, op};
  }

  private doOpTypes(op: PrimOps, l: Type, r: Type): NumType | StrType | undefined {
    if (op === '+' && iss(l) && iss(r)) {
      return {t: 's'};
    }
    let ll; let rr;
    if ((ll = isn(l)) && (rr = isn(r))) {
      const t = this.doNumOpTypes(op, ll, rr);
      return t && {t};
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
  if (ttp.value.length === 1) return [parseTypeAnnotation(ttp.value[0])];
  const [l, r] = ttp.value;
  const vals = ttpValues(l);
  vals.push(parseTypeAnnotation(r));
  return vals;
}

function parseFtpo(ftp: Ftpo): SimpleFunType {
  let ret;
  let args: Type[];
  if (ftp.value.length === 2) {
    ret = parseTypeAnnotation(ftp.value[1]);
    args = ftp.value[0].map(t => parseTypeAnnotation(t));
  } else {
    ret = parseTypeAnnotation(ftp.value[0]);
    args = [];
  }
  return {t: 'f', sigs: [{args, ret}]};
}

function parseFtp(ftp: Ftp): FunType {
  const sigs = ftp.value[0].flatMap(o => parseFtpo(o).sigs);
  return {t: 'f', sigs};
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
    const t = vr.vrtype.core;
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
    checkValidTypeAnnotation(vr.value, vr.vrtype, t);
    return t;
  }
}
