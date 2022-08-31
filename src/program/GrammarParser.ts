import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, throwIfNull, unreachable} from "../util/Utils";
import {OrderedMap, OrderedSet, Set as ISet, List, type ValueObject, hash} from 'immutable';
//import grammarPath from './grammar.ne';

class Symbol implements ValueObject {
  protected constructor(
    readonly type: 'token' | 'rule',
    readonly value: string) {} // DirtyLexerName | string

  equals(that: Symbol): boolean {
    return this.value === that.value;
  }

  hashCode(): number {
    return hash(this.value);
  }

  pretty(): string {
    return capitalise(this.value);
  }
}

class TokenSymbol extends Symbol {
  constructor(value: DirtyLexerName) {
    super('token', value);
  }
}

class RuleSymbol extends Symbol {
  constructor(value: string, readonly names: List<string>, public instruction: Instruction | Symbol) {
    super('rule', value);
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
  return throwIfNull(ruleNames.get(t));
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
  let result = OrderedMap<RuleSymbol, Rules>();
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
  }
  const parseSymboll = parseSymbol.bind(null, ruleNames);

  for (const line of lines) {
    const parsedRules = [];
    for (const rule of line.rules) {
      const symbols = List(rule.filter(t => t !== 'null').map(parseSymboll).flatMap(s => s ? [s] : []));
      parsedRules.push(symbols);
      //const postprocess = getPostprocessor(name, rule);
      //result.ParserRules.push({name, symbols, postprocess});
    }
    const symbol = throwIfNull(ruleNames.get(line.name));
    result = result.set(symbol, result.get(symbol, OrderedSet<Rule>()).concat(parsedRules));
  }
  return OrderedMap(result);
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

function filterAll(allRules: AllRules): AllRules {
  let changed2 = false;
  let count = 0;
  do {
    count += 1;
    assert(count < 100);
    let changed = false;
    allRules = allRules.filter((_rules, name) => {
      const keep = !(name.instruction instanceof Symbol) && name.instruction !== 'd';
      if (!keep) changed = true;
      return keep;
    }).map((rules, name) => {
      const newRules: Rules = rules.map(rule => rule.flatMap((s: Symbol): Symbol[] => {
        if (s.type === 'token') return [s];
        const p = (s as RuleSymbol).instruction;
        if (p instanceof Symbol) {
          assert(!p.equals(s), `p=s: ${name.value}, ${p.value}, ${s.value}`);
          changed = true;
          return [p];
        }
        if (p === 'd') {
          changed = true;
          return [];
        }
        return [s];
      }));
      if (newRules.size === 1 && newRules.first()?.size === 1) {
        if (name.instruction === 'fu') {
          changed = true;
          const repl = throwIfNull(newRules.first()?.first());
          name.instruction = repl;
        }
      }
      return newRules;
    });
    changed2 = changed;
  } while (changed2);
  return allRules;
}

export default function parseGrammar(grammar: string): string {
  const allRules = parseGrammarInner(grammar);
  const filteredRules = filterAll(allRules);
  const result = [];
  for (const [name, rules] of filteredRules) {
    const post = name.instruction;
    assert(post !== 'd', 'post = d', name.value);
    assert(!(post instanceof Symbol), 'post is Symbol', name.value);

    const start = `export type ${capitalise(name.value)} = `;

    let middle;
    if (post === 'fu') {
      for (const r of rules) assert(r.size === 1, `fu on a long rule ${name.value} ${r.map(s => s.value).join(';')}`);
      middle = rules.map(fu).join(' | ');
    } else if (post === 'fl') {
      middle = `{type: '${name.names.join(`' | '`)}', value: ${rules.map(fl).join(' | ')}}`;
    } else if (post === 'fm') {
      const short = capitalise(name.value.slice(0, name.value.length - 1));
      assert(name.value.endsWith('_'), 'Non underscore fm', name.value);
      const options = rules.filter(r => r.size === 1).map(fu).add(short).join(' | ');
      const other = `{type: '${name.names.join(`' | '`)}', value: ${rules.filter(r => r.size !== 1).map(fl).join(' | ')}}`;
      middle = `${options};\nexport type ${short} = ${other}`;
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
