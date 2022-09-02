import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, throwIfNull, unreachable} from "../util/Utils";
import {OrderedMap, OrderedSet, Set as ISet, List, type ValueObject, hash} from 'immutable';

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

export type Instruction = 'd' | 'ff' | 'fl' | 'fu' | 'fm';
type Rule = List<Symbol>;
type Rules = OrderedSet<Rule>;
type AllRules = OrderedMap<RuleSymbol, Rules>;

export type ParsedSymbol = {rule: string;} | {token: DirtyLexerName;} | {literal: string;};
function parseSymbol(t: string): ParsedSymbol {
  if (t.startsWith('%')) {
    return {token: checkLexerName(t.substring(1))};
  } else if (t.startsWith('"') && t.endsWith('"')) {
    const literal = t.substring(1, t.length - 1);
    return {literal};
  }
  return {rule: t};
}

function filterSymbol(ruleNames: Map<string, RuleSymbol>, t: ParsedSymbol): [Symbol] | [] {
  if ('rule' in t) {
    const symbol = ruleNames.get(t.rule);
    assert(symbol);
    if (symbol.instruction === 'd') return [];
    return [symbol];
  }
  let token: DirtyLexerName | undefined;
  if ('token' in t) {
    token = t.token;
  } else {
    for (const [k, v] of Object.entries(literalLookup)) {
      if (v.includes(t.literal)) token = checkLexerName(k);
    }
    assert(token, `Unknown lexer literal ${t.literal}`);
  }
  if (FilteredLexerNames.has(token)) return [];
  return [new TokenSymbol(token)];
}

interface Line {
  name: string;
  rules: ParsedSymbol[][];
  rename: string;
  instruction: Instruction;
}

function parseLine(line: string): [Line] | [] {
  const g = line.split(/[#@]/)[0].trim();
  if (g.length === 0) return [];
  const gs = g.split(/ +-> +/);
  assert(gs.length === 2, g);
  const [name, ruless] = gs;
  const rules = ruless.split(/ +\| +/).map(rule => rule.split(/ +/).filter(t => t !== 'null').map(parseSymbol));
  assert(rules.length >= 1, g);

  const post = /#(...?.?):(d|ff|fm|fl|fu)/.exec(line);
  assert(post, `Missing instructions comment for ${name}`);
  const rename = post[1];
  const instruction = post[2] as Instruction;
  assert(name.slice(0, 2) === rename.slice(0, 2), `Wrong instructions name ${rename} for ${name}`);
  if (instruction === 'fm') assert(rename.endsWith('_'), `${rename}:fm needs to end with underscore`);

  return [{name, rules, rename, instruction}];
}

export function splitGrammar(grammar: string): Line[] {
  return grammar.trim().split('\n').flatMap(parseLine);
}

function parseGrammarInner(grammar: string): AllRules {
  const lines = splitGrammar(grammar);
  const instMap = new Map<string, ISet<Instruction>>();
  const nameMap = new Map<string, ISet<string>>();
  let first: string | undefined;
  for (const line of lines) {
    const {name, rename, instruction} = line;
    assert(name.toLowerCase() !== 'start', `Banned rule name ${name}`);
    assert(rename.toLowerCase() !== 'start', `Banned rule name ${rename}`);
    assert(rename === rename.toLowerCase(), `${rename} is not lowercase`);
    assert(name === name.toLowerCase(), `${name} is not lowercase`);
    first = first || rename;
    const s = (instMap.get(rename) || ISet()).add(instruction);
    assert(s.size === 1, `Conflicting instructions for ${rename}`);
    instMap.set(rename, s);

    const n = nameMap.get(rename) || ISet();
    assert(!n.has(name), `Duplicate rule for ${name}`);
    nameMap.set(rename, n.add(name));
  }
  assert(first, 'No rules');
  const ruleNames = new Map<string, RuleSymbol>();
  for (const [rename, inst] of instMap) {
    const instruction = inst.first();
    assert(instruction);
    assert(rename.endsWith('_') === (instruction === 'fm'), `${rename}:${instruction} violates 'underscore iff fm'`);
    const names = nameMap.get(rename)?.toList();
    assert(names);
    const symbol = new RuleSymbol(rename, instruction === 'fm' ? List() : names, instruction);
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
  const filterSymboll = filterSymbol.bind(null, ruleNames);

  const firstSymbol = ruleNames.get(first);
  assert(firstSymbol);
  const startRule = List([firstSymbol]);

  let result = OrderedMap<RuleSymbol, Rules>([[new RuleSymbol('start', List(['start']), 'fl'), OrderedSet<Rule>([startRule])]]);
  for (const line of lines) {
    const name = ruleNames.get(line.name);
    assert(name);
    if (name.instruction === 'd') {
      result = result.set(name, OrderedSet<Rule>());
      continue;
    }

    const parsedRules = [];
    const fmMainRules = [];
    for (const rule of line.rules) {
      const symbols = List(rule.flatMap(filterSymboll));
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
    const mapped = mapSymbols(filteredRules, replace);
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

function mapSymbols(allRules: AllRules, m: (s: Symbol) => Symbol): AllRules {
  return allRules.map(rules => rules.map(rule => rule.map(m)));
}

function forEachSymbol(allRules: AllRules, m: (s: Symbol) => void) {
  allRules.forEach(rules => rules.forEach(rule => rule.forEach(m)));
}

function filterAll(allRules: AllRules): AllRules {
  allRules = allRules.filter((_rules, name) => name.instruction !== 'd');
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
  allRules = mapSymbols(allRules, s => {
    while (s.type === 'rule' && s.instruction instanceof SymbolBase) {
      //assert(!p.equals(s), `p=s: ${name.value}, ${p.value}, ${s.value}`);
      s = s.instruction;
    }
    return s;
  });

  return allRules;
}

export function generateTypesFrom(grammar: string): string {
  const allRules = parseGrammarInner(grammar);

  const rul = allRules.keySeq().filterNot(r => r.value === 'start');
  const filteredNames = rul.filterNot(r => r.instruction === 'fl').flatMap(r => r.names);
  // const cleanNames = rul.filter(r => r.instruction === 'fl').flatMap(r => r.names);
  const renames = rul.filter(r => r.instruction === 'fl').flatMap(r => r.names.map(n => `${n}: '${r.value.toLowerCase()}'`));
  const fms = rul.filter(r => r.value.endsWith('_')).map(r => capitalise(r.value.slice(0, r.value.length - 1))).toSet();
  const fixInstruction = (i: Instruction | Symbol) => i instanceof SymbolBase ? 'fu' : i;
  const instructions = rul.filterNot(r => r.value.endsWith('_'))
    .map(r => ({i: (fms.has(r.value) ? 'fm' : fixInstruction(r.instruction)), n: r.names}))
    .flatMap(({i, n}) => n.map<string>(n => `${n}: '${i}'`));

  const filteredRules = filterAll(allRules);
  const collapsedRules = collapseLoops(filteredRules);

  const lex = new Set<string>();
  forEachSymbol(collapsedRules, symbol => {symbol instanceof TokenSymbol && lex.add(symbol.pretty());});
  const lexx = [...lex].sort().join(', ');
  const imports = `import type {${lexx}} from "./CustomLexer";`;
  const imports2 = `import {Set as ISet} from 'immutable';`;
  const imports3 = `import type {Instruction} from "./GrammarParser";`;

  const result = [imports, imports2, imports3];
  for (const [name, rules] of collapsedRules) {
    const post = name.instruction;
    assert(post !== 'd', 'post = d', name.value);
    assert(!(post instanceof SymbolBase), 'post is Symbol', name.value);

    const start = `export type ${capitalise(name.value)} = `;

    let middle;
    if (post === 'fu' || post === 'fm' || name.value === 'start') {
      for (const r of rules) assert(r.size === 1, `fu on a long rule ${name.value} ${r.map(s => s.value).join(';')}`);
      middle = rules.map(fu).join(' | ');
    } else if (post === 'fl') {
      middle = `{type: '${name.value.toLowerCase()}', value: ${rules.map(fl).join(' | ')};}`;
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

  result.push(`export const renames = {${renames.join(', ')}} as const;`);
  result.push(`export type RenamedParserName = keyof typeof renames;`);
  result.push(`export type FinalParserName = typeof renames[RenamedParserName];`);
  result.push(`export const RenamedParserNames = ISet<string>(Object.keys(renames));`);
  result.push(`export const FinalParserNames = ISet<string>(Object.values(renames));`);
  //result.push(`const ParserNames_ = ['${cleanNames.join(`', '`)}'] as const;`);
  //result.push(`export const ParserNames = ISet<string>(ParserNames_);`);
  result.push(`const FilteredParserNames_ = ['${filteredNames.join(`', '`)}'] as const;`);
  result.push(`export type FilteredParserName = typeof FilteredParserNames_[number];`);
  result.push(`export const FilteredParserNames = ISet<string>(FilteredParserNames_);`);
  result.push(`export type DirtyParserName = RenamedParserName | FilteredParserName;`);
  result.push(`export const instructions: {[key in DirtyParserName]: Instruction} = {${instructions.join(', ')}};`);

  return result.join('\n');
}
