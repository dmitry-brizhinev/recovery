import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, unreachable} from "../util/Utils";
import {OrderedMap} from 'immutable';
//import grammarPath from './grammar.ne';

type Symbol = {token: DirtyLexerName;} | {rule: string;};
type Rule = Symbol[];

type Post = 'd' | 'ff' | 'fl' | 'fu' | 'fm';
type Posts = Map<string, Post>;
type Parsed = {allRules: OrderedMap<string, Rule[]>, posts: Posts;};

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
    return {token: checkLexerName(token)};

  }
  return {rule: t};
}

function parseGrammarInner(grammar: string): Parsed {
  const result: [string, Rule[]][] = [];
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
    posts.set(name, post[2] as Post);
    if (!start) start = name;
    const rules = ruless.split(/ +\| +/);
    assert(rules.length >= 1, g);
    const parsedRules = [];
    for (const rule of rules) {
      const tokens = rule.split(/ +/);
      assert(tokens.length >= 1, g);
      const symbols = tokens.filter(t => t !== 'null').map(parseSymbol).flatMap(s => s ? [s] : []);
      parsedRules.push(symbols);
      //const postprocess = getPostprocessor(name, rule);
      //result.ParserRules.push({name, symbols, postprocess});
    }
    result.push([name, parsedRules]);
  }
  return {allRules: OrderedMap(result), posts};
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettySymbol(e: Symbol): string {
  if ('token' in e) return capitalise(e.token);
  return capitalise(e.rule);
}

function fu(rule: Rule): string {
  assert(rule.length, 'fu on an empty rule');
  assert(rule.length === 1, 'fu on a long rule');
  return prettySymbol(rule[0]);
}

function fl(rule: Rule): string {
  if (!rule.length) return '[]';
  if (rule.length === 1) {
    return `[${prettySymbol(rule[0])}]`;
  }
  return `[${rule.map(prettySymbol).join(', ')}]`;
}

export default function parseGrammar(grammar: string): string {
  const {allRules, posts} = parseGrammarInner(grammar);

  const result = [];
  for (const [name, dirtyRules] of allRules) {
    const post = posts.get(name);
    assert(post, 'Missing post for', name);
    if (post === 'd') continue;

    const rules = dirtyRules.map(rs => rs.filter(s => ('token' in s) || posts.get(s.rule) !== 'd'));
    const start = `export type ${capitalise(name)} = `;

    let middle;
    if (post === 'fu') {
      middle = rules.map(fu).join(' | ');
    } else if (post === 'fl') {
      middle = `{type: '${name}', value: ${rules.map(fl).join(' | ')}}`;
    } else if (post === 'fm') {
      const options = rules.filter(r => r.length === 1).map(fu).concat(
        `{type: '${name}', value: ${rules.filter(r => r.length !== 1).map(fl).join(' | ')}}`);
      middle = options.join(' | ');
    } else if (post === 'ff') {
      const options = [];
      for (const rule of rules) {
        for (const symbol of rule) {
          if (('rule' in symbol) && symbol.rule === name) continue;
          options.push(symbol);
        }
      }
      middle = `(${options.map(prettySymbol).join(' | ')})[]`;
    } else {
      unreachable(post);
    }

    result.push(start + middle + ';');
  }
  return result.join('\n');
}
