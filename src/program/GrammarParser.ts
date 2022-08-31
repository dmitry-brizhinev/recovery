import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, throwIfNull, unreachable} from "../util/Utils";
import {OrderedMap, OrderedSet, List, type ValueObject, hash} from 'immutable';
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
  constructor(value: string) {
    super('rule', value);
  }
}

type Rule = List<Symbol>;
type Rules = OrderedSet<Rule>;

type Post = {inst: 'd' | 'ff' | 'fl' | 'fu' | 'fm';} | {repl: Symbol;};
type Posts = Map<string, Post>;
type AllRules = OrderedMap<string, Rules>;
type Parsed = {allRules: AllRules, posts: Posts;};

function parseSymbol(t: string): Symbol | undefined {
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
  return new RuleSymbol(t);
}

function parseGrammarInner(grammar: string): Parsed {
  const result: [string, Rules][] = [];
  const posts = new Map<string, Post>();
  let start = '';
  for (const gg of grammar.trim().split('\n')) {
    const g = gg.split(/[#@]/)[0].trim();
    if (g.length === 0) continue;
    const gs = g.split(/ +-> +/);
    assert(gs.length === 2, g);
    const [name, ruless] = gs;
    const post = /#(...?.?):(d|ff|fm|fl|fu)/.exec(gg);
    assert(post, `Missing instructions comment for ${name}`);
    assert(post[1] === name, `Wrong instructions name ${post[1]} for ${name}`);
    posts.set(name, {inst: post[2]} as Post);
    if (!start) start = name;
    const rules = ruless.split(/ +\| +/);
    assert(rules.length >= 1, g);
    const parsedRules = [];
    for (const rule of rules) {
      const tokens = rule.split(/ +/);
      assert(tokens.length >= 1, g);
      const symbols = List(tokens.filter(t => t !== 'null').map(parseSymbol).flatMap(s => s ? [s] : []));
      parsedRules.push(symbols);
      //const postprocess = getPostprocessor(name, rule);
      //result.ParserRules.push({name, symbols, postprocess});
    }
    result.push([name, OrderedSet(parsedRules)]);
  }
  return {allRules: OrderedMap(result), posts};
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

function filterAll(posts: Posts, allRules: AllRules): AllRules {
  let changed2 = false;
  do {
    let changed = false;
    allRules = allRules.filter((_rules, name) => {
      const p = posts.get(name);
      assert(p);
      const keep = ('inst' in p) && p.inst !== 'd';
      if (!keep) changed = true;
      return keep;
    }).map((rules, name) => {
      const newRules: Rules = rules.map(rule => rule.flatMap((s: Symbol): Symbol[] => {
        if (s.type === 'token') return [s];
        const p = posts.get(s.value);
        assert(p);
        if ('repl' in p) {
          changed = true;
          return [p.repl];
        }
        if (p.inst === 'd') {
          changed = true;
          return [];
        }
        return [s];
      }));
      if (newRules.size === 1 && newRules.first()?.size === 1) {
        const p = posts.get(name);
        assert(p);
        if ('inst' in p && p.inst === 'fu') {
          changed = true;
          posts.set(name, {repl: throwIfNull(newRules.first()?.first())});
        }
      }
      return newRules;
    });
    changed2 = changed;
  } while (changed2);
  return allRules;
}

export default function parseGrammar(grammar: string): string {
  const {allRules, posts} = parseGrammarInner(grammar);
  const filteredRules = filterAll(posts, allRules);
  const result = [];
  for (const [name, rules] of filteredRules) {
    const post = posts.get(name);
    assert(post);
    assert('inst' in post);
    assert(post.inst !== 'd');

    const start = `export type ${capitalise(name)} = `;

    let middle;
    if (post.inst === 'fu') {
      middle = rules.map(fu).join(' | ');
    } else if (post.inst === 'fl') {
      middle = `{type: '${name}', value: ${rules.map(fl).join(' | ')}}`;
    } else if (post.inst === 'fm') {
      const options = rules.filter(r => r.size === 1).map(fu).add(
        `{type: '${name}', value: ${rules.filter(r => r.size !== 1).map(fl).join(' | ')}}`);
      middle = options.join(' | ');
    } else if (post.inst === 'ff') {
      let options = OrderedSet<Symbol>();
      for (const rule of rules) {
        for (const symbol of rule) {
          if ((symbol.type === 'rule') && symbol.value === name) continue;
          options = options.add(symbol);
        }
      }
      const opts = options.map(r => r.pretty());
      middle = opts.size === 1 ? `${opts.join('')}[]` : `(${opts.join(' | ')})[]`;
    } else {
      unreachable(post.inst);
    }

    result.push(start + middle + ';');
  }
  return result.join('\n');
}
