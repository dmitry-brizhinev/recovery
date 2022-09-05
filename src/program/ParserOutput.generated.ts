import type {Cl, Cnst, Nu, Op, Sc, Tc, Tp, Vr, TokenLocation, CleanToken} from "./CustomLexer";
import {Set as ISet} from 'immutable';
import type {Instruction} from "./GrammarParser";

export type Start = Sta[];
export interface Ass extends RuleOutput {type: 'ass', value: [Rec, Exp];}
export interface Ret extends RuleOutput {type: 'ret', value: [Exp];}
export interface Brk extends RuleOutput {type: 'brk', value: [];}
export interface Cnt extends RuleOutput {type: 'cnt', value: [];}
export type Bls = Ife | Dow | Wdo | For | Doo;
export type Sta = Ass | Ret | Brk | Cnt | Exp;
export type Rec = Var | Dot | Nu;
export interface Ife extends RuleOutput {type: 'ife', value: [Ifb, Ifb[], Sta[]] | [Ifb, Ifb[]];}
export interface Ifb extends RuleOutput {type: 'ifb', value: [Exp, Sta[]];}
export interface Dow extends RuleOutput {type: 'dow', value: [Sta[], Exp];}
export interface Wdo extends RuleOutput {type: 'wdo', value: [Exp, Sta[]];}
export interface For extends RuleOutput {type: 'for', value: [Var, Exp, Sta[]];}
export interface Doo extends RuleOutput {type: 'doo', value: [Sta[]];}
export type Exp = Fnd | Cnd | Ond | Exc | Exl | Exm | Arr | Exo | Dot | Vr | Cnst | Nu | Bls;
export interface Ond extends RuleOutput {type: 'ond', value: [Fnd[]];}
export interface Fnd extends RuleOutput {type: 'fnd', value: [Var[], Typ, Exp] | [Var[], Exp];}
export interface Cnd extends RuleOutput {type: 'cnd', value: [Var[], Tc];}
export interface Exc extends RuleOutput {type: 'exc', value: [Exp, Sc];}
export interface Exl extends RuleOutput {type: 'exl', value: [Exp, Cl, Exp];}
export interface Arr extends RuleOutput {type: 'arr', value: [Arr, Exp] | [Exp] | [];}
export interface Exm extends RuleOutput {type: 'exm', value: [Exm, Exp] | [Exp];}
export interface Exo extends RuleOutput {type: 'exo', value: [Exp, Op, Exp];}
export interface Dot extends RuleOutput {type: 'dot', value: [Exp, Vr] | [Exp, Cnst];}
export type Typ = Ftp | Ttp | Atp | Tc | Tp | Mtp;
export interface Mtp extends RuleOutput {type: 'mtp', value: [Typ];}
export interface Ttp extends RuleOutput {type: 'ttp', value: [Typ] | [Ttp, Typ];}
export interface Atp extends RuleOutput {type: 'atp', value: [Typ];}
export interface Ftp extends RuleOutput {type: 'ftp', value: [Ftpo[]];}
export interface Ftpo extends RuleOutput {type: 'ftpo', value: [Typ] | [Typ[], Typ];}
export interface Var extends RuleOutput {type: 'var', value: [Vr] | [Vr, Typ];}

export const renames = {ass: 'ass', ret: 'ret', brk: 'brk', cnt: 'cnt', ife: 'ife', ifb: 'ifb', dow: 'dow', wdo: 'wdo', for: 'for', doo: 'doo', ond: 'ond', fnd: 'fnd', cnd: 'cnd', exc2: 'exc', exc1: 'exc', exc0: 'exc', exl2: 'exl', exl1: 'exl', exl0: 'exl', ars2: 'arr', ars1: 'arr', ars0: 'arr', arre: 'arr', exm2: 'exm', exm1: 'exm', exm0: 'exm', exo2: 'exo', exo1: 'exo', exo0: 'exo', dot: 'dot', mtp: 'mtp', ttp: 'ttp', atp: 'atp', ftp: 'ftp', ftpo: 'ftpo', var: 'var'} as const;
export type RenamedParserName = keyof typeof renames;
export type FinalParserName = typeof renames[RenamedParserName];
export const RenamedParserNames = ISet<string>(Object.keys(renames));
export const FinalParserNames = ISet<string>(Object.values(renames));
const FilteredParserNames_ = ['doc', 'mnl', 'wnl', 'bls', 'sta', 'sep', 'rec', 'eob', 'blo', 'ifl', 'ifn', 'exp', 'old', 'olds', 'exa2', 'emo2', 'emo1', 'emo0', 'exa1', 'exa0', 'dott', 'vcf', 'mws', 'ws', 'sc2', 'sc1', 'sc0', 'op2', 'op1', 'op0', 'cm2', 'cm1', 'cm0', 'cl2', 'cl1', 'cl0', 'typ', 'ftps', 'tps', 'tcl', 'vrl'] as const;
export type FilteredParserName = typeof FilteredParserNames_[number];
export const FilteredParserNames = ISet<string>(FilteredParserNames_);
export type DirtyParserName = RenamedParserName | FilteredParserName;
export const instructions: {[key in DirtyParserName]: Instruction} = {doc: 'fu', mnl: 'd', wnl: 'd', ass: 'fl', ret: 'fl', brk: 'fl', cnt: 'fl', bls: 'fu', sta: 'fu', sep: 'd', rec: 'fu', eob: 'fu', blo: 'ff', ife: 'fl', ifl: 'fu', ifn: 'ff', ifb: 'fl', dow: 'fl', wdo: 'fl', for: 'fl', doo: 'fl', exp: 'fu', old: 'fu', olds: 'ff', ond: 'fl', fnd: 'fl', cnd: 'fl', exa2: 'fu', exc2: 'fm', exc1: 'fm', exc0: 'fm', exl2: 'fm', exl1: 'fm', exl0: 'fm', emo2: 'fu', emo1: 'fu', emo0: 'fu', ars2: 'fl', ars1: 'fl', ars0: 'fl', arre: 'fl', exm2: 'fl', exm1: 'fl', exm0: 'fl', exo2: 'fm', exo1: 'fm', exo0: 'fm', exa1: 'fu', exa0: 'fu', dott: 'fu', dot: 'fl', vcf: 'fu', mws: 'd', ws: 'd', sc2: 'fu', sc1: 'fu', sc0: 'fu', op2: 'fu', op1: 'fu', op0: 'fu', cm2: 'd', cm1: 'd', cm0: 'd', cl2: 'fu', cl1: 'fu', cl0: 'fu', typ: 'fu', mtp: 'fl', ttp: 'fl', atp: 'fl', ftp: 'fl', ftps: 'ff', ftpo: 'fl', tps: 'ff', tcl: 'd', var: 'fl', vrl: 'ff'};

export interface WLoc {loc: TokenLocation | null;}
export interface RuleOutput extends WLoc {type: FinalParserName, value: Outputs[];}
export type FlatOutput = Outputs[];
export type Outputs = RuleOutput | FlatOutput | CleanToken;

