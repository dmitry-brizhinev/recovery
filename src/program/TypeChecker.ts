
import {assert, assertNonNull, unreachable} from '../util/Utils';
import type {Op, Sc, NumType, StrType, Vr, FunType, TupType, ObjType, ArrType, PrimOps} from './CustomLexer';
import type {Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec, Var, Typ, Ttp, Ftp} from './NearleyParser';
import {Map as IMap} from 'immutable';

interface Num {
  readonly type: NumType;
}
interface Str {
  readonly type: StrType;
}
interface Fun {
  readonly type: FunType;
  readonly args: RawValue[];
  readonly ret: RawValue;
}
interface Con {
  readonly name: string;
  readonly fields: IMap<VrName, RawValue>;
}
interface Tup {
  readonly type: TupType;
  readonly values: RawValue[];
}
interface Obj {
  readonly type: ObjType;
  readonly con: string;
}
interface Arr {
  readonly type: ArrType;
  readonly subtype: RawValue;
}
type VrName = Vr['value'];
type RawValue = Num | Str | Fun | Tup | Obj | Arr;

interface Literal {readonly type: 'lit'; readonly name: VrName;};

class ContextSnapshot {
  constructor(
    private readonly parent: ContextSnapshot | undefined,
    private readonly vars: IMap<VrName, RawValue>,
    private readonly cons: IMap<string, Con>,
    private readonly currentVar?: Var) {}

  getVarOrRecursive(vr: VrName): RawValue | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.value.length === 2) {
      const [vvv, typ] = this.currentVar.value;
      if (vvv.value === vr) {
        const value = parseTypeAnnotation(typ);
        checkFirstAssignment(vr, value);
        return isf(value) ? value : undefined;
      }
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): RawValue | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }

  getCon(s: string): Con | undefined {
    return this.cons.get(s) || this.parent?.getCon(s);
  }
}

class ExecContext {
  constructor(private readonly parent: ContextSnapshot | undefined) {}
  private readonly vars = new Map<VrName, RawValue>();
  private readonly cons = new Map<string, Con>();
  currentVar?: Var;

  getVarOrRecursive(vr: VrName): RawValue | undefined {
    const v = this.vars.get(vr);
    if (v) return v;
    if (this.currentVar?.value.length === 2) {
      const [vvv, typ] = this.currentVar.value;
      if (vvv.value === vr) {
        const value = parseTypeAnnotation(typ);
        checkFirstAssignment(vr, value);
        return isf(value) ? value : undefined;
      }
    }
    return this.parent?.getVarOrRecursive(vr);
  }

  getVar(vr: VrName): RawValue | undefined {
    return this.vars.get(vr) || this.parent?.getVar(vr);
  }
  setVar(vr: Vr, val: RawValue) {
    const name = vr.value;
    this.vars.set(name, val);
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

function ist(val: RawValue): val is Tup {
  return val.type === 't';
}
function checkt(val: RawValue): asserts val is Tup {
  assert(ist(val), `${val.type} is not a tuple`);
}
function iso(val: RawValue): val is Obj {
  return val.type === 'o';
}
function checko(val: RawValue): asserts val is Obj {
  assert(iso(val), `${val.type} is not an object`);
}
function isf(val: RawValue): val is Fun {
  return val.type === 'f';
}
function checkf(val: RawValue): asserts val is Fun {
  assert(isf(val), `${val.type} is not a function`);
}
function iss(val: RawValue): val is Str {
  return val.type === 's' || val.type === 'c';
}
function checks(val: RawValue): asserts val is Str {
  assert(iss(val), `${val.type} is not stringy`);
}

function checkn(val: RawValue): asserts val is Num {
  assert(val.type === 'b' || val.type === 'i' || val.type === 'd', `${val.type} is not numeric`);
}

function checkb(val: RawValue): asserts val is Num {
  assert(val.type === 'b', `${val.type} is not a boolean`);
}

function checkFirstAssignment(target: VrName, source: RawValue) {
  assert(target.charAt(0) === source.type);
}
function checkLitAssignment(target: VrName, source: VrName) {
  assert(target.charAt(0) === source.charAt(0));
}

export default class RootTypeChecker {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  check(sta: Sta): undefined {
    new TypeChecker(this.rootContext).check(sta);
    return undefined;
  }
}

type Receiver = Var | RawValue;

class TypeChecker {
  constructor(private readonly context: ExecContext) {}


  check(sta: Sta): void {
    const left = this.resolveReceiver(sta.value[0]);
    if (left.type === 'var' && left.value[0].value.charAt(0) === 'f') {
      this.context.currentVar = left;
    }
    const right = this.unwrapLiteral(this.express(sta.value[1]));
    if (left.type !== 'var') {
      this.checkAssignment(left, right);
    } else {
      this.assign(left, right);
    }
    this.context.currentVar = undefined;
  }

  private assign(left: Var, right: RawValue) {
    const v = this.context.getVar(left.value[0].value);
    if (left.value.length === 2) {
      const vv = this.typeAnnotation(...left.value);
      this.checkAssignment(vv, right);
    }
    if (v) {
      this.checkAssignment(v, right);
    } else {
      checkFirstAssignment(left.value[0].value, right);
      this.context.setVar(left.value[0], right);
    }
    return;
  }

  private resolveReceiver(rc: Rec): Receiver {
    if (rc.value.length === 1) {
      const rec = rc.value[0];
      if (rec.type === 'var') {
        return rec;
      }
      const cond = this.unwrapLiteral(this.express(rec.value[0]));
      checkb(cond);
      const y = this.resolveReceiver(rec.value[1]);
      const n = this.resolveReceiver(rec.value[2]);
      return this.eitherReceiver(y, n);
    } else {
      assert(rc.value[1].value === '.');
      const left = this.context.getVar(rc.value[0].value);
      assert(left, `undefined variable ${rc.value[0].value}`);
      checko(left);
      const con = this.context.getCon(left.con);
      assertNonNull(con);
      const field = con.fields.get(rc.value[2].value);
      assertNonNull(field);
      return field;
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
  private checkAssignment(target: RawValue | Literal, source: RawValue | Literal) {
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
      case 'lit':
        if (source.type === 'lit') {
          checkLitAssignment(target.name, source.name);
        } else {
          this.checkAssignment(this.unwrapLiteral(target), source);
        }
        return;
      default: unreachable(target, 'checkAssignment');
    }
  }

  private typeAnnotation(vr: Vr, typ: Typ): RawValue {
    const v = parseTypeAnnotation(typ);
    checkFirstAssignment(vr.value, v);
    return v;
  }

  private unwrapVar(vvr: Var): RawValue {
    if (vvr.value.length === 1) {
      const vr = vvr.value[0];
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
        case 'a':
          assert(false, 'Need a type annotation on ', vr.value); break;
        default:
          assert(false, 'Invalid type ', t);
      }
    } else {
      return this.typeAnnotation(...vvr.value);
    }
  }

  private either(l: RawValue | Literal, r: RawValue | Literal): RawValue | Literal {
    this.checkAssignment(l, r);
    return l;
  }

  private eitherReceiver(l: Receiver, r: Receiver): Receiver {
    if (l.type === 'var') {
      const v = this.context.getVar(l.value[0].value);
      assertNonNull(v, 'Cant define var inside receiver if');
      l = v;
    }
    if (r.type === 'var') {
      const v = this.context.getVar(r.value[0].value);
      assertNonNull(v, 'Cant define var inside receiver if');
      r = v;
    }
    this.checkAssignment(r, l);
    return l;
  }

  private partApply(fun: Fun, arg: RawValue, curried: boolean): Fun {
    const {type, args, ret} = fun;
    if (curried) {
      checkt(arg);
      assert(args.length >= arg.values.length, 'Too many arguments');
      arg.values.forEach((a, i) => this.checkAssignment(args[i], a));
      return {type, args: args.slice(arg.values.length), ret};
    } else {
      assert(args.length >= 1, 'Too many arguments');
      this.checkAssignment(args[0], arg);
      return {type, args: args.slice(1), ret};
    }
  }

  private callfun(fun: Fun): RawValue {
    assert(fun.args.length === 0, `Function missing ${fun.args.length} arguments`);
    return fun.ret;
  }

  private exprOrVcf(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Vcf): RawValue | Literal {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(exp);
    }
    return this.express(exp);
  }

  private express(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd): RawValue | Literal {
    if (exp.type === 'fnd') {
      if (exp.value[1].type !== 'tc') {
        const args = exp.value[0].map(vr => ({...this.unwrapVar(vr), name: vr.value[0].value}));
        const innerContext = new ExecContext(this.context.snapshot());
        args.forEach(v => innerContext.setVar({type: 'vr', value: v.name}, v));
        // const typ = exp.value.length === 3 ? exp.value[1] : undefined;
        const inn = exp.value.length === 3 ? exp.value[2] : exp.value[1];
        const ret = this.unwrapLiteral(new TypeChecker(innerContext).express(inn));
        return {type: 'f', args, ret};
      } else {
        const args = exp.value[0].map(vr => ({...this.unwrapVar(vr), name: vr.value[0].value}));
        const fields = IMap(args.map(a => [a.name, a]));
        const name = exp.value[1].value;
        const con: Con = {fields, name};
        this.context.setCon(name, con);
        const ret: Obj = {type: 'o', con: name};
        return {type: 'f', args, ret};
      }
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(exp.value[0]);
      const sc = exp.value[1];
      return this.doMonoOp(this.unwrapLiteral(left), sc);
    } else {
      const left = this.exprOrVcf(exp.value[0]);
      const op = exp.value[1];
      const right = this.exprOrVcf(exp.value[2]);
      const sc = exp.value.length === 4 ? exp.value[3] : undefined;
      const result = this.doOp(op, this.unwrapLiteral(left), right);
      if (!sc) return result;
      return this.doMonoOp(result, sc);
    }
  }

  private unwrapLiteral(lit: Literal | RawValue): RawValue {
    if (lit.type !== 'lit') return lit;
    const v = this.context.getVarOrRecursive(lit.name);
    assert(v, `undefined variable ${lit.name}`);
    return v;
  }

  private evalVcf(vcf: Vcf): RawValue | Literal {
    if (vcf.type === 'vr') {
      return {type: 'lit', name: vcf.value};
    } else if (vcf.type === 'cnst') {
      if (vcf.value === 'true') {
        return {type: 'b'};
      } else if (vcf.value === 'false') {
        return {type: 'b'};
      } else if (vcf.value.startsWith('"')) {
        return {type: 's'};
      } else if (vcf.value.startsWith("'")) {
        return {type: vcf.value.length === 3 ? 'c' : 's'};
      } else if (vcf.value.includes('.')) {
        return {type: 'd'};
      } else {
        return {type: 'i'};
      }
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.unwrapLiteral(this.express(c));
      checkb(cond);
      const ytype = this.express(y);
      const ntype = this.express(n);
      return this.either(ytype, ntype);
    } else {
      return unreachable(vcf, 'evalVcf');
    }
  }

  private doMonoOp(val: RawValue, sc: Sc): RawValue {
    assert(sc.value === ';');
    checkf(val);
    return this.callfun(val);
  }

  private doOp(op: Op, left: RawValue, right: RawValue | Literal): RawValue {
    if (op.value === '.' || op.value === '.:') {
      assert(op.value === '.');
      checko(left);
      assert(right.type === 'lit', 'Invalid object member dereference');
      const con = this.context.getCon(left.con);
      assertNonNull(con);
      const field = con.fields.get(right.name);
      assert(field, `Unknown object member ${right.name}`);
      return field;
    }

    right = this.unwrapLiteral(right);

    if (op.value === ':' || op.value === '::') {
      checkf(left);
      return this.partApply(left, this.unwrapLiteral(right), op.value === '::');
    } else if (op.value === ',') {
      const l = ist(left) ? left.values : [left];
      const r = ist(right) ? right.values : [right];
      return {type: 't', values: l.concat(r)};
    } else if (op.value === '+' && iss(left)) {
      checks(right);
      return {type: 's'};
    } else {
      checkn(left);
      checkn(right);
      return this.doNumOp(op.value, left, right);
    }
  }

  private doNumOp(op: PrimOps, left: Num, right: Num): Num {
    const type = this.doOpTypes(op, left.type, right.type);
    assert(type, `type ${left.type} cannot ${op} with type ${right.type}`);
    return {type};
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


function ttpValues(ttp: Ttp): RawValue[] {
  if (ttp.value.length === 2) return [parseTypeAnnotation(ttp.value[0])];
  const vals = ttpValues(ttp.value[0]);
  vals.push(parseTypeAnnotation(ttp.value[1]));
  return vals;
}

function parseFtp(ftp: Ftp): Fun {
  let ret;
  let args: RawValue[];
  if (ftp.value.length === 2) {
    ret = parseTypeAnnotation(ftp.value[1]);
    args = ftp.value[0].flatMap(t => t.type === 'op' ? [] : [t]).map(t => parseTypeAnnotation(t));
  } else {
    ret = parseTypeAnnotation(ftp.value[0]);
    args = [];
  }
  return {type: 'f', args, ret};
}

function parseTypeAnnotation(typ: Typ): RawValue {
  switch (typ.type) {
    case 'tp': return {type: typ.value};
    case 'tc': return {type: 'o', con: typ.value};
    case 'atp': return {type: 'a', subtype: parseTypeAnnotation(typ.value[0])};
    case 'ttp': return {type: 't', values: ttpValues(typ)};
    case 'ftp': return parseFtp(typ);
    default: unreachable(typ, (typ as any).type);
  }
}
