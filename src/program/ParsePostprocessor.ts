
import {assert, assertNonNull, unreachable, throwIfNull, asserteq, nonnull, nonstring} from '../util/Utils';
import type {Op, Sc, NumT, StrT, Vr, FunT, TupT, ObjT, ArrT, PrimOps, VrName, VrType, Cnst, Cl, NulT, Nu, MayT, TopT, BotT, GenT} from './CustomLexer';
import type {Dot, Fnd, Ass, Rec, Var, Typ, Ttp, Ftp, Ife, Exm, Arr, Ret, Sta, Dow, Wdo, For as ForP, Doo, Brk, Cnt, Bls, Ifb, Exp, Cnd, Ond, Ftpo} from './ParserOutput.generated';
import {Map as IMap, List, Seq, Set as ISet} from 'immutable';
import {zip, zipL, zipShorter} from '../util/Zip';

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
const Int: NumType = {t: 'i'};
const Dub: NumType = {t: 'd'};
const Bol: NumType = {t: 'b'};
export interface StrType {
  readonly t: StrT;
}
const Cha: StrType = {t: 'c'};
const Str: StrType = {t: 's'};
export interface FunSignature {
  readonly args: List<Type>;
  readonly ret: Type;
  readonly gens: IMap<string, GenType>;
}
export interface FunType {
  readonly t: FunT;
  readonly sigs: FunSignature[];
  readonly sigKept: boolean[];
}
export interface SimpleFunType extends FunType {
  readonly t: FunT;
  readonly sigs: [FunSignature];
  readonly sigKept: [true];
}
export interface ConType {
  readonly name: string;
  readonly fields: IMap<VrName, Type>;
}
export interface TupType {
  readonly t: TupT;
  readonly values: List<Type>;
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
export interface GenType {
  readonly t: GenT;
  readonly name: string;
  readonly assignableTo: List<NonGenType>;
  readonly assignableFrom: List<NonGenType>;
}
export type Type = NonGenType | TopType | BotType | GenType;
export type NonGenType = NulType | NumType | StrType | FunType | TupType | ObjType | ArrType | MayType;
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
    case 'g': return `${t.name}{${t.assignableFrom.toSeq().map(pt).join('&')}/${t.assignableTo.toSeq().map(pt).join('&')}}`;
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
function isff(val: UnassignedVariable): val is UnassignedVariableFun {
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

type ReceiverM = Discard | DefinedVariable | Field | StringElement | TupleElement | ArrayElement;
type ReceiverU = ReceiverM | UnassignedVariable;
export type Receiver = ReceiverM | NewVariable;

export interface Discard {
  kind: 'discard';
}

interface UnassignedVariable {
  kind: 'unassigned';
  type?: Type | undefined; // TODO
  name: VrName;
  vrtype: VrType;
}

type UnassignedVariableFun = UnassignedVariable & ExpNarrow<FunType>;

export interface NewVariable {
  kind: 'definition';
  type: Type;
  name: VrName;
}

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
  args: List<VrName>;
  body: Expression;
}

export interface FunctionExpression {
  kind: 'function';
  type: FunType;
  returnType: BotType;
  sigs: FunctionOverload[];
}

export interface ConstructorOverload {
  args: List<VrName>;
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
  callSig?: number | undefined;
  func: NarrowedExpression<FunType>;
  args: Expression[];
}

function checkNonGenType(type: Type): NonGenType {
  if (type.t === '*' || type.t === '-' || type.t === 'g') {
    throw new Error(`Invalid transformer output ${pt(type)} for gen restriction`);
  }
  return type;
}

function transformType(type: Type, transformer: (node: Type) => Type): Type {
  const t = type.t;
  switch (t) {
    case '*':
    case '-':
    case '_':
    case 'i':
    case 'd':
    case 'b':
    case 's':
    case 'c':
    case 'o':
      return transformer(type);
    case 'a':
    case 'm':
      const subtype = transformType(type.subtype, transformer);
      return transformer({...type, subtype});
    case 't':
      const values = type.values.map(node => transformType(node, transformer));
      return transformer({...type, values});
    case 'f':
      const sigs = type.sigs.map(({args, gens, ret}) => {
        args = args.map(node => transformType(node, transformer));
        ret = transformType(ret, transformer);
        // Not transforming gens map
        return {args, gens, ret};
      });
      return transformer({...type, sigs});
    case 'g':
      const assignableTo = type.assignableTo.map(node => checkNonGenType(transformType(node, transformer)));
      const assignableFrom = type.assignableFrom.map(node => checkNonGenType(transformType(node, transformer)));
      return transformer({...type, assignableTo, assignableFrom});
    default: unreachable(type, 'transformType');
  }
}

//function visitType(type: Type, visitor: Callback<Type>): void {
//  transformType(type, (t) => (visitor(t), t));
//}

class CalcGenType {
  private readonly assTos: NonGenType[];
  private readonly assFroms: NonGenType[];
  readonly immutable: boolean;
  constructor(g: GenType, private readonly mgens: ISet<string>, private readonly canAssignInner: (tgens: ISet<string>, target: NonGenType, source: NonGenType, sgens: ISet<string>) => boolean) {
    this.immutable = !mgens.has(g.name);
    if (this.immutable) {
      this.assTo = this.assToImmutable;
      this.assFrom = this.assFromImmutable;
    }
    this.assTos = g.assignableTo.toArray();
    this.assFroms = g.assignableFrom.toArray();
  }
  toGen(name: string): GenType {
    // TODO check validity here instead of infer(), and make it a hard fail?
    return {t: 'g', name, assignableTo: List(this.assTos), assignableFrom: List(this.assFroms)};
  }
  pretty(name: string): string {
    return pt(this.toGen(name));
  }
  assToImmutable(target: NonGenType, ogens: ISet<string>): boolean {
    return this.assTos.some(tt => this.canAssignInner(ogens, target, tt, this.mgens)); // TODO could be maybe type that covers combo???
  }
  assTo(target: NonGenType, ogens: ISet<string>): boolean {
    const result = this.assToImmutable(target, ogens);
    if (result) return result;
    this.assTos.push(target);
    return true;
  }
  assFromImmutable(source: NonGenType, ogens: ISet<string>): boolean {
    return this.assFroms.some(tt => this.canAssignInner(this.mgens, tt, source, ogens)); // TODO could be maybe type that covers combo???
  }
  assFrom(source: NonGenType, ogens: ISet<string>): boolean {
    const result = this.assFromImmutable(source, ogens);
    if (result) return result;
    this.assFroms.push(source);
    return true;
  }
  static genGen(ttt: CalcGenType, sss: CalcGenType): boolean {
    asserteq(ttt.canAssignInner, sss.canAssignInner);
    return ttt.assTos.every(tt => sss.assTo(tt, ttt.mgens)) &&
      sss.assFroms.every(ss => ttt.assFrom(ss, sss.mgens));
  }
  infer(comSup: (a: Type, b: Type) => Type): NonGenType | undefined {
    if (!this.assFroms.length) {
      if (this.assTos.length !== 1) return undefined;
      return this.assTos[0];
    }
    if (!this.assTos.every(tt => this.assFroms.every(ss => this.canAssignInner(ISet(), tt, ss, ISet())))) {
      return undefined;
    }
    const sup = this.assFroms.reduce<Type>(comSup, Bot);
    if (sup.t === 'g' || sup.t === '*' || sup.t === '-') return undefined;
    assert(this.assFromImmutable(sup, ISet()), `sup ${pt(sup)} not assignable to ${this.pretty('?')}`);
    assert(this.assTos.every(tt => this.canAssignInner(ISet(), tt, sup, ISet())), `sup ${pt(sup)} not compatible with ${this.pretty('?')}`);
    return sup;
  }
}

class CanAssignCalculator {
  private readonly genOut = new Map<string, CalcGenType>();
  private readonly invariantInnerBound = this.invariantInner.bind(this);
  getGens() {return Seq.Keyed(this.genOut.entries()).filterNot(g => g.immutable).toMap();}

  private register(g: GenType, mgens: ISet<string>): CalcGenType {
    let sss = this.genOut.get(g.name);
    if (!sss) {
      sss = new CalcGenType(g, mgens, this.invariantInnerBound);
      this.genOut.set(g.name, sss);
    }
    return sss;
  }

  canAssign(tgens: ISet<string>, target: Type, source: Type, sgens: ISet<string>): boolean {
    if (source.t === '-') return true;
    if (target.t === '*') return true;
    if (target.t === '-') return false;
    if (source.t === '*') return false;

    if (source.t !== 'g') {
      if (target.t !== 'g') {
        return this.canAssignInner(tgens, target, source, sgens);
      } else {
        const ttt = this.register(target, tgens);
        return ttt.assFrom(source, sgens);
      }
    }
    const sss = this.register(source, sgens);
    if (target.t === 'g') {
      const ttt = this.register(target, tgens);
      return CalcGenType.genGen(ttt, sss);
    } else {
      return sss.assTo(target, tgens);
    }
  }

  private invariant(tgens: ISet<string>, target: Type, source: Type, sgens: ISet<string>): boolean {
    if (source.t === '-' && target.t === '-') return true;
    if (source.t === '*' && target.t === '*') return true;
    if (source.t === '-' || target.t === '-') return false;
    if (source.t === '*' || target.t === '*') return false;

    if (source.t !== 'g' && target.t !== 'g') {
      return this.invariantInner(tgens, target, source, sgens);
    }
    return this.canAssign(tgens, target, source, sgens) && this.canAssign(sgens, source, target, tgens);
  }
  private invariantInner(tgens: ISet<string>, target: NonGenType, source: NonGenType, sgens: ISet<string>): boolean {
    const t = target.t;
    switch (t) {
      case '_':
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return t === source.t;
      case 't':
        return t === source.t && target.values.size === source.values.size &&
          zipL(target.values, source.values).every(([tv, sv]) => this.invariant(tgens, tv, sv, sgens));
      case 'a':
        return t === source.t && this.invariant(tgens, target.subtype, source.subtype, sgens);
      case 'o':
        return t === source.t && target.con === source.con;
      case 'f':
        return t === source.t && target.sigs.length === source.sigs.length &&
          zip(target.sigs, source.sigs).every(([target, source]) =>
            this.invariant(tgens, target.ret, source.ret, sgens)
            && target.args.size === source.args.size
            && zipL(target.args, source.args).every(([ta, sa]) => this.invariant(sgens, sa, ta, tgens)));
      case 'm':
        return t === source.t && this.invariant(tgens, target.subtype, source.subtype, sgens);
      default: unreachable(target, 'checkAssignment');
    }
  }
  private canAssignInner(tgens: ISet<string>, target: NonGenType, source: NonGenType, sgens: ISet<string>): boolean {
    const t = target.t;
    switch (t) {
      case '_':
      case 'i':
      case 'd':
      case 'b':
      case 's':
      case 'c': return t === source.t;
      case 't':
        return t === source.t && target.values.size === source.values.size &&
          zipL(target.values, source.values).every(([tv, sv]) => this.invariant(tgens, tv, sv, sgens));
      case 'a':
        return t === source.t && this.invariant(tgens, target.subtype, source.subtype, sgens);
      case 'o':
        return t === source.t && target.con === source.con;
      case 'f':
        return t === source.t && target.sigs.length === source.sigs.length &&
          zip(target.sigs, source.sigs).every(([target, source]) =>
            this.canAssign(tgens, target.ret, source.ret, sgens)
            && target.args.size === source.args.size
            && zipL(target.args, source.args).every(([ta, sa]) => this.canAssign(sgens, sa, ta, tgens)));
      case 'm':
        if (source.t === '_') return true;
        if (source.t === 'm') return this.canAssign(tgens, target.subtype, source.subtype, sgens);
        return this.canAssign(tgens, target.subtype, source, sgens);
      default: unreachable(target, 'checkAssignment');
    }
  }
}

export abstract class Module {
  protected abstract getRequiredCon(s: string): ConType;

  assertAssign(target: Type, source: Type, message?: string) {
    assert(this.canAssign(target, source), message ?? `Assigning ${pt(source)} to ${pt(target)}`);
  }
  canAssign(target: Type, source: Type): boolean {
    const calc = new CanAssignCalculator();
    return calc.canAssign(ISet(), target, source, ISet());
  }
  canAssignGen(tgens: ISet<string> | null, ts: Seq.Indexed<[Type, Type]>, sgens: ISet<string> | null): IMap<string, CalcGenType> | undefined {
    const calc = new CanAssignCalculator();
    return ts.every(([target, source]) => calc.canAssign(tgens ?? ISet(), target, source, sgens ?? ISet())) ? calc.getGens() : undefined;
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
  private readonly types = new Map<string, Type>();

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

  currentVar?: UnassignedVariableFun | undefined;

  getVar(vr: VrName): Type | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: VrName, val: Type) {
    this.vars.set(vr, val);
  }

  getType(name: string): Type | undefined {
    return this.types.get(name) || this.parent?.getType(name);
  }
  setType(name: string, type: Type) {
    this.types.set(name, type);
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
      case 'cnt': return this.continueexp(s);
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
    const receiverU = this.receiver(sta.value[0]);

    if (receiverU.kind === 'unassigned' && isff(receiverU)) {
      this.context.currentVar = receiverU;
    }
    const expression = this.expression(sta.value[1]);
    this.context.currentVar = undefined;

    this.checkReceiverAssignment(receiverU, expression.type);
    let receiver: Receiver;
    if (receiverU.kind === 'unassigned') {
      const type = receiverU.type ?? this.inferUnannotatedType(receiverU.name, receiverU.vrtype, expression.type);
      this.context.setVar(receiverU.name, type);
      receiver = {kind: 'definition', type, name: receiverU.name};
    } else {
      receiver = receiverU;
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

  private checkReceiverAssignment(left: ReceiverU, right: Type) {
    if (left.kind === 'field' || left.kind === 'selement' || left.kind === 'aelement' || left.kind === 'telement' || left.kind === 'variable') {
      this.context.module.assertAssign(left.type, right);
    } else if (left.kind === 'unassigned') {
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

  private receiver(r: Rec | Var | Nu): ReceiverU {
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

  private continueexp(_c: Cnt): Continue {
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

  private expstatement(exp: Exp): ExpressionStatement {
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

  private varReceiver(v: Var): DefinedVariable | UnassignedVariable {
    const name = v.value[0].value;
    const value = this.context.getVar(name);
    if (value) {
      const kind = 'variable'; // definition
      return {kind, type: value, returnType: Bot, name};
    } else {
      const kind = 'unassigned';
      const type = unwrapVar(v);
      const vrtype = v.value[0].vrtype;
      return {kind, type, vrtype, name};
    }
  }

  private expression(exp: Exp): Expression {
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
      return Bol;
    } else if (value === 'false') {
      return Bol;
    } else if (value.startsWith('"')) {
      return Str;
    } else if (value.startsWith("'")) {
      return value.length === 3 ? Cha : Str;
    } else if (value.includes('.')) {
      return Dub;
    } else if (value === '_') {
      return Nul;
    } else {
      return Int;
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
      return {kind: 'selement', type: Cha, returnType: str.returnType, index, str};
    } else {
      const tup = checktt(left);
      assert(right.type === 'cnst', `Cannot index tuple with variable ${right.value}`);
      const c = this.constant(right);
      assert(c.type.t === 'i', `Cannot index tuple with non-integer ${c.value}`);
      const index = Number.parseInt(c.value);
      const type = tup.type.values.get(index);
      assert(type, `Index ${c.value} out of bounds for tuple of size ${tup.type.values.size}`);
      return {kind: 'telement', type, returnType: tup.returnType, index, tup};
    }
  }

  private argTypes(f: Fnd | Cnd): List<Type> {
    return List(f.value[1].map(vr => throwIfNull(unwrapVar(vr), `Need a type annotation on ${vr.value[0].value}`)));
  }

  private argNames(f: Fnd | Cnd): List<VrName> {
    return List(f.value[1].map(vr => vr.value[0].value));
  }



  private functionexp(f: Fnd): FunctionExpression {
    const kind = 'function';
    const argTypes = this.argTypes(f);
    const argNames = this.argNames(f);

    const gens = fncTemplates(f);

    const innerContext = this.context.newChild(ContextType.Function);
    zipL(argNames, argTypes).forEach(v => innerContext.setVar(...v));
    gens.forEach((g, name) => innerContext.setType(name, g));
    if (this.context.currentVar) {
      innerContext.setVar(this.context.currentVar.name, this.context.currentVar.type);
    }
    const typ = f.value.length === 4 ? f.value[2] : undefined;
    const ret = typ && parseTypeAnnotation(typ);
    const inn = f.value.length === 4 ? f.value[3] : f.value[2];
    const body = new Postprocessor(innerContext).expression(inn);
    const bodyRet = this.comSup(body.type, body.returnType);
    ret && this.context.module.assertAssign(ret, bodyRet);
    const type: SimpleFunType = {t: 'f', sigs: [{args: argTypes, ret: bodyRet, gens}], sigKept: [true]};
    return {kind, sigs: [{args: argNames, body}], type, returnType: Bot};
  }

  private constructorexp(f: Cnd): Constructor {
    const kind = 'constructor';
    const argTypes = this.argTypes(f);
    const argNames = this.argNames(f);

    const gens = fncTemplates(f);

    const fields = IMap(zipL(argNames, argTypes));
    const name = f.value[2].value;
    const con: ConType = {fields, name};
    this.context.module.setNewCon(name, con);
    const ret: ObjType = {t: 'o', con: name};
    const type: SimpleFunType = {t: 'f', sigs: [{args: argTypes, ret, gens}], sigKept: [true]};

    return {kind, sigs: [{args: argNames, name}], type, returnType: Bot};
  }

  private overloads(o: Ond): FunctionExpression {
    const kind = 'function';
    const fs = o.value[0].map(f => this.functionexp(f));
    assert(fs.length);
    const sigs = fs.flatMap(f => f.sigs);
    const tsigs = fs.flatMap(f => f.type.sigs);
    assert(tsigs.length);
    const type: FunType = {t: 'f', sigs: tsigs, sigKept: tsigs.map(() => true)};
    return {kind, sigs, type, returnType: Bot};
  }

  private printAssignment(expected: List<Type>, actual: Type[]): string {
    return zipShorter(expected, actual).map(ea => ea.map(pt).join(' <-- ')).join(' , ');
  }

  private checkArgumentAssign(expected: List<Type>, actual: Type[], message: string): string {
    assert(actual.length <= expected.size);
    if (zipShorter(expected, actual).every(([e, a]) => this.context.module.canAssign(e, a))) {
      return '';
    }
    return `Cannot assign ${this.printAssignment(expected, actual)} ${message}`;
  }

  private updateGenerics(ret: Type, gens: IMap<string, GenType> | IMap<string, NonGenType>): Type {
    return transformType(ret, type => {
      if (type.t !== 'g') return type;
      return gens.get(type.name) ?? type;
    });
  }

  private applyToSig({args, ret, gens}: FunSignature, actuals: Type[]): FunSignature | string {
    if (args.size < actuals.length) return `Too many arguments`;
    const mods = this.context.module.canAssignGen(ISet.fromKeys(gens), zipShorter(args, actuals), null);
    if (!mods) {
      return `Cannot assign ${this.printAssignment(args, actuals)}`;
    }
    const log = !gens.isEmpty();
    if (log) console.log('gens1', gens.map(pt).toJSON());
    if (log) console.log('mods', mods.map((gg, n) => gg.pretty(n)).toJSON());
    for (const [name, gg] of mods) {
      assert(gens.has(name), `Unknown modified generic ${gg.pretty(name)}`);
    }
    gens = gens.merge(mods.map((gg, n) => gg.toGen(n)));
    if (log) console.log('gens2', gens.toSeq().map(pt).toJSON());

    args = args.map(a => this.updateGenerics(a, gens));
    ret = this.updateGenerics(ret, gens);
    let m: string;
    if (m = this.checkArgumentAssign(args, actuals, 'after adding generic constraints')) {
      return m;
    }

    const inferred = mods.map(gg => gg.infer(this.comSup.bind(this))).filter(nonnull).toMap();

    args = args.map(a => this.updateGenerics(a, inferred));
    ret = this.updateGenerics(ret, inferred);
    if (m = this.checkArgumentAssign(args, actuals, 'after inferring concrete generic types')) {
      return m;
    }

    gens = gens.removeAll(inferred.keys());

    return {args: args.slice(actuals.length), ret, gens};
  }

  private bindFuncType(type: FunType, args: Type[]): FunType {
    const sigsOrUn = type.sigs.map(s => this.applyToSig(s, args));
    const sigs = sigsOrUn.filter(nonstring);
    const sigKept = sigsOrUn.map(nonstring);
    if (!sigs.length) {
      if (sigsOrUn.length === 1) {
        assert(sigs.length, 'Invalid arguments to function: ' + sigsOrUn[0].toString());
      } else {
        assert(sigs.length, 'Invalid arguments to all overloads of function:\n' + sigsOrUn.map((s, i) => `${i + 1}: ${s}`).join('\n'));
      }
    }
    return {t: 'f', sigs, sigKept: this.combineSigKept(type.sigKept, sigKept)};
  }

  private combineSigKept(a: boolean[], b: boolean[]): boolean[] {
    const ts = a.flatMap((b, i) => b ? [i] : []).filter((_i, j) => b[j]);
    return a.map((_b, i) => ts.includes(i));
  }

  private bindfuncn(func: NarrowedExpression<FunType>, args: Expression[]): FunctionBind & ExpNarrow<FunType> {
    const kind = 'bind';

    const type = this.bindFuncType(func.type, args.map(a => a.type));
    const returnType = args.reduce((t, a) => this.comSup(t, a.returnType), func.returnType);

    if (func.kind === 'bind') {
      args = func.args.concat(args);
      func = func.func;
    }
    return {kind, type, returnType, func, args};
  }

  private bindfuncc(f: NarrowedExpression<FunType>, tup: NarrowedExpression<TupType>): FunctionBind & ExpNarrow<FunType> {
    const args: List<TupleElement> = tup.type.values.map((type, index) => ({kind: 'telement', type, returnType: tup.returnType, index, tup}));
    return this.bindfuncn(f, args.toArray());
  }

  private bindfun(l: Exp, op: Cl, r: Exp): FunctionBind & ExpNarrow<FunType> {
    const func = checkff(this.expression(l));
    const arg = this.expression(r);
    const curried = op.value === '::';
    if (curried) {
      return this.bindfuncc(func, checktt(arg));
    } else {
      return this.bindfuncn(func, [arg]);
    }
  }

  private callfun(e: Exp, _sc: Sc): FunctionBind {
    const kind = 'bind';
    let f = checkff(this.expression(e));
    const matchingOverload = f.type.sigs.findIndex(s => s.args.size === 0);
    assert(matchingOverload !== -1, `Function needs more arguments`);
    const type = f.type.sigs[matchingOverload].ret;
    const returnType = f.returnType;

    const callSig = f.type.sigKept.flatMap((b, i) => b ? [i] : [])[matchingOverload];

    const args = f.kind === 'bind' ? f.args : [];
    const func = f.kind === 'bind' ? f.func : f;
    return {kind, type, returnType, callSig, func, args};
  }

  private tuple(e: Exm): Tuple {
    const kind = 'tuple';
    const t = 't';
    if (e.value.length === 2) {
      const tt = checktt(this.expression(e.value[0]));
      assert(tt.kind === 'tuple');
      const v = this.expression(e.value[1]);
      const returnType = this.comSup(tt.returnType, v.returnType);
      return {kind, type: {t, values: tt.type.values.push(v.type)}, returnType, elements: tt.elements.concat(v)};
    } else {
      const v = this.expression(e.value[0]);
      const returnType = v.returnType;
      return {kind, type: {t, values: List.of(v.type)}, returnType, elements: [v]};
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

  private binary(l: Exp, op: Op, r: Exp): BinaryOperation {
    const kind = 'binary';
    const left = this.expression(l);
    const right = this.expression(r);
    const returnType = this.comSup(left.returnType, right.returnType);
    const type = this.doOpTypes(op.value, left.type, right.type);
    assert(type, `type ${pt(left.type)} cannot ${op.value} with type ${pt(right.type)}`);
    return {kind, type, returnType, left, right, op};
  }

  private doOpTypes(op: PrimOps, l: Type, r: Type): NumType | StrType | undefined {
    if (op === '+' && iss(l) && iss(r)) {
      return Str;
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


function ttpValues(ttp: Ttp): List<Type> {
  if (ttp.value.length === 1) return List.of(parseTypeAnnotation(ttp.value[0]));
  const [l, r] = ttp.value;
  const vals = ttpValues(l);
  return vals.push(parseTypeAnnotation(r));
}

function parseFtpo(ftp: Ftpo): SimpleFunType {
  let ret;
  let args: List<Type>;
  const gens = fncTemplates(ftp);
  if (ftp.value.length === 3) {
    ret = parseTypeAnnotation(ftp.value[2]);
    args = List(ftp.value[1].map(t => parseTypeAnnotation(t)));
  } else {
    ret = parseTypeAnnotation(ftp.value[1]);
    args = List();
  }
  return {t: 'f', sigs: [{args, ret, gens}], sigKept: [true]};
}

function parseFtp(ftp: Ftp): FunType {
  const sigs = ftp.value[0].flatMap(o => parseFtpo(o).sigs);
  return {t: 'f', sigs, sigKept: sigs.map(() => true)};
}

function parseTypeAnnotation(typ: Typ): Type {
  switch (typ.type) {
    case 'tp': return {t: typ.value};
    case 'tc': return {t: 'o', con: typ.value};
    case 'tg': return {t: 'g', name: typ.value, assignableTo: List(), assignableFrom: List()};
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
      case 'm':
      case 'g': return undefined;
      default: return unreachable(t, `Invalid type ${t}`);
    }
  } else {
    const t = parseTypeAnnotation(vvr.value[1]);
    checkValidTypeAnnotation(vr.value, vr.vrtype, t);
    return t;
  }
}

function fncTemplates(f: Fnd | Cnd | Ftpo): IMap<string, GenType> {
  const tmp = f.value[0].value;
  const tmps = tmp.length ? tmp[0] : [];
  return IMap(tmps.map(tc => [tc.value, {t: 'g', name: tc.value, assignableTo: List(), assignableFrom: List()}]));
}
