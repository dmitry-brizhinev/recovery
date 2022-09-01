import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, throwIfNull, unreachable} from "../util/Utils";
import {OrderedMap, OrderedSet, Set as ISet, List, type ValueObject, hash} from 'immutable';
//import grammarPath from './grammar.ne';

class SymbolBase implements ValueObject {
  protected constructor(
    readonly value: string) {} // DirtyLexerName | string

  equals(that: SymbolBase): boolean {
    return this.value === that.value;
  }

  hashCode(): number {
    return hash(this.value);
  }

  pretty(): string {
    return capitalise(this.value);
  }
}

type Symbol = TokenSymbol | RuleSymbol;

class TokenSymbol extends SymbolBase {
  readonly type = 'token';
  constructor(value: DirtyLexerName) {
    super(value);
  }
}

class RuleSymbol extends SymbolBase {
  readonly type = 'rule';
  constructor(value: string, readonly names: List<string>, public instruction: Instruction | Symbol) {
    super(value);
  }
}

type Rule = List<Symbol>;
type Rules = OrderedSet<Rule>;

type Instruction = 'd' | 'ff' | 'fl' | 'fu' | 'fm';
//type Post = {inst: Instruction;} | {repl: Symbol;};
//type Posts = Map<string, Post>;
type AllRules = OrderedMap<RuleSymbol, Rules>;
//type Parsed = {allRules: AllRules, posts: Posts;};

function parseSymbol(ruleNames: Map<string, RuleSymbol>, t: string): Symbol | undefined {
  let token = '';
  if (t.startsWith('%')) {
    token = t.substring(1);
  } else if (t.startsWith('"') && t.endsWith('"')) {
    const value = t.substring(1, t.length - 1);
    for (const [k, v] of Object.entries(literalLookup)) {
      if (v.includes(value)) token = k;
    }
    assert(token, `Unknown lexer literal ${value}`);
  }
  if (token) {
    if (FilteredLexerNames.includes(token as any)) return undefined;
    return new TokenSymbol(checkLexerName(token));

  }
  const symbol = ruleNames.get(t);
  assert(symbol);
  if (symbol.instruction === 'd') return undefined;
  return symbol;
}

interface Line {
  name: string;
  rules: string[][];
  rename: string;
  instruction: Instruction;
}

function parseLine(line: string): [Line] | [] {
  const g = line.split(/[#@]/)[0].trim();
  if (g.length === 0) return [];
  const gs = g.split(/ +-> +/);
  assert(gs.length === 2, g);
  const [name, ruless] = gs;
  const rules = ruless.split(/ +\| +/).map(rule => rule.split(/ +/));
  assert(rules.length >= 1, g);
  for (const rule of rules) {
    assert(rule.length >= 1, g);
  }

  const post = /#(...?.?):(d|ff|fm|fl|fu)/.exec(line);
  assert(post, `Missing instructions comment for ${name}`);
  const rename = post[1];
  const instruction = post[2] as Instruction;
  assert(name.slice(0, 2) === rename.slice(0, 2), `Wrong instructions name ${rename} for ${name}`);
  if (instruction === 'fm') assert(rename.endsWith('_'), `${rename}:fm needs to end with underscore`);

  return [{name, rules, rename, instruction}];
}

function parseGrammarInner(grammar: string): AllRules {
  const lines = grammar.trim().split('\n').flatMap(parseLine);
  const instMap = new Map<string, ISet<Instruction>>();
  const nameMap = new Map<string, ISet<string>>();
  for (const line of lines) {
    const {name, rename, instruction} = line;
    const s = (instMap.get(rename) || ISet()).add(instruction);
    assert(s.size === 1, `Conflicting instructions for ${rename}`);
    instMap.set(rename, s);

    const n = nameMap.get(rename) || ISet();
    assert(!n.has(name), `Duplicate rule for ${name}`);
    nameMap.set(rename, n.add(name));
  }
  const ruleNames = new Map<string, RuleSymbol>();
  for (const [rename, inst] of instMap) {
    const instruction = inst.first();
    assert(instruction);
    const names = nameMap.get(rename)?.toList();
    assert(names);
    const symbol = new RuleSymbol(rename, names, instruction);
    ruleNames.set(rename, symbol);
    for (const name of names) {
      ruleNames.set(name, symbol);
    }
    if (instruction === 'fm') {
      const fmName = capitalise(rename.slice(0, rename.length - 1));
      assert(!ruleNames.has(fmName), `Already have fmName ${fmName}`);
      ruleNames.set(fmName, new RuleSymbol(fmName, names, 'fl'));
    }
  }
  const parseSymboll = parseSymbol.bind(null, ruleNames);

  let result = OrderedMap<RuleSymbol, Rules>();
  for (const line of lines) {
    const name = ruleNames.get(line.name);
    assert(name);
    if (name.instruction === 'd') continue;

    const parsedRules = [];
    const fmMainRules = [];
    for (const rule of line.rules) {
      const symbols = List(rule.filter(t => t !== 'null').map(parseSymboll).flatMap(s => s ? [s] : []));
      if (name.instruction === 'fm' && symbols.size !== 1) {
        fmMainRules.push(symbols);
      } else {
        parsedRules.push(symbols);
      }
      //const postprocess = getPostprocessor(name, rule);
      //result.ParserRules.push({name, symbols, postprocess});
    }
    if (name.instruction === 'fm') {
      const fmRawName = capitalise(name.value.slice(0, name.value.length - 1));
      const fmName = ruleNames.get(fmRawName);
      assert(fmName, `Missing fmName ${fmRawName}`);
      parsedRules.push(List<Symbol>([fmName]));

      result = result.set(fmName, result.get(fmName, OrderedSet<Rule>()).concat(fmMainRules));
    }
    result = result.set(name, result.get(name, OrderedSet<Rule>()).concat(parsedRules));
  }
  return result;
}

function recurse(trimmed: OrderedMap<RuleSymbol, List<RuleSymbol>>, ancestors: OrderedSet<RuleSymbol>, current: RuleSymbol): OrderedSet<RuleSymbol> | undefined {
  if (ancestors.contains(current)) return ancestors.skipUntil(s => s.equals(current));
  const newAncestors = ancestors.add(current);
  for (const descendant of trimmed.get(current, List<RuleSymbol>())) {
    const result = recurse(trimmed, newAncestors, descendant);
    if (result) return result;
  }
  return undefined;
}

function searchForLoops(filteredRules: AllRules): OrderedSet<RuleSymbol> | undefined {
  let trimmed = OrderedMap<RuleSymbol, List<RuleSymbol>>();
  for (const [name, rules] of filteredRules) {
    if (name.instruction === 'ff' || name.instruction === 'fl') continue;
    if (name.instruction === 'd' || name.instruction instanceof SymbolBase) {assert(false, 'invalid filtered instruction'); continue;}
    const children = [];
    for (const rule of rules) {
      assert(rule.size === 1, 'Non single fu or fm', name.value);
      const repl = rule.first();
      assert(repl);
      if (repl.type === 'token') continue;
      if (repl.instruction === 'ff' || repl.instruction === 'fl') continue;
      children.push(repl);
    }
    trimmed = trimmed.set(name, List(children));
  }

  for (const [name] of trimmed) {
    const result = recurse(trimmed, OrderedSet(), name);
    if (result) return result;
  }
  return undefined;
}

function collapseLoops(filteredRules: AllRules): AllRules {
  let result: OrderedSet<RuleSymbol> | undefined;
  while ((result = searchForLoops(filteredRules)) != null) {
    //console.log('filtering', result.map(r => r.pretty()).toArray());
    const repl = result.first();
    const thisResult = result;
    assert(repl);
    const replaceR = (s: RuleSymbol) => thisResult.has(s) ? repl : s;
    const replace = (s: Symbol) => s.type === 'rule' && thisResult.has(s) ? repl : s;
    const mapped = mapInner(filteredRules, replace);
    const groups = mapped.groupBy((_rules, name) => replaceR(name));
    const flat = groups.map(rulesG => rulesG.valueSeq().flatMap(rules => rules).toOrderedSet());
    filteredRules = flat.map((rules, name) => rules.filterNot(rule => rule.size === 1 && name.equals(rule.first()))).toOrderedMap();

  }
  return filteredRules;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fu(rule: Rule): string {
  assert(rule.size, 'fu on an empty rule');
  assert(rule.size === 1, 'fu on a long rule');
  return throwIfNull(rule.get(0)).pretty();
}

function fl(rule: Rule): string {
  if (!rule.size) return '[]';
  if (rule.size === 1) {
    return `[${throwIfNull(rule.get(0)).pretty()}]`;
  }
  return `[${rule.map(r => r.pretty()).join(', ')}]`;
}

function mapInner(allRules: AllRules, m: (s: Symbol) => Symbol): AllRules {
  return allRules.map(rules => rules.map(rule => rule.map(m)));
}

function filterAll(allRules: AllRules): AllRules {
  //allRules = allRules.filter((_rules, name) => name.instruction !== 'd');
  //allRules = allRules.map(rules => rules.map(rule => rule.filter(s =>
  //  s.type === 'token' || s.instruction !== 'd'
  //)));
  allRules = allRules.filter((rules, name) => {
    if (rules.size === 1 && rules.first()?.size === 1) {
      if (name.instruction === 'fu' || name.instruction === 'fm') {
        const repl = rules.first()?.first();
        assert(repl);
        name.instruction = repl;
        return false;
      }
    }
    return true;
  });
  allRules = mapInner(allRules, s => {
    while (s.type === 'rule' && s.instruction instanceof SymbolBase) {
      //assert(!p.equals(s), `p=s: ${name.value}, ${p.value}, ${s.value}`);
      s = s.instruction;
    }
    return s;
  });

  return allRules;
}

export default function parseGrammar(grammar: string): string {
  const allRules = parseGrammarInner(grammar);
  const filteredRules = filterAll(allRules);
  const collapsedRules = collapseLoops(filteredRules);
  const result = [];
  for (const [name, rules] of collapsedRules) {
    const post = name.instruction;
    assert(post !== 'd', 'post = d', name.value);
    assert(!(post instanceof SymbolBase), 'post is Symbol', name.value);

    const start = `export type ${capitalise(name.value)} = `;

    let middle;
    if (post === 'fu' || post === 'fm') {
      for (const r of rules) assert(r.size === 1, `fu on a long rule ${name.value} ${r.map(s => s.value).join(';')}`);
      middle = rules.map(fu).join(' | ');
    } else if (post === 'fl') {
      middle = `{type: '${name.names.join(`' | '`)}', value: ${rules.map(fl).join(' | ')}}`;
    } else if (post === 'ff') {
      let options = OrderedSet<Symbol>();
      for (const rule of rules) {
        for (const symbol of rule) {
          if (symbol.equals(name)) continue;
          options = options.add(symbol);
        }
      }
      const opts = options.map(r => r.pretty());
      middle = opts.size === 1 ? `${opts.join('')}[]` : `(${opts.join(' | ')})[]`;
    } else {
      unreachable(post);
    }

    result.push(start + middle + ';');
  }
  return result.join('\n');
}
