import * as React from 'react'

import '../css/program.css';
import Textarea from '../util/Textarea';
import { assert, Callback, unreachable } from '../util/Utils';
import type { Op, Sc, ValueType as PrimType, Vr } from './CustomLexer';
import type { Exp, Exp0, Exp1, Exp2, Fnd, Sta, Vcf, Rec } from './CustomParser';
import parse, { visualiseNode } from './Parser';

export default function Program(): React.ReactElement {
  const [text, setText] = React.useState('');
  const [result, setResult] = React.useState('');
  const runCode = React.useCallback(() => run(text, setResult), [text, setResult]);
  
  return <div className="program-wrapper">
    <Textarea className="program-text" value={text} onChange={setText} spellCheck={false}/>
    <div><button className="program-run" onClick={runCode}>Run</button></div>
    <div className="program-output">{result}</div>
  </div>;
}


/*--------*/

function run(code: string, callback: Callback<string>): void {
  const it = execute(code);
  const result: string[] = [];
  let r;
  do {
    r = it.next();
    result.push(r.value ?? '');
    callback(result.join('\n'));
  } while (!r.done);
}

function* execute(code: string): Generator<string, string | null, void> {
  yield 'Running ...';
  const tree = parse(code);
  yield 'Parsed ...';
  if (typeof tree === 'string') {
    yield tree;
  } else {
    const exec = new Executor();
    for (const statement of tree) {
      try {
        yield exec.run(statement);
      }
      catch (e) {
        const m = e instanceof Error ? e.message : JSON.stringify(e);
        return `${m} <- error encountered while executing ${visualiseNode(statement)}`;
      }
    }
  }
  return 'Done.';
}

interface Prim {
  readonly type: PrimType;
  readonly value: number;
}
interface Fun {
  readonly type: 'f';
  readonly args: Vr[];
  readonly applied: Value[];
  readonly ret: Exp;
}
type Value = Prim | Fun;

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
    val.type === 'f' ? checkFuncType(vr, val) : checkPrimType(vr, val);
    this.vars.set(vr.value, val);
  }
}

function checkPrimType(vr: Vr, val: Prim) {
  assert(vr.value.charAt(0) === val.type, `${vr.value} cannot be assigned a value of type ${val.type}`);
}

function checkFuncType(vr: Vr, fun: Fun) {
  assert(vr.value.charAt(0) === 'f', `${vr.value} cannot be assigned a function`);
}

function checkf(val: Value): asserts val is Fun {
  assert(val.type === 'f', `${val.type} is not a function`);
}

function checknf(val: Value): asserts val is Prim {
  assert(val.type !== 'f', `${val.type} is a function`);
}

function checkb(val: Value): asserts val is Prim {
  assert(val.type === 'b', `${val.type} is not a boolean`);
}

class Executor {
  private readonly rootContext: ExecContext = new ExecContext(undefined);

  run(sta: Sta): string {
    return this.runn(this.rootContext, sta);
  }

  private runn(context: ExecContext, sta: Sta): string {
    const left = this.resolveReceiver(context, sta.value[0]);
    const right = this.express(context, sta.value[1]);
    context.setVar(left, right);
    return right.type === 'f' ? `Defined ${left.value}` : `${left.value} = ${right.value}`;
  }

  private resolveReceiver(context: ExecContext, rec: Rec): Vr {
    if (rec.type === 'vr') {
      return rec;
    }
    const cond = this.express(context, rec.value[0]);
    checkb(cond);
    if (cond.value) {
      return this.resolveReceiver(context, rec.value[1]);
    } else {
      return this.resolveReceiver(context, rec.value[2]);
    }
  }

  private partApply(fun: Fun, arg: Value): Fun {
    const {type, args, applied, ret} = fun;
    return {type, args, applied: applied.concat(arg), ret};
  }

  private callfun(context: ExecContext, fun: Fun): Value {
    assert(fun.args.length === fun.applied.length, `Function missing ${fun.args.length - fun.applied.length} arguments`);
    const innerContext = new ExecContext(context);
    for (const [i,a] of fun.applied.entries()) {
      innerContext.setVar(fun.args[i], a);
    }
    const result = this.express(innerContext, fun.ret);
    return result;
  }

  private exprOrVcf(context: ExecContext, exp: Exp | Exp0 | Exp1 | Exp2 | Fnd | Vcf): Value {
    if (exp.type === 'ife' || exp.type === 'cnst' || exp.type === 'vr') {
      return this.evalVcf(context, exp);
    }
    return this.express(context, exp);
  }

  private express(context: ExecContext, exp: Exp | Exp0 | Exp1 | Exp2 | Fnd, innerVars?: Map<string, Value>): Value {
    if (exp.type === 'fnd'){
      const [args, ret] = exp.value;
      return {type: 'f', args, applied:[], ret};
    } else if (exp.value.length === 1) {
      return this.exprOrVcf(context, exp.value[0]);
    } else if (exp.value.length === 2) {
      const left = this.exprOrVcf(context, exp.value[0]);
      const sc = exp.value[1];
      return this.doMonoOp(context, left, sc);
    } else {
      const left = this.exprOrVcf(context, exp.value[0]);
      const right = this.exprOrVcf(context, exp.value[2]);
      const op = exp.value[1];
      const sc = exp.value.length === 4 ? exp.value[3] : undefined;
      const result = this.doOp(op, left, right);
      if (!sc) return result;
      return this.doMonoOp(context, result, sc);
    }
  }

  private evalVcf(context: ExecContext, vcf: Vcf): Value {
    if (vcf.type === 'vr') {
      return context.getVar(vcf);
    } else if (vcf.type === 'cnst') {
      if (vcf.value === 'true') {
        return {type: 'b', value: 1};
      } else if (vcf.value === 'false') {
        return {type: 'b', value: 0};
      } else if (vcf.value.includes('.')) {
        return {type:'d', value: Number.parseFloat(vcf.value)};
      } else {
        return {type:'i', value: Number.parseInt(vcf.value)};
      }
    } else if (vcf.type === 'ife') {
      const [c, y, n] = vcf.value;
      const cond = this.express(context, c);
      checkb(cond);
      if (cond.value) {
        return this.express(context, y);
      } else {
        return this.express(context, n);
      }
    } else {
      return unreachable(vcf);
    }
  }

  private doMonoOp(context: ExecContext, val: Value, sc: Sc): Value {
    assert(sc.value === ';');
    checkf(val);
    return this.callfun(context, val);
  }

  private doOp(op: Op, left: Value, right: Value): Value {
    if (op.value === ':') {
      checkf(left);
      return this.partApply(left, right);
    } else {
      checknf(left);
      checknf(right);
      return this.doPrimOp(op, left, right);
    }
  }

  private doPrimOp(op: Op, left: Prim, right: Prim): Prim {
    const type = this.doOpTypes(op.value, left.type, right.type);
    assert(type, `Error: type ${left.type} cannot ${op.value} with type ${right.type}`);
    const value = this.doOpValues(op.value, left.value, right.value);
    return {type, value};
  }

  private doOpTypes(op: Op['value'], l: PrimType, r: PrimType): PrimType | undefined {
    assert(op !== ':');
    switch (op) {
      case '+':
      case '-':
      case '*':  return l === r && l !== 'b' ? l : undefined;
      case '/':  return l === r && l === 'd' ? l : undefined;
      case '//': 
      case '%':  return l === r && l === 'i' ? l : undefined;
      case '!=':
      case '==': return l === r ? 'b' : undefined;
      case '<<':
      case '>>':
      case '<=':
      case '>=': return l === r && l !== 'b' ? 'b' : undefined;
      case '&&':
      case '||': return l === r && l === 'b' ? l : undefined;
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


