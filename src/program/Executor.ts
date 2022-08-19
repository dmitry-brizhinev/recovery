
import {assert, unreachable} from '../util/Utils';
import type {Op, Sc, NumType, StrType, Vr, FunType, TupType, ObjType, ArrType, PrimOps} from './CustomLexer';
import type {Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec} from './NearleyParser';
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
  readonly args: Vr[];
  readonly applied: Value[];
  readonly context?: ContextSnapshot;
  readonly ret: Exp | 'struct';
}
interface Tup {
  readonly type: TupType;
  readonly values: Value[];
}
class Obj {
  readonly type: ObjType = 'o';
  constructor(private fields: IMap<string, Value>,
    private readonly methods: IMap<string, Fun> = IMap()) {}

  getMember(name: string): Value {
    const m = this.fields.get(name) ?? this.methods.get(name);
    assert(m, `No member named ${name}`);
    return m;
  }
  setMember(name: string, v: Value) {
    const current = this.getMember(name);
    assert(current.type === v.type, `${name} cannot be assigned a value of type ${v.type}`);
    this.fields = this.fields.set(name, v);
  }
}
interface Arr {
  readonly type: ArrType;
}
type Value = Num | Str | Fun | Tup | Obj | Arr;
type LazyValue = Value | Vr;

class ContextSnapshot {
  constructor(
    private readonly parent: ContextSnapshot | undefined,
    readonly vars: IMap<string, Value>) {}

  getVar(vr: Vr): Value {
    const v = this.vars.get(vr.value);
    if (v != null) return v;
    assert(this.parent, `undefined variable ${vr.value}`);
    return this.parent.getVar(vr);
  }
}

class ExecContext {
  constructor(private readonly parent: ContextSnapshot | undefined) {}
  private readonly vars = new Map<string, Value>();

  getVar(vr: Vr): Value {
    const v = this.vars.get(vr.value);
    if (v != null) return v;
    assert(this.parent, `undefined variable ${vr.value}`);
    return this.parent.getVar(vr);
  }
  setVar(vr: Vr, val: Value) {
    checkType(vr, val);
    this.vars.set(vr.value, val);
  }
  snapshot(): ContextSnapshot {
    return new ContextSnapshot(this.parent, IMap(this.vars));
  }
}

function checkType(vr: Vr, val: Value) {
  assert(vr.value.charAt(0) === val.type, `${vr.value} cannot be assigned a value of type ${val.type}`);
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
  return val.type === 'f' || val.type === 'r';
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

export default class RootExecutor {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  run(sta: Sta): string | undefined {
    return new Executor(this.rootContext).run(sta);
  }
}

type Receiver = Vr | [Obj, string];

class Executor {
  constructor(private readonly context: ExecContext) {}

  private eager(v: LazyValue): Value {
    if (v.type !== 'vr') return v;
    return this.context.getVar(v);
  }

  run(sta: Sta): string | undefined {
    const left = this.resolveReceiver(sta.value[0]);
    const right = this.eager(this.express(sta.value[1]));
    return this.assign(left, right);
  }

  private recRep(r: Receiver): string {
    if (Array.isArray(r)) {
      return `object.${r[1]}`;
    }
    return r.value;
  }

  private valRep(v: Value): string {
    return isf(v) ? `function` :
      v.type === 't' ? `tuple` :
        v.type === 'o' ? `object` :
          v.type === 'a' ? `array` :
            `${v.value}`;
  }

  private assign(left: Receiver, right: Value): string | undefined {
    if (Array.isArray(left)) {
      left[0].setMember(left[1], right);
    } else {
      this.context.setVar(left, right);
    }
    return `${this.recRep(left)} = ${this.valRep(right)}`;
  }

  private resolveReceiver(rc: Rec): Receiver {
    if (rc.value.length === 1) {
      const rec = rc.value[0];
      if (rec.type === 'vr') {
        return rec;
      }
      const cond = this.eager(this.express(rec.value[0]));
      checkb(cond);
      if (cond.value) {
        return this.resolveReceiver(rec.value[1]);
      } else {
        return this.resolveReceiver(rec.value[2]);
      }
    } else {
      assert(rc.value[1].value === '.');
      const left = this.context.getVar(rc.value[0]);
      checko(left);
      const right = rc.value[2];
      return [left, right.value];
    }
  }

  private partApply(fun: Fun, arg: Value, curried: boolean): Fun {
    const {type, args, applied, context, ret} = fun;
    if (curried) checkt(arg);
    return {type, args, applied: curried && ist(arg) ? applied.concat(arg.values) : applied.concat(arg), context, ret};
  }

  private makeStruct(fun: Fun, fields: ContextSnapshot): Obj {
    return new Obj(fields.vars);
  }

  private callfun(fun: Fun): LazyValue {
    assert(fun.args.length === fun.applied.length, `Function missing ${fun.args.length - fun.applied.length} arguments`);
    const innerContext = new ExecContext(fun.context);
    for (const [i, a] of fun.applied.entries()) {
      innerContext.setVar(fun.args[i], a);
    }
    if (fun.ret === 'struct') {
      return this.makeStruct(fun, innerContext.snapshot());
    } else {
      return new Executor(innerContext).express(fun.ret);
    }
  }

  private exprOrVcf(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Vcf): LazyValue {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(exp);
    }
    return this.express(exp);
  }

  private express(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd): LazyValue {
    if (exp.type === 'fnd') {
      if (exp.value.length === 2) {
        const [args, ret] = exp.value;
        return {type: 'f', args, applied: [], context: this.context.snapshot(), ret};
      } else {
        const args = exp.value[0];
        return {type: 'r', args, applied: [], ret: 'struct'};
      }
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(exp.value[0]);
      const sc = exp.value[1];
      return this.doMonoOp(this.eager(left), sc);
    } else {
      const left = this.exprOrVcf(exp.value[0]);
      const op = exp.value[1];
      let right = this.exprOrVcf(exp.value[2]);
      if (op.value === '.:' || op.value === '.') {
        assert(right.type === 'vr', 'Invalid object member dereference', right);
        right = {type: 's', value: right.value};
      }
      const sc = exp.value.length === 4 ? exp.value[3] : undefined;
      const result = this.doOp(op, this.eager(left), this.eager(right));
      if (!sc) return result;
      return this.doMonoOp(this.eager(result), sc);
    }
  }

  private evalVcf(vcf: Vcf): LazyValue {
    if (vcf.type === 'vr') {
      return vcf;
    } else if (vcf.type === 'cnst') {
      if (vcf.value === 'true') {
        return {type: 'b', value: 1};
      } else if (vcf.value === 'false') {
        return {type: 'b', value: 0};
      } else if (vcf.value.startsWith('"')) {
        return {type: 's', value: vcf.value.slice(1, -1)};
      } else if (vcf.value.startsWith("'")) {
        return {type: vcf.value.length === 3 ? 'c' : 's', value: vcf.value.slice(1, -1)};
      } else if (vcf.value.includes('.')) {
        return {type: 'd', value: Number.parseFloat(vcf.value)};
      } else {
        return {type: 'i', value: Number.parseInt(vcf.value)};
      }
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.eager(this.express(c));
      checkb(cond);
      if (cond.value) {
        return this.express(y);
      } else {
        return this.express(n);
      }
    } else {
      return unreachable(vcf);
    }
  }

  private doMonoOp(val: Value, sc: Sc): LazyValue {
    assert(sc.value === ';');
    checkf(val);
    return this.callfun(val);
  }

  private doOp(op: Op, left: Value, right: Value): LazyValue {
    if (op.value === ':' || op.value === '::') {
      checkf(left);
      return this.partApply(left, right, op.value === '::');
    } else if (op.value === ',') {
      const l = ist(left) ? left.values : [left];
      const r = ist(right) ? right.values : [right];
      return {type: 't', values: l.concat(r)};
    } else if (op.value === '.' || op.value === '.:') {
      assert(op.value === '.');
      checko(left);
      checks(right);
      return left.getMember(right.value);
    } else if (op.value === '+' && iss(left)) {
      checks(right);
      return {type: 's', value: left.value + right.value};
    } else {
      checkn(left);
      checkn(right);
      return this.doNumOp(op.value, left, right);
    }
  }

  private doNumOp(op: PrimOps, left: Num, right: Num): Num {
    const type = this.doOpTypes(op, left.type, right.type);
    assert(type, `type ${left.type} cannot ${op} with type ${right.type}`);
    const value = this.doOpValues(op, left.value, right.value);
    return {type, value};
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
      default: return unreachable(op);
    }
  }

  private doOpValues(op: PrimOps, l: number, r: number): number {
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
}
/*
Todos:
Abstract roots, join and split them, shared? saver and top-level data
Parser type checking
Static type checking
lists, methods + method calls, Maybe and Either/Union types, test assertions
*/
/*


*/


