
import { assert, unreachable } from '../util/Utils';
import type { Op, Sc, NumType, StrType, Vr } from './CustomLexer';
import type { Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec } from './NearleyParser';

interface Num {
  readonly type: NumType;
  readonly value: number;
}
interface Str {
  readonly type: StrType;
  readonly value: string;
}
interface Fun {
  readonly type: 'f';
  readonly args: Vr[];
  readonly applied: Value[];
  readonly ret: Exp;
}
type Value = Num | Str | Fun;

class ExecContext {
  constructor(private readonly parent: ExecContext | undefined) {}
  private readonly vars = new Map<string, Value>();

  getVar(vr: Vr): Value {
    const v = this.vars.get(vr.value);
    if (v != null) return v;
    assert(this.parent, `Error: undefined variable ${vr.value}`);
    return this.parent.getVar(vr);
  }
  setVar(vr: Vr, val: Value) {
    checkType(vr, val);
    this.vars.set(vr.value, val);
  }
}

function checkType(vr: Vr, val: Value) {
  assert(vr.value.charAt(0) === val.type, `${vr.value} cannot be assigned a value of type ${val.type}`);
}

function checkf(val: Value): asserts val is Fun {
  assert(val.type === 'f', `${val.type} is not a function`);
}

function checks(val: Value): asserts val is Str {
  assert(val.type === 's' || val.type === 'c', `${val.type} is not stringy`);
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

class Executor {
  constructor(private readonly context: ExecContext) {}

  run(sta: Sta): string | undefined {
    const left = this.resolveReceiver(sta.value[0]);
    const right = this.express(sta.value[1]);
    this.context.setVar(left, right);
    return right.type === 'f' ? `Defined ${left.value}` : `${left.value} = ${right.value}`;
  }

  private resolveReceiver(rec: Rec): Vr {
    if (rec.type === 'vr') {
      return rec;
    }
    const cond = this.express(rec.value[0]);
    checkb(cond);
    if (cond.value) {
      return this.resolveReceiver(rec.value[1]);
    } else {
      return this.resolveReceiver(rec.value[2]);
    }
  }

  private partApply(fun: Fun, arg: Value): Fun {
    const {type, args, applied, ret} = fun;
    return {type, args, applied: applied.concat(arg), ret};
  }

  private callfun(fun: Fun): Value {
    assert(fun.args.length === fun.applied.length, `Function missing ${fun.args.length - fun.applied.length} arguments`);
    const innerContext = new ExecContext(this.context);
    for (const [i,a] of fun.applied.entries()) {
      innerContext.setVar(fun.args[i], a);
    }
    const innerExecutor = new Executor(innerContext);
    const result = innerExecutor.express(fun.ret);
    return result;
  }

  private exprOrVcf(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Vcf): Value {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(exp);
    }
    return this.express(exp);
  }

  private express(exp: Exp | Exp0 | Exp1 | Exp2 | Fnd, innerVars?: Map<string, Value>): Value {
    if (exp.type === 'fnd'){
      const [args, ret] = exp.value;
      return {type: 'f', args, applied:[], ret};
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(exp.value[0]);
      const sc = exp.value[1];
      return this.doMonoOp(left, sc);
    } else {
      const left = this.exprOrVcf(exp.value[0]);
      const right = this.exprOrVcf(exp.value[2]);
      const op = exp.value[1];
      const sc = exp.value.length === 4 ? exp.value[3] : undefined;
      const result = this.doOp(op, left, right);
      if (!sc) return result;
      return this.doMonoOp(result, sc);
    }
  }

  private evalVcf(vcf: Vcf): Value {
    if (vcf.type === 'vr') {
      return this.context.getVar(vcf);
    } else if (vcf.type === 'cnst') {
      if (vcf.value === 'true') {
        return {type: 'b', value: 1};
      } else if (vcf.value === 'false') {
        return {type: 'b', value: 0};
      } else if (vcf.value.startsWith('"')) {
        return {type: 's', value: vcf.value.slice(1,-1)};
      } else if (vcf.value.startsWith("'")) {
        return {type: vcf.value.length === 3 ? 'c' : 's', value: vcf.value.slice(1,-1)};
      } else if (vcf.value.includes('.')) {
        return {type:'d', value: Number.parseFloat(vcf.value)};
      } else {
        return {type:'i', value: Number.parseInt(vcf.value)};
      }
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.express(c);
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

  private doMonoOp(val: Value, sc: Sc): Value {
    assert(sc.value === ';');
    checkf(val);
    return this.callfun(val);
  }

  private doOp(op: Op, left: Value, right: Value): Value {
    if (op.value === ':') {
      checkf(left);
      return this.partApply(left, right);
    } else if (op.value === '+' && (left.type === 's' || left.type === 'c')) {
      checks(right);
      return {type: 's', value: left.value + right.value};
    } else {
      checkn(left);
      checkn(right);
      return this.doNumOp(op, left, right);
    }
  }

  private doNumOp(op: Op, left: Num, right: Num): Num {
    const type = this.doOpTypes(op.value, left.type, right.type);
    assert(type, `Error: type ${left.type} cannot ${op.value} with type ${right.type}`);
    const value = this.doOpValues(op.value, left.value, right.value);
    return {type, value};
  }

  private doOpTypes(op: Op['value'], l: NumType, r: NumType): NumType | undefined {
    assert(op !== ':');
    type T = NumType;

    const not = (l: T, ...ts: T[]) => ts.every(t => t !== l);
    const one = (l: T, ...ts: T[]) => ts.some(t => t === l);

    switch (op) {
      case '+':  return l === r && not(l, 'b') ? l : undefined;
      case '-':
      case '*':  return l === r && not(l, 'b') ? l : undefined;
      case '/':  return l === r && one(l, 'd') ? l : undefined;
      case '//': 
      case '%':  return l === r && one(l, 'i') ? l : undefined;
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

  private doOpValues(op: Op['value'], l: number, r: number): number {
    assert(op !== ':');
    switch (op) {
      case '+': return l+r;
      case '-': return l-r;
      case '*': return l*r;
      case '/': return l/r;
      case '//': return Math.trunc(l/r);
      case '%': return l%r;
      case '!=': return l!==r ? 1 : 0;
      case '==': return l===r ? 1 : 0;
      case '<<': return l<r ? 1 : 0;
      case '>>': return l>r ? 1 : 0;
      case '<=': return l<=r ? 1 : 0;
      case '>=': return l>=r ? 1 : 0;
      case '&&': return l&&r; 
      case '||': return l||r;
      default: return unreachable(op);  
    }
  }
}
/*
Todos:
Abstract roots, join and split them, shared? saver and top-level data
Parser type checking
Static type checking
Fix function closure context
Tuples, lists, structs + method calls, Maybe and Either/Union types, exceptions
*/
/*
fiSPooky = -> iX + iY
iX = 4
iY = 5
iZ = iX + iY * 8
dX = 4.0
dY = 5.0
dZ = dX + dY * 8.0
bC = iX >> iY
bD = iX << iY || bC
fiF = iX iY iZ -> iX + iY + iZ
iZ = fiF : 10 : iZ : 20 ;
iZ = fiSPooky;
if iZ == 10 then iX else iY endif = fiF : iZ : iZ : iZ ;
fiZ = fiSPooky
if iZ << 10 then iX else iY endif = iZ
fiX = iX -> fiZ; + iX

iX = fiX : iX-1 ;
iX = fiX : iX ; - 1
fiZ = fiX : iX-1
iX = 2 + 4*if true then 7 else 0 endif

fiFact = iN -> if iN == 0 then 1 else iN *  fiFact : iN-1 ; endif
fiFact=iN->if iN==0 then 1 else iN  *  fiFact : iN-1 : iJ+2 ; endif

fiLow = iX iY->iX-iY
fiHigh = fiLow iX iY -> fiLow:iY:iX ;
iX = fiHigh : fiLow : 3 : 4 ;

*/


